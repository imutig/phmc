---
description: Apply SQL migrations to Supabase database
---

# Database Migration Workflow

This workflow allows applying SQL migrations to the Supabase database.

## Prerequisites
- `DATABASE_URL` environment variable must be set in the terminal
- PostgreSQL client (psql) installed

## Steps

### 1. Set DATABASE_URL (one-time per session)
```bash
export DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```
// turbo

### 2. Apply a migration file
```bash
psql "$DATABASE_URL" -f supabase/migrations/XXX_migration_name.sql
```

### 3. Verify the migration
```bash
psql "$DATABASE_URL" -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'your_table';"
```

## Notes
- The `DATABASE_URL` can be found in Supabase Dashboard > Project Settings > Database > Connection string.
- Use the "Transaction pooler" connection string for migrations.
