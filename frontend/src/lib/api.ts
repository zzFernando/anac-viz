import useSWR from "swr";
import type {
  FiltersData, KPIsData, SerieData, MapaData,
  HeatmapData, ScatterData, RotasData,
  RouteArcsData, FrotaNacional,
  SdrResumo, OcorrenciasData, AdsResumo,
} from "./types";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  });

function qs(p: Record<string, unknown>) {
  return "?" + new URLSearchParams(
    Object.entries(p).map(([k, v]) => [k, String(v)])
  ).toString();
}

export function useFilters() {
  return useSWR<FiltersData>("/api/filters", fetcher);
}

export function useKPIs(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<KPIsData>(
    `/api/kpis${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useSerie(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<SerieData>(
    `/api/serie${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useMapa(anoIni: number, anoFim: number) {
  return useSWR<MapaData>(
    `/api/mapa${qs({ ano_ini: anoIni, ano_fim: anoFim })}`,
    fetcher
  );
}

export function useHeatmap(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<HeatmapData>(
    `/api/heatmap${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useScatter(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<ScatterData>(
    `/api/scatter${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useTopRotas(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<RotasData>(
    `/api/top-rotas${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useRouteArcs(anoIni: number, anoFim: number, aeroporto: string) {
  return useSWR<RouteArcsData>(
    `/api/route-arcs${qs({ ano_ini: anoIni, ano_fim: anoFim, aeroporto })}`,
    fetcher
  );
}

export function useFrota() {
  return useSWR<FrotaNacional>("/api/frota", fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
}

export function useSdr() {
  return useSWR<SdrResumo>("/api/sdr", fetcher, {
    revalidateOnFocus: false, revalidateIfStale: false,
  });
}

export function useAds() {
  return useSWR<AdsResumo>("/api/ads", fetcher, {
    revalidateOnFocus: false, revalidateIfStale: false,
  });
}

export function useOcorrencias(anoIni: number, anoFim: number, aeroporto?: string) {
  const aeroPart = aeroporto ? `&aeroporto=${aeroporto}` : "";
  return useSWR<OcorrenciasData>(
    `/api/ocorrencias?ano_ini=${anoIni}&ano_fim=${anoFim}${aeroPart}`,
    fetcher,
  );
}
