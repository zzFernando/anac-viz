"use client";

import { useState, useCallback, useTransition } from "react";
import dynamic from "next/dynamic";
import DashboardHeader from "@/components/ui/DashboardHeader";
import FiltersBar     from "@/components/ui/FiltersBar";
import ThemeBand      from "@/components/ui/ThemeBand";
import KPIRow         from "@/components/ui/KPIRow";
import MiniKPI        from "@/components/ui/MiniKPI";
import SectionCard    from "@/components/ui/SectionCard";
import Loader         from "@/components/ui/Loader";
import SerieTemporalD3 from "@/components/charts/SerieTemporalD3";
import HeatmapD3       from "@/components/charts/HeatmapD3";
import ScatterD3       from "@/components/charts/ScatterD3";
import BarChartD3      from "@/components/charts/BarChartD3";
import TreemapD3       from "@/components/charts/TreemapD3";
import DonutD3         from "@/components/charts/DonutD3";
import FrotaFabricantes from "@/components/charts/FrotaFabricantes";
import FrotaFabricantesScatter from "@/components/charts/FrotaFabricantesScatter";
import FrotaModelos         from "@/components/charts/FrotaModelos";
import FrotaModelosLollipop from "@/components/charts/FrotaModelosLollipop";
import FrotaEmpresas         from "@/components/charts/FrotaEmpresas";
import FrotaEmpresasParallel from "@/components/charts/FrotaEmpresasParallel";
import AtaChart              from "@/components/charts/AtaChart";
import AtaLollipop           from "@/components/charts/AtaLollipop";
import AtaDotPlot            from "@/components/charts/AtaDotPlot";
import AtaPareto             from "@/components/charts/AtaPareto";
import AtaWaffle             from "@/components/charts/AtaWaffle";
import AtaHBar               from "@/components/charts/AtaHBar";
import AdsWaffle             from "@/components/charts/AdsWaffle";
import OcorrenciasFase        from "@/components/charts/OcorrenciasFase";
import OcorrenciasFaseRadial  from "@/components/charts/OcorrenciasFaseRadial";
import OcorrenciasFaseWaffle  from "@/components/charts/OcorrenciasFaseWaffle";
import MethodologyNote from "@/components/ui/MethodologyNote";
import type { Mode as MapMode } from "@/components/maps/HeroMap";
import type { SerieMode } from "@/components/charts/SerieTemporalD3";
import {
  useFilters, useKPIs, useSerie, useHeatmap, useScatter,
  useTopRotas, useRouteArcs, useFrota,
  useSdr, useAds, useOcorrencias,
} from "@/lib/api";

// MapLibre + deck.gl tocam o objeto window — desabilitar SSR
const HeroMap = dynamic(() => import("@/components/maps/HeroMap"), {
  ssr: false,
  loading: () => <Loader height={520} variant="dark" rounded={false} label="Carregando mapa…" />,
});
const OcorrenciasMap = dynamic(() => import("@/components/maps/OcorrenciasMap"), {
  ssr: false,
  loading: () => <Loader height={460} variant="dark" rounded={false} label="Carregando mapa de ocorrências…" />,
});

const MAP_TABS: { id: MapMode; label: string }[] = [
  { id: "volume", label: "Passageiros" },
  { id: "calor",  label: "Concentração" },
  { id: "rotas",  label: "Rotas"  },
];

const SERIE_TABS: { id: SerieMode; label: string; hint: string }[] = [
  { id: "indexed",  label: "Comparação",  hint: "Mostra a evolução em base 100 para comparar tendências" },
  { id: "absolute", label: "Valores",     hint: "Mostra a quantidade de passageiros" },
  { id: "share",    label: "% do Brasil", hint: "Mostra a fatia do aeroporto no total nacional" },
];

export default function Dashboard() {
  const [anoIni, setAnoIni]       = useState(2016);
  const [anoFim, setAnoFim]       = useState(2026);
  const [aeroporto, setAeroporto] = useState("SBPA");
  const [mapMode, setMapMode]     = useState<MapMode>("volume");
  const [serieMode, setSerieMode] = useState<SerieMode>("indexed");
  const [groupMetros, setGroupMetros] = useState<boolean>(true);
  const [rotasView,       setRotasView]       = useState<"bar" | "treemap" | "donut">("donut");
  const [fabricantesView, setFabricantesView] = useState<"bar" | "scatter">("scatter");
  const [modelosView,      setModelosView]      = useState<"bar" | "lollipop">("lollipop");
  const [empresasView,     setEmpresasView]     = useState<"bar" | "parallel">("parallel");
  const [faseView,         setFaseView]         = useState<"bar" | "radial" | "waffle">("radial");
  const [ataView,          setAtaView]          = useState<"bar" | "lollipop" | "dot" | "pareto" | "waffle" | "hbar">("hbar");
  const [downloading, startDownload] = useTransition();

  const { data: filters } = useFilters();
  const { data: kpis }    = useKPIs(anoIni, anoFim, aeroporto);
  const { data: serie }   = useSerie(anoIni, anoFim, aeroporto);
  const { data: heatmap } = useHeatmap(anoIni, anoFim, aeroporto);
  const { data: scatter } = useScatter(anoIni, anoFim, aeroporto);
  const { data: rotas }   = useTopRotas(anoIni, anoFim, aeroporto);
  const { data: arcData } = useRouteArcs(anoIni, anoFim, aeroporto);
  const { data: frota }   = useFrota();
  const { data: sdr }     = useSdr();
  const { data: ads }     = useAds();
  const { data: ocorr }   = useOcorrencias(anoIni, anoFim);

  const onAirportClick = useCallback((icao: string) => setAeroporto(icao), []);

  function handleDownloadAll() {
    startDownload(async () => {
      const { downloadAllCharts } = await import("@/lib/downloadUtils");
      await downloadAllCharts();
    });
  }

  const frotaT = frota?.transporte;

  return (
    <div className="min-h-screen bg-surface px-3 md:px-5 py-2 space-y-2">
      <DashboardHeader downloading={downloading} onExportAll={handleDownloadAll} />

      <FiltersBar
        filters={filters}
        anoIni={anoIni} anoFim={anoFim} aeroporto={aeroporto}
        setAnoIni={setAnoIni} setAnoFim={setAnoFim} setAeroporto={setAeroporto}
        nomeAeroporto={kpis?.nome}
      />

      {/* ── Hero: mapa + KPIs do aeroporto selecionado ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2">
        <SectionCard
          title="Mapa da aviação doméstica"
          chartId="chart-hero"
          actions={
            <div className="flex items-center bg-slate-100 rounded-md p-0.5 gap-0.5">
              {MAP_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setMapMode(t.id)}
                  className={`px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider rounded transition-colors
                    ${mapMode === t.id
                      ? "bg-anac-blue text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          {arcData
            ? <HeroMap data={arcData} aeroporto={aeroporto} onAirportClick={onAirportClick} height={520} mode={mapMode} />
            : <Loader height={520} label="Carregando mapa…" />}
        </SectionCard>
        <KPIRow kpis={kpis} serie={serie} scatter={scatter} rotas={rotas} aeroporto={aeroporto} layout="column" />
      </div>

      {/* ── DEMANDA E SAZONALIDADE ──────────────────────────────────── */}
      <ThemeBand label="Movimento de passageiros" hint="evolução mensal e principais destinos" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <SectionCard
          title="Passageiros por mês — Brasil e aeroporto escolhido"
          chartId="chart-serie"
          className="md:col-span-2"
          actions={
            <div className="flex items-center bg-slate-100 rounded-md p-0.5 gap-0.5">
              {SERIE_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSerieMode(t.id)}
                  title={t.hint}
                  className={`px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider rounded transition-colors
                    ${serieMode === t.id
                      ? "bg-anac-blue text-white shadow-sm"
                      : "text-slate-600 hover:bg-white"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        >
          {serie
            ? <SerieTemporalD3 data={serie} mode={serieMode} aeroporto={aeroporto} />
            : <Loader height={260} label="Carregando série temporal…" />}
        </SectionCard>
        <SectionCard
          title="Principais destinos saindo do aeroporto"
          chartId={rotasView === "bar" ? "chart-bar" : rotasView === "treemap" ? "chart-treemap" : "chart-donut"}
          actions={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={groupMetros}
                  onChange={e => setGroupMetros(e.target.checked)}
                  className="w-3 h-3 accent-anac-blue"
                />
                Agrupar regiões metropolitanas
              </label>
              <div className="flex rounded overflow-hidden border border-slate-200">
                <button
                  onClick={() => setRotasView("bar")}
                  title="Barras"
                  className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${rotasView === "bar" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  ▬ Barras
                </button>
                <button
                  onClick={() => setRotasView("treemap")}
                  title="Treemap"
                  className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${rotasView === "treemap" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  ▦ Treemap
                </button>
                <button
                  onClick={() => setRotasView("donut")}
                  title="Donut"
                  className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${rotasView === "donut" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                >
                  ◎ Donut
                </button>
              </div>
            </div>
          }
        >
          {rotas && rotas.rotas.length
            ? rotasView === "bar"
              ? <BarChartD3 data={rotas} groupMetros={groupMetros} />
              : rotasView === "treemap"
              ? <TreemapD3  data={rotas} groupMetros={groupMetros} />
              : <DonutD3    data={rotas} groupMetros={groupMetros} />
            : <Loader height={280} label="Carregando rotas…" />}
        </SectionCard>
      </div>

      {/* ── QUALIDADE OPERACIONAL ───────────────────────────────────── */}
      <ThemeBand label="Pontualidade e empresas" hint="atrasos, participação das companhias e operação local" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard title="Atrasos por mês — voos com mais de 30 min" chartId="chart-heatmap">
          {heatmap && heatmap.data.length
            ? <HeatmapD3 data={heatmap} aeroporto={aeroporto} />
            : <Loader height={390} label="Carregando atrasos…" />}
        </SectionCard>
        <SectionCard
          title="Participação das empresas e pontualidade"
          chartId="chart-scatter"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Pontualidade de cada companhia no aeroporto escolhido e no período filtrado. Pode ser diferente da pontualidade nacional da empresa.">ⓘ</span>
          }
        >
          {scatter && scatter.points.length
            ? <ScatterD3 data={scatter} />
            : <Loader height={300} label="Carregando empresas…" />}
        </SectionCard>
      </div>

      {/* ── FROTA BRASILEIRA ────────────────────────────────────────── */}
      <ThemeBand label="Frota brasileira" hint="aeronaves comerciais ativas registradas na ANAC" />

      {/* Mini KPIs de frota (4 cards horizontais) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKPI
          label="Aeronaves de transporte"
          value={frotaT ? frotaT.total.toLocaleString("pt-BR") : "—"}
          sub="ativas no registro da ANAC"
          accent="#003F7F"
        />
        <MiniKPI
          label="Idade média da frota"
          value={frotaT?.idade_media != null ? `${frotaT.idade_media.toLocaleString("pt-BR")} anos` : "—"}
          sub={frotaT?.idade_p90 != null ? `90% têm até ${frotaT.idade_p90.toLocaleString("pt-BR")} anos` : ""}
          accent="#0066CC"
        />
        <MiniKPI
          label="Aeronaves a jato"
          value={frotaT ? `${frotaT.pct_jato.toLocaleString("pt-BR")}%` : "—"}
          sub={frotaT ? `da frota de transporte (${frotaT.total.toLocaleString("pt-BR")} aeronaves)` : ""}
          accent="#C89600"
        />
        <MiniKPI
          label="Certificado em dia"
          value={frotaT?.ca ? `${frotaT.ca.pct_vigente.toFixed(0)}%` : "—"}
          sub={frotaT?.ca
            ? `${frotaT.ca.vigente.toLocaleString("pt-BR")} de ${frotaT.total.toLocaleString("pt-BR")} com certificado regular`
            : ""}
          accent={
            !frotaT?.ca ? "#7C3AED"
              : frotaT.ca.pct_vigente >= 80 ? "#16A34A"
              : frotaT.ca.pct_vigente >= 50 ? "#F59E0B"
              : "#DC2626"
          }
        />
      </div>

      {/* Row 1: Fabricantes + Modelos nacionais (lado a lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard
          title="Fabricantes mais comuns — transporte"
          chartId="chart-frota-fabricantes"
          actions={
            <div className="flex rounded overflow-hidden border border-slate-200">
              <button
                onClick={() => setFabricantesView("bar")}
                className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${fabricantesView === "bar" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >▬ Barras</button>
              <button
                onClick={() => setFabricantesView("scatter")}
                className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${fabricantesView === "scatter" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >◉ Scatter</button>
            </div>
          }
        >
          {frotaT
            ? fabricantesView === "bar"
              ? <FrotaFabricantes data={frotaT.top_fabricantes} />
              : <FrotaFabricantesScatter data={frotaT.top_fabricantes} />
            : <Loader height={240} label="Carregando fabricantes…" />}
        </SectionCard>
        <SectionCard
          title="Modelos mais comuns — transporte"
          chartId="chart-frota-modelos"
          actions={
            <div className="flex rounded overflow-hidden border border-slate-200">
              <button
                onClick={() => setModelosView("bar")}
                className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${modelosView === "bar" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >▬ Barras</button>
              <button
                onClick={() => setModelosView("lollipop")}
                className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${modelosView === "lollipop" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >⦾ Lollipop</button>
            </div>
          }
        >
          {frotaT
            ? modelosView === "bar"
              ? <FrotaModelos         data={frotaT.top_modelos} />
              : <FrotaModelosLollipop data={frotaT.top_modelos} />
            : <Loader height={240} label="Carregando modelos…" />}
        </SectionCard>
      </div>

      {/* Row 2: FrotaEmpresas em largura cheia (acomoda a nova coluna Modelo) */}
      <SectionCard
        title="Frota das empresas que operam no aeroporto"
        chartId="chart-frota-empresas"
        actions={
          <div className="flex rounded overflow-hidden border border-slate-200">
            <button
              onClick={() => setEmpresasView("bar")}
              className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${empresasView === "bar" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >▬ Barras</button>
            <button
              onClick={() => setEmpresasView("parallel")}
              className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider transition-colors ${empresasView === "parallel" ? "bg-anac-blue text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >⫴ Paralelas</button>
          </div>
        }
      >
        {scatter
          ? empresasView === "bar"
            ? <FrotaEmpresas         points={scatter.points} />
            : <FrotaEmpresasParallel points={scatter.points} />
          : <Loader height={240} label="Carregando frota por empresa…" />}
      </SectionCard>

      {/* ── SEGURANÇA & MANUTENÇÃO ──────────────────────────────── */}
      <ThemeBand label="Segurança e manutenção" hint="falhas reportadas, regras obrigatórias e ocorrências investigadas" />

      {/* Mini KPIs nacionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKPI
          label="Falhas reportadas"
          value={sdr ? sdr.total.toLocaleString("pt-BR") : "—"}
          sub={sdr ? `${sdr.ultimos_5_anos.toLocaleString("pt-BR")} nos últimos 5 anos` : ""}
          accent="#0066CC"
        />
        <MiniKPI
          label="Acidentes investigados"
          value={ocorr ? ocorr.resumo.acidentes.toLocaleString("pt-BR") : "—"}
          sub={ocorr ? `${ocorr.resumo.lesoes_fatais.toLocaleString("pt-BR")} fatalidades registradas` : ""}
          accent="#DC2626"
        />
        <MiniKPI
          label="Incidentes graves"
          value={ocorr ? ocorr.resumo.incidentes_graves.toLocaleString("pt-BR") : "—"}
          sub={ocorr
            ? (ocorr.resumo.incidentes > 0
                ? `+ ${ocorr.resumo.incidentes.toLocaleString("pt-BR")} incidentes investigados`
                : "investigados pelo CENIPA")
            : ""}
          accent="#EA580C"
        />
        <MiniKPI
          label="Regras obrigatórias vigentes"
          value={ads ? ads.vigentes.toLocaleString("pt-BR") : "—"}
          sub={ads ? `${(ads.total - ads.vigentes).toLocaleString("pt-BR")} já substituídas ou revogadas` : ""}
          accent="#C89600"
        />
      </div>

      {/* SDR ATA + Ocorrências fase (lado a lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard
          title="Falhas reportadas por componente"
          chartId="chart-ata"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-slate-400 cursor-help"
                    title="Relatos de dificuldade em serviço agrupados por sistema da aeronave. Ajuda a ver quais partes concentram mais problemas técnicos.">ⓘ</span>
              <div className="flex rounded overflow-hidden border border-slate-200">
                {(["hbar", "bar", "lollipop", "pareto", "waffle"] as const).map(v => (
                  <button key={v} onClick={() => setAtaView(v)}
                    className={`px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${ataView === v ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}>
                    {v === "hbar" ? "H. Barras" : v === "bar" ? "Barras" : v === "lollipop" ? "Lollipop" : v === "pareto" ? "Pareto" : "Waffle"}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {sdr
            ? ataView === "hbar" ? <AtaHBar data={sdr} />
              : ataView === "bar" ? <AtaChart data={sdr} />
              : ataView === "lollipop" ? <AtaLollipop data={sdr} />
              : ataView === "pareto" ? <AtaPareto data={sdr} />
              : <AtaWaffle data={sdr} />
            : <Loader height={260} label="Carregando falhas…" />}
        </SectionCard>

        <SectionCard
          title="Ocorrências por fase do voo"
          chartId="chart-ocorr-fase"
          actions={
            <div className="flex items-center gap-2">
              <span className="text-[0.55rem] text-slate-400 cursor-help"
                    title="Distribuição dos acidentes e incidentes pela etapa do voo em que aconteceram.">ⓘ</span>
              <div className="flex rounded overflow-hidden border border-slate-200">
                {(["bar", "radial", "waffle"] as const).map(v => (
                  <button key={v} onClick={() => setFaseView(v)}
                    className={`px-2 py-0.5 text-[0.6rem] font-medium transition-colors ${faseView === v ? "bg-slate-700 text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}>
                    {v === "bar" ? "Barras" : v === "radial" ? "Radial" : "Waffle"}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {ocorr
            ? faseView === "bar" ? <OcorrenciasFase data={ocorr.resumo} />
              : faseView === "radial" ? <OcorrenciasFaseRadial data={ocorr.resumo} />
              : <OcorrenciasFaseWaffle data={ocorr.resumo} />
            : <Loader height={260} label="Carregando ocorrências…" />}
        </SectionCard>
      </div>

      {/* ADs por sistema + Mapa de ocorrências */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard
          title="Regras técnicas da ANAC por tema"
          chartId="chart-ads"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Conta Diretrizes de Aeronavegabilidade vigentes: regras da ANAC que obrigam inspeção, correção ou substituição em aeronaves, motores ou componentes. Não são acidentes nem falhas ocorridas.">ⓘ</span>
          }
        >
          {ads
            ? <AdsWaffle data={ads} />
            : <Loader height={260} label="Carregando regras…" />}
        </SectionCard>

        <SectionCard
          title={`Mapa de ocorrências investigadas · ${anoIni}–${anoFim}`}
          chartId="chart-ocorrmap"
        >
          {ocorr
            ? <OcorrenciasMap eventos={ocorr.eventos} height={420} />
            : <Loader height={420} variant="dark" rounded={false} label="Carregando mapa…" />}
        </SectionCard>
      </div>

      <MethodologyNote />

      <footer className="text-center text-[0.68rem] text-slate-400 border-t border-gray-200 pt-2 pb-3">
        Dados: ANAC — Agência Nacional de Aviação Civil · voos domésticos regulares · registros públicos
      </footer>
    </div>
  );
}
