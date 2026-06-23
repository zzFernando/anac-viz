interface Props {
  label: string;
  value: string;
  sub?:  string;
  accent?: string;
}

export default function MiniKPI({ label, value, sub, accent = "#003F7F" }: Props) {
  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-card border border-gray-100 dark:border-slate-700 p-3 flex flex-col justify-between min-w-0"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 leading-tight">
        {label}
      </p>
      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-none tracking-tight mt-1">
        {value}
      </p>
      {sub && <p className="text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}
