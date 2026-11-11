"""EPIC 8 (US-26..US-32) repair management smoke test."""
import secrets
import sys

import httpx

BASE = "http://127.0.0.1:8000"
DEMO = "+12125550147"
REPAIR_PHONE = "+15550007001"

TINY_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def login(phone: str, role: str) -> httpx.Client:
    c = httpx.Client(base_url=BASE, timeout=30)
    code = c.post("/api/v1/auth/otp/request", json={"phone": phone}).json()["dev_code"]
    tok = c.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code}).json()["session_token"]
    acc = c.post(
        "/api/v1/auth/role/select",
        json={"role_slug": role},
        headers={"X-Session-Token": tok},
    ).json()["tokens"]["access_token"]
    c.headers.update({"Authorization": f"Bearer {acc}", "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
    return c


def ensure_repair_user(sa: httpx.Client) -> None:
    rr = sa.post(
        "/api/v1/admin/users",
        json={"phone": REPAIR_PHONE, "full_name": "Repair Tester", "role_slugs": ["repair_team"]},
    )
    if rr.status_code >= 400 and "already" not in rr.text.lower():
        print("ensure_user:", rr.status_code, rr.text[:120])


def main() -> int:
    ok = True
    sa = login(DEMO, "super_admin")
    ensure_repair_user(sa)
    D = login(DEMO, "driver")
    O = login(DEMO, "operation_team")
    A = login(DEMO, "admin")
    R = login(REPAIR_PHONE, "repair_team")

    qr = f"PHYS-QR-EPIC8-{secrets.token_hex(3).upper()}"

    # Create order + pickup pipeline
    oid = sa.post(
        "/api/v1/orders",
        json={
            "customer_name": "Epic8 Repair Customer",
            "phone": "+12121110055",
            "source": "phone",
            "service_type": "standard",
            "pickup_address": "Tehran, Repair St 8",
            "carpet_dimensions": "2x3m",
        },
    ).json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid}/accept")
    D.post(f"/api/v1/driver/pickups/{oid}/attach-qr", json={"code": qr, "carpet_type": "Wool"})
    D.post(f"/api/v1/driver/pickups/{oid}/confirm", json={"code": qr})

    # US-26 driver flag repair
    r = D.post(
        f"/api/v1/driver/pickups/{oid}/flag-repair",
        json={
            "need_repair": True,
            "damage_description": "Edge fraying observed at pickup",
            "photos": [{"data_url": TINY_PNG, "caption": "Edge damage"}],
        },
    )
    us26 = r.status_code < 400 and r.json().get("status") == "pending_approval"
    us26 = us26 and r.json().get("flagged_source") == "driver"
    us26 = us26 and len(r.json().get("photos") or []) == 1
    rid = r.json().get("id") if r.status_code < 400 else None
    print(f"[{'OK' if us26 else 'FAIL'}] driver flag repair -> {r.status_code}")
    ok = ok and us26

    # US-28 work queue shows item
    wq = R.get("/api/v1/repairs/work-queue").json()
    us28 = any(x["id"] == rid for x in wq.get("items", []))
    us28 = us28 and any(x.get("qr_code") == qr for x in wq.get("items", []) if x["id"] == rid)
    print(f"[{'OK' if us28 else 'FAIL'}] work queue -> found={us28}")
    ok = ok and us28

    # US-29 assessment
    r = R.patch(
        f"/api/v1/repairs/{rid}/assessment",
        json={
            "repair_type": "Edge reweaving",
            "quoted_price": "150.00",
            "repair_deadline": "2026-12-31",
            "assessment_notes": "2 days work",
        },
    )
    us29 = r.status_code < 400 and r.json().get("status") == "waiting_customer_response"
    print(f"[{'OK' if us29 else 'FAIL'}] assessment -> {r.json().get('status') if r.status_code < 400 else r.status_code}")
    ok = ok and us29

    # US-30 admin customer approval
    r = A.patch(
        f"/api/v1/repairs/{rid}/customer-contact",
        json={"outcome": "approved", "notes": "Customer agreed by phone"},
    )
    us30 = r.status_code < 400 and r.json().get("status") == "customer_approved"
    print(f"[{'OK' if us30 else 'FAIL'}] admin approval -> {r.json().get('status') if r.status_code < 400 else r.status_code}")
    ok = ok and us30

    # US-31 start repair with QR
    r = R.patch(
        f"/api/v1/repairs/{rid}/work",
        json={"status": "in_repair", "qr_code": qr},
    )
    us31 = r.status_code < 400 and r.json().get("status") == "in_repair"
    print(f"[{'OK' if us31 else 'FAIL'}] start repair -> {r.json().get('status') if r.status_code < 400 else r.status_code}")
    ok = ok and us31

    # US-32 complete repair
    r = R.patch(
        f"/api/v1/repairs/{rid}/work",
        json={"status": "repair_completed", "completion_notes": "Edges restored"},
    )
    us32 = r.status_code < 400 and r.json().get("status") == "repair_completed"
    us32 = us32 and r.json().get("completion_notes") == "Edges restored"
    print(f"[{'OK' if us32 else 'FAIL'}] complete repair -> {r.json().get('status') if r.status_code < 400 else r.status_code}")
    ok = ok and us32

    # US-27 operations flag (separate order)
    qr2 = f"PHYS-QR-EPIC8B-{secrets.token_hex(3).upper()}"
    oid2 = sa.post(
        "/api/v1/orders",
        json={
            "customer_name": "Ops Repair",
            "phone": "+12121110056",
            "source": "phone",
            "service_type": "standard",
            "pickup_address": "Tehran, Ops Repair",
            "carpet_dimensions": "1x2m",
        },
    ).json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid2}/accept")
    D.post(f"/api/v1/driver/pickups/{oid2}/attach-qr", json={"code": qr2, "carpet_type": "Silk"})
    D.post(f"/api/v1/driver/pickups/{oid2}/confirm", json={"code": qr2})
    O.post("/api/v1/operations/receive", json={"code": qr2})
    r = O.post(
        "/api/v1/operations/flag-repair",
        json={
            "code": qr2,
            "damage_type": "Color fade",
            "damage_description": "Faded area in center",
            "photos": [{"data_url": TINY_PNG}],
        },
    )
    us27 = r.status_code < 400 and r.json().get("flagged_source") == "operations"
    us27 = us27 and r.json().get("damage_type") == "Color fade"
    print(f"[{'OK' if us27 else 'FAIL'}] operations flag -> {r.status_code}")
    ok = ok and us27

    sa.close()
    D.close()
    O.close()
    A.close()
    R.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
