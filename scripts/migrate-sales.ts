import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function migrate() {
  await db.execute(sql`DROP TABLE IF EXISTS sales CASCADE`);
  await db.execute(sql`
    CREATE TABLE sales (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL DEFAULT 1 REFERENCES restaurants(id),
      date TEXT NOT NULL,
      cash NUMERIC(12,2) NOT NULL DEFAULT 0,
      card NUMERIC(12,2) NOT NULL DEFAULT 0,
      app1 NUMERIC(12,2) NOT NULL DEFAULT 0,
      app2 NUMERIC(12,2) NOT NULL DEFAULT 0,
      app3 NUMERIC(12,2) NOT NULL DEFAULT 0,
      app4 NUMERIC(12,2) NOT NULL DEFAULT 0,
      app5 NUMERIC(12,2) NOT NULL DEFAULT 0,
      app6 NUMERIC(12,2) NOT NULL DEFAULT 0,
      vat_mode TEXT NOT NULL DEFAULT 'exclusive',
      total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
      net_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
      output_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
      opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      cash_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
      petty_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
      closing_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      expected_closing NUMERIC(12,2) NOT NULL DEFAULT 0,
      cash_discrepancy NUMERIC(12,2) NOT NULL DEFAULT 0,
      daily_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log("sales table created");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sales_app_config (
      id SERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL DEFAULT 1 REFERENCES restaurants(id),
      app1_name TEXT NOT NULL DEFAULT 'HungerStation',
      app2_name TEXT NOT NULL DEFAULT 'Jahez',
      app3_name TEXT NOT NULL DEFAULT 'Noon Food',
      app4_name TEXT NOT NULL DEFAULT 'Talabat',
      app5_name TEXT NOT NULL DEFAULT 'App 5',
      app6_name TEXT NOT NULL DEFAULT 'App 6',
      default_vat_mode TEXT NOT NULL DEFAULT 'exclusive',
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log("sales_app_config table created");
  await db.execute(sql`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'`);
  console.log("payment_type added to purchases");
  await pool.end();
  console.log("Done!");
}

migrate().catch((e) => { console.error(e.message); process.exit(1); });
