import KPICard from "./KPICard";
import Sparkline, { type SparkPoint } from "@/components/charts/Sparkline";
import ShareBar  from "@/components/charts/ShareBar";
import type { KPIsData, SerieData, ScatterData } from "@/lib/types";
import { eventsForAirport } from "@/lib/events";

const GOLD       = "#C89600";
const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const SUCCESS    = "#16A34A";
const DANGER     = "#DC2626";

interface Props {
  kpis:       KPIsData | undefined;
  serie?:     SerieData | undefined;
  scatter?:   ScatterData | undefined;
  aeroporto?: string;
  layout?:    "grid" | "column";
}

export default function KPIRow({ kpis, serie, scatter, aeroporto, layout = "grid" }: Props) {
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

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPICard
          label={kpis ? `Passageiros em ${kpis.nome}` : "Passageiros"}
          value={kpis?.pax.value ?? "—"}
          sub={kpis?.pax.sub ?? ""}
          icon="✈"
          accent={ANAC_BLUE}
        />
        <KPICard
          label="Variação (YTD)"
          value={kpis?.variacao.value ?? "—"}
          sub={kpis?.variacao.sub ?? ""}
          icon="📈"
          accent={kpis?.variacao.positive ? SUCCESS : DANGER}
        />
        <KPICard
          label="Empresa líder no período"
          value={kpis?.lider.value ?? "—"}
          sub={kpis?.lider.sub ?? ""}
          tooltip="Empresa com mais passageiros pagos no aeroporto durante o período filtrado. Muda conforme você ajusta os anos."
          icon="🏢"
          accent={GOLD}
        />
        <KPICard
          label="Pontualidade no aeroporto"
          value={kpis?.pontualidade.value ?? "—"}
          sub={kpis?.pontualidade.sub ?? ""}
          tooltip="Pontualidade média de partidas de TODAS as companhias operando no aeroporto, no período filtrado. Base: % de voos com atraso ≤ 30 min entre partida programada e real."
          icon="🕐"
          accent={ANAC_LIGHT}
        />
      </div>
    );
  }

  // layout "column" — KPI herói no topo + 3 secundários
  return (
    <div className="flex flex-col gap-2">
      {/* HERO */}
      <KPICard
        size="hero"
        label={kpis ? `Passageiros em ${kpis.nome}` : "Passageiros"}
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
                  · marcadores: {sparkEvents.map(e => e.label).join(", ")}
                </span>
              )}
            </div>
          </div>
        )}
      </KPICard>

      {/* Variação YTD */}
      <KPICard
        label="Variação (YTD)"
        value={kpis?.variacao.value ?? "—"}
        sub={kpis?.variacao.sub ?? ""}
        icon="📈"
        accent={kpis?.variacao.positive ? SUCCESS : DANGER}
      />

      {/* Empresa líder no período + mini stacked bar */}
      <KPICard
        label="Empresa líder no período"
        value={kpis?.lider.value ?? "—"}
        sub={kpis?.lider.sub ?? ""}
        tooltip="Empresa com mais passageiros pagos no aeroporto durante o período filtrado. Muda conforme você ajusta os anos."
        icon="🏢"
        accent={GOLD}
      >
        <ShareBar points={scatter?.points} />
      </KPICard>

      {/* Pontualidade */}
      <KPICard
        label="Pontualidade no aeroporto"
        value={kpis?.pontualidade.value ?? "—"}
        sub={kpis?.pontualidade.sub ?? ""}
        tooltip="Pontualidade média de partidas de TODAS as companhias operando no aeroporto, no período filtrado. Base: % de voos com atraso ≤ 30 min entre partida programada e real."
        icon="🕐"
        accent={ANAC_LIGHT}
      />
    </div>
  );
}
