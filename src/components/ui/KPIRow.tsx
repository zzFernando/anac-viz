import KPICard from "./KPICard";
import Sparkline, { type SparkPoint } from "@/components/charts/Sparkline";
import ShareBar  from "@/components/charts/ShareBar";
import type { KPIsData, SerieData, ScatterData, RotasData, Rota } from "@/lib/types";
import { eventsForAirport } from "@/lib/events";

const GOLD       = "#C89600";
const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const CONNECTION = "#16A34A";

const METRO_GROUPS: { key: string; name: string; airports: string[] }[] = [
  { key: "GSP", name: "Grande São Paulo",      airports: ["SBGR", "SBSP", "SBKP"] },
  { key: "GRJ", name: "Grande Rio de Janeiro", airports: ["SBGL", "SBRJ", "SBJR"] },
];

interface Props {
  kpis:       KPIsData | undefined;
  serie?:     SerieData | undefined;
  scatter?:   ScatterData | undefined;
  rotas?:     RotasData | undefined;
  aeroporto?: string;
  layout?:    "grid" | "column";
}

export default function KPIRow({ kpis, serie, scatter, rotas, aeroporto, layout = "grid" }: Props) {
  // Sparkline dos últimos 24 meses do aeroporto, com data + valor pra ancorar eventos
  const sparkData: SparkPoint[] = (serie?.aeroporto?.slice(-24) ?? [])
    .filter(p => p.pax != null)
    .map(p => ({ date: p.date, value: p.pax }));

  const sparkEvents = aeroporto
    ? eventsForAirport(aeroporto).map(ev => ({
        date:  ev.date,
        label: ev.label,
        color: ev.color,
      }))
    : [];
  const connection = buildConnectionSummary(rotas);

  if (layout === "grid") {
    const onTimePct = kpis
      ? parseFloat(kpis.pontualidade.value.replace(",", ".")) || 0
      : 0;
    const delayedPct = onTimePct > 0 ? +(100 - onTimePct).toFixed(1) : 0;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <KPICard
          label={kpis ? `Passageiros no aeroporto — ${kpis.nome}` : "Passageiros no aeroporto"}
          value={kpis?.pax.value ?? "—"}
          sub={kpis?.pax.sub ?? ""}
          icon="✈"
          accent={ANAC_BLUE}
        >
          {sparkData.length > 1 && (
            <div className="mt-3">
              <Sparkline data={sparkData} color={ANAC_LIGHT} height={48} events={sparkEvents} />
              <div className="text-[0.55rem] text-slate-400 mt-1 tracking-wider uppercase">
                últimos 24 meses
                {sparkEvents.length > 0 && (
                  <span className="ml-1 normal-case tracking-normal">
                    · {sparkEvents.map(e => e.label).join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </KPICard>
        <KPICard
          label="Empresa com mais passageiros"
          value={kpis?.lider.value ?? "—"}
          sub={kpis?.lider.sub ?? ""}
          tooltip="Companhia que transportou mais passageiros pagos no aeroporto durante o período escolhido."
          icon="🏢"
          accent={GOLD}
        >
          <ShareBar points={scatter?.points} />
        </KPICard>
        <KPICard
          label="Voos no horário"
          value={kpis?.pontualidade.value ?? "—"}
          sub={kpis?.pontualidade.sub ?? ""}
          tooltip="Percentual de partidas com até 30 minutos de atraso no aeroporto escolhido."
          icon="🕐"
          accent={ANAC_LIGHT}
        >
          {onTimePct > 0 && (
            <div className="mt-3 space-y-2">
              <div>
                <div className="flex justify-between text-[0.6rem] text-slate-500 dark:text-slate-400 mb-1">
                  <span>No horário</span>
                  <span className="font-semibold text-emerald-600">{kpis!.pontualidade.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${onTimePct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[0.6rem] text-slate-500 dark:text-slate-400 mb-1">
                  <span>Com atraso (&gt;30 min)</span>
                  <span className="font-semibold text-red-500">{delayedPct.toLocaleString("pt-BR")}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${delayedPct}%` }} />
                </div>
              </div>
            </div>
          )}
        </KPICard>
        <ConnectionCard connection={connection} />
      </div>
    );
  }

  // layout "column" — KPI herói no topo + secundários
  return (
    <div className="flex flex-col justify-between gap-2 h-full">
      {/* HERO */}
      <KPICard
        size="hero"
        label={kpis ? `Passageiros no aeroporto — ${kpis.nome}` : "Passageiros no aeroporto"}
        value={kpis?.pax.value ?? "—"}
        sub={kpis?.pax.sub ?? ""}
        icon="✈"
        accent={ANAC_BLUE}
      >
        {sparkData.length > 1 && (
          <div className="mt-2">
            <Sparkline data={sparkData} color={ANAC_LIGHT} height={36} events={sparkEvents} />
            <div className="text-[0.55rem] text-slate-400 mt-0.5 tracking-wider uppercase">
              últimos 24 meses
              {sparkEvents.length > 0 && (
                <span className="ml-1.5 normal-case tracking-normal">
                  · eventos: {sparkEvents.map(e => e.label).join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </KPICard>

      {/* Empresa líder no período + mini stacked bar */}
      <KPICard
        label="Empresa com mais passageiros"
        value={kpis?.lider.value ?? "—"}
        sub={kpis?.lider.sub ?? ""}
        tooltip="Companhia que transportou mais passageiros pagos no aeroporto durante o período escolhido."
        icon="🏢"
        accent={GOLD}
      >
        <ShareBar points={scatter?.points} />
      </KPICard>

      {/* Pontualidade */}
      <KPICard
        label="Voos no horário"
        value={kpis?.pontualidade.value ?? "—"}
        sub={kpis?.pontualidade.sub ?? ""}
        tooltip="Percentual de partidas com até 30 minutos de atraso no aeroporto escolhido."
        icon="🕐"
        accent={ANAC_LIGHT}
      />

      <ConnectionCard connection={connection} />
    </div>
  );
}

interface ConnectionItem {
  key: string;
  label: string;
  detail: string;
  pct: number;
  paxRaw: number;
}

interface ConnectionSummary {
  main?: ConnectionItem;
  items: ConnectionItem[];
}

function ConnectionCard({ connection }: { connection: ConnectionSummary }) {
  const main = connection.main;

  return (
    <KPICard
      label="Principal conexão"
      value={main?.label ?? "—"}
      sub={main ? `${main.detail} · ${fmtPercent(main.pct)} dos passageiros` : "sem rotas no período"}
      tooltip="Destino ou região metropolitana que mais recebeu passageiros saindo do aeroporto no período escolhido."
      icon="↗"
      accent={CONNECTION}
    >
      {connection.items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {connection.items.slice(0, 3).map(item => (
            <div key={item.key}>
              <div className="flex items-center justify-between gap-2 text-[0.62rem] text-slate-500 dark:text-slate-400">
                <span className="min-w-0 truncate">{item.label}</span>
                <span className="shrink-0 font-semibold text-slate-600 dark:text-slate-300">{fmtPercent(item.pct)}</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-sm bg-emerald-500"
                  style={{ width: `${Math.max(5, Math.min(100, item.pct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </KPICard>
  );
}

function buildConnectionSummary(rotas?: RotasData): ConnectionSummary {
  if (!rotas?.rotas.length || rotas.total_raw <= 0) return { items: [] };

  const used = new Set<string>();
  const items: ConnectionItem[] = [];

  for (const group of METRO_GROUPS) {
    const members = rotas.rotas.filter(route => group.airports.includes(route.dest));
    if (members.length < 2) continue;

    members.forEach(route => used.add(route.dest));
    const paxRaw = members.reduce((sum, route) => sum + route.pax_raw, 0);
    items.push({
      key: group.key,
      label: group.name,
      detail: `${members.length} aeroportos`,
      paxRaw,
      pct: (paxRaw / rotas.total_raw) * 100,
    });
  }

  for (const route of rotas.rotas) {
    if (used.has(route.dest)) continue;
    const { cidade, uf } = parseRouteLabel(route);
    items.push({
      key: route.dest,
      label: cidade || route.dest,
      detail: [route.dest, uf].filter(Boolean).join(" · "),
      paxRaw: route.pax_raw,
      pct: (route.pax_raw / rotas.total_raw) * 100,
    });
  }

  items.sort((a, b) => b.paxRaw - a.paxRaw);
  return { main: items[0], items };
}

function parseRouteLabel(route: Rota): { cidade: string; uf: string } {
  const [, location = ""] = route.label.split("·").map(part => part.trim());
  const [cidade = "", uf = ""] = location.split("/").map(part => part.trim());
  return { cidade: toTitleCase(cidade), uf };
}

function toTitleCase(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s|-)([A-Za-zÀ-ÖØ-öø-ÿ])/g, (_, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase("pt-BR"));
}

function fmtPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}
