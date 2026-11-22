import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ToastProvider } from "@/components/ui/toast";
import { AppRoutes } from "@/App";
import type { Role } from "@/lib/permissions";
import { tokens } from "@/lib/tokens";

export function makeMe(role: Role) {
  return { id: 1, email: `${role.toLowerCase()}@example.com`, username: role, first_name: "Test", last_name: role, role, is_active: true };
}

/** Rend l'application complète à une URL donnée avec un client de requêtes sans retry. */
export function renderApp(route = "/", ui: ReactElement = <AppRoutes />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>{ui}</AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** Simule une session existante : refresh token présent → restauration via /auth/token/refresh/. */
export function seedSession() {
  tokens.set("access-old", "refresh-1");
}
