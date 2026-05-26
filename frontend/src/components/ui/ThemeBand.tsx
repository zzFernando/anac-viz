interface Props {
  label: string;
  hint?: string;
}

export default function ThemeBand({ label, hint }: Props) {
  return (
    <div className="flex items-center gap-3 pt-3 pb-1">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold whitespace-nowrap">
        {label}
      </span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
      {hint && (
        <span className="text-[0.65rem] text-slate-400 italic hidden md:inline">{hint}</span>
      )}
    </div>
  );
}
