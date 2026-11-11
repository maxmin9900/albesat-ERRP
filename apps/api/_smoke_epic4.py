"""EPIC 4 (US-13..US-14) operations receipt smoke test — runs inside api container."""
import secrets
import sys
import httpx

BASE = "http://127.0.0.1:8000"
DEMO = "+12125550147"  # super_admin + driver + operation_team


def login(role: str) -> httpx.Client:
    c = httpx.Client(base_url=BASE, timeout=30)
    code = c.post("/api/v1/auth/otp/request", json={"phone": DEMO}).json()["dev_code"]
    tok = c.post("/api/v1/auth/otp/verify", json={"phone": DEMO, "code": code}).json()["session_token"]
    acc = c.post("/api/v1/auth/role/select", json={"role_slug": role},
                 headers={"X-Session-Token": tok}).json()["tokens"]["access_token"]
    c.headers.update({"Authorization": f"Bearer {acc}", "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
    return c


def driver_pickup(client: httpx.Client, order_id: str, qr_code: str) -> None:
    client.post(f"/api/v1/driver/pickups/{order_id}/accept")
    client.post(
        f"/api/v1/driver/pickups/{order_id}/attach-qr",
        json={"code": qr_code, "carpet_type": "Persian Wool", "dimensions": "3x4"},
    )
    r = client.post(f"/api/v1/driver/pickups/{order_id}/confirm", json={"code": qr_code})
    assert r.status_code < 400, r.text


def main() -> int:
    ok = True
    S = login("super_admin")
    D = login("driver")
    O = login("operation_team")

    r = S.post("/api/v1/orders", json={
        "customer_name": "Ops Customer", "phone": "+12121110099", "source": "phone",
        "service_type": "standard", "pickup_address": "Tehran, Valiasr 10",
    })
    order_id = r.json()["id"]
    qr = f"PHYS-QR-OPS-{secrets.token_hex(3).upper()}"
    driver_pickup(D, order_id, qr)

    # ---- US-13: mandatory scan + validations ----
    r = O.post("/api/v1/operations/receive", json={})
    noscan = r.status_code >= 400
    print(f"[{'OK' if noscan else 'FAIL'}] no-scan rejected -> {r.status_code}")
    ok = ok and noscan

    r = D.post("/api/v1/operations/receive", json={"code": qr})
    driver_denied = r.status_code == 403
    print(f"[{'OK' if driver_denied else 'FAIL'}] driver cannot receive -> {r.status_code}")
    ok = ok and driver_denied

    r = O.post("/api/v1/operations/receive", json={"code": qr})
    body = r.json()
    us13 = (
        r.status_code < 400
        and body.get("status") == "received_by_operation"
        and body.get("status_label") == "Received By Operation"
        and body.get("received_at") is not None
        and body.get("qr_code") == qr
    )
    print(f"[{'OK' if us13 else 'FAIL'}] receive -> {r.status_code} status={body.get('status')} "
          f"label={body.get('status_label')} at={body.get('received_at')}")
    ok = ok and us13

    r = O.post("/api/v1/operations/receive", json={"code": qr})
    dup = r.status_code >= 400
    print(f"[{'OK' if dup else 'FAIL'}]  duplicate receive rejected -> {r.status_code}")
    ok = ok and dup

    # ---- US-14: operations queue list ----
    q = O.get("/api/v1/operations/queue").json()
    received = q.get("received") or []
    item = next((x for x in received if x.get("qr_code") == qr), None)
    us14 = item and all([
        item.get("customer_name") == "Ops Customer",
        item.get("carpet_type") == "Persian Wool",
        item.get("status") == "received_by_operation",
        item.get("status_label") == "Received By Operation",
        item.get("received_at"),
    ])
    print(f"[{'OK' if us14 else 'FAIL'}] queue: qr={item and item.get('qr_code')} "
          f"customer={item and item.get('customer_name')} type={item and item.get('carpet_type')} "
          f"status={item and item.get('status')} repair={item and item.get('repair_status')}")
    ok = ok and bool(us14)

    S.close()
    D.close()
    O.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
