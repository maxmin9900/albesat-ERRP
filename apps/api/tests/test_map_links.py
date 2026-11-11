import pytest

from src.core.map_links import _is_google_host, extract_url, parse_coordinates


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("23.588, 58.3829", (23.588, 58.3829)),
        ("23.588 58.3829", (23.588, 58.3829)),
        ("https://maps.google.com/maps?q=23.588%2C58.3829&z=17&hl=en", (23.588, 58.3829)),
        ("Location: https://maps.google.com/?q=23.5880,58.3829", (23.588, 58.3829)),
        # The place pin (!3d/!4d) wins over the viewport centre (@).
        (
            "https://www.google.com/maps/place/Muscat/@23.58,58.38,17z/data=!4m6!3m5!8m2!3d23.5859!4d58.4059",
            (23.5859, 58.4059),
        ),
        ("https://maps.apple.com/?ll=23.6,58.5&q=Pin", (23.6, 58.5)),
        ("https://www.google.com/maps/search/23.6100,+58.5400?entry=tts", (23.61, 58.54)),
        ("&amp;center=23.61%2C58.54&amp;zoom=15", (23.61, 58.54)),
    ],
)
def test_parse_coordinates(text, expected):
    assert parse_coordinates(text) == expected


@pytest.mark.parametrize("text", ["https://maps.app.goo.gl/AbCd", "hello 12", "0.0, 0.0", "95.1, 58.2"])
def test_parse_coordinates_rejects(text):
    assert parse_coordinates(text) is None


def test_extract_url_strips_trailing_punctuation():
    assert extract_url("Location: https://maps.app.goo.gl/AbCd.") == "https://maps.app.goo.gl/AbCd"


def test_only_google_hosts_are_fetched():
    assert _is_google_host("maps.app.goo.gl")
    assert _is_google_host("www.google.com")
    assert not _is_google_host("google.co.io")
    assert not _is_google_host("evilgoogle.com")
    assert not _is_google_host("127.0.0.1")
