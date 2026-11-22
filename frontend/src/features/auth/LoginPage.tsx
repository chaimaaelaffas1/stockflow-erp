import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, PackageCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Logo } from "@/components/common/Logo";
import { normalizeError } from "@/lib/errors";

const schema = z.object({
  email: z.string().min(1, "L'e-mail est requis").email("E-mail invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});
type Values = z.infer<typeof schema>;

const HIGHLIGHTS = [
  { icon: PackageCheck, title: "Stock fiable", text: "Réservations, expéditions et réceptions tracées à chaque mouvement." },
  { icon: BarChart3, title: "Vue d'ensemble", text: "Ventes, achats et inventaire dans un tableau de bord unique." },
  { icon: ShieldCheck, title: "Accès par rôle", text: "Chaque équipe ne voit et ne modifie que son périmètre." },
];

export function LoginPage() {
  const { login, status, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (status === "authenticated") return <Navigate to={from} replace />;

  const onSubmit = async (v: Values) => {
    setServerError(null);
    try {
      await login(v.email, v.password);
      navigate(from, { replace: true });
    } catch (e) {
      const err = normalizeError(e);
      setServerError(err.status === 401 ? "E-mail ou mot de passe incorrect." : err.message);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0" aria-hidden />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" aria-hidden />
        <div className="relative"><Logo size="lg" /></div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Pilotez votre stock, vos ventes et vos achats au même endroit.</h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-300"><Icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">StockFlow ERP — gestion de stock, ventes et achats</p>
      </aside>

      <main className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo size="lg" /></div>
          <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
          <p className="mb-6 mt-1.5 text-sm text-muted-foreground">Accédez à votre espace StockFlow ERP.</p>
          {expired && <p role="status" className="mb-4 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">Votre session a expiré. Veuillez vous reconnecter.</p>}
          {serverError && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Adresse e-mail" error={errors.email?.message}>
              {(p) => <Input type="email" autoComplete="username" className="h-10" {...p} {...register("email")} />}
            </Field>
            <Field label="Mot de passe" error={errors.password?.message}>
              {(p) => <Input type="password" autoComplete="current-password" className="h-10" {...p} {...register("password")} />}
            </Field>
            <Button type="submit" className="h-10 w-full" loading={isSubmitting}>Se connecter</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
