import uuid

import pytest

from src.core.qr_security import decode_and_verify, generate_signed_code


def test_generate_and_verify_valid_code():
    carpet_id = uuid.uuid4()
    carpet_code = "QC-1402-0042"
    full_code, sig_hash = generate_signed_code(carpet_id, carpet_code)

    assert full_code.startswith("FZ.")
    assert len(sig_hash) == 64

    decoded = decode_and_verify(full_code)
    assert decoded is not None
    assert decoded["carpet_id"] == carpet_id
    assert decoded["carpet_code"] == carpet_code


def test_reject_tampered_signature():
    carpet_id = uuid.uuid4()
    full_code, _ = generate_signed_code(carpet_id, "QC-TEST-0001")
    parts = full_code.split(".")
    tampered = f"{parts[0]}.{parts[1]}.deadbeefdeadbeef"
    assert decode_and_verify(tampered) is None


def test_reject_invalid_prefix():
    assert decode_and_verify("INVALID.code.here") is None


def test_reject_empty_code():
    assert decode_and_verify("") is None


def test_different_carpet_different_codes():
    id1, id2 = uuid.uuid4(), uuid.uuid4()
    code1, _ = generate_signed_code(id1, "CARPET-A")
    code2, _ = generate_signed_code(id2, "CARPET-B")
    assert code1 != code2
