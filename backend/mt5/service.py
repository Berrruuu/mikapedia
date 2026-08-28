"""
MT5 Service Layer
Handles all MetaTrader 5 connections using the Python MetaTrader5 package.

Windows-only: MetaTrader5 package requires Windows + MT5 terminal installed.
On non-Windows (Linux/Mac), falls back to demo/simulated data automatically.
"""

import base64
import logging
import os
import platform
from datetime import datetime, timedelta, timezone
from typing import Optional

from django.conf import settings as django_settings
from .crypto import encrypt_password, decrypt_password
from .manager import manager as mt5_manager

logger = logging.getLogger(__name__)

# ─── Encryption ───────────────────────────────────────────────────────────────

# encryption helpers moved to mt5.crypto


# ─── MT5 availability check ───────────────────────────────────────────────────

def _is_mt5_available() -> bool:
    # Check env override first
    from decouple import config as env_config
    if env_config('MT5_USE_SIMULATION', default=False, cast=bool):
        logger.info("MT5_USE_SIMULATION=True — using simulated data")
        return False
    if platform.system() != 'Windows':
        return False
    try:
        import MetaTrader5 as _mt5  # noqa: F401
        return True
    except ImportError:
        return False


MT5_AVAILABLE = _is_mt5_available()

if MT5_AVAILABLE:
    import MetaTrader5 as mt5
    logger.info("MetaTrader5 package available — real MT5 integration active")
else:
    logger.warning("MetaTrader5 not available — using simulated data (install on Windows with MT5 terminal)")


# ─── Connection Manager ───────────────────────────────────────────────────────

class MT5ConnectionError(Exception):
    pass


def connect(login: int, password: str, server: str) -> dict:
    """
    Connect to MT5 terminal.
    Returns account info dict or raises MT5ConnectionError.
    """
    # Prefer using the centralized manager to avoid repeated logins.
    sess = mt5_manager.ensure_session(login, password, server)
    # Attempt to extract account info from manager meta, fallback to calling mt5
    if not MT5_AVAILABLE:
        return _simulate_account_info(login, server)

    try:
        info = mt5.account_info()
        if info is None:
            raise MT5ConnectionError('account_info returned None')
        return _account_info_to_dict(info)
    except Exception as e:
        raise MT5ConnectionError(str(e))


def get_account_snapshot(login: int, password: str, server: str) -> dict:
    """
    Full account snapshot: info + positions + orders + recent deals
    """
    if not MT5_AVAILABLE:
        return _simulate_full_snapshot(login, server)

    # Ensure a pooled session exists for this login
    mt5_manager.ensure_session(login, password, server)

    try:
        info = mt5.account_info()
        positions = mt5.positions_get() or []
        orders = mt5.orders_get() or []
        from_date = datetime.now(tz=timezone.utc) - timedelta(days=30)
        deals = mt5.history_deals_get(from_date, datetime.now(tz=timezone.utc)) or []

        result = {
            'account': _account_info_to_dict(info),
            'positions': [_position_to_dict(p) for p in positions],
            'orders':    [_order_to_dict(o) for o in orders],
            'deals':     [_deal_to_dict(d) for d in deals[:100]],
        }
        return result
    except Exception as e:
        raise MT5ConnectionError(str(e))


# ─── Data converters ──────────────────────────────────────────────────────────

def _account_info_to_dict(info) -> dict:
    balance  = getattr(info, 'balance', 0) or 0
    equity   = getattr(info, 'equity', 0) or 0
    drawdown = round((1 - equity / balance) * 100, 2) if balance > 0 else 0
    return {
        'login':            getattr(info, 'login', 0),
        'balance':          round(balance, 2),
        'equity':           round(equity, 2),
        'floating_pnl':     round(getattr(info, 'profit', 0) or 0, 2),
        'margin':           round(getattr(info, 'margin', 0) or 0, 2),
        'free_margin':      round(getattr(info, 'margin_free', 0) or 0, 2),
        'margin_level':     round(getattr(info, 'margin_level', 0) or 0, 2),
        'drawdown':         drawdown,
        'currency':         getattr(info, 'currency', 'USD'),
        'leverage':         getattr(info, 'leverage', 100),
        'company':          getattr(info, 'company', ''),
        'server':           getattr(info, 'server', ''),
        'name':             getattr(info, 'name', ''),
        'is_demo':          getattr(info, 'trade_mode', 0) == 1,
    }


def _position_to_dict(p) -> dict:
    type_map = {0: 'BUY', 1: 'SELL'}
    return {
        'ticket':        p.ticket,
        'symbol':        p.symbol,
        'type':          type_map.get(p.type, 'BUY'),
        'volume':        p.volume,
        'price_open':    p.price_open,
        'price_current': p.price_current,
        'sl':            p.sl or None,
        'tp':            p.tp or None,
        'profit':        round(p.profit, 2),
        'swap':          round(p.swap, 2),
        'comment':       p.comment,
        'magic':         p.magic,
        'time_open':     datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat() if p.time else None,
    }


def _order_to_dict(o) -> dict:
    type_map = {0:'BUY',1:'SELL',2:'BUY LIMIT',3:'SELL LIMIT',4:'BUY STOP',5:'SELL STOP'}
    return {
        'ticket':     o.ticket,
        'symbol':     o.symbol,
        'type':       type_map.get(o.type, str(o.type)),
        'volume':     o.volume_current,
        'price_open': o.price_open,
        'sl':         o.sl or None,
        'tp':         o.tp or None,
        'comment':    o.comment,
        'magic':      o.magic,
        'time_setup': datetime.fromtimestamp(o.time_setup, tz=timezone.utc).isoformat() if o.time_setup else None,
    }


def _deal_to_dict(d) -> dict:
    type_map = {0: 'BUY', 1: 'SELL'}
    entry_map = {0: 'IN', 1: 'OUT', 2: 'INOUT', 3: 'OUT_BY'}
    return {
        'ticket':     d.ticket,
        'order':      d.order,
        'symbol':     d.symbol,
        'type':       type_map.get(d.type, str(d.type)),
        'entry':      entry_map.get(d.entry, 'IN'),
        'volume':     d.volume,
        'price':      d.price,
        'profit':     round(d.profit, 2),
        'swap':       round(d.swap, 2),
        'commission': round(d.commission, 2),
        'comment':    d.comment,
        'magic':      d.magic,
        'time':       datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat() if d.time else None,
    }


# ─── Simulation (dev / non-Windows) ──────────────────────────────────────────

import random
import math

def _simulate_account_info(login: int, server: str) -> dict:
    seed = login % 1000
    now = time.time()
    drift = math.sin(now / 30.0 + seed / 100.0) * 120.0
    balance = 10000 + (seed * 47.3) + drift
    equity = balance + (seed * 4.1 - 100) + math.sin(now / 15.0) * 20.0
    return {
        'login': login, 'balance': round(balance, 2), 'equity': round(equity, 2),
        'floating_pnl': round(equity - balance, 2),
        'margin': round(balance * 0.03, 2), 'free_margin': round(equity * 0.97, 2),
        'margin_level': round((equity / (balance * 0.03)) * 100, 2) if balance > 0 else 0,
        'drawdown': round(max(0, (balance - equity) / balance * 100), 2),
        'currency': 'USD', 'leverage': 100, 'company': f'Demo Broker ({server})',
        'server': server, 'name': f'Account {login}', 'is_demo': True,
    }


def _simulate_full_snapshot(login: int, server: str) -> dict:
    seed = login % 1000
    now = time.time()
    account = _simulate_account_info(login, server)

    pairs = ['XAUUSD', 'EURUSD', 'GBPJPY', 'USDJPY']
    positions = []
    for i in range(seed % 4):
        sym = pairs[i % len(pairs)]
        tp = 0 if i % 2 == 0 else 1
        base_price = {'XAUUSD': 2400, 'EURUSD': 1.09, 'GBPJPY': 198, 'USDJPY': 155}.get(sym, 1.0)
        price_delta = math.sin(now / ((i + 1) * 10.0) + seed / 50.0) * (0.5 if sym != 'XAUUSD' else 5.0)
        current_price = base_price + (0.3 if tp == 0 else -0.3) + price_delta
        profit_base = (seed * 0.7 + i * 12.3) * (1 if tp == 0 else -1)
        profit = round(profit_base + price_delta * 10.0, 2)

        positions.append({
            'ticket': 10000000 + login + i,
            'symbol': sym,
            'type': 'BUY' if i % 2 == 0 else 'SELL',
            'volume': round(0.1 * (i + 1), 2),
            'price_open': round(base_price - 0.5, 5),
            'price_current': round(current_price, 5),
            'sl': round(base_price - 1.5, 5),
            'tp': round(base_price + 2.0, 5),
            'profit': profit,
            'swap': -0.5, 'comment': 'MIKAPEDIA', 'magic': 12345,
            'time_open': (datetime.now(tz=timezone.utc) - timedelta(hours=i+1)).isoformat(),
        })

    orders = []
    deals = []
    for i in range(min(seed % 5, 3)):
        sym = pairs[(i + 2) % len(pairs)]
        base_price = {'XAUUSD': 2400, 'EURUSD': 1.09, 'GBPJPY': 198, 'USDJPY': 155}.get(sym, 1.0)
        deals.append({
            'ticket': 20000000 + login + i,
            'order': 30000000 + login + i,
            'symbol': sym,
            'type': 'BUY' if i % 2 == 0 else 'SELL',
            'entry': 'OUT' if i % 2 == 0 else 'IN',
            'volume': 0.1,
            'price': round(base_price + math.sin(now / 20.0 + i) * 1.0, 5),
            'profit': round(math.sin(now / 15.0 + i) * 30.0, 2),
            'swap': -0.3, 'commission': -1.5, 'comment': '', 'magic': 0,
            'time': (datetime.now(tz=timezone.utc) - timedelta(hours=i * 3 + 2)).isoformat(),
        })

    return {'account': account, 'positions': positions, 'orders': orders, 'deals': deals}
