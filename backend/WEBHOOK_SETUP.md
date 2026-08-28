# TradingView Webhook Setup Guide

## Timing Signal (SOP)

```
Candle close (bar_time) : 20:45  ← dikirim Pine Script via bar_time
Max entry (5 menit)     : 20:50  ← Executed jika entry sebelum ini
Late zone               : 20:50 – 21:00
Expires / Missed        : 21:00  ← candle berikutnya close = signal kadaluarsa
```

---

## Kenapa error?

| Error | Penyebab | Solusi |
|-------|----------|--------|
| 502 Bad Gateway | Server tidak bisa diakses dari internet | Jalankan ngrok |
| 404 Not Found | URL webhook salah | Pakai URL yang benar (lihat bawah) |
| 503 Tunnel Unavailable | Ngrok session expired/mati | Restart ngrok, update URL di TradingView |
| 403 Forbidden | Secret salah | Pastikan `secret` di payload cocok dengan `.env` |

---

## Setup Langkah-per-Langkah

### 1. Jalankan Backend Django
```cmd
cd backend
venv\Scripts\activate
python manage.py runserver 8000
```

### 2. Jalankan Ngrok (terminal baru)
```cmd
ngrok http 8000
```
Copy URL yang muncul, contoh: `https://abc123.ngrok-free.app`

### 3. URL Webhook di TradingView Alert
```
https://abc123.ngrok-free.app/api/v1/signals/webhook/
```
> ⚠️ URL ngrok BERUBAH setiap restart — selalu update di TradingView

### 4. Pine Script (lengkap dengan bar_time)

```pine
//@version=5
indicator("Seacrate", overlay=true)

isXAUUSD = syminfo.ticker == "XAUUSD"
isUSDJPY  = syminfo.ticker == "USDJPY"

totalCandle  = high - low
bodyCandle   = math.abs(close - open)
upperWick    = high - math.max(open, close)
lowerWick    = math.min(open, close) - low
totalWick    = upperWick + lowerWick
totalWickPct = (totalWick / totalCandle) * 100
wickOK       = totalWickPct <= 30

prevBody = math.abs(close[1] - open[1])
bodyOK   = bodyCandle > prevBody

validXAUUSD_M5  = isXAUUSD and timeframe.period == "5"  and totalCandle >= 3.4 and wickOK
validXAUUSD_M15 = isXAUUSD and timeframe.period == "15" and totalCandle >= 3.8 and wickOK
validUSDJPY_M15 = isUSDJPY and timeframe.period == "15" and bodyCandle  >= 0.10 and wickOK
validCandle     = (validXAUUSD_M5 or validXAUUSD_M15 or validUSDJPY_M15) and bodyOK

hourUTC   = hour(time, "UTC")
session1  = hourUTC >= 22 or hourUTC < 3
session2  = hourUTC >= 11 and hourUTC < 16
inSession = session1 or session2

buySignal  = validCandle and close > open and barstate.isconfirmed and inSession
sellSignal = validCandle and close < open and barstate.isconfirmed and inSession

candleRange = high - low
buyEntry1 = high - candleRange * 0.236
buyEntry2 = high - candleRange * 0.500
buyEntry3 = high - candleRange * 0.618
buySL     = high - candleRange * 0.786
buyTP     = high + candleRange * 0.270

sellEntry1 = low + candleRange * 0.236
sellEntry2 = low + candleRange * 0.500
sellEntry3 = low + candleRange * 0.618
sellSL     = low + candleRange * 0.786
sellTP     = low - candleRange * 0.270

plotshape(buySignal,  style=shape.triangleup,   color=color.blue, location=location.belowbar, size=size.small)
plotshape(sellSignal, style=shape.triangledown, color=color.red,  location=location.abovebar, size=size.small)

if buySignal
    alert('{"secret":"mikapedia-tv-secret-2026","symbol":"' + syminfo.ticker + '","pair":"' + syminfo.ticker + '","timeframe":"' + timeframe.period + '","direction":"BUY","strategy":"Seacrate","bar_time":"' + str.tostring(time, "yyyy-MM-dd HH:mm") + '","fib_entry":0.5,"fib_0236":' + str.tostring(math.round(buyEntry1, 5)) + ',"fib_0500":' + str.tostring(math.round(buyEntry2, 5)) + ',"fib_0618":' + str.tostring(math.round(buyEntry3, 5)) + ',"stop_loss":' + str.tostring(math.round(buySL, 5)) + ',"take_profit":' + str.tostring(math.round(buyTP, 5)) + ',"max_entry_minutes":5}', alert.freq_once_per_bar_close)

if sellSignal
    alert('{"secret":"mikapedia-tv-secret-2026","symbol":"' + syminfo.ticker + '","pair":"' + syminfo.ticker + '","timeframe":"' + timeframe.period + '","direction":"SELL","strategy":"Seacrate","bar_time":"' + str.tostring(time, "yyyy-MM-dd HH:mm") + '","fib_entry":0.5,"fib_0236":' + str.tostring(math.round(sellEntry1, 5)) + ',"fib_0500":' + str.tostring(math.round(sellEntry2, 5)) + ',"fib_0618":' + str.tostring(math.round(sellEntry3, 5)) + ',"stop_loss":' + str.tostring(math.round(sellSL, 5)) + ',"take_profit":' + str.tostring(math.round(sellTP, 5)) + ',"max_entry_minutes":5}', alert.freq_once_per_bar_close)
```

> ⚠️ Pastikan chart TradingView diset ke timezone **UTC+7 (WIB)** agar `bar_time` yang dikirim sesuai dengan waktu lokal.

### 5. Setelah update Pine Script
1. Save Pine Script
2. Add to chart (refresh)
3. Hapus alert lama
4. Buat alert baru

---

## Ngrok Tips
- **Free plan**: URL berubah setiap restart
- **Paid plan**: URL tetap (static domain)

## Secret Webhook
```
TRADINGVIEW_WEBHOOK_SECRET=mikapedia-tv-secret-2026
```
