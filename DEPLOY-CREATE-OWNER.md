# Deploy & Create Owner Account - Step by Step

## Overview
Panduan praktis untuk deploy owner role feature dan create superuser + owner account di VPS.

---

## Step 1: Deploy ke VPS

### 1.1 SSH ke Server
```bash
ssh root@srv1936514
```

### 1.2 Pull Latest Code
```bash
cd ~/mikapedia
git pull origin main2
```

**Expected output:**
```
Updating 8da93c9..6657971
Fast-forward
 backend/users/models.py                       | 3 ++-
 backend/users/migrations/0002_add_owner_role.py | 22 ++++++++++++++++++++++
 src/lib/auth.tsx                              | 2 +-
 src/components/app-layout.tsx                 | 8 ++++----
 src/routes/login.tsx                          | 6 ++++--
 src/routes/index.tsx                          | 2 +-
 src/routes/trader.profile.tsx                 | 2 +-
 CREATE-SUPERUSER-OWNER.md                     | 575 +++++++++++++++++++++++
 QUICK-CREATE-USERS.md                         | 400 +++++++++++++++++
 9 files changed, 975 insertions(+), 9 deletions(-)
```

### 1.3 Run Migration
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

**Expected output:**
```
Running migrations:
  Applying users.0002_add_owner_role... OK
```

### 1.4 Rebuild & Restart Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 1.5 Verify Deployment
```bash
# Check containers
docker compose -f docker-compose.prod.yml ps

# Should show all containers as "Up"
```

---

## Step 2: Create Superuser (Django Admin)

### 2.1 Run Createsuperuser Command
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### 2.2 Input Data
```
Username (leave blank to use 'root'): admin
Email address: admin@mikapedia.com
Password: **********
Password (again): **********
```

**Tips untuk password:**
- Minimal 8 karakter
- Kombinasi huruf, angka, simbol
- Jangan gunakan password yang mudah ditebak

**Expected output:**
```
Superuser created successfully.
```

---

## Step 3: Create Owner Account

### 3.1 Open Django Shell
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

### 3.2 Create Owner
Paste code ini di shell (ganti data sesuai kebutuhan):

```python
from users.models import User

# Data owner (GANTI SESUAI KEBUTUHAN)
owner_username = 'owner_mikapedia'
owner_email = 'owner@mikapedia.com'
owner_password = 'OwnerPassword123!'  # GANTI PASSWORD INI!
owner_firstname = 'John'              # GANTI NAMA INI!
owner_lastname = 'Doe'                # GANTI NAMA INI!

# Create owner
owner = User.objects.create_user(
    username=owner_username,
    email=owner_email,
    password=owner_password,
    first_name=owner_firstname,
    last_name=owner_lastname,
    role='owner',
    is_staff=True,
    status='active',
    department='Management',
    position='CEO / Owner'
)

print(f"✅ Owner created successfully!")
print(f"   Username: {owner.username}")
print(f"   Email: {owner.email}")
print(f"   Full Name: {owner.full_name}")
print(f"   Role: {owner.role}")

exit()
```

**Expected output:**
```
✅ Owner created successfully!
   Username: owner_mikapedia
   Email: owner@mikapedia.com
   Full Name: John Doe
   Role: owner
```

---

## Step 4: Verify Accounts

### 4.1 List All Users
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

print("\n=== ALL USERS ===\n")
print(f"{'Username':<20} {'Email':<30} {'Role':<10} {'Staff':<6} {'Super':<6}")
print("-" * 80)

for user in User.objects.all().order_by('role'):
    print(f"{user.username:<20} {user.email:<30} {user.role:<10} {str(user.is_staff):<6} {str(user.is_superuser):<6}")

print(f"\nTotal users: {User.objects.count()}")

exit()
```

**Expected output:**
```
=== ALL USERS ===

Username             Email                          Role       Staff  Super 
--------------------------------------------------------------------------------
owner_mikapedia      owner@mikapedia.com            owner      True   False 
admin                admin@mikapedia.com            admin      True   True  

Total users: 2
```

---

## Step 5: Test Login

### 5.1 Test Login Owner di Frontend

1. **Buka browser:**
   ```
   https://mikapedia.online/login
   ```

2. **Login dengan owner:**
   - Username: `owner_mikapedia`
   - Password: `OwnerPassword123!` (atau password yang kamu set)

3. **Verify redirect:**
   - Seharusnya redirect ke `/admin` (admin dashboard)
   - Bukan ke `/trader`

4. **Check menu:**
   - Seharusnya bisa akses semua menu admin:
     - Dashboard
     - Users
     - Signals
     - Compliance
     - Audit Logs
     - Reports
     - Settings
     - Notifications

5. **Check profile:**
   - Klik avatar di kanan atas
   - Seharusnya tertulis "Owner" (bukan "Supervisor" atau "Trader")

### 5.2 Test Login Superuser di Django Admin

1. **Buka Django Admin:**
   ```
   https://mikapedia.online/admin/
   ```

2. **Login dengan superuser:**
   - Username: `admin`
   - Password: password yang kamu set saat createsuperuser

3. **Verify access:**
   - Seharusnya bisa lihat Django admin interface
   - Bisa manage users, groups, etc.

---

## Step 6: Create Additional Users (Optional)

### 6.1 Create Admin User
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

admin = User.objects.create_user(
    username='admin_ops',
    email='admin@mikapedia.com',
    password='AdminPass123!',
    first_name='Admin',
    last_name='Operations',
    role='admin',
    is_staff=True,
    department='Operations',
    position='Operations Manager'
)

print(f"✅ Admin created: {admin.username}")
exit()
```

### 6.2 Create Trader User
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

trader = User.objects.create_user(
    username='trader1',
    email='trader1@mikapedia.com',
    password='TraderPass123!',
    first_name='Trader',
    last_name='One',
    role='trader',
    department='Trading',
    position='Junior Trader'
)

print(f"✅ Trader created: {trader.username}")
exit()
```

---

## Step 7: Change Password (If Needed)

### 7.1 Change Owner Password
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword owner_mikapedia
```

Input new password 2x.

### 7.2 Change Any User Password via Shell
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

user = User.objects.get(username='owner_mikapedia')
user.set_password('NewSecurePassword123!')
user.save()

print(f"✅ Password changed for {user.username}")
exit()
```

---

## Step 8: Security Checklist

### ✅ After Creating Owner Account

- [ ] **Change default password** jika menggunakan contoh password
- [ ] **Save credentials** di tempat aman (password manager)
- [ ] **Test login** dengan owner account
- [ ] **Verify permissions** (bisa akses admin dashboard)
- [ ] **Update profile** (foto, phone number, dll)
- [ ] **Setup 2FA** (jika available)

### ✅ Never Do This

- [ ] ❌ Commit password ke git
- [ ] ❌ Share password via email/chat
- [ ] ❌ Use simple password (123456, password, dll)
- [ ] ❌ Use same password untuk multiple accounts
- [ ] ❌ Give owner access to unauthorized people

---

## Troubleshooting

### Issue 1: Migration Failed
```bash
# Check migration status
docker compose -f docker-compose.prod.yml exec backend python manage.py showmigrations

# If migration exists but not applied
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate --fake users 0002_add_owner_role
```

### Issue 2: User Already Exists
```python
# Delete existing user first
from users.models import User
User.objects.get(username='owner_mikapedia').delete()
```

### Issue 3: Can't Login After Creating User
```python
# Make sure password is set correctly
from users.models import User
user = User.objects.get(username='owner_mikapedia')
user.set_password('YourPassword123!')
user.save()
```

### Issue 4: Container Not Running
```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart if needed
docker compose -f docker-compose.prod.yml restart

# View logs if error
docker compose -f docker-compose.prod.yml logs -f backend
```

### Issue 5: Frontend Shows 404 After Login
```bash
# Rebuild frontend
docker compose -f docker-compose.prod.yml stop frontend
docker compose -f docker-compose.prod.yml up -d --build frontend

# Clear browser cache
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

---

## Quick Reference Commands

```bash
# === SSH & Navigate ===
ssh root@srv1936514
cd ~/mikapedia

# === Deploy ===
git pull origin main2
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml up -d --build

# === Create Superuser ===
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# === Create Owner (One-liner) ===
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
owner = User.objects.create_user(
    username='owner_mikapedia',
    email='owner@mikapedia.com',
    password='OwnerPass123!',
    first_name='Owner',
    last_name='Mikapedia',
    role='owner',
    is_staff=True,
    position='CEO'
);
print('✅ Owner created:', owner.username)
"

# === List Users ===
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
for u in User.objects.all().order_by('role'):
    print(f'{u.username:<20} {u.email:<30} {u.role}')
"

# === Change Password ===
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword owner_mikapedia

# === Check Logs ===
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Summary

✅ **What We Did:**
1. Deploy owner role feature ke VPS
2. Run migration untuk add owner role
3. Create superuser (Django admin)
4. Create owner account (company owner)
5. Verify accounts dan test login

✅ **Roles Available:**
- **Owner** - Full admin access (pemilik perusahaan)
- **Admin** - System management (supervisor/operations)
- **Trader** - Trading only (trader team)

✅ **Login URLs:**
- Frontend: `https://mikapedia.online/login`
- Django Admin: `https://mikapedia.online/admin/`

✅ **Created Accounts:**
| Account | Username | Email | Role | Access |
|---------|----------|-------|------|--------|
| Superuser | `admin` | `admin@mikapedia.com` | admin | Django Admin + Full App |
| Owner | `owner_mikapedia` | `owner@mikapedia.com` | owner | Full Admin Dashboard |

---

## Next Steps

1. **Login sebagai owner** dan explore dashboard
2. **Change default passwords** jika menggunakan contoh
3. **Update owner profile** (foto, contact, dll)
4. **Create admin/trader accounts** untuk team
5. **Configure system settings** sesuai kebutuhan
6. **Setup notifications** untuk owner
7. **Review audit logs** untuk monitoring

---

**Documentation:**
- Full guide: `CREATE-SUPERUSER-OWNER.md`
- Quick reference: `QUICK-CREATE-USERS.md`
- This deployment guide: `DEPLOY-CREATE-OWNER.md`

**Status**: ✅ Ready to use  
**Branch**: main2  
**Deployed**: Yes
