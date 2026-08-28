import os
import base64
from cryptography.fernet import Fernet
from django.conf import settings as django_settings


def _get_fernet() -> Fernet:
    key = os.environ.get('MT5_ENCRYPTION_KEY', '')
    if not key:
        import hashlib
        raw = hashlib.sha256(django_settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(raw).decode()
    return Fernet(key.encode())


def encrypt_password(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_password(ciphertext: str) -> str:
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return ''
