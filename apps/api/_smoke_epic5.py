"""EPIC 5 (US-15..US-17A) operation management smoke test — runs inside api container."""
import sys
import httpx

BASE = "http://127.0.0.1:8000"
DEMO = "+12125550147"


def login(role: str) -> httpx.Client:
    c = httpx.Client(base_url=BASE, timeout=30)
    code = c.post("/api/v1/auth/otp/request", json={"phone": DEMO}).json()["dev_code"]
    tok = c.post("/api/v1/auth/otp/verify", json={"phone": DEMO, "code": code}).json()["session_token"]
    acc = c.post("/api/v1/auth/role/select", json={"role_slug": role},
                 headers={"X-Session-Token": tok}).json()["tokens"]["access_token"]
    c.headers.update({"Authorization": f"Bearer {acc}", "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
    return c


def full_pickup_and_receive(S, D, O, qr: str) -> str:
    r = S.post("/api/v1/orders", json={
        "customer_name": "Epic5 Customer", "phone": "+12121110055", "source": "phone",
        "service_type": "standard", "pickup_address": "Tehran, Epic5 St 1",
    })
    oid = r.json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid}/accept")
    D.post(f"/api/v1/driver/pickups/{oid}/attach-qr", json={"code": qr, "carpet_type": "Wool"})
    D.post(f"/api/v1/driver/pickups/{oid}/confirm", json={"code": qr})
    O.post("/api/v1/operations/receive", json={"code": qr})
    return qr


def main() -> int:
    ok = True
    S = login("super_admin")
    D = login("driver")
    O = login("operation_team")

    qr = "PHYS-QR-EPIC5-001"
    full_pickup_and_receive(S, D, O, qr)

    # ---- US-15: start operation via QR scan ----
    r = O.post("/api/v1/operations/start", json={"code": qr})
    body = r.json()
    us15 = (
        r.status_code < 400
        and body.get("status") == "in_washing"
        and body.get("status_label") == "In Operation"
        and body.get("operation_started_at")
    )
    print(f"[{'OK' if us15 else 'FAIL'}]  start -> {r.status_code} status={body.get('status_label')}")
    ok = ok and us15

    r = O.post("/api/v1/operations/start", json={"code": qr})
    dup = r.status_code >= 400
    print(f"[{'OK' if dup else 'FAIL'}]  not in queue rejected -> {r.status_code}")
    ok = ok and dup

    # ---- US-16: wash steps ----
    cid = body["id"]
    r = O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "washing"})
    us16w = r.status_code < 400
    print(f"[{'OK' if us16w else 'FAIL'}] washing -> {r.status_code}")
    ok = ok and us16w

    r = O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "drying"})
    us16d = r.status_code < 400 and r.json().get("status") == "drying"
    print(f"[{'OK' if us16d else 'FAIL'}] drying -> {r.status_code} status={r.json().get('status')}")
    ok = ok and us16d

    r = O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "packaging"})
    us16p = r.status_code < 400
    print(f"[{'OK' if us16p else 'FAIL'}] packaging -> {r.status_code}")
    ok = ok and us16p

    # ---- US-17: complete operation ----
    r = O.post(f"/api/v1/operations/carpets/{cid}/complete")
    b17 = r.json()
    us17 = (
        r.status_code < 400
        and b17.get("status") == "ready"
        and b17.get("status_label") == "Ready for Delivery"
        and b17.get("operation_completed_at")
    )
    print(f"[{'OK' if us17 else 'FAIL'}] complete -> {r.status_code} at={b17.get('operation_completed_at')}")
    ok = ok and us17

    # ---- US-17A: load for delivery ----
    drivers = O.get("/api/v1/operations/drivers").json()
    driver_id = drivers[0]["id"] if drivers else None
    if not driver_id:
        print("[FAIL] no drivers found")
        ok = False
    else:
        r = O.post("/api/v1/operations/load", json={"code": qr, "driver_id": driver_id})
        b17a = r.json()
        us17a = (
            r.status_code < 400
            and b17a.get("loaded_for_delivery_at")
            and b17a.get("loaded_for_driver_id") == driver_id
        )
        print(f"[{'OK' if us17a else 'FAIL'}] load -> {r.status_code} driver={b17a.get('loaded_for_driver_name')}")
        ok = ok and us17a

        # Driver sees loaded order in deliveries
        lst = D.get("/api/v1/driver/orders").json()
        on_list = any(x.get("tracking_code") == b17a.get("tracking_code") for x in lst.get("deliveries", []))
        print(f"[{'OK' if on_list else 'FAIL'}] on driver delivery list -> {on_list}")
        ok = ok and on_list

        r = O.post("/api/v1/operations/load", json={"code": qr, "driver_id": driver_id})
        dup_load = r.status_code >= 400
        print(f"[{'OK' if dup_load else 'FAIL'}] duplicate load rejected -> {r.status_code}")
        ok = ok and dup_load

    S.close()
    D.close()
    O.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
