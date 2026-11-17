from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time
from io import BytesIO
import re
from zoneinfo import ZoneInfo

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from .models import MT5Account, MT5Deal


JAKARTA = ZoneInfo('Asia/Jakarta')
PIP_CURRENCIES = {
    'AUD', 'CAD', 'CHF', 'CNH', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
    'HUF', 'JPY', 'MXN', 'NOK', 'NZD', 'PLN', 'SEK', 'SGD', 'TRY',
    'USD', 'ZAR',
}
SESSION_RANGES = (
    (time(6), time(10), 'ASIA'),
    (time(10), time(18), 'LONDON'),
    (time(18), time(23), 'NEWYORK'),
)


@dataclass(frozen=True)
class JournalRow:
    close_time: datetime
    session: str
    result: str
    pips: float | None
    net_profit: float
    position_id: int


def _local_time(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if timezone.is_aware(value):
        return timezone.localtime(value, JAKARTA)
    return value.replace(tzinfo=JAKARTA)


def _session_for(value: datetime) -> str:
    local_time = value.timetz().replace(tzinfo=None)
    for start, end, session in SESSION_RANGES:
        if start <= local_time < end:
            return session
    return 'MIDNIGHT'


def _pip_size_for(deal: MT5Deal) -> float | None:
    if deal.pip_size and deal.pip_size > 0:
        return deal.pip_size

    symbol = re.sub(r'[^A-Z]', '', deal.symbol.upper())
    if len(symbol) < 6:
        return None
    base, quote = symbol[:3], symbol[3:6]
    if base not in PIP_CURRENCIES or quote not in PIP_CURRENCIES:
        return None
    return 0.01 if quote == 'JPY' else 0.0001


def _closed_positions(deals: list[MT5Deal]) -> list[JournalRow]:
    grouped: dict[int, list[MT5Deal]] = defaultdict(list)
    for deal in deals:
        if deal.position_id:
            grouped[deal.position_id].append(deal)

    journal_rows = []
    for position_deals in grouped.values():
        position_deals.sort(
            key=lambda deal: (
                _local_time(deal.time) or datetime.min.replace(tzinfo=JAKARTA),
                deal.ticket,
            )
        )
        entries = [deal for deal in position_deals if deal.entry == 'IN']
        exits = [deal for deal in position_deals if deal.entry in ('OUT', 'OUT_BY', 'INOUT')]
        entry_volume = sum(deal.volume for deal in entries)
        exit_volume = sum(deal.volume for deal in exits)
        if not entries or not exits or entry_volume <= 0 or exit_volume + 1e-8 < entry_volume:
            continue

        direction = entries[0].type.upper()
        if direction not in ('BUY', 'SELL'):
            continue
        entry_price = sum(deal.price * deal.volume for deal in entries) / entry_volume
        exit_price = sum(deal.price * deal.volume for deal in exits) / exit_volume
        pip_size = next(
            (size for deal in entries if (size := _pip_size_for(deal)) is not None),
            None,
        )
        pips = None
        if pip_size:
            price_change = exit_price - entry_price
            pips = (price_change if direction == 'BUY' else -price_change) / pip_size

        close_time = max(
            (_local_time(deal.time) for deal in exits if deal.time is not None),
            default=None,
        )
        if close_time is None:
            continue

        net_profit = sum(
            deal.profit + deal.swap + deal.commission
            for deal in position_deals
        )
        journal_rows.append(JournalRow(
            close_time=close_time,
            session=_session_for(close_time),
            result='PROFIT' if net_profit >= 0 else 'LOSS',
            pips=pips,
            net_profit=net_profit,
            position_id=position_deals[0].position_id,
        ))

    return sorted(journal_rows, key=lambda row: (row.close_time, row.position_id))


def _in_date_range(value: datetime, start_date: date | None, end_date: date | None) -> bool:
    return (start_date is None or value.date() >= start_date) and (
        end_date is None or value.date() <= end_date
    )


def _style_header(sheet, row: int, columns: int) -> None:
    for column in range(1, columns + 1):
        cell = sheet.cell(row=row, column=column)
        cell.fill = PatternFill('solid', fgColor='17365D')
        cell.font = Font(color='FFFFFF', bold=True)
        cell.alignment = Alignment(horizontal='center', vertical='center')


def build_journal_workbook(
    account: MT5Account,
    start_date: date | None = None,
    end_date: date | None = None,
) -> bytes:
    all_deals = list(
        MT5Deal.objects.filter(account=account).order_by('time', 'ticket')
    )
    closed_positions = [
        row for row in _closed_positions(all_deals)
        if _in_date_range(row.close_time, start_date, end_date)
    ]
    raw_deals = []
    for deal in all_deals:
        local_time = _local_time(deal.time)
        if local_time is not None and _in_date_range(local_time, start_date, end_date):
            raw_deals.append(deal)

    workbook = Workbook()
    journal = workbook.active
    journal.title = '0'
    journal.sheet_view.showGridLines = False
    journal['A1'] = 'Equity'
    journal['B1'] = account.balance
    journal['C1'] = 'Currency'
    journal['D1'] = account.currency
    journal['A2'] = 'MT5 Account'
    journal['B2'] = account.account_number
    journal['A3'] = 'Sesi WIB: Asia 06:00-10:00; London 10:00-18:00; New York 18:00-23:00; Midnight 23:00-06:00'
    journal.merge_cells('A3:F3')
    journal['A3'].font = Font(italic=True, color='666666')

    headers = ['DATE', 'SESION', 'PROFIT/LOSS', 'PIPS', 'BALANCE', 'NET P/L']
    for column, header in enumerate(headers, start=1):
        journal.cell(row=4, column=column, value=header)
    _style_header(journal, 4, len(headers))
    for row_number, row in enumerate(closed_positions, start=5):
        journal.cell(row_number, 1, row.close_time.replace(tzinfo=None))
        journal.cell(row_number, 2, row.session)
        journal.cell(row_number, 3, row.result)
        journal.cell(row_number, 4, row.pips)
        journal.cell(row_number, 5, f'=$B$1+SUM($F$5:F{row_number})')
        journal.cell(row_number, 6, row.net_profit)
        journal.cell(row_number, 1).number_format = 'yyyy-mm-dd hh:mm'
        journal.cell(row_number, 4).number_format = '0.00'
        journal.cell(row_number, 5).number_format = '#,##0.00'
        journal.cell(row_number, 6).number_format = '#,##0.00'
        journal.cell(row_number, 6).font = Font(
            color='008000' if row.net_profit >= 0 else 'C00000'
        )

    last_row = max(5, 4 + len(closed_positions))
    journal['G4'] = 'TOTAL'
    journal['H4'] = f'=COUNTA(A5:A{last_row})'
    overall_summary = (
        ('TP', f'=COUNTIF(C5:C{last_row},"PROFIT")'),
        ('LOSS', f'=COUNTIF(C5:C{last_row},"LOSS")'),
        ('NETT', f'=SUM(F5:F{last_row})'),
        ('PROBABILITAS', f'=IFERROR(COUNTIF(C5:C{last_row},"PROFIT")/H4,0)'),
        ('PROFIT', f'=SUMIF(C5:C{last_row},"PROFIT",F5:F{last_row})'),
    )
    for row_number, (label, formula) in enumerate(overall_summary, start=5):
        journal.cell(row_number, 7, label)
        journal.cell(row_number, 8, formula)

    for session, heading_row in (
        ('ASIA', 11),
        ('LONDON', 19),
        ('NEWYORK', 27),
        ('MIDNIGHT', 35),
    ):
        journal.cell(heading_row, 7, session)
        session_summary = (
            ('TOTAL', f'=COUNTIF(B5:B{last_row},G{heading_row})'),
            ('TP', f'=COUNTIFS(B5:B{last_row},G{heading_row},C5:C{last_row},"PROFIT")'),
            ('LOSS', f'=COUNTIFS(B5:B{last_row},G{heading_row},C5:C{last_row},"LOSS")'),
            (
                'NETT',
                f'=COUNTIFS(B5:B{last_row},G{heading_row},C5:C{last_row},"PROFIT")'
                f'-COUNTIFS(B5:B{last_row},G{heading_row},C5:C{last_row},"LOSS")',
            ),
            (
                'PROBABILITAS',
                f'=IFERROR(COUNTIFS(B5:B{last_row},G{heading_row},C5:C{last_row},"PROFIT")'
                f'/COUNTIF(B5:B{last_row},G{heading_row}),0)',
            ),
            ('PROFIT', f'=SUMIF(B5:B{last_row},G{heading_row},F5:F{last_row})'),
        )
        for offset, (label, formula) in enumerate(session_summary, start=1):
            journal.cell(heading_row + offset, 7, label)
            journal.cell(heading_row + offset, 8, formula)
    _style_header(journal, 4, 8)

    widths = {1: 19, 2: 14, 3: 16, 4: 12, 5: 16, 6: 16, 7: 18, 8: 16}
    for column, width in widths.items():
        journal.column_dimensions[get_column_letter(column)].width = width
    journal.freeze_panes = 'A5'
    journal.auto_filter.ref = f'A4:F{max(4, 4 + len(closed_positions))}'

    deals_sheet = workbook.create_sheet('MT5 Deals')
    deal_headers = [
        'Ticket', 'Order', 'Position ID', 'Symbol', 'Type', 'Entry',
        'Volume', 'Price', 'Pip Size', 'Profit', 'Swap', 'Commission',
        'Net P/L', 'Comment', 'Magic', 'Time (WIB)',
    ]
    for column, header in enumerate(deal_headers, start=1):
        deals_sheet.cell(row=1, column=column, value=header)
    _style_header(deals_sheet, 1, len(deal_headers))
    for row_number, deal in enumerate(raw_deals, start=2):
        local_time = _local_time(deal.time)
        values = [
            deal.ticket, deal.order, deal.position_id or None, deal.symbol,
            deal.type, deal.entry, deal.volume, deal.price, deal.pip_size,
            deal.profit, deal.swap, deal.commission,
            deal.profit + deal.swap + deal.commission, deal.comment,
            deal.magic, local_time.replace(tzinfo=None) if local_time else None,
        ]
        for column, value in enumerate(values, start=1):
            deals_sheet.cell(row_number, column, value)
        deals_sheet.cell(row_number, 16).number_format = 'yyyy-mm-dd hh:mm:ss'
        for column in (7, 8, 9, 10, 11, 12, 13):
            deals_sheet.cell(row_number, column).number_format = '0.00####'
    for column, width in enumerate(
        (16, 16, 18, 14, 10, 12, 12, 14, 12, 14, 12, 14, 14, 32, 14, 22),
        start=1,
    ):
        deals_sheet.column_dimensions[get_column_letter(column)].width = width
    deals_sheet.freeze_panes = 'A2'
    deals_sheet.auto_filter.ref = f'A1:P{max(1, len(raw_deals) + 1)}'

    workbook.calculation.fullCalcOnLoad = True
    workbook.calculation.forceFullCalc = True
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()
