"""Geographic helpers for Sultanate of Oman."""

OMAN_BOUNDS = {
    "south": 16.65,
    "west": 52.05,
    "north": 26.4,
    "east": 59.85,
}


def is_inside_oman(lat: float, lng: float) -> bool:
    return (
        OMAN_BOUNDS["south"] <= lat <= OMAN_BOUNDS["north"]
        and OMAN_BOUNDS["west"] <= lng <= OMAN_BOUNDS["east"]
    )
