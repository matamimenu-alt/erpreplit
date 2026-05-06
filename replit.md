# Restaurant Management System

A multi-restaurant management and accounting system for Saudi Arabia, providing financial, sales, purchasing, HR, inventory, and reporting functionalities for restaurant owners.

## Run & Operate

- **Run Dev**: `pnpm dev` (starts frontend and backend concurrently)
- **Build**: `pnpm build` (builds both `api-server` and `restaurant-mgmt`)
- **Typecheck**: `pnpm typecheck`
- **Codegen**: `pnpm --filter @workspace/api-spec run codegen` (after OpenAPI changes)
- **DB Push**: `pnpm --filter @workspace/db run push` (after Drizzle schema changes)

**Required Environment Variables**:
- `X-Restaurant-ID`: Global header for API client to filter data by restaurant.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: v24
- **TypeScript**: v5.9
- **API**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, TailwindCSS, Recharts, React Hook Form, React Query (v5)

## Where things live

- `/artifacts/api-server`: Express API server
- `/artifacts/restaurant-mgmt`: React + Vite frontend
- `/lib/api-spec`: OpenAPI specification and Orval codegen configuration
- `/lib/api-client-react`: Generated React Query hooks
- `/lib/api-zod`: Generated Zod schemas
- `/lib/db`: Drizzle ORM schema and database connection
- `/scripts`: Utility scripts
- **DB Schema**: `/lib/db/schema.ts`
- **API Contracts**: `/lib/api-spec/openapi.yaml`

## Architecture decisions

- **Monorepo Structure**: Uses pnpm workspaces for a unified development experience across frontend, backend, and shared libraries.
- **API-First Design**: OpenAPI specification is the source of truth for API contracts, enabling automated client and Zod schema generation.
- **WAC-based Inventory**: Inventory stock quantities and costs are managed using Weighted Average Cost (WAC) for accurate valuation.
- **Hybrid Transfer System**: Supports both inter-branch transfers (with transfer-in/out movements) and internal location transfers (transfer-out only).
- **Automated Food Costing & Pricing**: Implements a sophisticated engine for dish costing, pricing analysis, and profit simulation, including waste, fixed cost allocation, and psychological/delivery app pricing.
- **Dynamic Fixed Costs**: Two-tier system — default amounts per template + monthly overrides per period. Closing a month locks it from edits. All changes logged to `expense_audit_logs`. After codegen, rebuild api-client-react declarations: `cd lib/api-client-react && pnpm exec tsc -p tsconfig.json`.

## Product

- **Financial Dashboard**: Overview of key financial KPIs, charts, and monthly performance.
- **Sales Management**: Daily sales records, multi-channel revenue tracking, VAT calculation, and reporting.
- **Purchase Management**: Full CRUD for purchases, multi-item invoice processing, product autocomplete, category hierarchy, and stock movement auto-sync.
- **Inventory Management**: Real-time stock levels, movement tracking (consumption, adjustments, transfers), monthly COGS reports, and P&L closing stock.
- **HR & Payroll**: Simplified payroll calculation based on basic salary, overtime, deductions, and absences, along with staff expense tracking.
- **Dynamic Fixed Costs**: 4-tab system — Monthly Overview (per-month overrides, lock/unlock), Templates (CRUD per category), History & Charts (6-month Recharts trends), Audit Log (full change trail). 6 categories: staff-salaries, owner-drawings, apps-subscriptions, rent, utilities, other-fixed. P&L includes `totalDynamicFixedCosts`.
- **Reporting**: Comprehensive P&L statements, monthly purchase summaries, category expense breakdowns, and ZATCA VAT reports.
- **Supplier Management**: Directory and price comparison features.

## User preferences

_Populate as you build_

## Gotchas

- **React Query v5**: `onSuccess` callback has been removed; use `useEffect` to watch the `data` property instead.
- **Negative Stock Prevention**: Both frontend and backend enforce checks to prevent consumption or transfers that would result in negative stock.
- **Path Resolution**: The Wouter router uses `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` for correct SPA routing.

## Pointers

- **React Query Documentation**: [https://react-query-v5.tanstack.com/](https://react-query-v5.tanstack.com/)
- **Drizzle ORM Documentation**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **OpenAPI Specification**: [https://swagger.io/specification/](https://swagger.io/specification/)
- **Orval Documentation**: [https://orval.dev/](https://orval.dev/)
- **ZATCA VAT Regulations**: Refer to Saudi Arabian tax authority guidelines for VAT calculations.