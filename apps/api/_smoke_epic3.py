"""EPIC 3 (US-9..US-12) carpet pickup smoke test — runs inside api container."""
import sys
import httpx

BASE = "http://127.0.0.1:8000"
DEMO = "+12125550147"  # has super_admin + driver


def login(role):
    c = httpx.Client(base_url=BASE, timeout=30)
    code = c.post("/api/v1/auth/otp/request", json={"phone": DEMO}).json()["dev_code"]
    tok = c.post("/api/v1/auth/otp/verify", json={"phone": DEMO, "code": code}).json()["session_token"]
    acc = c.post("/api/v1/auth/role/select", json={"role_slug": role},
                 headers={"X-Session-Token": tok}).json()["tokens"]["access_token"]
    c.headers.update({"Authorization": f"Bearer {acc}", "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
    return c


def main() -> int:
    ok = True
    S = login("super_admin")
    D = login("driver")

    # create two pickup orders
    def make_order(name, phone):
        r = S.post("/api/v1/orders", json={
            "customer_name": name, "phone": phone, "source": "phone",
            "service_type": "standard", "pickup_address": "Tehran, Mirdamad 5",
        })
        return r.json()["id"]
    o1 = make_order("Pickup One", "+12121110001")
    o2 = make_order("Pickup Two", "+12121110002")

    # ---- US-9: driver sees pickup list with required fields ----
    lst = D.get("/api/v1/driver/orders").json()
    pend = {x["id"]: x for x in lst["pending_pickup"]}
    card = pend.get(o1)
    us9 = card and card["pickup_address"] and card["customer_phone"] and card["source"] and card["carpet_count"] >= 1
    print(f"[{'OK' if us9 else 'FAIL'}] US-9 list fields: addr={bool(card and card['pickup_address'])} "
          f"phone={bool(card and card['customer_phone'])} source={card and card['source']} count={card and card['carpet_count']}")
    ok = ok and bool(us9)

    # ---- US-10: accept -> assign + Pickup In Progress ----
    r = D.post(f"/api/v1/driver/pickups/{o1}/accept").json()
    c1 = r["order"]
    us10 = c1["assigned_to_me"] and c1["pickup_workflow"] == "in_progress" and c1["status_label"] == "Pickup In Progress"
    print(f"[{'OK' if us10 else 'FAIL'}]  accept: assigned={c1['assigned_to_me']} wf={c1['pickup_workflow']} label={c1['status_label']}")
    ok = ok and bool(us10)
    D.post(f"/api/v1/driver/pickups/{o2}/accept")

    # ---- US-11: attach physical QR + validations ----
    r = D.post(f"/api/v1/driver/pickups/{o1}/attach-qr",
               json={"code": "PHYS-QR-001", "carpet_type": "Persian Wool", "dimensions": "3x4"})
    us11 = r.status_code < 400 and r.json()["qr_code"] == "PHYS-QR-001" and r.json()["carpet_type"] == "Persian Wool"
    print(f"[{'OK' if us11 else 'FAIL'}] attach: {r.status_code} qr={r.json().get('qr_code')} type={r.json().get('carpet_type')}")
    ok = ok and bool(us11)

    r = D.post(f"/api/v1/driver/pickups/{o1}/attach-qr", json={"code": "PHYS-QR-001"})
    dup = r.status_code >= 400
    print(f"[{'OK' if dup else 'FAIL'}] duplicate-on-same-carpet rejected -> {r.status_code}")
    ok = ok and dup

    r = D.post(f"/api/v1/driver/pickups/{o2}/attach-qr", json={"code": "PHYS-QR-001"})
    notavail = r.status_code >= 400
    print(f"[{'OK' if notavail else 'FAIL'}] QR active on another carpet rejected -> {r.status_code}")
    ok = ok and notavail

    # ---- US-12: scan-mandatory receipt ----
    r = D.post(f"/api/v1/driver/pickups/{o1}/confirm", json={})
    noscan = r.status_code >= 400
    print(f"[{'OK' if noscan else 'FAIL'}] no-scan rejected -> {r.status_code}")
    ok = ok and noscan

    r = D.post(f"/api/v1/driver/pickups/{o1}/confirm", json={"code": "WRONG-CODE-999"})
    wrong = r.status_code >= 400
    print(f"[{'OK' if wrong else 'FAIL'}] wrong/inactive QR rejected -> {r.status_code}")
    ok = ok and wrong

    r = D.post(f"/api/v1/driver/pickups/{o1}/confirm", json={"code": "PHYS-QR-001"})
    body = r.json()
    collected = r.status_code < 400 and body.get("status") == "picked_up" and body.get("status_label") == "Collected"
    print(f"[{'OK' if collected else 'FAIL'}] receipt -> {r.status_code} status={body.get('status')} label={body.get('status_label')}")
    ok = ok and collected

    S.close(); D.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
