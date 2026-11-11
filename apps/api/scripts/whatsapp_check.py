"""Diagnose the WhatsApp Cloud API setup before switching the app to cloud mode.

Verifies the token/phone-number id, lists the approved templates, and can send
one real test message.

  # credentials + template list only (sends nothing)
  PYTHONPATH=. python scripts/whatsapp_check.py

  # also send a real template message to your own WhatsApp number
  PYTHONPATH=. python scripts/whatsapp_check.py --to +96899275151
"""

import argparse
import sys

import httpx

from src.core.config import get_settings

settings = get_settings()
GRAPH = "https://graph.facebook.com/v21.0"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", help="phone number to send a test invoice template to")
    ap.add_argument("--waba", help="WhatsApp Business Account id (skips auto-detection)")
    args = ap.parse_args()

    # The 360messenger bridge has its own credential and no Meta concepts,
    # so it gets a short path of its own.
    if settings.whatsapp_provider.strip().lower() in ("360messenger", "360"):
        from src.modules.notifications.whatsapp import Messenger360Provider

        key = settings.messenger360_api_key
        print("provider          : 360messenger (WhatsApp Web bridge)")
        print(f"mode              : {settings.whatsapp_mode}")
        print(f"api key           : {'set (' + str(len(key)) + ' chars)' if key else 'MISSING'}")
        print(f"base url          : {settings.messenger360_base_url}")
        print(f"otp via whatsapp  : {settings.otp_send_via_whatsapp}")
        if not key:
            print("-> Set MESSENGER360_API_KEY in .env first.")
            return 1
        try:
            code, body = Messenger360Provider().get_state()
            print(f"session state     : HTTP {code} {body}")
            if "CONNECTED" not in body:
                print("-> The phone is not linked/connected. Re-scan the QR in the 360messenger panel.")
        except Exception as exc:  # network / DNS / firewall from the server
            print(f"session state     : request failed: {exc!r}")
            print("-> The server cannot reach api.360messenger.com (DNS/firewall/outbound HTTPS).")
            return 1
        if not args.to:
            print("-> Re-run with --to +968XXXXXXXX to send a real test message.")
            return 0
        if settings.whatsapp_mode.lower() == "mock":
            print("-> WHATSAPP_MODE is 'mock'; set it to 'cloud' to send for real.")
            return 1
        print(f"\ntest send to {args.to} ...")
        ok = Messenger360Provider().send_text(
            args.to, "Albesat test - draft invoice PRO-TEST. Total: 25.000 OMR"
        )
        print("    result:", "SENT" if ok else "FAILED (see the error above)")
        if not ok:
            print("\n    Check: is the phone still linked in the 360messenger panel,")
            print("           and has WhatsApp been opened on it in the last 14 days?")
        return 0 if ok else 1

    token = settings.whatsapp_access_token
    phone_id = settings.whatsapp_phone_number_id
    print("provider          : meta (Cloud API)")
    print(f"mode              : {settings.whatsapp_mode}")
    print(f"access token      : {'set (' + str(len(token)) + ' chars)' if token else 'MISSING'}")
    print(f"phone number id   : {phone_id or 'MISSING'}")
    print(f"invoice template  : {settings.whatsapp_invoice_template_name}")
    print(f"otp template      : {settings.whatsapp_otp_template_name}")
    if not token or not phone_id:
        print("\n-> Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env first.")
        return 1

    headers = {"Authorization": f"Bearer {token}"}
    with httpx.Client(timeout=30.0, headers=headers) as client:
        # A token can hold the right scopes yet be bound to no WhatsApp account
        # at all — that combination fails sends with a bare "(#131005)".
        dbg = client.get(
            f"{GRAPH}/debug_token", params={"input_token": token, "access_token": token}
        )
        print(f"\n[0] token scopes  : HTTP {dbg.status_code}")
        if dbg.status_code < 400:
            d = dbg.json().get("data", {})
            print(f"    valid   : {d.get('is_valid')}")
            print(f"    app     : {d.get('application')}")
            bound = False
            for g in d.get("granular_scopes", []):
                targets = g.get("target_ids") or []
                if targets:
                    bound = True
                print(f"    {g.get('scope'):<32} -> {targets or 'NO ACCOUNT BOUND'}")
            if not bound:
                print("\n    ! The token is not bound to any WhatsApp account.")
                print("      Regenerate it and finish the account opt-in dialog.")

        r = client.get(f"{GRAPH}/{phone_id}", params={"fields": "verified_name,display_phone_number,quality_rating"})
        print(f"\n[1] phone number  : HTTP {r.status_code}")
        if r.status_code >= 400:
            print(f"    {r.text[:400]}")
            return 1
        info = r.json()
        print(f"    name    : {info.get('verified_name')}")
        print(f"    number  : {info.get('display_phone_number')}")
        print(f"    quality : {info.get('quality_rating')}")

        waba_id = args.waba
        if not waba_id:
            waba = client.get(f"{GRAPH}/{phone_id}", params={"fields": "whatsapp_business_account"})
            waba_id = (waba.json().get("whatsapp_business_account") or {}).get("id") if waba.status_code < 400 else None
        if waba_id:
            t = client.get(f"{GRAPH}/{waba_id}/message_templates", params={"limit": 50})
            print(f"\n[2] templates     : HTTP {t.status_code}")
            if t.status_code < 400:
                found = False
                for tpl in t.json().get("data", []):
                    mark = ""
                    if tpl["name"] == settings.whatsapp_invoice_template_name:
                        mark, found = "  <-- invoice template", True
                    print(f"    {tpl['status']:<10} {tpl['language']:<6} {tpl['name']}{mark}")
                if not found:
                    print(f"\n    ! '{settings.whatsapp_invoice_template_name}' not found — create and get it APPROVED,")
                    print("      otherwise invoices fall back to free-form text (24h window only).")
        else:
            print("\n[2] templates     : could not resolve the WABA id (token may lack scope)")

        if args.to:
            from src.modules.notifications.whatsapp import send_draft_invoice_sync

            print(f"\n[3] test send to {args.to} ...")
            ok = send_draft_invoice_sync(
                args.to,
                "Albesat test — draft invoice PRO-TEST. Total: 25.000 OMR",
                customer_name="Test Customer",
                invoice_number="PRO-TEST",
                total="25.000 OMR",
                tracking_code="QC-TEST",
            )
            print("    result:", "SENT" if ok else "FAILED (see the error above)")
            if not ok:
                print("\n    Common causes:")
                print("      131005  token not bound to the WhatsApp account -> regenerate it")
                print("      131030  recipient missing from the test number's allowed list")
                print("      131047  no 24h window: message the business number first,")
                print("              or configure an approved template")
            return 0 if ok else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
