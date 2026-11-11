"""US-3/US-4 RBAC matrix verification (runs inside api container).

Uses a separate httpx client per role so the CSRF double-submit cookie/header
stay consistent within each role session.
"""
import sys
import httpx

BASE = "http://127.0.0.1:8000"
ADMIN_PHONE = "+12125550147"  # super_admin/admin/operation_team/driver
REPAIR_PHONE = "+15550007001"
FINANCE_PHONE = "+15550007002"

results = []


def client_for(phone, role):
    """Return a fresh logged-in client with Bearer + matching CSRF defaults.

    Retries OTP a few times: hammering one phone in a tight test loop can race the
    latest-unverified-OTP lookup. Real clients log in once and never hit this.
    """
    c = httpx.Client(base_url=BASE, timeout=30)
    last = None
    for _ in range(5):
        rq = c.post("/api/v1/auth/otp/request", json={"phone": phone})
        code = rq.json().get("dev_code")
        if not code:
            last = f"otp/request -> {rq.status_code} {rq.json()}"
            continue
        v = c.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code}).json()
        if "session_token" in v:
            roles = [r["slug"] for r in v["available_roles"]]
            if role not in roles:
                raise RuntimeError(f"{phone} missing role {role}; has {roles}")
            sel = c.post("/api/v1/auth/role/select", json={"role_slug": role},
                         headers={"X-Session-Token": v["session_token"]}).json()
            c.headers.update({"Authorization": f"Bearer {sel['tokens']['access_token']}",
                              "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
            return c
        last = f"verify (code={code}) -> {v}"
    raise RuntimeError(f"login failed for {phone}/{role}: {last}")


def expect(role, label, r, allow):
    code = r.status_code
    good = (code < 400) if allow else (code in (401, 403))
    results.append(good)
    tag = "OK " if good else "XX "
    verb = "allow" if allow else "deny "
    print(f"  [{tag}] {role:14} {verb} {label:34} -> {code}")


def main() -> int:
    sa = client_for(ADMIN_PHONE, "super_admin")
    expect("super_admin", "GET /admin/users", sa.get("/api/v1/admin/users"), True)
    expect("super_admin", "GET /payments/dashboard", sa.get("/api/v1/payments/dashboard"), True)
    # create test users for repair_team / finance_team
    for phone, name, role in [(REPAIR_PHONE, "Repair Tester", "repair_team"),
                              (FINANCE_PHONE, "Finance Tester", "finance_team")]:
        rr = sa.post("/api/v1/admin/users",
                     json={"phone": phone, "full_name": name, "role_slugs": [role]})
        if rr.status_code >= 400 and "already" not in rr.text.lower():
            print("   ensure_user:", rr.status_code, rr.text[:140])

    a = client_for(ADMIN_PHONE, "admin")
    expect("admin", "GET /admin/users (deny)", a.get("/api/v1/admin/users"), False)
    expect("admin", "GET /payments/dashboard", a.get("/api/v1/payments/dashboard"), True)
    expect("admin", "GET /repairs/approval-queue", a.get("/api/v1/repairs/approval-queue"), True)
    expect("admin", "GET /payments/partners", a.get("/api/v1/payments/partners"), True)
    # valid partner body so request reaches the permission check (admin lacks partners:manage)
    expect("admin", "POST /payments/partners (deny)",
           a.post("/api/v1/payments/partners",
                  json={"name": "Test Partner", "contact_phone": "+15550000000",
                        "address": "Somewhere", "commission_rate": "15.00", "is_active": True}),
           False)

    o = client_for(ADMIN_PHONE, "operation_team")
    expect("operation_team", "GET /operations/queue", o.get("/api/v1/operations/queue"), True)
    expect("operation_team", "GET /payments/dashboard (deny)", o.get("/api/v1/payments/dashboard"), False)
    expect("operation_team", "GET /admin/users (deny)", o.get("/api/v1/admin/users"), False)
    expect("operation_team", "GET /repairs/approval-queue (deny)", o.get("/api/v1/repairs/approval-queue"), False)

    d = client_for(ADMIN_PHONE, "driver")
    expect("driver", "GET /driver/dashboard", d.get("/api/v1/driver/dashboard"), True)
    expect("driver", "GET /payments/dashboard (deny)", d.get("/api/v1/payments/dashboard"), False)
    expect("driver", "GET /admin/users (deny)", d.get("/api/v1/admin/users"), False)

    rt = client_for(REPAIR_PHONE, "repair_team")
    expect("repair_team", "GET /repairs/work-queue", rt.get("/api/v1/repairs/work-queue"), True)
    expect("repair_team", "GET /repairs/approval-queue (deny)", rt.get("/api/v1/repairs/approval-queue"), False)
    expect("repair_team", "GET /payments/dashboard (deny)", rt.get("/api/v1/payments/dashboard"), False)
    expect("repair_team", "GET /admin/users (deny)", rt.get("/api/v1/admin/users"), False)
    expect("repair_team", "GET /driver/dashboard (deny)", rt.get("/api/v1/driver/dashboard"), False)

    f = client_for(FINANCE_PHONE, "finance_team")
    expect("finance_team", "GET /payments/dashboard", f.get("/api/v1/payments/dashboard"), True)
    expect("finance_team", "GET /payments/partners", f.get("/api/v1/payments/partners"), True)
    expect("finance_team", "GET /operations/queue (deny)", f.get("/api/v1/operations/queue"), False)
    expect("finance_team", "GET /admin/users (deny)", f.get("/api/v1/admin/users"), False)
    expect("finance_team", "GET /repairs/approval-queue (deny)", f.get("/api/v1/repairs/approval-queue"), False)

    # Repair-team assessment lifecycle: operation flags -> repair team assesses
    cl = sa.get("/api/v1/qr/carpets").json()
    items = cl.get("items") or cl.get("carpets") or []
    if items:
        cid = items[0]["id"]
        cr = o.post("/api/v1/repairs",
                    json={"carpet_id": cid, "damage_description": "بررسی برای تست assessment"})
        expect("operation_team", "POST /repairs", cr, True)
        if cr.status_code < 400:
            rid = cr.json()["id"]
            asr = rt.patch(f"/api/v1/repairs/{rid}/assessment",
                           json={"repair_type": "rufu", "quoted_price": "900000",
                                 "repair_deadline": "2026-08-01", "assessment_notes": "قابل تعمیر"})
            expect("repair_team", "PATCH /repairs/{id}/assessment", asr, True)
            from decimal import Decimal
            ok_price = asr.status_code < 400 and Decimal(str(asr.json().get("quoted_price"))) == Decimal("900000")
            results.append(ok_price)
            print(f"  [{'OK ' if ok_price else 'XX '}] repair_team    assessment persisted -> price={asr.json().get('quoted_price')}")
            # repair_team must NOT be able to approve (admin only)
            cc = rt.patch(f"/api/v1/repairs/{rid}/customer-contact", json={"outcome": "approved"})
            expect("repair_team", "PATCH customer-contact (deny)", cc, False)

    passed = sum(1 for x in results if x)
    total = len(results)
    print(f"RESULT: {passed}/{total}", "PASS" if passed == total else "FAIL")
    return 0 if passed == total else 2


if __name__ == "__main__":
    sys.exit(main())
