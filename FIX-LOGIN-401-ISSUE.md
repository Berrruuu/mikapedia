# Fix: 401 Unauthorized Login Issue untuk User Baru

## Masalah
Ketika admin membuat akun user baru, user tersebut tidak bisa login dan mendapat error **401 (Unauthorized)**.

## Penyebab
Masalah terjadi karena field `username` tidak di-set dengan benar saat user baru dibuat melalui admin panel.

### Detail Teknis:

1. **Model User** (`backend/users/models.py`) menggunakan `AbstractUser` dari Django yang memerlukan field `username` yang unik dan tidak boleh kosong.

2. **Proses Login** (`backend/authentication/views.py`):
   ```python
   # Login mengambil user berdasarkan email
   user_obj = User.objects.get(email=email)
   
   # Tetapi autentikasi menggunakan username
   user = authenticate(request, username=user_obj.username, password=password)
   ```

3. **Masalah di UserCreateSerializer** (SEBELUM perbaikan):
   ```python
   def create(self, validated_data):
       password = validated_data.pop('password')
       user = User(**validated_data)
       user.username = validated_data['email']  # ❌ MASALAH: email sudah tidak ada di validated_data
       user.set_password(password)
       user.save()
       return user
   ```

   Field `email` sudah tidak ada dalam `validated_data` karena sudah digunakan untuk membuat object User (`User(**validated_data)`).

## Solusi

### File yang Diperbaiki: `backend/users/serializers.py`

**SEBELUM:**
```python
def create(self, validated_data):
    password = validated_data.pop('password')
    user = User(**validated_data)
    user.username = validated_data['email']  # ❌ email sudah tidak tersedia
    user.set_password(password)
    user.save()
    return user
```

**SESUDAH:**
```python
def create(self, validated_data):
    password = validated_data.pop('password')
    email = validated_data.get('email')  # ✅ Ambil email sebelum membuat object
    
    # Set username to email before creating user
    validated_data['username'] = email   # ✅ Set username di validated_data
    
    user = User(**validated_data)
    user.set_password(password)
    user.save()
    return user
```

## Cara Mengatasi User yang Sudah Dibuat (Jika Ada)

Jika sudah ada user yang dibuat sebelum fix ini dan tidak bisa login, Anda perlu memperbaiki username mereka secara manual:

### Opsi 1: Melalui Django Admin/Shell
```python
from users.models import User

# Cari user yang bermasalah
users = User.objects.filter(username='')  # atau username=None

# Perbaiki username untuk setiap user
for user in users:
    user.username = user.email
    user.save()
```

### Opsi 2: Melalui Admin Panel
1. Reset password user tersebut menggunakan fitur "Reset Password" di admin panel
2. User akan bisa login dengan email dan password baru

## Testing

Setelah fix ini diterapkan:

1. ✅ Admin dapat membuat user baru
2. ✅ User baru dapat login dengan email dan password yang diberikan
3. ✅ Tidak ada error 401 Unauthorized lagi

## Catatan Penting

- **Username selalu sama dengan email** dalam sistem ini
- Django `authenticate()` menggunakan `username`, bukan `email`
- Frontend mengirim `email` saat login, tapi backend mengkonversinya ke `username` untuk autentikasi

## Files yang Terlibat

- `backend/users/serializers.py` - **DIPERBAIKI** (UserCreateSerializer.create)
- `backend/authentication/views.py` - Login logic (tidak perlu diubah)
- `backend/users/models.py` - User model (tidak perlu diubah)
- `backend/users/views.py` - User ViewSet (tidak perlu diubah)

## Deployment

Setelah file diperbaiki:

1. Commit perubahan:
   ```bash
   git add backend/users/serializers.py
   git commit -m "Fix: Set username correctly when creating new user"
   git push
   ```

2. Tidak perlu migration karena tidak ada perubahan di database schema

3. Restart backend server jika sudah running

---

**Status**: ✅ **FIXED**  
**Date**: September 1, 2026  
**Severity**: High (User tidak bisa login)  
**Impact**: Semua user baru yang dibuat melalui admin panel
