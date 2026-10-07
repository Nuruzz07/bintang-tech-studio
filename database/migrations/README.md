# database/migrations

Versioned SQL migrations for Supabase/PostgreSQL schema.

## Status: PLANNED FOR M02

- **NO migrations are implemented in M01.**
- Database schema and migration implementation begins in **M02 (Database Foundation)**.
- All migrations will follow sequential numbering (`00001_initial_schema.sql`, etc.) and the _Expand -> Migrate -> Switch -> Contract_ lifecycle.
- Production Supabase schema will be safely reconciled before any migration is applied.
