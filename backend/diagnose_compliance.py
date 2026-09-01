#!/usr/bin/env python
"""
Diagnostic Script: Compliance Engine Check
===========================================
Run: python diagnose_compliance.py

Checks:
1. Are there active signals today?
2. Does user have open positions?
3. Are positions matched to signals?
4. Are compliance results created?
5. Are violations detected?
6. Are notifications sent?


import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from signals.models import Signal
from mt5.models import MT5Account, MT5Position, Trade
from compliance.models import ComplianceResult, SOPWarning
from notifications.models import Notification
from users.models import User

def main():
    print("="*70)
    print("COMPLIANCE ENGINE DIAGNOSTIC")
    print("="*70)
    
    today = timezone.localdate()
    print(f"\n📅 Date: {today}")
    
    # 1. Check Signals
    print("\n" + "="*70)
    print("1. ACTIVE SIGNALS TODAY")
    print("="*70)
    
    signals = Signal.objects.filter(session_date=today)
    print(f"Total signals today: {signals.count()}")
    
    for sig in signals:
        print(f"\n  Signal #{sig.id}:")
        print(f"    Pair: {sig.pair}")
        print(f"    Direction: {sig.direction}")
        print(f"    Time: {sig.time}")
        print(f"    Max Entry: {sig.max_entry_time}")
        print(f"    Status: {sig.status}")
        print(f"    Fib 0.236: {sig.fib_0236}")
        print(f"    Fib 0.500: {sig.fib_0500}")
        print(f"    Fib 0.618: {sig.fib_0618}")
        print(f"    SL: {sig.stop_loss}")
        print(f"    TP: {sig.take_profit}")
    
    if signals.count() == 0:
        print("\n⚠️  WARNING: No signals today!")
        print("   Compliance engine needs signals to match against.")
        print("   Create a test signal via admin panel or TradingView webhook.")
    
    # 2. Check MT5 Accounts
    print("\n" + "="*70)
    print("2. MT5 ACCOUNTS & POSITIONS")
    print("="*70)
    
    accounts = MT5Account.objects.all()
    print(f"Total MT5 accounts: {accounts.count()}")
    
    for acc in accounts:
        print(f"\n  Account #{acc.id} (Login: {acc.login}):")
        print(f"    User: {acc.user.email}")
        print(f"    Status: {acc.status}")
        print(f"    Balance: ${acc.balance}")
        print(f"    Open Positions: {acc.open_positions}")
        print(f"    Last Sync: {acc.last_sync}")
        
        positions = acc.positions.all()
        print(f"\n    Positions ({positions.count()}):")
        for pos in positions:
            print(f"      - {pos.symbol} {pos.type} @ {pos.price_open} (ticket: {pos.ticket})")
        
        if positions.count() == 0:
            print("      (no open positions)")
    
    # 3. Check Trade Models (compliance tracking)
    print("\n" + "="*70)
    print("3. TRADE RECORDS (Compliance Tracking)")
    print("="*70)
    
    trades = Trade.objects.filter(open_time__date=today)
    print(f"Total trades today: {trades.count()}")
    
    for trade in trades:
        print(f"\n  Trade #{trade.ticket}:")
        print(f"    User: {trade.user.email}")
        print(f"    Symbol: {trade.symbol}")
        print(f"    Direction: {trade.direction}")
        print(f"    Entry Price: {trade.entry_price}")
        print(f"    Volume: {trade.volume} lots")
        print(f"    Order Type: {trade.order_type}")
        print(f"    Status: {trade.status}")
        print(f"    Linked Signal: #{trade.signal_id} ({trade.signal.pair if trade.signal else 'None'})")
        print(f"    SL: {trade.stop_loss}")
        print(f"    TP: {trade.take_profit}")
        print(f"    Open Time: {trade.open_time}")
    
    if trades.count() == 0:
        print("\n⚠️  No trades today in Trade model!")
        print("   This could mean:")
        print("   - EA hasn't pushed data yet")
        print("   - Signal matcher hasn't matched positions to signals")
        print("   - Positions were opened on a different day")
    
    # 4. Check Compliance Results
    print("\n" + "="*70)
    print("4. COMPLIANCE RESULTS")
    print("="*70)
    
    results = ComplianceResult.objects.filter(created_at__date=today)
    print(f"Total compliance results today: {results.count()}")
    
    for result in results:
        print(f"\n  Result #{result.id}:")
        print(f"    User: {result.user.email}")
        print(f"    Signal: #{result.signal_id} ({result.signal.pair if result.signal else 'None'})")
        print(f"    Status: {result.status}")
        print(f"    Score: {result.score}/100")
        print(f"    Violations: {result.violations}")
        print(f"    Entry Count: {result.entry_count}/3")
        print(f"    Coaching Note: {result.coaching_note}")
        print(f"    Created: {result.created_at}")
    
    if results.count() == 0:
        print("\n⚠️  No compliance results today!")
        print("   This means compliance engine hasn't evaluated any trades yet.")
        print("   Possible reasons:")
        print("   - No signals to match against")
        print("   - Trades not created (EA not pushing data)")
        print("   - Signal matcher not running (check EA endpoint logs)")
    
    # 5. Check SOP Warnings
    print("\n" + "="*70)
    print("5. SOP WARNINGS")
    print("="*70)
    
    warnings = SOPWarning.objects.filter(created_at__date=today)
    print(f"Total warnings today: {warnings.count()}")
    
    for warn in warnings:
        print(f"\n  Warning #{warn.id}:")
        print(f"    User: {warn.user.email}")
        print(f"    Type: {warn.violation_type}")
        print(f"    Severity: {warn.severity}")
        print(f"    Message: {warn.message}")
        print(f"    Created: {warn.created_at}")
    
    # 6. Check Notifications
    print("\n" + "="*70)
    print("6. NOTIFICATIONS")
    print("="*70)
    
    notifications = Notification.objects.filter(
        type='compliance',
        created_at__date=today
    )
    print(f"Total compliance notifications today: {notifications.count()}")
    
    for notif in notifications:
        recipient = notif.recipient.email if notif.recipient else 'All Admins'
        print(f"\n  Notification #{notif.id}:")
        print(f"    To: {recipient}")
        print(f"    Level: {notif.level}")
        print(f"    Title: {notif.title}")
        print(f"    Body: {notif.body}")
        print(f"    Read: {notif.read}")
        print(f"    Created: {notif.created_at}")
    
    # 7. Summary & Recommendations
    print("\n" + "="*70)
    print("7. DIAGNOSIS SUMMARY")
    print("="*70)
    
    issues = []
    
    if signals.count() == 0:
        issues.append("❌ No signals today → Create signal via admin or TradingView webhook")
    else:
        print("✅ Signals found")
    
    if accounts.count() == 0:
        issues.append("❌ No MT5 accounts → Connect MT5 account first")
    elif all(acc.open_positions == 0 for acc in accounts):
        issues.append("⚠️  No open positions → Open a trade in MT5 to test")
    else:
        print("✅ MT5 accounts with positions found")
    
    if trades.count() == 0:
        issues.append("❌ No trades in database → EA might not be pushing data or signal matcher not running")
    else:
        print("✅ Trades found in database")
    
    if results.count() == 0:
        issues.append("❌ No compliance results → Compliance engine not evaluating")
    else:
        print("✅ Compliance results found")
        
        violations_found = any(len(r.violations) > 0 for r in results)
        if violations_found:
            print("✅ Violations detected")
        else:
            print("⚠️  No violations detected → Trades might be compliant or evaluation logic needs check")
    
    if warnings.count() == 0 and results.count() > 0:
        # Check if there are results with violations
        violation_results = [r for r in results if len(r.violations) > 0]
        if violation_results:
            issues.append("⚠️  Violations found but no warnings issued → Check _issue_warnings() logic")
        else:
            print("✅ No warnings expected (no violations)")
    
    if notifications.count() == 0 and results.count() > 0:
        issues.append("⚠️  Compliance evaluated but no notifications sent → Check _notify_trader() logic")
    else:
        print("✅ Notifications sent")
    
    print("\n" + "="*70)
    if issues:
        print("ISSUES DETECTED:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("✅ ALL CHECKS PASSED!")
        print("Compliance engine is working correctly.")
    
    print("\n" + "="*70)
    print("NEXT STEPS:")
    print("="*70)
    
    if signals.count() == 0:
        print("\n1. Create a test signal:")
        print("   - Go to admin panel → Signals → Add Signal")
        print("   - Or send TradingView webhook to trigger auto-create")
        print("   - Set session_date to TODAY")
        print("   - Set status to 'Pending' or 'Waiting'")
    
    if accounts.count() == 0 or all(acc.open_positions == 0 for acc in accounts):
        print("\n2. Open a position in MT5:")
        print("   - Make sure EA is running")
        print("   - Place a trade (market or limit order)")
        print("   - Wait 1-2 seconds for EA to push data")
    
    if trades.count() == 0 and accounts.count() > 0:
        print("\n3. Check EA logs:")
        print("   - MT5 → Experts tab → Look for EA logs")
        print("   - Should see: '✓ Data sent: X positions, Y pending, Z deals'")
        print("   - If no logs → EA not running or attached")
        print("   - If error logs → URL not whitelisted or token mismatch")
    
    if trades.count() > 0 and results.count() == 0:
        print("\n4. Manually trigger signal matcher:")
        print("   python manage.py shell")
        print("   >>> from mt5.signal_matcher import match_account_to_signals")
        print("   >>> from mt5.models import MT5Account")
        print("   >>> acc = MT5Account.objects.first()")
        print("   >>> match_account_to_signals(acc)")
    
    print("\n" + "="*70)


if __name__ == '__main__':
    main()
