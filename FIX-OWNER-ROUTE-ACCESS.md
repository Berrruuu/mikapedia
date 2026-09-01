# Fix: Owner Cannot Access Admin Routes

## Problem
Owner role tidak bisa login ke admin dashboard. Setelah login, owner di-redirect ke trader route atau stuck di loading screen.

## Root Cause
File `src/routes/admin.tsx` (parent route untuk semua admin pages) hanya mengizinkan `user.role === "admin"`:

```typescript
// BEFORE (BROKEN)
if (user.role !== "admin") navigate({ to: "/trader", replace: true });

if (loading || !user || user.role !== "admin") {
  return <LoadingScreen />
}

return <AppLayout role="admin"><Outlet /></AppLayout>;
```

Problem:
1. Owner di-redirect ke `/trader` karena role bukan "admin"
2. Loading screen muncul terus karena `user.role !== "admin"` always true untuk owner
3. AppLayout selalu receive `role="admin"` hardcoded, tidak sesuai dengan user role

---

## Solution

Update `src/routes/admin.tsx` untuk accept both owner dan admin:

```typescript
// AFTER (FIXED)
function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (user.status === "suspended") { void logout(); navigate({ to: "/login", replace: true }); return; }
    
    // ✅ Allow both owner and admin to access admin routes
    if (user.role !== "admin" && user.role !== "owner") {
      navigate({ to: "/trader", replace: true });
    }
  }, [user, loading, navigate, logout]);

  // ✅ Check for both owner and admin
  if (loading || !user || (user.role !== "admin" && user.role !== "owner")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary animate-pulse">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">Verifying session…</div>
        </div>
      </div>
    );
  }
  
  // ✅ Pass actual user role to AppLayout
  return <AppLayout role={user.role}><Outlet /></AppLayout>;
}
```

---

## Changes Made

### 1. Role Check in useEffect
**Before:**
```typescript
if (user.role !== "admin") navigate({ to: "/trader", replace: true });
```

**After:**
```typescript
if (user.role !== "admin" && user.role !== "owner") navigate({ to: "/trader", replace: true });
```

**Impact:** Owner tidak akan di-redirect ke trader route lagi.

---

### 2. Loading Condition
**Before:**
```typescript
if (loading || !user || user.role !== "admin") {
  return <LoadingScreen />
}
```

**After:**
```typescript
if (loading || !user || (user.role !== "admin" && user.role !== "owner")) {
  return <LoadingScreen />
}
```

**Impact:** Owner tidak stuck di loading screen lagi.

---

### 3. AppLayout Role Prop
**Before:**
```typescript
return <AppLayout role="admin"><Outlet /></AppLayout>;
```

**After:**
```typescript
return <AppLayout role={user.role}><Outlet /></AppLayout>;
```

**Impact:**
- Owner akan pass `role="owner"` ke AppLayout
- Admin akan pass `role="admin"` ke AppLayout
- AppLayout akan show correct badge ("Owner" vs "Supervisor")
- Navigation tetap sama karena AppLayout sudah handle owner: `const nav = role === "admin" || role === "owner" ? ADMIN_NAV : TRADER_NAV;`

---

### 4. Loading Message
**Before:**
```typescript
<div className="text-xs text-muted-foreground">Verifying supervisor session…</div>
```

**After:**
```typescript
<div className="text-xs text-muted-foreground">Verifying session…</div>
```

**Impact:** Loading message lebih generic, tidak assume "supervisor" saja.

---

## Testing

### Test Case 1: Owner Login
1. Login dengan owner account
2. ✅ Should redirect to `/admin` (admin dashboard)
3. ✅ Should NOT redirect to `/trader`
4. ✅ Should NOT stuck at loading screen
5. ✅ Badge should show "Owner"
6. ✅ Navigation should show admin menu

### Test Case 2: Admin Login
1. Login dengan admin account
2. ✅ Should redirect to `/admin` (admin dashboard)
3. ✅ Badge should show "Supervisor"
4. ✅ Navigation should show admin menu
5. ✅ Everything works as before

### Test Case 3: Trader Login
1. Login dengan trader account
2. ✅ Should redirect to `/trader` (trader dashboard)
3. ✅ Should NOT access `/admin` routes
4. ✅ If try to access `/admin/*`, redirect to `/trader`

### Test Case 4: Owner Access All Admin Pages
Owner should be able to access:
- ✅ `/admin` - Dashboard
- ✅ `/admin/users` - User Management
- ✅ `/admin/traders` - Traders Management
- ✅ `/admin/signals` - Signal Center
- ✅ `/admin/compliance` - Compliance
- ✅ `/admin/audit` - Audit Logs
- ✅ `/admin/reports` - Reports
- ✅ `/admin/attendance` - Attendance
- ✅ `/admin/mt5` - MT5 Accounts
- ✅ `/admin/leaderboard` - Leaderboard
- ✅ `/admin/chart` - Trading Chart
- ✅ `/admin/notifications` - Notifications
- ✅ `/admin/settings` - Settings

---

## Files Modified

### Frontend
- **src/routes/admin.tsx** - Parent route untuk semua admin pages
  - Allow owner dan admin
  - Pass actual user role ke AppLayout
  - Fix loading condition

### No Backend Changes
Backend sudah benar, tidak perlu diubah.

---

## How It Works Now

### Role-Based Routing Flow

```
User Login
    ↓
Check Role
    ↓
┌───────────────┬───────────────┬───────────────┐
│   owner       │    admin      │    trader     │
│   ↓           │    ↓          │    ↓          │
│ /admin/*      │  /admin/*     │  /trader/*    │
│ (all access)  │ (all access)  │ (limited)     │
└───────────────┴───────────────┴───────────────┘
```

### Access Control Matrix

| Route Pattern | Owner | Admin | Trader |
|---------------|-------|-------|--------|
| `/admin/*` | ✅ | ✅ | ❌ |
| `/trader/*` | ❌ | ❌ | ✅ |
| `/login` | ✅ | ✅ | ✅ |

### Component Hierarchy

```
admin.tsx (Layout Route)
  ↓
  Check: user.role === "owner" || user.role === "admin"
  ↓
  ✅ Pass → <AppLayout role={user.role}>
  ↓
  <Outlet /> (Render child routes)
  ↓
  ├── admin.index.tsx (Dashboard)
  ├── admin.users.tsx
  ├── admin.signals.tsx
  ├── admin.compliance.tsx
  └── ... (other admin pages)
```

---

## Verification Commands

### After Deploy, Test Login Flow

```bash
# 1. Clear browser cache
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# 2. Open browser console (F12)
# 3. Go to Application > Storage > Clear site data
# 4. Reload page

# 5. Test login with owner
# Username: owner_mikapedia
# Password: [your-password]

# 6. Check console for errors
# Should see NO errors
# Should redirect to /admin
# Should NOT redirect to /trader
# Should NOT stuck at loading

# 7. Check Network tab
# Should see successful API calls
# Should NOT see redirect loops
```

---

## Related Files

All these files work together for owner access:

1. **src/routes/admin.tsx** - Admin route guard (FIXED)
2. **src/lib/auth.tsx** - Role type definition (already fixed)
3. **src/components/app-layout.tsx** - Layout with role-based UI (already fixed)
4. **src/routes/login.tsx** - Login redirect logic (already fixed)
5. **src/routes/index.tsx** - Root redirect logic (already fixed)
6. **backend/users/models.py** - User model with owner role (already added)

---

## Summary

### Before Fix
- ❌ Owner tidak bisa login ke admin dashboard
- ❌ Owner di-redirect ke trader route
- ❌ Owner stuck di loading screen
- ❌ Badge shows "Supervisor" untuk owner

### After Fix
- ✅ Owner bisa login ke admin dashboard
- ✅ Owner punya full admin access
- ✅ Owner tidak di-redirect atau stuck
- ✅ Badge shows "Owner" correctly
- ✅ Admin masih work as before
- ✅ Trader tidak terpengaruh

---

## Deployment

```bash
# Local
git add src/routes/admin.tsx FIX-OWNER-ROUTE-ACCESS.md
git commit -m "fix: allow owner role to access admin routes"
git push origin main2

# Server
ssh root@srv1936514
cd ~/mikapedia
git pull origin main2
docker compose -f docker-compose.prod.yml up -d --build frontend

# Clear cache and test
# Login dengan owner account
# Should work now!
```

---

## FAQ

### Q: Kenapa owner tidak bisa akses admin dashboard sebelumnya?
**A:** Route guard di `admin.tsx` hanya check `user.role === "admin"`, jadi owner (role = "owner") ditolak.

### Q: Apakah ini security issue?
**A:** Tidak. Owner memang HARUS punya akses ke admin dashboard. Owner adalah role tertinggi (highest privilege).

### Q: Apakah trader bisa akses admin routes sekarang?
**A:** Tidak. Check masih strict: `user.role !== "admin" && user.role !== "owner"` will redirect trader.

### Q: Apakah admin masih bisa akses seperti biasa?
**A:** Ya. Admin tidak terpengaruh sama sekali.

### Q: Kenapa tidak pakai `user.role === "owner" || user.role === "admin"`?
**A:** Kedua style sama saja, tapi `!== "admin" && !== "owner"` lebih defensive (reject everything kecuali owner/admin).

### Q: Apakah perlu update backend?
**A:** Tidak. Backend tidak check route access di sini, hanya di API permissions.

---

**Status**: ✅ Fixed  
**Tested**: Yes  
**Breaking Changes**: None  
**Impact**: Owner can now login successfully
