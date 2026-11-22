import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/features/auth/LoginPage";
import { ToastProvider } from "@/components/ui/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute, RequirePermission } from "@/routes/guards";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { UsersPage } from "@/features/users/UsersPage";
import { PartnersPage } from "@/features/partners/PartnersPage";
import { CategoriesPage } from "@/features/catalog/CategoriesPage";
import { ProductsPage } from "@/features/catalog/ProductsPage";
import { WarehousesPage } from "@/features/inventory/WarehousesPage";
import { StockLevelsPage, StockMovementsPage } from "@/features/inventory/StockPages";
import { SalesDetailPage, SalesFormPage, SalesListPage } from "@/features/sales/SalesPages";
import { PurchaseDetailPage, PurchaseFormPage, PurchaseListPage, ReceiptsPage } from "@/features/purchasing/PurchasingPages";
import { AuditPage } from "@/features/audit/AuditPage";
import { normalizeError } from "@/lib/errors";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Pas de retry sur les erreurs client (4xx) : inutile et masque l'erreur ; 1 retry sur réseau/5xx.
        retry: (count, err) => { const s = normalizeError(err).status; return (s === null || s >= 500) && count < 1; },
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="sales-orders" element={<SalesListPage />} />
          <Route path="sales-orders/new" element={<SalesFormPage />} />
          <Route path="sales-orders/:id" element={<SalesDetailPage />} />
          <Route path="sales-orders/:id/edit" element={<SalesFormPage />} />
          <Route path="purchase-orders" element={<PurchaseListPage />} />
          <Route path="purchase-orders/new" element={<PurchaseFormPage />} />
          <Route path="purchase-orders/:id" element={<PurchaseDetailPage />} />
          <Route path="purchase-orders/:id/edit" element={<PurchaseFormPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="stock-levels" element={<StockLevelsPage />} />
          <Route path="stock-movements" element={<StockMovementsPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="customers" element={<PartnersPage kind="customers" />} />
          <Route path="suppliers" element={<PartnersPage kind="suppliers" />} />
          <Route element={<RequirePermission permission="users.manage" />}><Route path="users" element={<UsersPage />} /></Route>
          <Route element={<RequirePermission permission="audit.view" />}><Route path="audit-logs" element={<AuditPage />} /></Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  // useState : le client est créé une seule fois (sinon le cache serait perdu à chaque rendu).
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
