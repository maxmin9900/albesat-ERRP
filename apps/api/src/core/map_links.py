"""Read coordinates out of a pasted map location (WhatsApp / Google Maps / Apple Maps).

Staff copy a customer's WhatsApp location and paste it into the order/customer
forms. What they paste is one of:

- plain coordinates: ``23.588, 58.3829``
- a full map URL: ``https://maps.google.com/maps?q=23.588%2C58.3829&z=17``,
  ``https://www.google.com/maps/place/.../@23.58,58.38,17z/data=!3d23.58!4d58.38``,
  ``https://maps.apple.com/?ll=23.58,58.38``
- a short link: ``https://maps.app.goo.gl/AbCd`` / ``https://goo.gl/maps/AbCd``

Short links carry no coordinates, so they are expanded server-side (the browser
cannot follow cross-origin redirects). Only Google map hosts are fetched.
"""

import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx

# Map coordinates always carry decimals; requiring them avoids matching ids/sizes.
_NUM = r"(-?\d{1,3}\.\d+)"

# Most precise first: the place pin (!3d/!4d) beats the viewport centre (@).
_URL_PATTERNS = [
    re.compile(rf"!3d{_NUM}!4d{_NUM}"),
    re.compile(
        rf"[?&;](?:q|query|ll|sll|daddr|destination|center|markers)=(?:loc:)?\s*\+?{_NUM}\s*,\s*\+?{_NUM}"
    ),
    re.compile(rf"/maps/(?:place|search|dir)/(?:[^/?]*/)?\+?{_NUM},\s*\+?{_NUM}"),
    re.compile(rf"@{_NUM},{_NUM}"),
]
_PLAIN_COORDS = re.compile(rf"^\s*{_NUM}\s*[, ]\s*{_NUM}\s*$")
_URL_IN_TEXT = re.compile(r"https?://\S+")

_SHORT_HOSTS = {"maps.app.goo.gl", "goo.gl", "g.co"}
_MAX_REDIRECTS = 6
_MAX_BODY = 1_000_000


def _valid(lat: float, lng: float) -> bool:
    return -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def _is_google_host(host: str) -> bool:
    host = host.lower()
    return host in _SHORT_HOSTS or host == "google.com" or host.endswith(".google.com")


def parse_coordinates(text: str) -> tuple[float, float] | None:
    """Coordinates from plain ``lat,lng`` text or a map URL that contains them."""
    text = unquote(unquote(text.strip()))
    m = _PLAIN_COORDS.match(text)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        return (lat, lng) if _valid(lat, lng) else None
    for pattern in _URL_PATTERNS:
        m = pattern.search(text)
        if m:
            lat, lng = float(m.group(1)), float(m.group(2))
            if _valid(lat, lng):
                return lat, lng
    return None


def extract_url(text: str) -> str | None:
    m = _URL_IN_TEXT.search(text)
    return m.group(0).rstrip(").,;") if m else None


async def resolve_map_location(text: str) -> tuple[float, float] | None:
    """Parse the pasted text; expand Google short links when needed."""
    direct = parse_coordinates(text)
    if direct:
        return direct

    url = extract_url(text)
    if not url or not _is_google_host(urlparse(url).hostname or ""):
        return None

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; AlbesatCarpetPro/1.0)",
        "Accept-Language": "en",
        # The API server is in the EU: skip Google's cookie-consent interstitial.
        "Cookie": "CONSENT=YES+cb; SOCS=CAI",
    }
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=False, headers=headers) as client:
        for _ in range(_MAX_REDIRECTS):
            parsed = urlparse(url)
            if parsed.scheme not in ("http", "https") or not _is_google_host(parsed.hostname or ""):
                return None
            # consent.google.com keeps the real destination in ?continue=
            if (parsed.hostname or "").startswith("consent."):
                cont = parse_qs(parsed.query).get("continue", [None])[0]
                if not cont:
                    return None
                url = cont
                found = parse_coordinates(url)
                if found:
                    return found
                continue

            try:
                resp = await client.get(url)
            except httpx.HTTPError:
                return None

            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    return None
                url = str(resp.url.join(location))
                found = parse_coordinates(url)
                if found:
                    return found
                continue

            if resp.status_code != 200:
                return None
            # Landed on a page whose URL has no coordinates (e.g. a named
            # place): the page itself embeds them in static-map / viewport URLs.
            return parse_coordinates(resp.text[:_MAX_BODY])
    return None
