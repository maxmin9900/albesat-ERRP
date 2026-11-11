import re

OMAN_NATIONAL = re.compile(r"^[79]\d{7}$")


def normalize_oman_phone(value: str) -> str:
    """Normalize to E.164 (+968XXXXXXXX). Raises ValueError if invalid."""
    digits = re.sub(r"\D", "", value.strip())
    if digits.startswith("00968"):
        digits = digits[2:]

    national: str | None = None
    if len(digits) == 8 and OMAN_NATIONAL.match(digits):
        national = digits
    elif len(digits) == 11 and digits.startswith("968") and OMAN_NATIONAL.match(digits[3:]):
        national = digits[3:]

    if not national:
        raise ValueError(
            "Invalid Oman mobile number. Use 8 digits starting with 7 or 9 (e.g. 91234567)."
        )
    return f"+968{national}"


def is_valid_oman_phone(value: str) -> bool:
    try:
        normalize_oman_phone(value)
        return True
    except ValueError:
        return False


IRAN_NATIONAL = re.compile(r"^9\d{9}$")


def normalize_iran_phone(value: str) -> str:
    """Normalize to E.164 (+989XXXXXXXXX). Raises ValueError if invalid."""
    digits = re.sub(r"\D", "", value.strip())
    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    if not IRAN_NATIONAL.match(digits):
        raise ValueError(
            "Invalid Iran mobile number. Use 09XXXXXXXXX (e.g. 09121234567)."
        )
    return f"+98{digits}"


def is_valid_iran_phone(value: str) -> bool:
    try:
        normalize_iran_phone(value)
        return True
    except ValueError:
        return False


def normalize_customer_phone(value: str) -> str:
    """Normalize a customer phone from either supported country.

    Orders and invoices are taken from Oman and Iran, so both are accepted
    here; staff and partner numbers stay Oman-only.
    """
    try:
        return normalize_oman_phone(value)
    except ValueError:
        pass
    try:
        return normalize_iran_phone(value)
    except ValueError:
        raise ValueError(
            "Invalid mobile number. Use an Oman number (8 digits starting with "
            "7 or 9) or an Iran number (09XXXXXXXXX)."
        ) from None


def is_valid_customer_phone(value: str) -> bool:
    try:
        normalize_customer_phone(value)
        return True
    except ValueError:
        return False
