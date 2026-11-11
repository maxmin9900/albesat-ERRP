"""Fixed role access codes for staff login (replaces OTP)."""

ROLE_LOGIN_PINS: dict[str, str] = {
    "111111": "super_admin",
    "222222": "admin",
    "333333": "driver",
    "444444": "operation_team",
}

STAFF_ROLE_SLUGS = frozenset(ROLE_LOGIN_PINS.values())


def role_slug_from_pin(pin: str) -> str | None:
    return ROLE_LOGIN_PINS.get(pin.strip())
