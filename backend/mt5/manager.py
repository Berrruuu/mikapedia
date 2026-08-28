"""Centralized MT5 Connection Manager

Maintains lightweight session state per MT5 account (by login). Avoids
re-initializing the MT5 terminal on every request when possible. Performs
automatic reconnects, health checks, and exposes status for the frontend.

Notes:
- The `MetaTrader5` Python package is process-global (initialize/shutdown)
  so we limit reconnect churn by skipping redundant login attempts.
- Credentials are decrypted only when needed and not stored in plaintext.
"""
import threading
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

from django.utils import timezone
from django.conf import settings as django_settings

from .crypto import decrypt_password

logger = logging.getLogger('mt5.manager')

try:
    import MetaTrader5 as mt5  # type: ignore
    MT5_AVAILABLE = True
except Exception:
    mt5 = None
    MT5_AVAILABLE = False


class SessionInfo:
    def __init__(self, login: int, server: str):
        self.login = int(login)
        self.server = server
        self.connected = False
        self.last_heartbeat = None
        self.last_error = None
        self.lock = threading.RLock()
        self.meta = {}


class MT5ConnectionManager:
    _instance = None
    _instance_lock = threading.Lock()

    def __init__(self):
        self.sessions: dict[int, SessionInfo] = {}
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._stop = threading.Event()
        self._monitor_thread.start()

    @classmethod
    def instance(cls):
        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = MT5ConnectionManager()
        return cls._instance

    def ensure_session(self, login: int, password_encrypted: str, server: str) -> SessionInfo:
        login = int(login)
        if login not in self.sessions:
            self.sessions[login] = SessionInfo(login=login, server=server)

        sess = self.sessions[login]
        with sess.lock:
            if sess.connected:
                # already connected to this login — quick check
                return sess

            # attempt connect
            pwd = decrypt_password(password_encrypted)
            if not MT5_AVAILABLE:
                sess.connected = True
                sess.last_heartbeat = timezone.now()
                sess.meta = {'simulated': True}
                return sess

            try:
                if not mt5.initialize():
                    logger.warning('mt5.initialize() failed: %s', mt5.last_error())
                ok = mt5.login(login, password=pwd, server=server)
                if not ok:
                    err = mt5.last_error()
                    sess.connected = False
                    sess.last_error = str(err)
                    raise RuntimeError(f"MT5 login failed: {err}")

                sess.connected = True
                sess.last_heartbeat = timezone.now()
                try:
                    info = mt5.account_info()
                    sess.meta = {'account_info': info}
                except Exception:
                    sess.meta = {}
                return sess
            except Exception as e:
                sess.connected = False
                sess.last_error = str(e)
                logger.exception('Failed to ensure session for %s', login)
                raise

    def get_status(self, login: int) -> dict:
        sess = self.sessions.get(int(login))
        if not sess:
            return {'connected': False, 'last_heartbeat': None, 'last_error': None}
        return {
            'connected': sess.connected,
            'last_heartbeat': sess.last_heartbeat.isoformat() if sess.last_heartbeat else None,
            'last_error': sess.last_error,
        }

    def _monitor_loop(self):
        while not self._stop.is_set():
            try:
                self._run_health_checks()
            except Exception:
                logger.exception('MT5 monitor loop error')
            time.sleep(10)

    def _run_health_checks(self):
        for login, sess in list(self.sessions.items()):
            with sess.lock:
                if not sess.connected:
                    continue
                if not MT5_AVAILABLE:
                    sess.last_heartbeat = timezone.now()
                    continue
                try:
                    # lightweight ping: account_info
                    info = mt5.account_info()
                    if info is None:
                        # mark disconnected and attempt reconnect once
                        sess.connected = False
                        sess.last_error = 'account_info returned None'
                        logger.warning('Session %s lost — will attempt reconnect', login)
                        # try reconnect in background
                        try:
                            mt5.shutdown()
                        except Exception:
                            pass
                        # don't block here; reconnect will be attempted by ensure_session on demand
                    else:
                        sess.last_heartbeat = timezone.now()
                except Exception as e:
                    sess.connected = False
                    sess.last_error = str(e)

    def stop(self):
        self._stop.set()


manager = MT5ConnectionManager.instance()
