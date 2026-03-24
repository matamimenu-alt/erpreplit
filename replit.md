# Workspace

## Overview

Restaurant Management & Accounting System for Saudi Arabia. Full-stack pnpm monorepo using TypeScript, React, and Express.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TailwindCSS, Recharts, React Hook Form, React Query

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── restaurant-mgmt/    # React + Vite frontend (Restaurant Management System)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Restaurant Management System Features

1. **Financial Dashboard** — KPI cards (Total Sales, Purchases, VAT Payable, Net Profit/Loss), charts (Cost Distribution, Sales Mix). Month filter.
2. **Sales Management** — Daily sales records with Food Sales, Beverage Sales, auto-calculated Total and 15% Output VAT. Monthly summary.
3. **Purchase Management** — Purchases with supplier/product info, VAT checkbox (price includes VAT or not), auto-calculated VAT amounts.
4. **Supplier Management** — Supplier directory with contact info.
5. **Supplier Price Comparison** — Track previous/current prices per product per supplier, highlight increases (red) / decreases (green).
6. **Employee HR** — Employee records with Iqama expiry/renewal dates, vacation balance. Monthly cost calculation: salary + accommodation + medical + GOSI + air ticket/12.
7. **Fixed Expenses** — Monthly recurring costs with contract start/end dates.
8. **ZATCA VAT Report** — Output VAT (Sales × 15%), Input VAT (from purchases), VAT Payable = Output - Input. Month filter.
9. **Financial Reports** — Downloadable/printable P&L, VAT, Employee Cost, Expense, Supplier Price reports.

## Database Schema

- `sales` — daily sales records
- `purchases` — purchase records with VAT calculation
- `suppliers` — supplier directory
- `supplier_products` — supplier product price history
- `employees` — employee data and monthly cost components
- `expenses` — fixed monthly expenses

## VAT Rules (Saudi ZATCA)
- VAT Rate: 15%
- Output VAT = Total Sales × 15%
- Input VAT = VAT paid on purchases
- VAT Payable = Output VAT − Input VAT

## API Routes
All routes under `/api/`:
- `/sales` — CRUD + `/monthly-summary`
- `/purchases` — CRUD
- `/suppliers` — CRUD + `/price-comparison` + `/products` (CRUD)
- `/employees` — CRUD
- `/expenses` — CRUD
- `/vat/report` — VAT report (optional ?month=YYYY-MM)
- `/dashboard/summary` — Financial summary (optional ?month=YYYY-MM)
