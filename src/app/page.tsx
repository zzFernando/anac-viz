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
import FrotaFabricantes from "@/components/charts/FrotaFabricantes";
import FrotaModelos     from "@/components/charts/FrotaModelos";
import FrotaEmpresas    from "@/components/charts/FrotaEmpresas";
import AtaChart         from "@/components/charts/AtaChart";
import AdsPorSistema    from "@/components/charts/AdsPorSistema";
import OcorrenciasFase  from "@/components/charts/OcorrenciasFase";
import KeyFindings     from "@/components/ui/KeyFindings";
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
  { id: "volume", label: "Volume" },
  { id: "calor",  label: "Calor"  },
  { id: "rotas",  label: "Rotas"  },
];

const SERIE_TABS: { id: SerieMode; label: string; hint: string }[] = [
  { id: "indexed",  label: "Índice 100",  hint: "Trajetória normalizada para comparação" },
  { id: "absolute", label: "Absoluto",    hint: "Valores brutos com eixos independentes" },
  { id: "share",    label: "% Nacional",  hint: "Participação do aeroporto no mercado nacional" },
];

export default function Dashboard() {
  const [anoIni, setAnoIni]       = useState(2016);
  const [anoFim, setAnoFim]       = useState(2026);
  const [aeroporto, setAeroporto] = useState("SBPA");
  const [mapMode, setMapMode]     = useState<MapMode>("volume");
  const [serieMode, setSerieMode] = useState<SerieMode>("indexed");
  const [groupMetros, setGroupMetros] = useState<boolean>(true);
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
          title="Aviação doméstica — rotas e volume de passageiros"
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
        <KPIRow kpis={kpis} serie={serie} scatter={scatter} aeroporto={aeroporto} layout="column" />
      </div>

      {/* ── Principais achados (dinâmicos) ───────────────────────────── */}
      <KeyFindings
        kpis={kpis} serie={serie} scatter={scatter}
        rotas={rotas} heatmap={heatmap} frota={frota}
        sdr={sdr} ocorr={ocorr}
        aeroporto={aeroporto} anoIni={anoIni} anoFim={anoFim}
      />

      {/* ── DEMANDA E SAZONALIDADE ──────────────────────────────────── */}
      <ThemeBand label="Demanda e sazonalidade" hint="volume mensal e principais rotas do aeroporto" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <SectionCard
          title="Passageiros mensais — Brasil vs. aeroporto selecionado"
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
          title="Top 5 rotas a partir do aeroporto"
          chartId="chart-bar"
          actions={
            <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={groupMetros}
                onChange={e => setGroupMetros(e.target.checked)}
                className="w-3 h-3 accent-anac-blue"
              />
              Agrupar metrópoles
            </label>
          }
        >
          {rotas && rotas.rotas.length
            ? <BarChartD3 data={rotas} groupMetros={groupMetros} />
            : <Loader height={280} label="Carregando top rotas…" />}
        </SectionCard>
      </div>

      {/* ── QUALIDADE OPERACIONAL ───────────────────────────────────── */}
      <ThemeBand label="Qualidade operacional" hint="atrasos por mês × ano · empresas no aeroporto" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard title="Atrasos no aeroporto — % voos >30 min por mês/ano" chartId="chart-heatmap">
          {heatmap && heatmap.data.length
            ? <HeatmapD3 data={heatmap} aeroporto={aeroporto} />
            : <Loader height={390} label="Carregando heatmap…" />}
        </SectionCard>
        <SectionCard
          title="Market share × pontualidade — por companhia neste aeroporto"
          chartId="chart-scatter"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Pontualidade da companhia ESPECIFICAMENTE neste aeroporto, no período filtrado. Pode diferir da pontualidade nacional da companhia.">ⓘ</span>
          }
        >
          {scatter && scatter.points.length
            ? <ScatterD3 data={scatter} />
            : <Loader height={300} label="Carregando market share…" />}
        </SectionCard>
      </div>

      {/* ── FROTA BRASILEIRA ────────────────────────────────────────── */}
      <ThemeBand label="Frota brasileira" hint="aeronaves de transporte ativas (RAB ANAC)" />

      {/* Mini KPIs de frota (4 cards horizontais) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKPI
          label="Frota de transporte"
          value={frotaT ? frotaT.total.toLocaleString("pt-BR") : "—"}
          sub="aeronaves ativas (RAB)"
          accent="#003F7F"
        />
        <MiniKPI
          label="Idade média"
          value={frotaT?.idade_media != null ? `${frotaT.idade_media} anos` : "—"}
          sub={frotaT?.idade_p90 != null ? `90% têm até ${frotaT.idade_p90} anos` : ""}
          accent="#0066CC"
        />
        <MiniKPI
          label="Jato / turbofan"
          value={frotaT ? `${frotaT.pct_jato}%` : "—"}
          sub={frotaT ? `da frota de transporte (${frotaT.total.toLocaleString("pt-BR")} aeronaves)` : ""}
          accent="#C89600"
        />
        <MiniKPI
          label="CA vigente (nacional)"
          value={frotaT?.ca ? `${frotaT.ca.pct_vigente.toFixed(0)}%` : "—"}
          sub={frotaT?.ca
            ? `${frotaT.ca.vigente} de ${frotaT.total} com aeronavegabilidade em dia`
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
        <SectionCard title="Top fabricantes — frota de transporte" chartId="chart-frota-fabricantes">
          {frotaT
            ? <FrotaFabricantes data={frotaT.top_fabricantes} />
            : <Loader height={240} label="Carregando fabricantes…" />}
        </SectionCard>
        <SectionCard
          title="Top modelos — frota de transporte"
          chartId="chart-frota-modelos"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Aeronaves categoria TRANSPORTE / TRANSPORTE A/B / TRANSP.REGIONAL — inclui executivos (Phenom, King Air) e helicópteros (AW139). Cor da barra: azul = mais novo · cinza = mais antigo.">ⓘ</span>
          }
        >
          {frotaT
            ? <FrotaModelos data={frotaT.top_modelos} />
            : <Loader height={240} label="Carregando modelos…" />}
        </SectionCard>
      </div>

      {/* Row 2: FrotaEmpresas em largura cheia (acomoda a nova coluna Modelo) */}
      <SectionCard
        title="Idade da frota das empresas operando no aeroporto"
        chartId="chart-frota-empresas"
        actions={
          <span className="text-[0.55rem] text-slate-400 cursor-help"
                title="Idade média, tamanho da frota (Brasil) e modelo dominante de cada companhia. A pontualidade é a operação ESPECIFICAMENTE neste aeroporto, no período filtrado.">ⓘ</span>
        }
      >
        {scatter
          ? <FrotaEmpresas points={scatter.points} />
          : <Loader height={240} label="Carregando frota por empresa…" />}
      </SectionCard>

      {/* ── SEGURANÇA & MANUTENÇÃO ──────────────────────────────── */}
      <ThemeBand label="Segurança e manutenção" hint="SDR · diretrizes de aeronavegabilidade · ocorrências CENIPA" />

      {/* Mini KPIs nacionais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniKPI
          label="SDRs registrados (10y+)"
          value={sdr ? sdr.total.toLocaleString("pt-BR") : "—"}
          sub={sdr ? `${sdr.ultimos_5_anos.toLocaleString("pt-BR")} nos últimos 5 anos` : ""}
          accent="#0066CC"
        />
        <MiniKPI
          label="Acidentes (CENIPA)"
          value={ocorr ? ocorr.resumo.acidentes.toLocaleString("pt-BR") : "—"}
          sub={ocorr ? `${ocorr.resumo.lesoes_fatais} lesões fatais no histórico` : ""}
          accent="#DC2626"
        />
        <MiniKPI
          label="Incidentes graves"
          value={ocorr ? ocorr.resumo.incidentes_graves.toLocaleString("pt-BR") : "—"}
          sub={ocorr
            ? (ocorr.resumo.incidentes > 0
                ? `+ ${ocorr.resumo.incidentes.toLocaleString("pt-BR")} incidentes regulares`
                : "investigados pelo CENIPA")
            : ""}
          accent="#EA580C"
        />
        <MiniKPI
          label="Diretrizes vigentes"
          value={ads ? ads.vigentes.toLocaleString("pt-BR") : "—"}
          sub={ads ? `${(ads.total - ads.vigentes).toLocaleString("pt-BR")} substituídas ou revogadas` : ""}
          accent="#C89600"
        />
      </div>

      {/* SDR ATA + Ocorrências fase (lado a lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard
          title="Componentes mais reportados — SDR"
          chartId="chart-ata"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Service Difficulty Reports agrupados por capítulo ATA (sistema da aeronave). Indica quais sistemas mais geram problemas técnicos no Brasil.">ⓘ</span>
          }
        >
          {sdr
            ? <AtaChart data={sdr} />
            : <Loader height={260} label="Carregando SDRs…" />}
        </SectionCard>

        <SectionCard
          title="Ocorrências por fase da operação"
          chartId="chart-ocorr-fase"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="Distribuição das ocorrências (acidentes + incidentes) pela fase da operação onde aconteceram.">ⓘ</span>
          }
        >
          {ocorr
            ? <OcorrenciasFase data={ocorr.resumo} />
            : <Loader height={260} label="Carregando ocorrências…" />}
        </SectionCard>
      </div>

      {/* ADs por sistema + Mapa de ocorrências */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <SectionCard
          title="Diretrizes de Aeronavegabilidade — top sistemas"
          chartId="chart-ads"
          actions={
            <span className="text-[0.55rem] text-slate-400 cursor-help"
                  title="ADs (ordens regulatórias obrigatórias) vigentes, por sistema afetado. Cada AD obriga inspeção ou reparo num modelo de aeronave.">ⓘ</span>
          }
        >
          {ads
            ? <AdsPorSistema data={ads} />
            : <Loader height={260} label="Carregando ADs…" />}
        </SectionCard>

        <SectionCard
          title={`Mapa de ocorrências CENIPA · ${anoIni}–${anoFim}`}
          chartId="chart-ocorrmap"
        >
          {ocorr
            ? <OcorrenciasMap eventos={ocorr.eventos} height={420} />
            : <Loader height={420} variant="dark" rounded={false} label="Carregando mapa…" />}
        </SectionCard>
      </div>

      <MethodologyNote />

      <footer className="text-center text-[0.68rem] text-slate-400 border-t border-gray-200 pt-2 pb-3">
        Dados: ANAC — Agência Nacional de Aviação Civil · Aviação doméstica regular · RAB · Dados públicos abertos
      </footer>
    </div>
  );
}
