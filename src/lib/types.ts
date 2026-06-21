export interface FiltersData {
  ano_min: number;
  ano_max: number;
  aeroportos: {
    value: string;
    label: string;
    icao: string;
    uf: string;
    cidade: string;
    nome: string;
  }[];
}

export interface KPIsData {
  nome: string;
  pax:         { value: string; sub: string };
  variacao:    { value: string; sub: string; positive: boolean };
  lider:       { value: string; sub: string };
  pontualidade:{ value: string; sub: string };
}

export interface SeriePonto {
  date: string;
  pax:  number;
  mm24: number | null;
}
export interface SerieData {
  nacional:       SeriePonto[];
  aeroporto:      SeriePonto[];
  aeroporto_nome: string;
  scale:          "K" | "M";
  ano_ini:        number;
  ano_fim:        number;
}

export interface AirportBubble {
  icao: string; pax: number;
  lat: number;  lon: number;
  nome: string; mun: string; uf: string;
  sz: number;
}
export interface MapaData { airports: AirportBubble[] }

export interface HeatmapPoint { ano: number; mes: number; pct_atraso: number }
export interface HeatmapData {
  data:           HeatmapPoint[];
  anos:           number[];
  zmax:           number;
  meses:          string[];
  aeroporto_nome: string;
}

export interface ScatterPoint {
  sig: string; label: string;
  market_share: number; pontualidade: number;
  color: string;
  idade_frota:    number | null;
  n_aeronaves:    number | null;
  /** % da frota da cia com Certificado de Aeronavegabilidade vigente (snapshot RAB). */
  pct_ca_vigente: number | null;
  /** % da frota da cia composta por aeronaves a jato (vs turboélice/pistão). */
  pct_jato:       number | null;
  /** Modelo de aeronave dominante na frota da cia. */
  modelo_top:     string | null;
}
export interface ScatterData {
  points:   ScatterPoint[];
  med_ms:   number;
  med_pont: number;
}

export interface FrotaFabricante { nome: string; n: number; idade_media: number }
export interface FrotaModelo {
  modelo:      string;
  n:           number;
  idade_media: number | null;
  fabricante:  string | null;
}
export interface FrotaCA {
  vigente:     number;
  vencido:     number;
  indefinido:  number;   // ABORDO/RESRAB/ISENTA/sem data
  pct_vigente: number;
}
export interface FrotaResumo {
  total: number;
  idade_media: number | null;
  idade_p50:   number | null;
  idade_p90:   number | null;
  pct_jato:    number;
  ca:          FrotaCA;
  top_fabricantes:  FrotaFabricante[];
  top_modelos:      FrotaModelo[];
  composicao_motor: Record<string, number>;
}
export interface FrotaNacional {
  ano_ref: number;
  transporte: FrotaResumo;
  total:      FrotaResumo;
}

// ── Segurança & Manutenção ───────────────────────────────────────────────
export interface SdrResumo {
  total: number;
  ultimos_5_anos: number;
  top_fabricantes: { nome: string; n: number }[];
  top_modelos:     { modelo: string; n: number }[];
  top_ata:         { ata: string; nome: string; n: number }[];
  timeline:        { ano: number; n: number }[];
}

export interface OcorrenciaResumo {
  total: number;
  acidentes: number;
  incidentes: number;
  incidentes_graves: number;
  lesoes_fatais: number;
  top_tipos: { tipo: string; n: number }[];
  por_fase:  { fase: string; n: number }[];
  timeline:  Record<string, number | string>[];
}

export interface OcorrenciaEvento {
  lat: number; lon: number;
  data: string; ano: number;
  tipo: string; cls: string; fase: string;
  muni: string; uf: string;
  danos: string; icao: string;
  fatais: number;
}

export interface OcorrenciasData {
  resumo:  OcorrenciaResumo;
  eventos: OcorrenciaEvento[];
}

export interface AdsResumo {
  total: number;
  vigentes: number;
  top_fabricantes: { nome: string; n: number }[];
  top_sistemas:    { sistema: string; n: number }[];
  por_produto:     Record<string, number>;
}

export interface Rota { dest: string; label: string; pax: number; pax_raw: number }
export interface RotasData {
  rotas:     Rota[];
  unit:      "K" | "M";
  aeroporto: string;
  /** Total bruto de passageiros do aeroporto no período — base do %. */
  total_raw: number;
}

export interface Arc {
  origem: string; destino: string;
  lat_o: number; lon_o: number;
  lat_d: number; lon_d: number;
  pax: number; pax_ratio: number;
  is_focus: boolean; tier: string;
  nome_o: string; nome_d: string;
}
export interface AirportNode {
  icao: string; lat: number; lon: number;
  pax: number; nome: string; uf: string;
  sz: number; is_ref: boolean;
}
export interface RouteArcsData {
  arcs:      Arc[];
  airports:  AirportNode[];
  aeroporto: string;
}
