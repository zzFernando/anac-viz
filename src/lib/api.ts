import { useMemo } from "react";
import useSWR from "swr";
import type {
  FiltersData, KPIsData, SerieData, MapaData,
  HeatmapData, ScatterData, RotasData,
  RouteArcsData, FrotaNacional,
  SdrResumo, OcorrenciasData, AdsResumo,
} from "./types";
import { loadDataset, type Dataset } from "./dataset";
import {
  getFilters, getKpis, getSerie, getMapa, getHeatmap,
  getScatter, getTopRotas, getRouteArcs,
} from "./aggregations";

/**
 * Sem backend: os JSONs consolidados são carregados uma única vez no browser.
 * As agregações rodam em `lib/aggregations.ts` a partir desse dataset em memória.
 */
function useDataset() {
  return useSWR<Dataset>("dataset", loadDataset, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
}

export function useFilters() {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(() => (ds ? getFilters(ds) : undefined), [ds]);
  return { data, error, isLoading };
}

export function useKPIs(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getKpis(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useSerie(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getSerie(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useMapa(anoIni: number, anoFim: number) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getMapa(ds, anoIni, anoFim) : undefined),
    [ds, anoIni, anoFim]
  );
  return { data, error, isLoading };
}

export function useHeatmap(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getHeatmap(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useScatter(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getScatter(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useTopRotas(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getTopRotas(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useRouteArcs(anoIni: number, anoFim: number, aeroporto: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(
    () => (ds ? getRouteArcs(ds, anoIni, anoFim, aeroporto) : undefined),
    [ds, anoIni, anoFim, aeroporto]
  );
  return { data, error, isLoading };
}

export function useFrota() {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(() => ds?.frotaNacional, [ds]);
  return { data, error, isLoading };
}

export function useSdr() {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(() => ds?.sdrResumo, [ds]);
  return { data, error, isLoading };
}

export function useAds() {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo(() => ds?.adsResumo, [ds]);
  return { data, error, isLoading };
}

export function useOcorrencias(anoIni: number, anoFim: number, aeroporto?: string) {
  const { data: ds, error, isLoading } = useDataset();
  const data = useMemo<OcorrenciasData | undefined>(() => {
    if (!ds) return undefined;

    const eventos = ds.ocorrenciasEventos
      .filter((e) => e.ano >= anoIni && e.ano <= anoFim)
      .filter((e) => !aeroporto || e.icao.includes(aeroporto))
      .slice(0, 2000);

    return { resumo: ds.ocorrenciasResumo, eventos };
  }, [ds, anoIni, anoFim, aeroporto]);

  return { data, error, isLoading };
}
