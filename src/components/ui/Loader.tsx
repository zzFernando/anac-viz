interface LoaderProps {
  height?:  number | string;
  label?:   string;
  variant?: "light" | "dark";
  rounded?: boolean;
}

export default function Loader({
  height  = 260,
  label   = "Carregando…",
  variant = "light",
  rounded = true,
}: LoaderProps) {
  const isDark = variant === "dark";
  const bg     = isDark ? "bg-[#0D1117]" : "bg-gray-50";
  const ring   = isDark ? "border-white/15 border-t-white/70" : "border-anac-blue/15 border-t-anac-blue";
  const text   = isDark ? "text-white/60" : "text-slate-500";
  const style  = typeof height === "number" ? { height: `${height}px` } : { height };

  return (
    <div
      style={style}
      className={`${bg} ${rounded ? "rounded" : ""} w-full flex flex-col items-center justify-center gap-3`}
      role="status"
      aria-live="polite"
    >
      <div className={`w-9 h-9 rounded-full border-[3px] ${ring} animate-spin`} />
      <div className={`text-xs font-semibold tracking-wide uppercase ${text}`}>{label}</div>
    </div>
  );
}
