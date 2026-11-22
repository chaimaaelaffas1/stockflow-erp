import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { BREADCRUMB_LABELS, NAV } from "./nav";

function BrandLink() {
  return (
    <Link to="/" className="px-2 text-white" aria-label="StockFlow ERP — accueil">
      <Logo />
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Navigation principale" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.title}</p>
            <ul className="space-y-0.5">
              {items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-white/10 font-medium text-white before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-blue-400"
                          : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="border-t border-sidebar-border p-4">
      <p className="truncate text-xs font-medium text-white">{user.email}</p>
      <p className="mt-0.5 text-xs text-sidebar-foreground/60">{ROLE_LABELS[user.role]}</p>
    </div>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return <span className="text-sm font-medium">Tableau de bord</span>;
  let acc = "";
  return (
    <ol className="flex items-center gap-1 text-sm" aria-label="Fil d'Ariane">
      <li><Link to="/" className="text-muted-foreground hover:text-foreground">Accueil</Link></li>
      {parts.map((p, i) => {
        acc += "/" + p;
        const label = BREADCRUMB_LABELS[p] ?? (/^\d+$/.test(p) ? `#${p}` : p);
        const last = i === parts.length - 1;
        return (
          <li key={acc} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {last ? <span className="font-medium" aria-current="page">{label}</span> : <Link to={acc} className="text-muted-foreground hover:text-foreground">{label}</Link>}
          </li>
        );
      })}
    </ol>
  );
}

const THEME_KEY = "stockflow.theme";

// Le stockage peut être indisponible (navigation privée stricte, stockage bloqué, certains environnements de test) :
// on ne laisse jamais cela faire planter l'interface.
function readTheme(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}
function saveTheme(dark: boolean) {
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    /* préférence non persistée, sans conséquence */
  }
}

function useTheme() {
  const [dark, setDark] = useState(readTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    saveTheme(dark);
  }, [dark]);
  return [dark, () => setDark((d) => !d)] as const;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  const initials = (user?.first_name?.[0] ?? user?.email[0] ?? "?").toUpperCase();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-16 items-center border-b border-sidebar-border px-3"><BrandLink /></div>
        <SidebarNav />
        <SidebarFooter />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
              <BrandLink />
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="h-4 w-4" /></Button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1 overflow-x-auto"><Breadcrumbs /></div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark ? "Thème clair" : "Thème sombre"}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2.5 border-l pl-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>{initials}</span>
            <div className="hidden text-left leading-tight sm:block">
              <p className="max-w-[170px] truncate text-sm font-medium">{user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email}</p>
              <p className="text-xs text-muted-foreground">{user ? ROLE_LABELS[user.role] : ""}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Se déconnecter"><LogOut className="h-4 w-4" /></Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
      </div>
    </div>
  );
}
