import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/ui/card";
import type { Permission } from "@/lib/permissions";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") {
    return <div className="p-8" aria-busy="true"><Skeleton className="h-8 w-48" /></div>;
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function Unauthorized() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-warning" aria-hidden />
      <h1 className="text-xl font-semibold">Accès non autorisé</h1>
      <p className="text-sm text-muted-foreground">Votre rôle ne permet pas d'accéder à cette page. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.</p>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">Retour au tableau de bord</Link>
    </div>
  );
}

/** Garde de route par permission (ergonomie uniquement : le backend renvoie 403 de toute façon). */
export function RequirePermission({ permission }: { permission: Permission }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <Unauthorized />;
}
