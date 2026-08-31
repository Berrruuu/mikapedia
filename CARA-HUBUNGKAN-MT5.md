# Cara Menghubungkan Akun MT5

## Langkah-langkah Menghubungkan MT5 ke MIKAPEDIA TOMS

### 1. Login ke Website
1. Buka https://mikapedia.online/login
2. Masukkan email dan password trader
3. Klik **Login**

### 2. Buka Halaman MT5
1. Setelah login, klik menu **MT5** di sidebar kiri
2. Atau buka langsung: https://mikapedia.online/trader/mt5

### 3. Isi Form Koneksi MT5

Saat pertama kali buka halaman MT5, akan muncul form **"Connect MT5 Account"**:

#### Data yang Harus Diisi:

1. **Login (Account Number)**
   - Isi dengan nomor akun MT5 kamu
   - Contoh: `7724091`
   - ❗ Jangan pakai spasi atau karakter lain

2. **Password**
   - Isi dengan password MT5 kamu (bukan password website)
   - Password akan disimpan terenkripsi di server
   - Klik ikon mata (👁️) untuk lihat password saat mengetik

3. **Server**
   - Isi dengan nama server broker
   - Contoh: `ICMarkets-Live01`, `XMGlobal-Real 4`, dll
   - ℹ️ Cek di MT5 terminal: File → Login to Trade Account → Server
   
4. **Broker (opsional)**
   - Isi nama broker (opsional tapi disarankan)
   - Contoh: `ICMarkets`, `XM`, `FBS`, dll

#### Contoh Pengisian:
```
Login: 7724091
Password: ••••••••••
Server: ICMarkets-Live01
Broker: ICMarkets
```

### 4. Klik "Save & Connect"

Setelah klik tombol, sistem akan:
1. ✅ Menyimpan credentials (terenkripsi)
2. ✅ Menghubungkan ke akun MT5
3. ✅ Mengambil data balance, equity, positions
4. ✅ Menampilkan informasi akun

### 5. Verifikasi Data Muncul

Setelah berhasil connect, kamu akan lihat:

#### ✅ Badge Status
- **Connected** (hijau) = Sukses terhubung
- **Error** (merah) = Gagal terhubung

#### ✅ Informasi Akun
- **Balance**: Total saldo akun
- **Equity**: Saldo + floating P/L
- **Floating P/L**: Profit/loss posisi yang masih terbuka
- **Margin Level**: Persentase margin level

#### ✅ Data Tambahan
- **Drawdown**: Persentase penurunan dari balance
- **Open Positions**: Jumlah posisi terbuka
- **Pending Orders**: Jumlah pending order

#### ✅ Tabs
- **Open Positions**: List semua posisi yang masih terbuka
- **Pending Orders**: List semua limit/stop order yang belum tersentuh
- **Deal History**: History transaksi yang sudah closed

### 6. Auto Sync

Setelah connected, data akan otomatis refresh setiap **1 detik** untuk menampilkan:
- Perubahan balance real-time
- Update profit/loss posisi
- Posisi baru yang dibuka
- Posisi yang sudah closed

## Troubleshooting

### ❌ Tidak Muncul Data Setelah Save

#### Cek 1: Apakah Status "Connected"?
- Kalau status **Error** → ada masalah koneksi
- Lihat pesan error di kotak merah

#### Cek 2: Refresh Browser
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

#### Cek 3: Coba Mode Incognito/Private
- Buka browser incognito/private
- Login lagi
- Coba connect MT5 lagi

#### Cek 4: Periksa Console Browser
1. Tekan F12 (atau klik kanan → Inspect)
2. Buka tab **Console**
3. Lihat apakah ada error merah
4. Screenshot dan kirim ke developer

### ❌ Status "Error" Muncul

#### Kemungkinan Penyebab:

1. **Password Salah**
   - Cek password MT5 di terminal
   - Pastikan tidak ada typo
   - Password case-sensitive (huruf besar/kecil berbeda)

2. **Server Salah**
   - Cek nama server persis seperti di MT5
   - Contoh: `ICMarkets-Live01` bukan `IC Markets Live 01`

3. **Login Salah**
   - Pastikan nomor login benar
   - Login biasanya 7-8 digit angka

4. **Akun Disabled**
   - Cek apakah akun masih aktif di broker
   - Login ke MT5 terminal untuk verifikasi

### ❌ Data Tidak Update Real-Time

#### Solusi:

1. **Klik tombol "Sync"**
   - Ada di pojok kanan atas
   - Akan force refresh data

2. **Reload Halaman**
   - Tekan F5 atau Ctrl+R

3. **Periksa WebSocket**
   - Buka DevTools (F12)
   - Tab **Network** → Filter: **WS**
   - Harus ada `wss://mikapedia.online/ws/` dengan status **101**

## Mode Simulasi (Development)

⚠️ **Penting untuk Deployment di Linux (Hostinger):**

Karena MetaTrader5 Python package hanya jalan di Windows, server Hostinger menggunakan **mode simulasi** dengan data palsu untuk testing.

### Cara Kerja Mode Simulasi:
- Backend otomatis generate data palsu (fake)
- Balance sekitar $10,000
- Ada 0-3 posisi terbuka simulasi
- Data akan berubah-ubah setiap sync

### Cara Dapat Data Real MT5:

Untuk mendapatkan data real, harus install **Expert Advisor (EA)** di MT5 terminal Windows:

1. **Copy file EA**: `backend/scripts/MikapediaReporter.mq5`
2. **Paste ke folder**: `C:\Program Files\MetaTrader 5\MQL5\Experts\`
3. **Compile di MetaEditor**
4. **Drag EA ke chart MT5**
5. **Set parameter**:
   - `ApiBaseUrl`: `https://mikapedia.online/api/v1/mt5/ea-report/`
   - `IntegrationToken`: (sesuai EA_INTEGRATION_TOKEN di .env)
6. **Enable AutoTrading**

EA akan otomatis push data real ke backend setiap tick/bar.

## FAQ (Pertanyaan Sering Ditanya)

### Q: Apakah password MT5 saya aman?
**A**: Ya, password disimpan terenkripsi menggunakan AES-256. Backend hanya bisa decrypt saat connect ke MT5.

### Q: Kenapa harus input password? Kenapa tidak pakai API key?
**A**: MetaTrader 5 memerlukan login + password untuk connect. Tidak ada API key seperti platform lain.

### Q: Apakah bisa connect beberapa akun MT5?
**A**: Saat ini 1 user = 1 akun MT5. Untuk multi-account, hubungi admin untuk setup user tambahan.

### Q: Akun demo atau real account?
**A**: Bisa keduanya. Sistem otomatis detect dari MT5 apakah akun demo atau real.

### Q: Data history berapa lama?
**A**: Deal history menampilkan 30 hari terakhir.

### Q: Kenapa balance tidak sama dengan MT5?
**A**: 
- Mode simulasi = data fake
- Mode real (dengan EA) = data real-time dari MT5

### Q: Bisa connect dari mobile?
**A**: Ya, website responsive. Bisa buka dari HP/tablet dengan browser apapun.

## Kontak Support

Jika masih ada masalah setelah ikuti troubleshooting:

1. Screenshot halaman error
2. Screenshot console browser (F12 → Console)
3. Catat waktu kejadian
4. Kirim ke developer atau admin

---

**Last Updated**: 31 Agustus 2026  
**Version**: 1.0
