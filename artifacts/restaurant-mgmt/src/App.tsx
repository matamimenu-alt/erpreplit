import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Sales from "@/pages/Sales";
import Purchases from "@/pages/Purchases";
import Suppliers from "@/pages/Suppliers";
import SupplierPrices from "@/pages/SupplierPrices";
import Employees from "@/pages/Employees";
import Inventory from "@/pages/Inventory";
import FoodCost from "@/pages/FoodCost";
import VatReport from "@/pages/VatReport";
import Reports from "@/pages/Reports";
import Branches from "@/pages/Branches";
import GroupDashboard from "@/pages/GroupDashboard";
import ExpensesManagement from "@/pages/ExpensesManagement";
import DailyRevenueEntry from "@/pages/DailyRevenueEntry";
import ReportsHub from "@/pages/reports/ReportsHub";
import SalesComparison from "@/pages/reports/SalesComparison";
import RestaurantPerformance from "@/pages/reports/RestaurantPerformance";
import FinancialReport from "@/pages/reports/FinancialReport";
import ConsolidatedFinancial from "@/pages/reports/ConsolidatedFinancial";
import SupplierPurchases from "@/pages/reports/SupplierPurchases";
import PriceComparison from "@/pages/reports/PriceComparison";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import { LanguageProvider } from "@/i18n/LanguageContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/group-dashboard" component={GroupDashboard} />
        <Route path="/branches" component={Branches} />
        <Route path="/daily-revenue" component={DailyRevenueEntry} />
        <Route path="/sales" component={Sales} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/supplier-prices" component={SupplierPrices} />
        <Route path="/employees" component={Employees} />
        {/* Unified Expenses Management (replaces Fixed Expenses + Expense Ledger).
            Old paths /expenses and /expense-ledger redirect to the new module so
            any bookmarks / hard-coded links keep working. */}
        <Route path="/expenses-management" component={ExpensesManagement} />
        <Route path="/expenses"            component={ExpensesManagement} />
        <Route path="/expense-ledger"      component={ExpensesManagement} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/food-cost" component={FoodCost} />
        <Route path="/vat-report" component={VatReport} />
        <Route path="/reports" component={ReportsHub} />
        <Route path="/reports/pl" component={Reports} />
        <Route path="/reports/sales-comparison" component={SalesComparison} />
        <Route path="/reports/restaurant-performance" component={RestaurantPerformance} />
        <Route path="/reports/financial" component={FinancialReport} />
        <Route path="/reports/consolidated" component={ConsolidatedFinancial} />
        <Route path="/reports/supplier-purchases" component={SupplierPurchases} />
        <Route path="/reports/price-comparison" component={PriceComparison} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <LanguageProvider>
            <RestaurantProvider>
              <Router />
            </RestaurantProvider>
          </LanguageProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
