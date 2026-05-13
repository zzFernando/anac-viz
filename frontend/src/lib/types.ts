export interface FiltersData {
  ano_min: number;
  ano_max: number;
  aeroportos: { value: string; label: string }[];
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
}
export interface ScatterData {
  points:   ScatterPoint[];
  med_ms:   number;
  med_pont: number;
}

export interface Rota { dest: string; label: string; pax: number; pax_raw: number }
export interface RotasData { rotas: Rota[]; unit: "K" | "M"; aeroporto: string }

export interface NetworkNode {
  id: string; label: string; size: number; color: string;
  pax: number; nome: string; empresa: string;
  betweenness?: number; degree?: number;
}
export interface NetworkLink {
  source: string; target: string; value: number; pax: number;
}
export interface NetworkData { nodes: NetworkNode[]; links: NetworkLink[] }

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

export interface ODMatrixData {
  airports:     string[];
  z:            number[][];
  aeroporto:    string;
  aeroporto_idx:number;
}
