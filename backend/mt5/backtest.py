from decimal import Decimal


def calculate_backtest_metrics(journal):
    starting_balance = journal.starting_balance
    balance = starting_balance
    peak_balance = starting_balance
    max_drawdown = Decimal('0')
    max_drawdown_percent = Decimal('0')
    gross_profit = Decimal('0')
    gross_loss = Decimal('0')
    wins = losses = breakeven = 0
    current_loss_streak = max_loss_streak = 0

    trades = journal.trades.all().order_by('trade_date', 'created_at', 'id')
    for trade in trades:
        balance += trade.net_pl
        if trade.net_pl > 0:
            wins += 1
            gross_profit += trade.net_pl
            current_loss_streak = 0
        elif trade.net_pl < 0:
            losses += 1
            gross_loss += abs(trade.net_pl)
            current_loss_streak += 1
            max_loss_streak = max(max_loss_streak, current_loss_streak)
        else:
            breakeven += 1
            current_loss_streak = 0

        peak_balance = max(peak_balance, balance)
        drawdown = peak_balance - balance
        max_drawdown = max(max_drawdown, drawdown)
        if peak_balance > 0:
            max_drawdown_percent = max(
                max_drawdown_percent,
                drawdown / peak_balance * Decimal('100'),
            )

    total_trades = wins + losses + breakeven
    return {
        'totalTrades': total_trades,
        'winningTrades': wins,
        'losingTrades': losses,
        'breakevenTrades': breakeven,
        'winRate': round((wins / total_trades * 100) if total_trades else 0, 2),
        'grossProfit': float(gross_profit),
        'grossLoss': float(gross_loss),
        'netProfit': float(balance - starting_balance),
        'endingBalance': float(balance),
        'maxDrawdown': float(max_drawdown),
        'maxDrawdownPercent': round(float(max_drawdown_percent), 2),
        'maxConsecutiveLosses': max_loss_streak,
    }
