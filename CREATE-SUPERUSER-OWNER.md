# Panduan Create Superuser dan Owner Account

## Overview
Panduan ini menjelaskan cara membuat:
1. **Superuser** - Django admin superuser (untuk development/maintenance)
2. **Owner Account** - Account dengan role "owner" untuk pemilik perusahaan

## Role Hierarchy

```
Owner (Tertinggi)
  ↓
Admin
  ↓
Trader (Terendah)
```

### Perbedaan Role

| Feature | Owner | Admin | Trader |
|---------|-------|-------|--------|
| Full system access | ✅ | ✅ | ❌ |
| Django admin panel | ✅ | ✅ | ❌ |
| Manage users | ✅ | ✅ | ❌ |
| System settings | ✅ | ✅ | ❌ |
| View all reports | ✅ | ✅ | ❌ |
| Audit logs | ✅ | ✅ | ❌ |
| Signal center | ✅ | ✅ | ❌ |
| Trading dashboard | ✅ | Limited | ✅ |
| Company-wide decisions | ✅ | ❌ | ❌ |

---

## Part 1: Create Superuser (Django Admin)

### Method 1: Via Docker (Recommended untuk VPS)

#### Step 1: SSH ke VPS
```bash
ssh root@srv1936514
# atau: ssh root@<your-server-ip>
```

#### Step 2: Masuk ke Directory Project
```bash
cd ~/mikapedia
```

#### Step 3: Check Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```

Pastikan backend container running.

#### Step 4: Run Createsuperuser Command
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

#### Step 5: Isi Data Superuser
```
Username: admin
# atau username yang Anda inginkan

Email address: admin@mikapedia.com
# atau email yang Anda inginkan

Password: **********
# Ketik password yang kuat (minimal 8 karakter)

Password (again): **********
# Ketik password yang sama untuk konfirmasi
```

**Output Expected:**
```
Superuser created successfully.
```

#### Step 6: Verify Superuser
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

Lalu di Python shell:
```python
from users.models import User
admin = User.objects.get(username='admin')
print(f"Username: {admin.username}")
print(f"Email: {admin.email}")
print(f"Is superuser: {admin.is_superuser}")
print(f"Is staff: {admin.is_staff}")
print(f"Role: {admin.role}")

# Exit shell
exit()
```

---

### Method 2: Via Django Shell (Alternative)

Jika `createsuperuser` command bermasalah, gunakan cara manual:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

Di Python shell:
```python
from users.models import User

# Create superuser
superuser = User.objects.create_superuser(
    username='admin',
    email='admin@mikapedia.com',
    password='YourStrongPassword123!',
    first_name='Super',
    last_name='Admin',
    role='admin'  # atau 'owner' untuk owner account
)

print(f"Superuser created: {superuser.username}")
print(f"Is superuser: {superuser.is_superuser}")
print(f"Is staff: {superuser.is_staff}")

exit()
```

---

## Part 2: Create Owner Account

Owner account adalah user biasa dengan role "owner" dan full permissions.

### Step 1: Run Migration (Tambah Owner Role)

```bash
# Di VPS
cd ~/mikapedia
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

### Step 2: Create Owner via Django Shell

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

Di Python shell:
```python
from users.models import User

# Create owner account
owner = User.objects.create_user(
    username='owner_mikapedia',
    email='owner@mikapedia.com',
    password='YourOwnerPassword123!',
    first_name='Owner',
    last_name='Mikapedia',
    role='owner',
    is_staff=True,  # Bisa akses Django admin
    is_superuser=False,  # Tidak full Django admin access
    status='active',
    department='Management',
    position='CEO / Owner'
)

print(f"Owner created: {owner.username}")
print(f"Email: {owner.email}")
print(f"Role: {owner.role}")
print(f"Is staff: {owner.is_staff}")

exit()
```

### Step 3: Verify Owner Account

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

owner = User.objects.get(role='owner')
print(f"Username: {owner.username}")
print(f"Full name: {owner.full_name}")
print(f"Email: {owner.email}")
print(f"Role: {owner.role}")
print(f"Status: {owner.status}")
print(f"Is staff: {owner.is_staff}")
print(f"Is superuser: {owner.is_superuser}")

exit()
```

---

## Part 3: Create Multiple Accounts at Once

### Script untuk Create Multiple Users

Save as `create_users.py` di local, lalu copy ke server:

```python
from users.models import User

users_to_create = [
    {
        'username': 'owner_mikapedia',
        'email': 'owner@mikapedia.com',
        'password': 'OwnerPass123!',
        'first_name': 'Owner',
        'last_name': 'Mikapedia',
        'role': 'owner',
        'is_staff': True,
        'department': 'Management',
        'position': 'CEO'
    },
    {
        'username': 'admin_ops',
        'email': 'admin@mikapedia.com',
        'password': 'AdminPass123!',
        'first_name': 'Admin',
        'last_name': 'Operations',
        'role': 'admin',
        'is_staff': True,
        'department': 'Operations',
        'position': 'Operations Manager'
    },
    {
        'username': 'trader1',
        'email': 'trader1@mikapedia.com',
        'password': 'TraderPass123!',
        'first_name': 'Trader',
        'last_name': 'One',
        'role': 'trader',
        'is_staff': False,
        'department': 'Trading',
        'position': 'Junior Trader'
    }
]

for user_data in users_to_create:
    password = user_data.pop('password')
    
    if User.objects.filter(username=user_data['username']).exists():
        print(f"User {user_data['username']} already exists, skipping...")
        continue
    
    if user_data.get('role') == 'owner' and user_data.get('is_staff'):
        user = User.objects.create_user(**user_data)
        user.set_password(password)
        user.save()
    else:
        user = User.objects.create_user(**user_data)
        user.set_password(password)
        user.save()
    
    print(f"✅ Created: {user.username} ({user.role}) - {user.email}")

print("\n🎉 All users created successfully!")
```

### Cara Pakai Script:

```bash
# 1. Upload script ke VPS
scp create_users.py root@srv1936514:~/mikapedia/

# 2. SSH ke VPS
ssh root@srv1936514

# 3. Run script
cd ~/mikapedia
docker compose -f docker-compose.prod.yml exec backend python manage.py shell < create_users.py
```

---

## Part 4: Update Existing User to Owner

Jika sudah punya user dan ingin diubah jadi owner:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

# Method 1: By username
user = User.objects.get(username='existing_username')
user.role = 'owner'
user.is_staff = True  # Bisa akses Django admin
user.department = 'Management'
user.position = 'CEO / Owner'
user.save()
print(f"✅ {user.username} updated to owner")

# Method 2: By email
user = User.objects.get(email='existing@email.com')
user.role = 'owner'
user.is_staff = True
user.save()
print(f"✅ {user.email} updated to owner")

exit()
```

---

## Part 5: Login dan Test

### Test Login di Frontend

1. **Buka browser**
   ```
   https://mikapedia.online/login
   ```

2. **Login dengan Owner Account**
   - Username: `owner_mikapedia`
   - Password: `YourOwnerPassword123!`

3. **Verify Access**
   - Seharusnya masuk ke dashboard
   - Check menu yang tersedia (owner seharusnya lihat semua menu admin)

### Test Login di Django Admin

1. **Buka Django Admin**
   ```
   https://mikapedia.online/admin/
   ```

2. **Login dengan Superuser atau Owner**
   - Username: `admin` atau `owner_mikapedia`
   - Password: password yang kamu set

3. **Verify Access**
   - Seharusnya bisa lihat Django admin interface
   - Bisa manage users, signals, trades, dll

---

## Part 6: Change Password

### Change Password via Django Shell

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

# Get user
user = User.objects.get(username='owner_mikapedia')

# Set new password
user.set_password('NewPassword123!')
user.save()

print(f"✅ Password changed for {user.username}")

exit()
```

### Change Password via Command

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword owner_mikapedia
```

---

## Part 7: Permissions dan Security

### Owner Permissions (Backend)

Update `backend/users/permissions.py` atau views untuk check owner role:

```python
def is_owner(user):
    return user.role == 'owner'

def is_owner_or_admin(user):
    return user.role in ['owner', 'admin']

def is_staff_user(user):
    return user.role in ['owner', 'admin']
```

### Frontend Route Guards

Update route permissions untuk owner:

```typescript
// src/lib/auth.tsx
export function canAccessAdminRoutes(user: User): boolean {
  return ['owner', 'admin'].includes(user.role);
}

export function canAccessOwnerOnlyFeatures(user: User): boolean {
  return user.role === 'owner';
}

export function canManageUsers(user: User): boolean {
  return ['owner', 'admin'].includes(user.role);
}
```

---

## Part 8: List All Users

### Command untuk List Users

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

# List all users
users = User.objects.all().order_by('role', 'username')

print("\n=== ALL USERS ===\n")
print(f"{'Username':<20} {'Email':<30} {'Role':<10} {'Status':<10} {'Staff':<6} {'Super':<6}")
print("-" * 90)

for user in users:
    print(f"{user.username:<20} {user.email:<30} {user.role:<10} {user.status:<10} {str(user.is_staff):<6} {str(user.is_superuser):<6}")

print(f"\nTotal users: {users.count()}")

# Count by role
from django.db.models import Count
role_counts = User.objects.values('role').annotate(count=Count('role'))
print("\n=== USERS BY ROLE ===")
for item in role_counts:
    print(f"{item['role']}: {item['count']}")

exit()
```

---

## Part 9: Delete User (Jika Salah)

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from users.models import User

# Delete by username
user = User.objects.get(username='username_to_delete')
username = user.username
user.delete()
print(f"✅ User {username} deleted")

# Or delete all test users
test_users = User.objects.filter(email__contains='test')
count = test_users.count()
test_users.delete()
print(f"✅ Deleted {count} test users")

exit()
```

---

## Quick Commands Reference

### Create Superuser
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### Create Owner (Quick)
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
User.objects.create_user(
    username='owner',
    email='owner@mikapedia.com',
    password='OwnerPass123!',
    first_name='Owner',
    last_name='Mikapedia',
    role='owner',
    is_staff=True,
    position='CEO'
);
print('Owner created successfully')
"
```

### List Users (Quick)
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
for u in User.objects.all():
    print(f'{u.username} - {u.email} - {u.role}')
"
```

### Change Password (Quick)
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword <username>
```

---

## Troubleshooting

### Issue: Command not found
```bash
# Make sure you're in the right directory
cd ~/mikapedia

# Check containers are running
docker compose -f docker-compose.prod.yml ps
```

### Issue: User already exists
```python
# Delete existing user first
from users.models import User
User.objects.get(username='existing_username').delete()
```

### Issue: Permission denied
```bash
# Make sure you're using the correct compose file
docker compose -f docker-compose.prod.yml exec backend <command>
```

### Issue: Can't login after creating user
```python
# Make sure password is set correctly
from users.models import User
user = User.objects.get(username='your_username')
user.set_password('YourPassword123!')
user.save()
```

### Issue: Owner role not showing in admin
```bash
# Run migration first
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Restart containers
docker compose -f docker-compose.prod.yml restart
```

---

## Security Best Practices

### 1. Strong Passwords
- Minimal 12 karakter
- Kombinasi huruf besar, kecil, angka, simbol
- Jangan gunakan password default

### 2. Unique Emails
- Setiap user harus punya email unik
- Gunakan email corporate untuk owner/admin

### 3. Limit Superuser
- Hanya buat 1-2 superuser untuk maintenance
- Gunakan owner role untuk daily operations

### 4. Regular Audit
- Check audit logs untuk aktivitas owner
- Monitor login attempts
- Review user permissions berkala

### 5. Backup Credentials
- Simpan credentials owner di tempat aman
- Jangan commit ke git
- Gunakan password manager

---

## Summary Commands

```bash
# === ON VPS (via SSH) ===

# 1. Create Superuser
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# 2. Create Owner
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
# Then paste the owner creation code

# 3. List Users
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
# Then paste the list users code

# 4. Change Password
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword <username>

# 5. Run Migrations (if needed)
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

---

## Next Steps After Creating Owner

1. **Login sebagai owner** dan verify akses penuh
2. **Setup owner profile** (foto, phone, dll)
3. **Configure system settings** sesuai kebutuhan perusahaan
4. **Create additional admin accounts** untuk tim operations
5. **Create trader accounts** untuk trading team
6. **Setup audit logging** untuk owner actions
7. **Configure notifications** untuk owner

---

**Files Modified:**
- `backend/users/models.py` - Added 'owner' role
- `backend/users/migrations/0002_add_owner_role.py` - Migration for owner role
- `CREATE-SUPERUSER-OWNER.md` - This documentation

**Status**: ✅ Ready to use

**Tested**: VPS Production Environment
