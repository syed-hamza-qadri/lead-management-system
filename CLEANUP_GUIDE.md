# Cleanup Script Guide - Remove Demo Data from Supabase

## Overview
This guide explains how to use the cleanup script (`00-cleanup-demo-data.sql`) to remove all demo data from your Supabase database while preserving the database structure, indexes, triggers, and functions.

## ⚠️ WARNING
**This script will DELETE ALL DATA from your database permanently.** Make sure you have:
- ✅ Backed up your database
- ✅ Confirmed you want to delete all data
- ✅ Are running this on the correct database

---

## How to Use

### Option 1: Run via Supabase Dashboard (Recommended for Beginners)

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project
   - Navigate to "SQL Editor"

2. **Create a New Query**
   - Click "+ New Query"
   - Give it a name (e.g., "Cleanup Demo Data")

3. **Copy and Paste the Script**
   - Open `scripts/00-cleanup-demo-data.sql`
   - Copy all the content
   - Paste into the SQL Editor

4. **Review the Script**
   - Read through the comments
   - Verify it's deleting from the correct tables
   - Check the order respects foreign key constraints

5. **Execute**
   - Click "Run" button
   - Wait for confirmation
   - The script will complete in seconds

6. **Verify (Optional)**
   - Uncomment the verification section at the bottom
   - Run it to see row counts (should all be 0)

---

### Option 2: Run via SQL Client (Advanced)

Using a tool like DBeaver, pgAdmin, or psql:

```bash
psql -h your-database-url -U your-user -d your-database -f scripts/00-cleanup-demo-data.sql
```

---

### Option 3: Run Individual Sections

If you want to delete data selectively:

```sql
-- Delete only activity logs
DELETE FROM activity_log;
ALTER SEQUENCE IF EXISTS activity_log_id_seq RESTART WITH 1;

-- Delete only lead responses
DELETE FROM lead_responses;
ALTER SEQUENCE IF EXISTS lead_responses_id_seq RESTART WITH 1;

-- Delete only leads
DELETE FROM leads;
ALTER SEQUENCE IF EXISTS leads_id_seq RESTART WITH 1;
```

---

## What the Script Does

### Deletion Order (respects foreign keys)
```
1. activity_log    → references users & leads
2. lead_responses  → references leads & users
3. sessions        → references users
4. leads           → references cities & users
5. cities          → references niches
6. niches          → no dependencies
7. users           → root table
```

### Resets Sequences
After deleting data, auto-increment IDs are reset to 1:
```sql
ALTER SEQUENCE niches_id_seq RESTART WITH 1;
ALTER SEQUENCE cities_id_seq RESTART WITH 1;
-- ... and so on for all tables
```

### What is NOT Deleted
✅ Table structures (schema)  
✅ Indexes  
✅ Triggers  
✅ Functions (like database-level stored procedures)  
✅ Views  
✅ Constraints  
✅ RLS (Row Level Security) policies  

---

## Verification

To verify the cleanup was successful, run:

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

**Expected Result:**
```
table_name    | row_count
--------------|----------
niches        | 0
cities        | 0
users         | 0
leads         | 0
lead_responses| 0
sessions      | 0
activity_log  | 0
```

---

## Troubleshooting

### Error: "Foreign key constraint violation"
This shouldn't happen with the script order, but if it does:
- Make sure you're using the script as-is (don't reorder the DELETE statements)
- Verify you don't have additional custom constraints

### Error: "Sequence doesn't exist"
This is safe to ignore - the script uses `IF EXISTS` to handle missing sequences.

### Tables not empty after running?
- Make sure the entire script ran completely
- Check if you have triggers that auto-populate data
- Run the script again, paying attention to any error messages

---

## Safety Recommendations

1. **Always Backup First**
   ```
   - In Supabase Dashboard, go to Settings → Backups
   - Create a manual backup before running cleanup
   ```

2. **Test in Development First**
   - If possible, test on a development database first
   - Then run on production when confident

3. **Keep a Copy**
   - Keep the script saved for future cleanups
   - Located at: `scripts/00-cleanup-demo-data.sql`

4. **Document Your Cleanup**
   - Note when you ran it
   - Note what data was cleared
   - Keep transaction logs if needed

---

## When to Use This Script

✅ **Good use cases:**
- Removing demo data before going to production
- Testing the application with a fresh database
- Clearing test data between test runs
- Resetting sequences for predictable testing

❌ **Don't use for:**
- Selective deletion (use individual DELETE statements instead)
- Archiving data (backup first!)
- Production data preservation (make sure you have backups!)

---

## After Cleanup

Once the cleanup is complete:

1. **Verify the database is empty**
   - Run the verification query above

2. **Add real data**
   - Use your application's setup/seeding process
   - Or manually add initial records

3. **Check your application**
   - Test that your app handles empty database correctly
   - Verify error messages and empty states work

4. **Document the cleanup**
   - Note the date and time
   - Record why the cleanup was performed

---

## Need to Restore?

If you accidentally deleted data:

1. **Restore from Backup** (Recommended)
   - Go to Supabase Dashboard
   - Settings → Backups
   - Click restore on a recent backup

2. **Re-add Demo Data**
   - Use your seeding scripts if available
   - Or use the application's import/setup features

---

## Questions?

Refer to:
- Supabase Documentation: https://supabase.com/docs
- PostgreSQL Documentation: https://www.postgresql.org/docs/

---

**Last Updated:** February 5, 2026  
**Script Version:** 1.0  
**Database:** Supabase PostgreSQL
