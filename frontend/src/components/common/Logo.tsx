import { cn } from "@/lib/utils";

/** Pictogramme StockFlow : trois couches de stock empilées (flux) sur un carré bleu arrondi. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sf-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#sf-logo-gradient)" />
      <path d="M7 20.5 16 25l9-4.5" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16.2 16 20.7l9-4.5" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6.5 7 11l9 4.5L25 11z" fill="#fff" />
    </svg>
  );
}

/** Logo complet (pictogramme + nom). La couleur du texte suit `currentColor` : adapté aux fonds clairs et sombres. */
export function Logo({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={big ? "h-10 w-10" : "h-8 w-8"} />
      <span className={cn("font-semibold tracking-tight", big ? "text-2xl" : "text-[15px]")}>
        StockFlow<span className="ml-1 font-medium opacity-60">ERP</span>
      </span>
    </span>
  );
}
