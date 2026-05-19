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
import Expenses from "@/pages/Expenses";
import Inventory from "@/pages/Inventory";
import FoodCost from "@/pages/FoodCost";
import VatReport from "@/pages/VatReport";
import Reports from "@/pages/Reports";
import Branches from "@/pages/Branches";
import GroupDashboard from "@/pages/GroupDashboard";
import ExpenseLedger from "@/pages/ExpenseLedger";
import { RestaurantProvider } from "@/contexts/RestaurantContext";

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
        <Route path="/sales" component={Sales} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/supplier-prices" component={SupplierPrices} />
        <Route path="/employees" component={Employees} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/expense-ledger" component={ExpenseLedger} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/food-cost" component={FoodCost} />
        <Route path="/vat-report" component={VatReport} />
        <Route path="/reports" component={Reports} />
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
          <RestaurantProvider>
            <Router />
          </RestaurantProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
