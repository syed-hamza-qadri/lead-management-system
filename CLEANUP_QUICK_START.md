# Quick Cleanup Reference

## Files
- **Script:** `scripts/00-cleanup-demo-data.sql`
- **Guide:** `CLEANUP_GUIDE.md`

## Quick Steps

### 1. Backup (⚠️ IMPORTANT!)
```
Supabase Dashboard → Settings → Backups → Create Manual Backup
```

### 2. Open SQL Editor
```
Supabase Dashboard → SQL Editor → New Query
```

### 3. Copy & Paste Script
```
From: scripts/00-cleanup-demo-data.sql
To: SQL Editor
```

### 4. Run
```
Click "Run" button in Supabase
```

### 5. Verify (Optional)
Uncomment verification section in script and run again:
```sql
SELECT 'niches' as table_name, COUNT(*) as row_count FROM niches
UNION ALL
SELECT 'cities', COUNT(*) FROM cities
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'leads', COUNT(*) FROM leads
UNION ALL
SELECT 'lead_responses', COUNT(*) FROM lead_responses
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'activity_log', COUNT(*) FROM activity_log;
```

All counts should be **0**

---

## What Gets Deleted
- ✅ All data from all tables
- ❌ NOT table structures
- ❌ NOT triggers/functions
- ❌ NOT indexes
- ❌ NOT RLS policies

## What Doesn't Get Deleted
- ✅ Database schema (column definitions, constraints)
- ✅ Triggers (for auto-updating timestamps)
- ✅ Functions (database procedures)
- ✅ Indexes (for performance)
- ✅ RLS policies (for security)
- ✅ Views (if any)

---

## Safety Checklist
- [ ] Backup created
- [ ] Running on correct database
- [ ] Confirmed data loss is acceptable
- [ ] Script copied correctly
- [ ] Verification shows 0 rows (optional)

---

## Restore?
If you made a mistake:
```
Supabase Dashboard → Settings → Backups → Restore
```

---

**Created:** February 5, 2026
