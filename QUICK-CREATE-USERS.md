# Quick Reference: Create Superuser & Owner

## 🚀 TL;DR - Copy Paste Commands

### 1. Create Superuser (Django Admin)

```bash
# SSH ke VPS
ssh root@srv1936514

# Masuk directory
cd ~/mikapedia

# Create superuser (interactive)
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Input:
# Username: admin
# Email: admin@mikapedia.com
# Password: [your-strong-password]
```

---

### 2. Create Owner Account

```bash
# SSH ke VPS dan masuk directory
ssh root@srv1936514
cd ~/mikapedia

# Run migration untuk owner role
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Open Django shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell
```

**Paste code ini di shell:**
```python
from users.models import User

owner = User.objects.create_user(
    username='owner_mikapedia',
    email='owner@mikapedia.com',
    password='OwnerPassword123!',
    first_name='Owner',
    last_name='Mikapedia',
    role='owner',
    is_staff=True,
    status='active',
    department='Management',
    position='CEO / Owner'
)

print(f"✅ Owner created: {owner.username} ({owner.email})")
exit()
```

---

### 3. One-Liner Create Owner

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
owner = User.objects.create_user(
    username='owner_mikapedia',
    email='owner@mikapedia.com',
    password='OwnerPassword123!',
    first_name='Owner',
    last_name='Mikapedia',
    role='owner',
    is_staff=True,
    position='CEO'
);
print('✅ Owner created:', owner.username)
"
```

---

## 📋 List All Users

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
print('\\n=== ALL USERS ===\\n');
for u in User.objects.all().order_by('role'):
    print(f'{u.username:<20} {u.email:<30} {u.role:<10} (Staff: {u.is_staff}, Super: {u.is_superuser})');
print(f'\\nTotal: {User.objects.count()} users')
"
```

---

## 🔑 Change Password

```bash
# Method 1: Interactive
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword owner_mikapedia

# Method 2: Via shell
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
user = User.objects.get(username='owner_mikapedia');
user.set_password('NewPassword123!');
user.save();
print('✅ Password changed')
"
```

---

## 🗑️ Delete User

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
User.objects.get(username='username_to_delete').delete();
print('✅ User deleted')
"
```

---

## ✅ Verify User

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
user = User.objects.get(username='owner_mikapedia');
print(f'Username: {user.username}');
print(f'Email: {user.email}');
print(f'Role: {user.role}');
print(f'Is staff: {user.is_staff}');
print(f'Is superuser: {user.is_superuser}');
print(f'Status: {user.status}')
"
```

---

## 🎯 Create Multiple Users at Once

Save sebagai file `create_users.sh`:

```bash
#!/bin/bash

docker compose -f docker-compose.prod.yml exec backend python manage.py shell << 'EOF'
from users.models import User

users = [
    {
        'username': 'owner_mikapedia',
        'email': 'owner@mikapedia.com',
        'password': 'OwnerPass123!',
        'first_name': 'Owner',
        'last_name': 'Mikapedia',
        'role': 'owner',
        'is_staff': True,
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
        'position': 'Operations Manager'
    },
    {
        'username': 'trader1',
        'email': 'trader1@mikapedia.com',
        'password': 'TraderPass123!',
        'first_name': 'Trader',
        'last_name': 'One',
        'role': 'trader',
        'position': 'Junior Trader'
    }
]

for data in users:
    password = data.pop('password')
    if not User.objects.filter(username=data['username']).exists():
        user = User.objects.create_user(**data)
        user.set_password(password)
        user.save()
        print(f"✅ Created: {user.username} ({user.role})")
    else:
        print(f"⚠️  User {data['username']} already exists")

print("\\n🎉 Done!")
EOF
```

Lalu jalankan:
```bash
chmod +x create_users.sh
./create_users.sh
```

---

## 🔐 Role Hierarchy

```
owner (Tertinggi - Full Access)
  ↓
admin (System Management)
  ↓
trader (Trading Only)
```

---

## 🧪 Test Login

### Frontend
```
URL: https://mikapedia.online/login
Username: owner_mikapedia
Password: [your-password]
```

### Django Admin
```
URL: https://mikapedia.online/admin/
Username: admin (superuser) atau owner_mikapedia
Password: [your-password]
```

---

## 🚨 Troubleshooting

### User already exists
```bash
# Delete first
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c "
from users.models import User;
User.objects.get(username='owner_mikapedia').delete()
"
```

### Migration needed
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml restart
```

### Can't login
```bash
# Reset password
docker compose -f docker-compose.prod.yml exec backend python manage.py changepassword owner_mikapedia
```

### Check logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## 📝 Default Credentials (Ganti Setelah Login!)

| Account | Username | Email | Role | Password |
|---------|----------|-------|------|----------|
| Superuser | `admin` | `admin@mikapedia.com` | admin | `[set-saat-create]` |
| Owner | `owner_mikapedia` | `owner@mikapedia.com` | owner | `OwnerPassword123!` |

⚠️ **IMPORTANT**: Ganti password default setelah first login!

---

## 🔗 Related Files

- `backend/users/models.py` - User model dengan owner role
- `backend/users/migrations/0002_add_owner_role.py` - Migration
- `CREATE-SUPERUSER-OWNER.md` - Full documentation

---

**Quick Deploy:**
```bash
git add backend/users/models.py backend/users/migrations/0002_add_owner_role.py CREATE-SUPERUSER-OWNER.md QUICK-CREATE-USERS.md
git commit -m "feat: add owner role and user creation guides"
git push origin main2
```

**On VPS:**
```bash
cd ~/mikapedia
git pull origin main2
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml restart
```
