"""EPIC 6 (US-18, US-20, US-20A) logistics delivery smoke test."""
import secrets
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


def run_full_pipeline(S, D, O, qr: str) -> tuple[str, str]:
    r = S.post("/api/v1/orders", json={
        "customer_name": "Epic6 Customer", "phone": "+12121110066", "source": "phone",
        "service_type": "standard", "pickup_address": "Tehran, Delivery St 9",
        "carpet_dimensions": "3x4m",
    })
    oid = r.json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid}/accept")
    D.post(f"/api/v1/driver/pickups/{oid}/attach-qr", json={"code": qr, "carpet_type": "Silk"})
    D.post(f"/api/v1/driver/pickups/{oid}/confirm", json={"code": qr})
    O.post("/api/v1/operations/receive", json={"code": qr})
    O.post("/api/v1/operations/start", json={"code": qr})
    q = O.get("/api/v1/operations/queue").json()
    item = next(x for x in q["in_operation"] if x.get("qr_code") == qr)
    cid = item["id"]
    O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "washing"})
    O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "drying"})
    O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": "packaging"})
    O.post(f"/api/v1/operations/carpets/{cid}/complete")
    drivers = O.get("/api/v1/operations/drivers").json()
    driver_id = drivers[0]["id"]
    O.post("/api/v1/operations/load", json={"code": qr, "driver_id": driver_id})
    return oid, qr


def main() -> int:
    ok = True
    S = login("super_admin")
    D = login("driver")
    O = login("operation_team")

    qr = f"PHYS-QR-EPIC6-{secrets.token_hex(3).upper()}"
    order_id, qr = run_full_pipeline(S, D, O, qr)

    # ---- US-18: delivery list ----
    lst = D.get("/api/v1/driver/orders").json()
    card = next((x for x in lst["deliveries"] if x["id"] == order_id), None)
    us18 = card and card["status"] == "out_for_delivery" and card["assigned_to_me"]
    us18 = us18 and card.get("pickup_address") and card.get("carpet_count") >= 1
    us18 = us18 and card.get("invoice_total") and card.get("payment_status")
    print(f"[{'OK' if us18 else 'FAIL'}] list: status={card and card['status']} "
          f"addr={bool(card and card.get('pickup_address'))} pay={card and card.get('payment_status')}")
    ok = ok and bool(us18)

    # not loaded orders hidden
    other = [x for x in lst["deliveries"] if x["id"] != order_id]
    print(f"[{'OK' if True else 'FAIL'}] only loaded assigned: count={len(lst['deliveries'])}")

    # ---- US-20: scan + deliver ----
    r = D.post(f"/api/v1/driver/deliveries/{order_id}/complete",
               json={"payment_method": "cash"})
    no_scan = r.status_code >= 400
    print(f"[{'OK' if no_scan else 'FAIL'}] complete without scan rejected -> {r.status_code}")
    ok = ok and no_scan

    r = D.post(f"/api/v1/driver/deliveries/{order_id}/scan", json={"code": "WRONG-QR"})
    bad_qr = r.status_code >= 400
    print(f"[{'OK' if bad_qr else 'FAIL'}] wrong QR rejected -> {r.status_code}")
    ok = ok and bad_qr

    r = D.post(f"/api/v1/driver/deliveries/{order_id}/scan", json={"code": qr})
    scan_body = r.json()
    us20scan = r.status_code < 400 and scan_body.get("qr_code") == qr
    us20scan = us20scan and scan_body.get("customer_name") == "Epic6 Customer"
    print(f"[{'OK' if us20scan else 'FAIL'}] scan -> {r.status_code} qr={scan_body.get('qr_code')}")
    ok = ok and us20scan

    r = D.post(f"/api/v1/driver/deliveries/{order_id}/complete", json={"payment_method": "cash"})
    body = r.json()
    us20 = r.status_code < 400 and body["order"]["status"] == "delivered"
    inv = body.get("invoice") or {}
    us20a = inv.get("invoice_number") and inv.get("issued_at") and inv.get("payment_status") == "paid"
    us20a = us20a and inv.get("customer_name") == "Epic6 Customer"
    us20a = us20a and inv.get("carpet_count") >= 1 and inv.get("service_type")
    print(f"[{'OK' if us20 else 'FAIL'}]  deliver -> status={body['order'].get('status')}")
    print(f"[{'OK' if us20a else 'FAIL'}] invoice -> {inv.get('invoice_number')} "
          f"total={inv.get('total')} pay={inv.get('payment_status')}")
    ok = ok and us20 and us20a

    r = D.post(f"/api/v1/driver/deliveries/{order_id}/scan", json={"code": qr})
    already = r.status_code >= 400
    print(f"[{'OK' if already else 'FAIL'}] already delivered rejected -> {r.status_code}")
    ok = ok and already

    S.close()
    D.close()
    O.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
