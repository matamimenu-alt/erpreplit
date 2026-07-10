# Database Data Snapshot

Exported from the development database on 2026-07-10.

## Contents

- `seed-data.sql` — full data-only SQL dump of **all** tables (restaurants, suppliers, purchases, sales, expenses, dishes, inventory, employees, fixed costs, etc.). Use this to restore the complete dataset.
- `exports/` — readable CSV extracts:
  - `restaurants.csv` — all restaurants/branches
  - `purchases_by_restaurant.csv` — purchases joined with restaurant name (EN/AR)
  - `sales_by_restaurant.csv` — sales joined with restaurant name (EN/AR)
  - `suppliers.csv` — suppliers
  - `supplier_products.csv` — supplier product catalog

## Restoring into a new database (e.g. Railway)

1. Create the schema first (runs automatically on deploy via `pnpm run db:push`, or run it manually).
2. Load the data:

```bash
psql "$DATABASE_URL" -f data/seed-data.sql
```

The dump uses plain `INSERT` statements, so it requires empty tables (fresh database) to avoid primary-key conflicts.
