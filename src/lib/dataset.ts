/**
 * Carrega os JSONs estáticos de `public/data` uma única vez e monta os lookups
 * derivados. Sem backend: tudo roda client-side.
 */
import type {
  FrotaNacional, SdrResumo, AdsResumo, OcorrenciaResumo, OcorrenciaEvento,
} from "./types";

export interface StatsCols {
  EMPRESA_SIGLA: string[];
  ANO: number[];
  MES: number[];
  DATA: string[];
  AEROPORTO_DE_ORIGEM_SIGLA: string[];
  AEROPORTO_DE_DESTINO_SIGLA: string[];
  PASSAGEIROS_PAGOS: number[];
}

export interface PercentuaisCols {
  Aeroporto_Origem_Designador_OACI: string[];
  Percentuais_de_Atrasos_superiores_a_30_minutos: (number | null)[];
  ano: number[];
  mes: number[];
  sigla: string[];
}

export interface AerodromosCols {
  "Código OACI": string[];
  Nome: (string | null)[];
  Município: (string | null)[];
  UF: (string | null)[];
  lat: (number | null)[];
  lon: (number | null)[];
}

export interface FrotaEmpresasCols {
  empresa_icao: string[];
  label: string[];
  n_aeronaves: number[];
  idade_media: (number | null)[];
  pct_jato: number[];
  modelo_top: (string | null)[];
  n_ca_vigente: number[];
  n_ca_vencido: number[];
  pct_ca_vigente: number[];
}

export interface OcorrenciasEventosCols {
  lat: number[];
  lon: number[];
  data: string[];
  ano: number[];
  tipo: string[];
  cls: string[];
  fase: string[];
  muni: string[];
  uf: string[];
  danos: string[];
  icao: string[];
  fatais: number[];
}

export interface FrotaInfo {
  n_aeronaves: number | null;
  idade_media: number | null;
  pct_ca_vigente: number | null;
  pct_jato: number | null;
  modelo_top: string | null;
}

export interface AeroInfo {
  lat: number | null;
  lon: number | null;
  nome: string;
  municipio: string;
  uf: string;
}

export interface Dataset {
  stats: StatsCols;
  percentuais: PercentuaisCols;
  aeroCoords: Map<string, AeroInfo>;
  pax120: string[];
  anoMin: number;
  anoMax: number;
  /** índices de `stats` por aeroporto de origem — evita varrer 530k linhas a cada filtro. */
  idxByOrigin: Map<string, number[]>;
  /** índices de `percentuais` por aeroporto de origem. */
  idxByOriginPct: Map<string, number[]>;
  frotaNacional: FrotaNacional;
  frotaBySig: Map<string, FrotaInfo>;
  sdrResumo: SdrResumo;
  adsResumo: AdsResumo;
  ocorrenciasResumo: OcorrenciaResumo;
  ocorrenciasEventos: OcorrenciaEvento[];
}

const EMPRESA_LABEL: Record<string, string> = {
  TAM: "LATAM/TAM", GLO: "Gol", AZU: "Azul",
  VRG: "Gol (VRG)", ONE: "Avianca BR", AVI: "Avianca",
  PTB: "Passaredo", MAP: "MAP",
};

const CORES: Record<string, string> = {
  TAM: "#E31837", GLO: "#FF6B00", AZU: "#3780D0",
  VRG: "#FFA040", ONE: "#7B2D2D", AVI: "#A52A2A",
  PTB: "#C89600", MAP: "#9467BD",
};

export const MESES_BR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function empresaLabel(sig: string): string {
  return EMPRESA_LABEL[sig] ?? sig;
}

export function empresaColor(sig: string): string {
  return CORES[sig] ?? "#94A3B8";
}

let _loadPromise: Promise<Dataset> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Falha ao carregar ${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export function loadDataset(): Promise<Dataset> {
  if (!_loadPromise) {
    _loadPromise = (async () => {
      const [
        stats, percentuais, aerodromos,
        frotaNacional, frotaEmpresas, sdrResumo, adsResumo,
        ocorrenciasResumo, ocorrenciasEventosCols,
      ] = await Promise.all([
        fetchJson<StatsCols>("/data/stats.json"),
        fetchJson<PercentuaisCols>("/data/percentuais.json"),
        fetchJson<AerodromosCols>("/data/aerodromos.json"),
        fetchJson<FrotaNacional>("/data/frota_nacional.json"),
        fetchJson<FrotaEmpresasCols>("/data/frota_empresas.json"),
        fetchJson<SdrResumo>("/data/sdr_resumo.json"),
        fetchJson<AdsResumo>("/data/ads_resumo.json"),
        fetchJson<OcorrenciaResumo>("/data/ocorrencias_resumo.json"),
        fetchJson<OcorrenciasEventosCols>("/data/ocorrencias_eventos.json"),
      ]);

      // drop_duplicates(subset="Código OACI", keep="first")
      const aeroCoords = new Map<string, AeroInfo>();
      const icaos = aerodromos["Código OACI"];
      for (let i = 0; i < icaos.length; i++) {
        const icao = icaos[i];
        if (aeroCoords.has(icao)) continue;
        aeroCoords.set(icao, {
          lat: aerodromos.lat[i],
          lon: aerodromos.lon[i],
          nome: aerodromos.Nome[i] ?? "",
          municipio: aerodromos["Município"][i] ?? "",
          uf: aerodromos.UF[i] ?? "",
        });
      }

      const paxByAirport = new Map<string, number>();
      const origem = stats.AEROPORTO_DE_ORIGEM_SIGLA;
      const pax = stats.PASSAGEIROS_PAGOS;
      const idxByOrigin = new Map<string, number[]>();
      for (let i = 0; i < origem.length; i++) {
        const icao = origem[i];
        paxByAirport.set(icao, (paxByAirport.get(icao) ?? 0) + pax[i]);
        let arr = idxByOrigin.get(icao);
        if (!arr) { arr = []; idxByOrigin.set(icao, arr); }
        arr.push(i);
      }
      const pax120 = [...paxByAirport.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 120)
        .map(([icao]) => icao);

      const idxByOriginPct = new Map<string, number[]>();
      const origemPct = percentuais.Aeroporto_Origem_Designador_OACI;
      for (let i = 0; i < origemPct.length; i++) {
        const icao = origemPct[i];
        let arr = idxByOriginPct.get(icao);
        if (!arr) { arr = []; idxByOriginPct.set(icao, arr); }
        arr.push(i);
      }

      const anos = stats.ANO;
      let anoMin = anos[0], anoMax = anos[0];
      for (const a of anos) {
        if (a < anoMin) anoMin = a;
        if (a > anoMax) anoMax = a;
      }

      const frotaBySig = new Map<string, FrotaInfo>();
      for (let i = 0; i < frotaEmpresas.empresa_icao.length; i++) {
        frotaBySig.set(frotaEmpresas.empresa_icao[i], {
          n_aeronaves:    frotaEmpresas.n_aeronaves[i],
          idade_media:    frotaEmpresas.idade_media[i],
          pct_ca_vigente: frotaEmpresas.pct_ca_vigente[i],
          pct_jato:       frotaEmpresas.pct_jato[i] ?? null,
          modelo_top: frotaEmpresas.modelo_top[i],
        });
      }

      const ocorrenciasEventos: OcorrenciaEvento[] = ocorrenciasEventosCols.lat.map((lat, i) => ({
        lat,
        lon: ocorrenciasEventosCols.lon[i],
        data: ocorrenciasEventosCols.data[i],
        ano: ocorrenciasEventosCols.ano[i],
        tipo: ocorrenciasEventosCols.tipo[i],
        cls: ocorrenciasEventosCols.cls[i],
        fase: ocorrenciasEventosCols.fase[i],
        muni: ocorrenciasEventosCols.muni[i],
        uf: ocorrenciasEventosCols.uf[i],
        danos: ocorrenciasEventosCols.danos[i],
        icao: ocorrenciasEventosCols.icao[i],
        fatais: ocorrenciasEventosCols.fatais[i],
      }));

      return {
        stats, percentuais, aeroCoords, pax120, anoMin, anoMax, idxByOrigin, idxByOriginPct,
        frotaNacional, frotaBySig, sdrResumo, adsResumo, ocorrenciasResumo, ocorrenciasEventos,
      };
    })();
  }
  return _loadPromise;
}
