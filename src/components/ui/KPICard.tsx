interface KPICardProps {
  label:    string;
  value:    string;
  sub:      string;
  icon?:    string;
  accent?:  string;
  size?:    "default" | "hero";
  tooltip?: string;
  /** Slot opcional pra sparkline, mini-bar etc. */
  children?: React.ReactNode;
}

export default function KPICard({
  label, value, sub, icon, accent = "#003F7F",
  size = "default", tooltip, children,
}: KPICardProps) {
  const isHero = size === "hero";
  const pad     = isHero ? "p-4 md:p-5" : "p-4";
  const valueCls = isHero ? "text-4xl md:text-[2.4rem]" : "text-2xl";
  const labelCls = isHero ? "text-[0.7rem]" : "text-[0.65rem]";
  const subCls   = isHero ? "text-xs" : "text-[0.7rem]";

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-card shadow-card border border-gray-100 dark:border-slate-700 relative overflow-hidden"
      style={{ borderTop: `3px solid ${accent}` }}
      title={tooltip}
    >
      {/* Ícone como watermark — apenas no modo hero */}
      {icon && isHero && (
        <span
          className="absolute right-3 top-3 text-4xl select-none pointer-events-none z-0"
          style={{ opacity: 0.08 }}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <div className={`${pad} relative z-10`}>
        <div className="flex items-baseline gap-1.5">
          <p className={`${labelCls} font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400`}>
            {label}
          </p>
          {tooltip && (
            <span
              aria-label={tooltip}
              className="text-[0.55rem] text-slate-400 cursor-help"
            >ⓘ</span>
          )}
        </div>
        <p className={`${valueCls} font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight mt-1`}>
          {value}
        </p>
        <p className={`${subCls} text-slate-400 dark:text-slate-500 mt-1.5`}>{sub}</p>
        {children}
      </div>
    </div>
  );
}
