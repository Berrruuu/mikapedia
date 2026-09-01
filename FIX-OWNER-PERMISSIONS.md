# Fix: Owner Cannot Change Password and Other Operations

## Problem
Owner role tidak bisa melakukan operations seperti:
- Change password
- Create/update/delete users
- Manage signals
- View/export reports
- Update system settings
- dll.

Semua operasi admin di-reject dengan error 403 Forbidden atau "You do not have permission to perform this action."

## Root Cause
Backend permission checks di seluruh aplikasi hanya check `user.role == 'admin'`, sehingga owner (role = "owner") di-reject.

**Affected Files** (17 files):
1. `backend/users/views.py` - User management, password change
2. `backend/users/services.py` - User service checks
3. `backend/users/repositories.py` - User queryset filtering
4. `backend/signals/views.py` - Signal management
5. `backend/mt5/views.py` - MT5 account operations
6. `backend/mt5/services.py` - MT5 service checks
7. `backend/mt5/repositories.py` - MT5 queryset filtering
8. `backend/compliance/views.py` - Compliance records
9. `backend/reports/views.py` - Reports and exports
10. `backend/attendance/views.py` - Attendance management
11. `backend/attendance/repositories.py` - Attendance queryset
12. `backend/app_settings/views.py` - System settings
13. `backend/audit_logs/views.py` - Audit logs
14. `backend/config/consumers.py` - WebSocket admin room

---

## Solution

### 1. Create Common Permission Class

Created `backend/common/permissions.py` with reusable permission classes:

```python
from rest_framework import permissions

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permission class that allows access to users with 'owner' or 'admin' role.
    Use this instead of checking `user.role == 'admin'` directly.
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin']
        )

class IsAdminRole(permissions.BasePermission):
    """
    Alias for IsOwnerOrAdmin for backward compatibility.
    Allows both owner and admin roles.
    """
    def has_permission(self, request, view):
        return (
            request.user 
            and request.user.is_authenticated 
            and request.user.role in ['owner', 'admin']
        )

def is_owner_or_admin(user) -> bool:
    """Helper function to check if user is owner or admin."""
    return user and user.is_authenticated and user.role in ['owner', 'admin']
```

### 2. Update All Backend Files

**Pattern Before:**
```python
# Hard-coded admin check
if request.user.role != 'admin':
    return error_response('Forbidden', ...)

# OR
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'
```

**Pattern After:**
```python
# Import common permission
from common.permissions import IsOwnerOrAdmin

# Use in views
@permission_classes([IsOwnerOrAdmin])

# OR in inline checks
if request.user.role not in ['owner', 'admin']:
    return error_response('Forbidden', ...)
```

---

## Files Modified

### Backend Permission Files

#### 1. common/permissions.py (NEW)
- Created reusable permission classes
- `IsOwnerOrAdmin` - Main permission class
- `IsAdminRole` - Alias for backward compatibility
- `CanManageUsers` - For user management
- Helper functions: `is_owner_or_admin()`, `is_staff_user()`

#### 2. users/views.py
- Replaced `IsAdminRole` with `IsOwnerOrAdmin`
- Updated `IsAdminOrSelf` to check `['owner', 'admin']`
- Updated `get_permissions()` for create/destroy/list actions
- Updated `@action` decorators for suspend and reset_password

#### 3. users/services.py
- Updated permission check: `user.role not in ['owner', 'admin']`

#### 4. users/repositories.py
- Updated `get_queryset_for_user()`: `role in ['owner', 'admin']`

#### 5. signals/views.py
- Replaced `IsAdminRole` with `IsOwnerOrAdmin`
- Updated `get_permissions()` for CRUD operations
- Updated `@permission_classes` for test_webhook

#### 6. mt5/views.py
- Replaced `IsAdminRole` with `IsOwnerOrAdmin`
- Updated inline checks in sync, deals, status actions
- Updated trades_by_signal endpoint check

#### 7. mt5/services.py
- Updated `get_account_for_request()`: `role not in ['owner', 'admin']`

#### 8. mt5/repositories.py
- Updated `get_queryset_for_user()`: `role in ['owner', 'admin']`

#### 9. compliance/views.py
- Updated `get_queryset()` in ComplianceRecordViewSet
- Updated `get_queryset()` in SOPWarningViewSet
- Updated acknowledge action permission check

#### 10. reports/views.py
- Replaced `IsAdminRole` and `AdminOnly` with `IsOwnerOrAdmin`
- Updated all @permission_classes decorators for report endpoints

#### 11. attendance/views.py
- Replaced `IsAdminRole` with `IsOwnerOrAdmin`
- Updated all permission decorators

#### 12. attendance/repositories.py
- Updated `get_queryset_for_user()`: `role in ['owner', 'admin']`

#### 13. app_settings/views.py
- Replaced `IsAdminRole` with `IsOwnerOrAdmin`
- Updated settings_view decorator

#### 14. audit_logs/views.py
- Replaced `permissions.IsAdminUser` with `IsOwnerOrAdmin`

#### 15. config/consumers.py (WebSocket)
- Updated admin_room group join: `role in ['owner', 'admin']`
- Updated admin_room group leave: `role in ['owner', 'admin']`

---

## Summary of Changes

### Permission Checks Changed

| Location | Before | After |
|----------|--------|-------|
| Permission classes | `role == 'admin'` | `role in ['owner', 'admin']` |
| Inline checks | `role != 'admin'` | `role not in ['owner', 'admin']` |
| Queryset filtering | `role == 'admin'` | `role in ['owner', 'admin']` |
| WebSocket rooms | `role == 'admin'` | `role in ['owner', 'admin']` |

### Operations Now Available to Owner

✅ **User Management**
- Create users
- Update users
- Delete users
- Reset passwords
- Suspend/activate users
- Upload avatars

✅ **Signal Management**
- Create signals
- Update signals  
- Delete signals
- Test webhook

✅ **MT5 Operations**
- View all MT5 accounts
- Sync accounts
- View deals
- Check status
- View all trades

✅ **Compliance**
- View all compliance records
- View all SOP warnings
- Acknowledge warnings

✅ **Reports & Exports**
- View execution reports
- View attendance reports
- View compliance reports
- View leaderboards
- Export all reports (PDF/Excel)

✅ **Attendance**
- View all attendance records
- Validate attendance
- Manage schedules
- Manage shifts

✅ **System Settings**
- View settings
- Update settings

✅ **Audit Logs**
- View all audit logs
- Filter and search logs

✅ **WebSocket**
- Join admin_room channel
- Receive admin broadcasts

---

## Testing

### Test Case 1: Change Password
```python
# As owner
POST /api/users/{id}/reset-password/
{
    "new_password": "NewPassword123!"
}

# Expected: 200 OK (not 403 Forbidden)
```

### Test Case 2: Create User
```python
# As owner
POST /api/users/
{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "Password123!",
    "role": "trader"
}

# Expected: 201 Created (not 403 Forbidden)
```

### Test Case 3: Update System Settings
```python
# As owner
PATCH /api/settings/
{
    "companyName": "Updated Company Name"
}

# Expected: 200 OK (not 403 Forbidden)
```

### Test Case 4: View Audit Logs
```python
# As owner
GET /api/audit-logs/

# Expected: 200 OK with data (not 403 Forbidden)
```

### Test Case 5: Export Reports
```python
# As owner
GET /api/reports/export/execution/?format=pdf

# Expected: PDF download (not 403 Forbidden)
```

---

## Deployment

### Local Testing
```bash
# Run migrations (if any new migrations created)
python manage.py migrate

# Restart server
python manage.py runserver
```

### Production Deployment
```bash
# SSH to VPS
ssh root@srv1936514

# Pull latest code
cd ~/mikapedia
git pull origin main2

# Restart backend
docker compose -f docker-compose.prod.yml restart backend

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

---

## Verification Commands

### After Deploy, Test Owner Permissions

```bash
# 1. Login as owner
curl -X POST https://mikapedia.online/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"owner_mikapedia","password":"YourPassword"}'

# Save the token from response

# 2. Test change password (should work now)
curl -X POST https://mikapedia.online/api/users/1/reset-password/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password":"NewPass123!"}'

# 3. Test view audit logs (should work now)
curl -X GET https://mikapedia.online/api/audit-logs/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Test update settings (should work now)
curl -X PATCH https://mikapedia.online/api/settings/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Update"}'
```

---

## Related Files

All these files work together for owner permissions:

**Frontend** (already fixed in previous commit):
- `src/routes/admin.tsx` - Route guard
- `src/lib/auth.tsx` - Role type
- `src/components/app-layout.tsx` - UI

**Backend** (fixed in this commit):
- `backend/common/permissions.py` - Permission classes (NEW)
- `backend/users/views.py` - User operations
- `backend/users/services.py` - User services
- `backend/users/repositories.py` - User queries
- `backend/signals/views.py` - Signal operations
- `backend/mt5/views.py` - MT5 operations
- `backend/mt5/services.py` - MT5 services
- `backend/mt5/repositories.py` - MT5 queries
- `backend/compliance/views.py` - Compliance operations
- `backend/reports/views.py` - Report operations
- `backend/attendance/views.py` - Attendance operations
- `backend/attendance/repositories.py` - Attendance queries
- `backend/app_settings/views.py` - Settings operations
- `backend/audit_logs/views.py` - Audit log operations
- `backend/config/consumers.py` - WebSocket channels

---

## Summary

### Before Fix
- ❌ Owner tidak bisa change password
- ❌ Owner tidak bisa create/manage users
- ❌ Owner tidak bisa manage signals
- ❌ Owner tidak bisa view/export reports
- ❌ Owner tidak bisa update settings
- ❌ Owner tidak bisa view audit logs
- ❌ All admin operations return 403 Forbidden

### After Fix
- ✅ Owner bisa change password
- ✅ Owner bisa create/manage users
- ✅ Owner bisa manage signals
- ✅ Owner bisa view/export reports
- ✅ Owner bisa update settings
- ✅ Owner bisa view audit logs
- ✅ Owner punya full admin permissions
- ✅ Admin masih work as before
- ✅ Trader tidak terpengaruh

---

**Status**: ✅ Fixed  
**Files Changed**: 15 backend files + 1 new file  
**Breaking Changes**: None  
**Backward Compatible**: Yes (IsAdminRole still works as alias)
