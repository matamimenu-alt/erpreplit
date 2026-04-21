# Workspace

## Overview

Multi-restaurant Management & Accounting System for Saudi Arabia. Manages 3 restaurants: **Asad Al-Hamra**, **Sabah Al-El**, **Chicken Bar**. Full-stack pnpm monorepo using TypeScript, React, and Express.

## Latest Changes (Session)
- **HR Payroll Simplification**: Completely rebuilt the payroll system. Formula: `Net Salary = Basic Salary + Overtime − Deductions − Absences`. Removed all allowances/benefits/GOSI from the payroll form and table. DB: added `overtime`, `deductions`, `absences` columns. The old legacy columns (socialSecurity, laborFees, etc.) remain in DB for data history but are no longer shown.
- **Staff Expenses category**: Added `staff-expenses` category to the Fixed Expenses page. New "Add Staff Expense" button with types: Iqama Renewal, Visa Fees, Medical Insurance, Travel Ticket, Government Fees, Work Permit, Recruitment Fees. Shown as its own section with orange badge. Included in P&L operating expenses and dashboard overhead totals.
- **Reports updated**: P&L now shows "Net Salaries (Payroll)" + "Staff Expenses (Iqama, Visa, Insurance, Tickets)" as separate line items. Excel export updated to match.
- **Product Autocomplete (Smart Suggestions)**: The Product Name field in the invoice modal now has intelligent autocomplete. Backend: `GET /api/purchases/products` (operationId `getPurchaseProductSuggestions`) — returns distinct products (by name) with last-used category + price using `DISTINCT ON (lower(product_name))`. Frontend: `ProductCombobox` component with real-time filtering, ↑↓ keyboard navigation, Enter to select, Escape to close, category badge + price shown in each row, "Add new item" option for unknown products, exact-match duplicate warning + partial-match hint when the product is already in the current invoice. On selection: auto-fills product name, main group key, subcategory, and unit price from the last purchase.
- **Multi-Item Invoice System**: Completely rebuilt the "Add Purchase" flow into a full multi-item invoice modal (فاتورة متعددة الأصناف). Key features:
  - Invoice-level fields: Invoice Type (tax/non-tax toggle), Date, Supplier, Payment Type, VAT inclusion checkbox
  - Items table with add/edit/delete — each item has its own Product Name, Category (2-level), Qty, Unit Price
  - Live preview shows Net, VAT, Total as you type each item's qty/price
  - Add Item with keyboard (Enter key support), inline edit mode, delete
  - Invoice totals footer: Subtotal, VAT (15%), Grand Total across all items
  - On save: calls `POST /api/purchases/batch` to save all items under shared `invoiceId` (UUID)
  - Each row in the purchases table shows the truncated `invoiceId` for traceability
  - Edit individual rows: separate single-item edit modal (unchanged workflow)
- **DB Schema**: Added `invoice_id` (text, nullable) column to `purchases` table
- **Backend batch endpoint**: `POST /api/purchases/batch` — accepts invoice-level fields + items array, saves each item as separate DB row with shared `invoiceId`, auto-creates stock movements per item
- **OpenAPI + Codegen**: Added `CreatePurchaseBatch`, `BatchInvoiceItem` schemas; added `/purchases/batch` POST endpoint; updated `PurchaseCategory` enum to include all 24 new subcategory values (plus legacy values for backward compatibility); updated `Purchase` schema with `invoiceId`
- **Purchase Category Hierarchy Restructured**: Replaced flat category list with 8 bilingual main categories + subcategories. Two-step selector in "Add Purchase" modal: main group buttons → subcategory dropdown. Filter dropdown shows full hierarchy. Category Expenses report shows grouped bilingual view. Legacy category values auto-mapped via `LEGACY_MAP`. All new category values use consistent prefix patterns (`food-*`, `bev-*`, `gen-*`, `fuel-*`, `maint-*`, `it-*`, `mkt-*`, `others-*`) for P&L classification.
- **8 Main Categories**: Cost of Sale–Food (الأغذية), Cost of Sale–Beverage (المشروبات), Cost of Sale–General (عام), Fuel & Energy (الوقود), Maintenance & Repair (الصيانة), IT & Communication (تقنية المعلومات), Marketing & Advertising (التسويق), Other Expenses (مصاريف أخرى). Each with 2–6 subcategories.
- **Monthly Purchases Report Enhanced**: Added 5-card KPI summary (Tax Invoice Net, Input VAT, Tax Total, Non-Tax Total, Grand Total) and expanded table with 7 columns showing taxable/non-taxable split per month.
- **Sales Module Completely Rewritten**: New `sales` DB table with `cash`, `card`, `app1-6`, `vatMode`, `totalRevenue`, `netSales`, `outputVat`, `openingBalance`, `cashExpenses`, `pettyCash`, `closingBalance`, `expectedClosing`, `cashDiscrepancy`, `dailyNotes`. Old food/beverage/channel structure dropped.
- **Sales App Config Table**: `sales_app_config` for per-restaurant delivery app names (6 slots) and default VAT mode.
- **New Sales UI**: 4-tab layout: *Daily Records* (table with all new fields), *Reports* (date-range filter + channel breakdown), *Cash Management* (discrepancy analysis per day), *Settings* (app names + VAT mode config).
- **VAT Calculation**: Exclusive mode → `netSales = totalRevenue`, `outputVat = totalRevenue × 15%`; Inclusive mode → `netSales = totalRevenue / 1.15`, `outputVat = totalRevenue - netSales`.
- **Cash Discrepancy**: `expectedClosing = openingBalance + cash - cashExpenses - pettyCash`; `cashDiscrepancy = closingBalance - expectedClosing`.
- **Live Preview**: Real-time calculation in the record entry modal (fixed numeric coercion bug).
- **Purchases Module Updated**: Added `paymentType` field (cash/card/credit) — shown as badge in table, dropdown in form, included in OpenAPI + codegen.
- **P&L Report Updated**: Revenue section now shows Cash Sales, Card/POS, Delivery Apps, Net Sales (excl. VAT) instead of old food/beverage channel breakdown.
- **Dashboard Updated**: Pie chart now shows Net Sales vs Output VAT instead of Food Sales vs Beverage Sales.
- **OpenAPI/Codegen**: All schemas updated (Sale, CreateSale, MonthlySalesSummary, SalesAppConfig, SalesReport, PLReport, Purchase, CreatePurchase). New endpoints: GET/PUT /api/sales/app-config, GET /api/sales/report. Codegen ran successfully.
- **Food Cost & Pricing Engine Built**: New page at `/food-cost` with 3 tabs (Dishes, Pricing Analysis, Profit Simulator). New DB tables: `dishes`, `dish_ingredients`, `pricing_config`. Backend route `/api/dishes` with full pricing calculation logic.
- **Automated pricing formula**: Ingredient Cost (from purchases) + Waste % + Fixed Cost Allocation (expenses + salaries ÷ monthly orders) + Delivery Cost = Final Dish Cost → ÷ Target Food Cost % = Suggested Price.
- **Psychological pricing**: Rounds up to X.90 format (SAR 25 → SAR 25.90).
- **Delivery app pricing**: Adds delivery commission uplift (default 25%) for delivery platform price.
- **Profit Simulator**: Interactive sliders for target food cost % and waste %, shows live price/margin changes with original vs simulated comparison.
- **Ingredient autocomplete**: Pulls product names from purchase records for easy ingredient entry.

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
2. **Sales Management** — Daily sales records with 4 revenue channels (Local Dine-In, Takeaway, Delivery, App Sales), each with Food + Beverage breakdown. Auto-calculated Total and 15% Output VAT. Excel export.
3. **Purchase Management** — Full CRUD with 15 subcategories across COGS (cost-food, cost-beverage, cost-general) and Operating Expenses (fuel-energy, maintenance, it-communication, marketing, others). Supplier name optional, notes field, search/filter by product/category/month, auto-calculated VAT, Excel export. Auto-syncs stock movements on create/update/delete.
4. **Supplier Management** — Supplier directory with contact info.
5. **Supplier Price Comparison** — Track previous/current prices per product per supplier, highlight increases (red) / decreases (green).
6. **HR & Payroll** — Full payroll table with grouped columns: Employee Info (Designation, Full/Part Time, Name, Nationality, Joining Date, # Months auto-calc), Basic Salary, Monthly Payroll Taxes (Social Security, Labor Fees, Iqama/mo = yearly÷3÷12, Total Taxes), Employee Benefits (Medical÷12, Indemnity=Salary÷12, AirTicket÷24, Vacation=(Salary÷30×21)÷12, Food Meal, Total Benefits), Total Labor Cost. Labor Cost Summary dashboard shows 4 KPI cards. Full Edit capability. Excel export.
7. **Fixed Expenses** — Monthly recurring costs with contract start/end dates.
8. **Inventory Management** — 5-tab system:
   - *Stock Levels*: Real-time stock per item (quantity, cost, value), search + category filter, Export Excel
   - *Movements*: Log consumptions/adjustments/opening balances; filter by type/item/date; delete entries
   - *Transfers*: Inter-branch transfer form; auto-creates transfer-in and transfer-out movements
   - *Monthly Report*: COGS breakdown by item with Opening/Purchases/Consumption/Closing; Export Excel
   - *P&L Closing Stock*: Save monthly closing stock values (Food, Beverage, General) for P&L calculation
9. **ZATCA VAT Report** — Output VAT (Sales × 15%), Input VAT (from purchases), VAT Payable = Output - Input. Month filter.
10. **Financial Reports** — 3 tabs: (1) P&L Statement with full COGS + OpEx breakdown (COGS uses Opening Inventory + Purchases − Closing Inventory formula, Labour TLC, Purchase OpEx categories, Fixed Expenses), % of Revenue column, KPI cards, Print & Excel export; (2) Monthly Purchases summary; (3) Category Expense breakdown.

## Database Schema

- `sales` — daily sales records (8 channel columns + computed totals)
- `purchases` — purchase records with VAT calculation (15 categories)
- `suppliers` — supplier directory
- `supplier_products` — supplier product price history
- `employees` — employee data and monthly cost components
- `expenses` — fixed monthly expenses
- `inventory` — monthly closing stock values (food/beverage/general per restaurant)
- `stock_movements` — all stock movements (purchases, consumption, adjustments, transfers, opening balances)
- `branch_transfers` — inter-branch transfer records

## VAT Rules (Saudi ZATCA)
- VAT Rate: 15%
- Output VAT = Total Sales × 15%
- Input VAT = VAT paid on purchases
- VAT Payable = Output VAT − Input VAT

## COGS Formula (P&L)
`COGS = Opening Inventory + Total Purchases − Closing Inventory`
Opening inventory = previous month's closing stock sum; Closing inventory = saved from P&L Closing Stock tab

## API Routes
All routes under `/api/`:
- `/sales` — CRUD + `/monthly-summary`
- `/purchases` — CRUD (auto-syncs stock movements)
- `/suppliers` — CRUD + `/price-comparison` + `/products` (CRUD)
- `/employees` — CRUD
- `/expenses` — CRUD
- `/inventory` — GET/UPSERT closing stock by month
- `/stock/items` — list stock items with current quantities
- `/stock/movements` — CRUD stock movements
- `/stock/transfers` — CRUD branch transfers
- `/stock/report` — monthly stock COGS report by item
- `/vat/report` — VAT report (optional ?month=YYYY-MM)
- `/dashboard/summary` — Financial summary (optional ?month=YYYY-MM)
- `/reports/pl` — P&L report (optional ?month=YYYY-MM)

## Important Technical Notes
- App is served at root path `/` (BASE_PATH="/"). All routes are relative to root.
- `X-Restaurant-ID` header is set globally in the API client to filter data by restaurant.
- React Query v5: `onSuccess` callback removed; use `useEffect` watching `data` instead.
- Wouter router uses `base={import.meta.env.BASE_URL.replace(/\/$/, "")}` for SPA routing.
- After OpenAPI changes: run `pnpm --filter @workspace/api-spec run codegen`
- After DB schema changes: run `pnpm --filter @workspace/db run push`
