"""
PDF Report Generator using ReportLab
"""

import io
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


# ─── Colours ──────────────────────────────────────────────────────────────────
PRIMARY   = colors.HexColor('#16a34a')
DARK      = colors.HexColor('#0f172a')
MUTED     = colors.HexColor('#64748b')
LIGHT_BG  = colors.HexColor('#f8fafc')
BORDER    = colors.HexColor('#e2e8f0')
SUCCESS   = colors.HexColor('#22c55e')
WARNING   = colors.HexColor('#f59e0b')
DANGER    = colors.HexColor('#ef4444')


def _style():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle('Title2',   parent=s['Title'],   fontSize=20, textColor=DARK,    spaceAfter=4))
    s.add(ParagraphStyle('Section',  parent=s['Heading2'],fontSize=12, textColor=PRIMARY,  spaceBefore=12, spaceAfter=4))
    s.add(ParagraphStyle('SubLabel', parent=s['Normal'],  fontSize=8,  textColor=MUTED,    spaceBefore=0, spaceAfter=1))
    s.add(ParagraphStyle('Value',    parent=s['Normal'],  fontSize=14, textColor=DARK,     fontName='Helvetica-Bold'))
    s.add(ParagraphStyle('Small',    parent=s['Normal'],  fontSize=8,  textColor=MUTED))
    s.add(ParagraphStyle('CenterB',  parent=s['Normal'],  fontSize=10, textColor=DARK,     fontName='Helvetica-Bold', alignment=TA_CENTER))
    s.add(ParagraphStyle('RightS',   parent=s['Normal'],  fontSize=8,  textColor=MUTED,    alignment=TA_RIGHT))
    return s


def _header(story, styles, title: str, subtitle: str, company: str = 'MIKAPEDIA Capital'):
    story.append(Paragraph(company, styles['Small']))
    story.append(Paragraph(title, styles['Title2']))
    story.append(Paragraph(subtitle, styles['Small']))
    story.append(HRFlowable(width='100%', thickness=1, color=PRIMARY, spaceAfter=8))


def _kpi_table(items: list[tuple[str, str]], styles) -> Table:
    """Render a row of KPI boxes: [(label, value), ...]"""
    cols = len(items)
    data = [
        [Paragraph(v, styles['Value']) for _, v in items],
        [Paragraph(l, styles['SubLabel']) for l, _ in items],
    ]
    t = Table(data, colWidths=[A4[0] / cols - 15] * cols)
    t.setStyle(TableStyle([
        ('BOX',        (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID',  (0,0), (-1,-1), 0.5, BORDER),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
    ]))
    return t


def _data_table(headers: list[str], rows: list[list], col_widths=None) -> Table:
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  PRIMARY),
        ('TEXTCOLOR',     (0,0), (-1,0),  colors.white),
        ('FONTNAME',      (0,0), (-1,0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, LIGHT_BG]),
        ('GRID',          (0,0), (-1,-1), 0.25, BORDER),
        ('TOPPADDING',    (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 5),
        ('ALIGN',         (0,0), (-1,-1), 'LEFT'),
    ]))
    return t


def generate_execution_pdf(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    s = _style()
    story = []

    _header(story, s,
            f"Execution Report — {data['period'].capitalize()}",
            f"{data['start']} to {data['end']}")

    story.append(_kpi_table([
        ('Total Signals',   str(data['totalSignals'])),
        ('Executed',        str(data['executed'])),
        ('Missed',          str(data['missed'])),
        ('Wrong Direction', str(data['wrongDirection'])),
        ('Execution Rate',  f"{data['executionRate']}%"),
    ], s))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Signal Log', s['Section']))
    headers = ['#', 'Pair', 'Dir', 'Fib', 'TP', 'SL', 'Time', 'Status', 'Exec%']
    rows = []
    for sig in data['signals']:
        rows.append([
            str(sig['id']),
            sig['pair'],
            sig['direction'],
            str(sig['fib_entry']),
            str(sig['take_profit']),
            str(sig['stop_loss']),
            str(sig['issued_at']),
            sig['status'],
            f"{sig['execution_rate']}%",
        ])
    story.append(_data_table(headers, rows))

    doc.build(story)
    return buf.getvalue()


def generate_attendance_pdf(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    s = _style()
    story = []

    _header(story, s,
            f"Attendance Report — {data['period'].capitalize()}",
            f"{data['start']} to {data['end']}")

    story.append(_kpi_table([
        ('Present',          str(data['present'])),
        ('Late',             str(data['late'])),
        ('Absent',           str(data['absent'])),
        ('Attendance Rate',  f"{data['attendanceRate']}%"),
        ('Total Traders',    str(data['totalTraders'])),
    ], s))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Check-in Records', s['Section']))
    headers = ['Trader', 'Date', 'Status', 'Check-in', 'GPS', 'IP', 'Validated']
    rows = []
    for r in data['records']:
        name = f"{r.get('user__first_name','')} {r.get('user__last_name','')}".strip()
        rows.append([
            name,
            str(r['date']),
            r['status'],
            str(r.get('check_in_time', '—')),
            '✓' if r.get('gps_valid') else '✗',
            r.get('ip_address', '—'),
            '✓' if r.get('is_validated') else '—',
        ])
    story.append(_data_table(headers, rows))

    doc.build(story)
    return buf.getvalue()


def generate_leaderboard_pdf(data: list[dict], period: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    s = _style()
    story = []

    start = data[0]['periodStart'] if data else ''
    end   = data[0]['periodEnd']   if data else ''
    _header(story, s,
            f"Discipline Leaderboard — {period.capitalize()}",
            f"{start} to {end} · Ranked by SOP adherence (not profit)")

    story.append(Paragraph(
        'Traders are ranked by Execution Rate, Compliance Score, Entry Accuracy and Timing Accuracy. '
        'Profit and loss are excluded from the ranking.',
        s['Small']
    ))
    story.append(Spacer(1, 8))

    headers = ['Rank', 'Trader', 'Account', 'Exec Rate', 'Compliance', 'Entry Acc', 'Timing Acc', 'Late', 'SOP Score']
    rows = []
    for r in data:
        rows.append([
            f"#{r['rank']}",
            r['name'],
            r.get('accountNumber', '—'),
            f"{r['executionRate']}%",
            f"{r['complianceScore']}%",
            f"{r['entryAccuracy']}%",
            f"{r['timingAccuracy']}%",
            str(r['lateEntries']),
            f"{r['sopScore']}",
        ])
    t = _data_table(headers, rows)
    # Colour rank column
    for i, r in enumerate(data, start=1):
        if r['rank'] == 1:
            t.setStyle(TableStyle([('BACKGROUND', (0,i), (0,i), colors.HexColor('#fef08a'))]))
        elif r['rank'] == 2:
            t.setStyle(TableStyle([('BACKGROUND', (0,i), (0,i), colors.HexColor('#e2e8f0'))]))
        elif r['rank'] == 3:
            t.setStyle(TableStyle([('BACKGROUND', (0,i), (0,i), colors.HexColor('#fed7aa'))]))
    story.append(t)

    doc.build(story)
    return buf.getvalue()


def generate_compliance_pdf(data: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    s = _style()
    story = []

    _header(story, s,
            f"Compliance Report — {data['period'].capitalize()}",
            f"{data['start']} to {data['end']}")

    story.append(_kpi_table([
        ('Avg Execution Rate',  f"{data['avgExecutionRate']}%"),
        ('Avg Compliance Score',f"{data['avgComplianceScore']}%"),
        ('Traders',             str(len(data['traders']))),
    ], s))
    story.append(Spacer(1, 10))

    story.append(Paragraph('Trader Compliance Breakdown', s['Section']))
    headers = ['Trader', 'Account', 'Exec Rate', 'Compliance', 'Entry Acc', 'Timing Acc', 'Late Entries']
    rows = [[
        t['name'], t.get('accountNumber', '—'),
        f"{t['executionRate']}%", f"{t['complianceScore']}%",
        f"{t['entryAccuracy']}%", f"{t['timingAccuracy']}%",
        str(t['lateEntries']),
    ] for t in data['traders']]
    story.append(_data_table(headers, rows))

    doc.build(story)
    return buf.getvalue()


def generate_session_pdf(data: dict) -> bytes:
    """Combined end-of-session report"""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm,
                             topMargin=15*mm, bottomMargin=15*mm)
    s = _style()
    story = []

    _header(story, s,
            f"End-of-Session Report",
            f"Session date: {data['sessionDate']}")

    # Execution summary
    ex = data['execution']
    story.append(Paragraph('Signal Execution', s['Section']))
    story.append(_kpi_table([
        ('Signals',        str(ex['totalSignals'])),
        ('Executed',       str(ex['executed'])),
        ('Missed',         str(ex['missed'])),
        ('Wrong Dir',      str(ex['wrongDirection'])),
        ('Exec Rate',      f"{ex['executionRate']}%"),
    ], s))
    story.append(Spacer(1, 8))

    # Attendance summary
    att = data['attendance']
    story.append(Paragraph('Attendance', s['Section']))
    story.append(_kpi_table([
        ('Present', str(att['present'])),
        ('Late',    str(att['late'])),
        ('Absent',  str(att['absent'])),
        ('Rate',    f"{att['attendanceRate']}%"),
    ], s))
    story.append(Spacer(1, 8))

    # Top 5 leaderboard
    story.append(Paragraph('Top 5 — SOP Leaderboard', s['Section']))
    headers = ['Rank', 'Trader', 'Exec Rate', 'Compliance', 'SOP Score']
    rows = [[
        f"#{r['rank']}", r['name'],
        f"{r['executionRate']}%", f"{r['complianceScore']}%", str(r['sopScore']),
    ] for r in data['leaderboard']]
    story.append(_data_table(headers, rows))

    doc.build(story)
    return buf.getvalue()
