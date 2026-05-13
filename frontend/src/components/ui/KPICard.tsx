interface KPICardProps {
  label:   string;
  value:   string;
  sub:     string;
  icon:    string;
  accent?: string;
}

export default function KPICard({ label, value, sub, icon, accent = "#003F7F" }: KPICardProps) {
  return (
    <div
      className="bg-white rounded-card shadow-card border border-gray-100 relative overflow-hidden"
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <div className="p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 leading-none tracking-tight">
          {value}
        </p>
        <p className="text-[0.7rem] text-slate-400 mt-1.5">{sub}</p>
      </div>
      <span
        className="absolute right-3 bottom-2 text-3xl select-none"
        style={{ opacity: 0.08 }}
        aria-hidden
      >
        {icon}
      </span>
    </div>
  );
}
