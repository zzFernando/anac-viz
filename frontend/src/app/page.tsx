"use client";

import { useState, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import KPICard   from "@/components/ui/KPICard";
import SectionCard from "@/components/ui/SectionCard";
import SerieTemporalD3 from "@/components/charts/SerieTemporalD3";
import HeatmapD3  from "@/components/charts/HeatmapD3";
import ScatterD3  from "@/components/charts/ScatterD3";
import BarChartD3 from "@/components/charts/BarChartD3";
import ODMatrixD3 from "@/components/charts/ODMatrixD3";
import RouteMap   from "@/components/maps/RouteMap";
import {
  useFilters, useKPIs, useSerie, useMapa, useHeatmap,
  useScatter, useTopRotas, useNetwork, useRouteArcs, useODMatrix,
} from "@/lib/api";

const NetworkGraph3D = dynamic(
  () => import("@/components/graphs/NetworkGraph3D"),
  { ssr: false, loading: () => <div className="h-[520px] bg-[#0D1117] flex items-center justify-center text-slate-400 text-sm">Carregando…</div> }
);
const NetworkGraph2D = dynamic(
  () => import("@/components/graphs/NetworkGraph2D"),
  { ssr: false, loading: () => <div className="h-[520px] bg-slate-50 flex items-center justify-center text-slate-400 text-sm">Carregando…</div> }
);

type Tab = "mapa" | "3d" | "2d" | "od";
const TABS: { id: Tab; label: string }[] = [
  { id: "mapa", label: "Mapa de rotas" },
  { id: "3d",   label: "Grafo 3D" },
  { id: "2d",   label: "Grafo força 2D" },
  { id: "od",   label: "Matriz O-D" },
];

const GOLD       = "#C89600";
const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const SUCCESS    = "#16A34A";
const DANGER     = "#DC2626";

export default function Dashboard() {
  const [anoIni, setAnoIni]       = useState(2016);
  const [anoFim, setAnoFim]       = useState(2026);
  const [aeroporto, setAeroporto] = useState("SBPA");
  const [tab, setTab]             = useState<Tab>("mapa");
  const [downloading, startDownload] = useTransition();

  function handleDownloadAll() {
    startDownload(async () => {
      const { downloadAllCharts } = await import("@/lib/downloadUtils");
      await downloadAllCharts();
    });
  }

  const { data: filters } = useFilters();
  const anoMin = filters?.ano_min ?? 2000;
  const anoMax = filters?.ano_max ?? 2026;

  const { data: kpis }    = useKPIs(anoIni, anoFim, aeroporto);
  const { data: serie }   = useSerie(anoIni, anoFim, aeroporto);
  const { data: heatmap } = useHeatmap(anoIni, anoFim, aeroporto);
  const { data: scatter } = useScatter(anoIni, anoFim, aeroporto);
  const { data: rotas }   = useTopRotas(anoIni, anoFim, aeroporto);
  const { data: network } = useNetwork(anoIni, anoFim);
  const { data: arcData } = useRouteArcs(anoIni, anoFim, aeroporto);
  const { data: odData }  = useODMatrix(anoIni, anoFim, aeroporto);

  const onAirportClick = useCallback((icao: string) => setAeroporto(icao), []);

  return (
    <div className="min-h-screen bg-surface px-3 md:px-5 py-2 space-y-2">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="rounded-card px-5 py-3.5 shadow-lift"
        style={{ background: "linear-gradient(125deg, #001F50 0%, #003F7F 55%, #0066CC 100%)" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-white font-bold text-lg tracking-tight">
              <span style={{ color: GOLD }}>✈ </span>
              Panorama da Aviação Doméstica Brasileira
            </div>
            <div className="text-blue-200/60 text-xs mt-0.5">
              Análise exploratória · Dados Abertos ANAC · 2000–2026
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              title="Baixar todos os gráficos como PNG"
              className="flex items-center gap-1.5 text-xs font-semibold text-white/80
                         bg-white/10 hover:bg-white/20 border border-white/20
                         rounded-full px-3 py-1.5 transition-all disabled:opacity-50
                         disabled:cursor-wait"
            >
              {downloading ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8 11.31l-3.78-3.78a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1Zm-5.25 9.5a.75.75 0 0 1 .75.75v1.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1.5a.75.75 0 0 1 1.5 0v1.5A2 2 0 0 1 12 15H4a2 2 0 0 1-2-2v-1.5a.75.75 0 0 1 .75-.75Z"/>
                </svg>
              )}
              {downloading ? "Exportando…" : "Exportar tudo"}
            </button>
            <span className="text-[0.7rem] font-semibold text-white/90 bg-white/10 border border-white/20 rounded-full px-3 py-1 tracking-widest">
              ANAC
            </span>
            <span className="text-blue-200/50 text-xs">PPGC · UFRGS</span>
          </div>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-card shadow-card border border-gray-100 px-4 py-3">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Período de análise
            </label>
            <div className="flex items-center gap-3">
              <select
                value={anoIni}
                onChange={e => setAnoIni(Math.min(+e.target.value, anoFim - 1))}
                className="border border-gray-200 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:border-anac-light"
              >
                {Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-slate-400 text-sm">→</span>
              <select
                value={anoFim}
                onChange={e => setAnoFim(Math.max(+e.target.value, anoIni + 1))}
                className="border border-gray-200 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:border-anac-light"
              >
                {Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
              Aeroporto de referência
            </label>
            <select
              value={aeroporto}
              onChange={e => setAeroporto(e.target.value)}
              className="w-full border border-gray-200 rounded-md text-sm px-2 py-1.5 focus:outline-none focus:border-anac-light"
            >
              {filters?.aeroportos.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          {kpis && (
            <div className="text-right text-xs text-slate-400 self-end pb-0.5">
              <span className="font-semibold text-slate-600">{kpis.nome}</span>
              {" · "}{anoIni}–{anoFim}
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────── */}
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
          label="Empresa líder"
          value={kpis?.lider.value ?? "—"}
          sub={kpis?.lider.sub ?? ""}
          icon="🏢"
          accent={GOLD}
        />
        <KPICard
          label="Pontualidade (partidas)"
          value={kpis?.pontualidade.value ?? "—"}
          sub={kpis?.pontualidade.sub ?? ""}
          icon="🕐"
          accent={ANAC_LIGHT}
        />
      </div>

      {/* ── Série temporal ───────────────────────────────────────── */}
      <SectionCard title="Passageiros mensais — Nacional vs. aeroporto selecionado" chartId="chart-serie">
        {serie
          ? <SerieTemporalD3 data={serie} />
          : <div className="h-[260px] bg-gray-50 rounded animate-pulse" />}
      </SectionCard>

      {/* ── Mapa de bolhas + Heatmap ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard title="Aeroportos — volume de passageiros" chartId="chart-routemap">
          {arcData
            ? <RouteMap
                data={{ arcs: [], airports: (arcData.airports ?? []).map(a => ({ ...a, is_ref: a.icao === aeroporto })), aeroporto }}
                onAirportClick={onAirportClick}
              />
            : <div className="h-[390px] bg-gray-50 rounded animate-pulse" />}
        </SectionCard>
        <SectionCard title={`Atrasos no aeroporto — % voos >30 min por mês/ano`} chartId="chart-heatmap">
          {heatmap && heatmap.data.length
            ? <HeatmapD3 data={heatmap} />
            : <div className="h-[390px] bg-gray-50 rounded animate-pulse" />}
        </SectionCard>
      </div>

      {/* ── Scatter + Top rotas ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard title="Market share × Pontualidade — empresas no aeroporto" chartId="chart-scatter">
          {scatter && scatter.points.length
            ? <ScatterD3 data={scatter} />
            : <div className="h-[300px] bg-gray-50 rounded animate-pulse" />}
        </SectionCard>
        <SectionCard title="Top 5 rotas a partir do aeroporto selecionado" chartId="chart-bar">
          {rotas && rotas.rotas.length
            ? <BarChartD3 data={rotas} />
            : <div className="h-[280px] bg-gray-50 rounded animate-pulse" />}
        </SectionCard>
      </div>

      {/* ── Rede de rotas (tabs) ─────────────────────────────────── */}
      <div className="bg-white rounded-card shadow-card border border-gray-100 overflow-hidden">
        <div className="px-3 pt-3 pb-0 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="section-title !mb-0">Rede de rotas — malha da aviação doméstica</div>
            <button
              onClick={async () => {
                const activeChartId =
                  tab === "mapa" ? "chart-routemap" :
                  tab === "3d"   ? "chart-3d" :
                  tab === "2d"   ? "chart-2d" :
                  "chart-od";
                const { downloadChart } = await import("@/lib/downloadUtils");
                await downloadChart(activeChartId as import("@/lib/downloadUtils").ChartId);
              }}
              title="Baixar aba atual como PNG"
              className="flex items-center gap-1 text-[0.65rem] font-semibold text-slate-400
                         hover:text-anac-blue transition-colors px-1.5 py-0.5 rounded
                         hover:bg-slate-50 border border-transparent hover:border-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8 11.31l-3.78-3.78a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1Zm-5.25 9.5a.75.75 0 0 1 .75.75v1.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1.5a.75.75 0 0 1 1.5 0v1.5A2 2 0 0 1 12 15H4a2 2 0 0 1-2-2v-1.5a.75.75 0 0 1 .75-.75Z"/>
              </svg>
              PNG
            </button>
          </div>
          <div className="tab-nav flex gap-1 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.id}
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {tab === "mapa" && (
            arcData
              ? <RouteMap data={arcData} onAirportClick={onAirportClick} />
              : <div className="h-[500px] bg-gray-50 animate-pulse" />
          )}
          {tab === "3d" && (
            network
              ? <NetworkGraph3D data={network} focusAirport={aeroporto} onNodeClick={onAirportClick} />
              : <div className="h-[520px] bg-[#0D1117] animate-pulse" />
          )}
          {tab === "2d" && (
            network
              ? <NetworkGraph2D data={network} focusAirport={aeroporto} onNodeClick={onAirportClick} />
              : <div className="h-[520px] bg-slate-50 animate-pulse" />
          )}
          {tab === "od" && (
            odData && odData.airports.length
              ? <div className="p-3 overflow-x-auto"><ODMatrixD3 data={odData} /></div>
              : <div className="h-[520px] bg-gray-50 animate-pulse" />
          )}
        </div>
      </div>

      {/* ── Rodapé ───────────────────────────────────────────────── */}
      <footer className="text-center text-[0.68rem] text-slate-400 border-t border-gray-200 pt-2 pb-3">
        Dados: ANAC — Agência Nacional de Aviação Civil · Aviação doméstica regular · Dados públicos abertos
      </footer>

    </div>
  );
}
