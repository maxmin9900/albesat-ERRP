"""EPIC 7 (US-21..25) payment system smoke test."""
import secrets
import sys
from datetime import date, timedelta

import httpx

BASE = "http://127.0.0.1:8000"
DEMO = "+12125550147"


def login(role: str) -> httpx.Client:
    c = httpx.Client(base_url=BASE, timeout=30)
    code = c.post("/api/v1/auth/otp/request", json={"phone": DEMO}).json()["dev_code"]
    tok = c.post("/api/v1/auth/otp/verify", json={"phone": DEMO, "code": code}).json()["session_token"]
    acc = c.post(
        "/api/v1/auth/role/select",
        json={"role_slug": role},
        headers={"X-Session-Token": tok},
    ).json()["tokens"]["access_token"]
    c.headers.update({"Authorization": f"Bearer {acc}", "X-CSRF-Token": c.cookies.get("fz_csrf") or ""})
    return c


def deliver_order(S, D, O, qr: str, payment_method: str = "cash", **extra) -> str:
    r = S.post(
        "/api/v1/orders",
        json={
            "customer_name": "Epic7 Customer",
            "phone": "+12121110077",
            "source": "phone",
            "service_type": "standard",
            "pickup_address": "Tehran, Payment St 7",
            "carpet_dimensions": "2x3m",
        },
    )
    oid = r.json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid}/accept")
    D.post(f"/api/v1/driver/pickups/{oid}/attach-qr", json={"code": qr, "carpet_type": "Wool"})
    D.post(f"/api/v1/driver/pickups/{oid}/confirm", json={"code": qr})
    O.post("/api/v1/operations/receive", json={"code": qr})
    O.post("/api/v1/operations/start", json={"code": qr})
    q = O.get("/api/v1/operations/queue").json()
    item = next(x for x in q["in_operation"] if x.get("qr_code") == qr)
    cid = item["id"]
    for step in ("washing", "drying", "packaging"):
        O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": step})
    O.post(f"/api/v1/operations/carpets/{cid}/complete")
    driver_id = O.get("/api/v1/operations/drivers").json()[0]["id"]
    O.post("/api/v1/operations/load", json={"code": qr, "driver_id": driver_id})
    D.post(f"/api/v1/driver/deliveries/{oid}/scan", json={"code": qr})
    payload = {"payment_method": payment_method, **extra}
    D.post(f"/api/v1/driver/deliveries/{oid}/complete", json=payload)
    return oid


def main() -> int:
    ok = True
    S = login("super_admin")
    D = login("driver")
    O = login("operation_team")

    qr = f"PHYS-QR-EPIC7-{secrets.token_hex(3).upper()}"

    # US-21: proforma -> final invoice on delivery
    r = S.post(
        "/api/v1/orders",
        json={
            "customer_name": "Epic7 Proforma",
            "phone": "+12121110088",
            "source": "phone",
            "service_type": "standard",
            "pickup_address": "Tehran, Proforma St",
            "carpet_dimensions": "2x2m",
        },
    )
    oid_pro = r.json()["id"]
    pf = S.post(f"/api/v1/payments/proforma/{oid_pro}")
    us21_pf = pf.status_code < 400 and pf.json().get("invoice_type") == "proforma"
    print(f"[{'OK' if us21_pf else 'FAIL'}] proforma issued -> {pf.status_code}")
    ok = ok and us21_pf

    qr2 = f"PHYS-QR-EPIC7B-{secrets.token_hex(3).upper()}"
    D.post(f"/api/v1/driver/pickups/{oid_pro}/accept")
    D.post(f"/api/v1/driver/pickups/{oid_pro}/attach-qr", json={"code": qr2, "carpet_type": "Wool"})
    D.post(f"/api/v1/driver/pickups/{oid_pro}/confirm", json={"code": qr2})
    O.post("/api/v1/operations/receive", json={"code": qr2})
    O.post("/api/v1/operations/start", json={"code": qr2})
    q = O.get("/api/v1/operations/queue").json()
    item = next(x for x in q["in_operation"] if x.get("qr_code") == qr2)
    cid = item["id"]
    for step in ("washing", "drying", "packaging"):
        O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": step})
    O.post(f"/api/v1/operations/carpets/{cid}/complete")
    driver_id = O.get("/api/v1/operations/drivers").json()[0]["id"]
    O.post("/api/v1/operations/load", json={"code": qr2, "driver_id": driver_id})
    D.post(f"/api/v1/driver/deliveries/{oid_pro}/scan", json={"code": qr2})
    r = D.post(f"/api/v1/driver/deliveries/{oid_pro}/complete", json={"payment_method": "cash"})
    inv = r.json().get("invoice") or {}
    final = S.get(f"/api/v1/payments/invoices/order/{oid_pro}").json()
    us21 = r.status_code < 400 and inv.get("invoice_number") and inv.get("due_date")
    us21 = us21 and final.get("invoice_type") == "invoice"
    us21 = us21 and inv.get("payment_status") == "paid"
    print(f"[{'OK' if us21 else 'FAIL'}] proforma->invoice on delivery pay={inv.get('payment_status')}")
    ok = ok and us21

    # US-22 cash delivery on fresh order
    oid_cash = deliver_order(S, D, O, qr, "cash")
    inv_cash = S.get(f"/api/v1/payments/invoices/order/{oid_cash}").json()
    us22 = inv_cash.get("payment_status") == "paid"
    print(f"[{'OK' if us22 else 'FAIL'}] cash payment -> {inv_cash.get('payment_status')}")
    ok = ok and us22

    # US-23 card transfer with driver confirm
    qr3 = f"PHYS-QR-EPIC7C-{secrets.token_hex(3).upper()}"
    oid_card = deliver_order(S, D, O, qr3, "card_transfer", confirmation_reference="REF-12345")
    inv_card = S.get(f"/api/v1/payments/invoices/order/{oid_card}").json()
    us23 = inv_card.get("payment_status") == "paid"
    print(f"[{'OK' if us23 else 'FAIL'}] card transfer confirmed -> {inv_card.get('payment_status')}")
    ok = ok and us23

    # US-21A partial + overdue: deliver unpaid then partial admin payment
    qr4 = f"PHYS-QR-EPIC7D-{secrets.token_hex(3).upper()}"
    r = S.post(
        "/api/v1/orders",
        json={
            "customer_name": "Epic7 Partial",
            "phone": "+12121110099",
            "source": "phone",
            "service_type": "standard",
            "pickup_address": "Tehran, Partial St",
            "carpet_dimensions": "1x2m",
        },
    )
    oid_part = r.json()["id"]
    D.post(f"/api/v1/driver/pickups/{oid_part}/accept")
    D.post(f"/api/v1/driver/pickups/{oid_part}/attach-qr", json={"code": qr4, "carpet_type": "Silk"})
    D.post(f"/api/v1/driver/pickups/{oid_part}/confirm", json={"code": qr4})
    O.post("/api/v1/operations/receive", json={"code": qr4})
    O.post("/api/v1/operations/start", json={"code": qr4})
    q = O.get("/api/v1/operations/queue").json()
    item = next(x for x in q["in_operation"] if x.get("qr_code") == qr4)
    cid = item["id"]
    for step in ("washing", "drying", "packaging"):
        O.post(f"/api/v1/operations/carpets/{cid}/step", json={"step": step})
    O.post(f"/api/v1/operations/carpets/{cid}/complete")
    driver_id = O.get("/api/v1/operations/drivers").json()[0]["id"]
    O.post("/api/v1/operations/load", json={"code": qr4, "driver_id": driver_id})
    D.post(f"/api/v1/driver/deliveries/{oid_part}/scan", json={"code": qr4})
    # Complete without payment (skip payment by using pos without ref -> pending, then don't pay full)
    # Instead: complete with partial amount via payment_amount
    total = float(D.get(f"/api/v1/driver/orders/{oid_part}").json().get("total", 100))
    half = round(total / 2, 2)
    r = D.post(
        f"/api/v1/driver/deliveries/{oid_part}/complete",
        json={"payment_method": "cash", "payment_amount": half},
    )
    inv_part = S.get(f"/api/v1/payments/invoices/order/{oid_part}").json()
    us21a_partial = inv_part.get("payment_status") == "partially_paid"
    us21a_partial = us21a_partial and float(inv_part.get("remaining_amount", 0)) > 0
    print(
        f"[{'OK' if us21a_partial else 'FAIL'}] partial -> "
        f"{inv_part.get('payment_status')} rem={inv_part.get('remaining_amount')}"
    )
    ok = ok and us21a_partial

    # US-21B CRM detail
    inv_id = inv_part["id"]
    crm = S.get(f"/api/v1/payments/invoices/{inv_id}/crm").json()
    us21b = crm.get("invoice") and crm.get("services_done") is not None
    us21b = us21b and len(crm.get("payment_history", [])) >= 1
    print(f"[{'OK' if us21b else 'FAIL'}]  CRM detail -> history={len(crm.get('payment_history', []))}")
    ok = ok and us21b

    # US-21C reminder
    r = S.post(f"/api/v1/payments/invoices/{inv_id}/remind", json={"channels": ["sms", "whatsapp"]})
    us21c = r.status_code < 400 and len(r.json()) >= 1
    print(f"[{'OK' if us21c else 'FAIL'}]  reminder logs -> {len(r.json()) if r.status_code < 400 else r.status_code}")
    ok = ok and us21c

    receivables = S.get("/api/v1/payments/receivables").json()
    us21a_recv = any(x["id"] == inv_id for x in receivables)
    print(f"[{'OK' if us21a_recv else 'FAIL'}]  receivables list includes partial invoice")
    ok = ok and us21a_recv

    # US-25 partner settlement
    partners = S.get("/api/v1/payments/partners").json()
    if partners:
        pid = partners[0]["id"]
        fin = S.get(f"/api/v1/payments/partners/{pid}/finance").json()
        us25_fin = "order_count" in fin and "revenue_from_partner" in fin
        today = date.today()
        gen = S.post(
            f"/api/v1/payments/partners/{pid}/settlements/generate",
            json={"year": today.year, "month": today.month},
        )
        us25_set = gen.status_code < 400 and gen.json().get("net_payable") is not None
        print(f"[{'OK' if us25_fin else 'FAIL'}]  partner finance report")
        print(f"[{'OK' if us25_set else 'FAIL'}]  monthly settlement -> {gen.status_code}")
        ok = ok and us25_fin and us25_set
    else:
        print("[SKIP] US-25 no partners seeded")

    S.close()
    D.close()
    O.close()
    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
