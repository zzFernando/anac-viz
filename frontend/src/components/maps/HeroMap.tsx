"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ColumnLayer, ArcLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { RouteArcsData } from "@/lib/types";

export type Mode = "volume" | "calor" | "rotas";

const MAGMA: [number, number, number][] = [
  [26, 10, 58],
  [74, 29, 138],
  [201, 59, 110],
  [244, 160, 75],
  [253, 230, 138],
];
const GOLD:       [number, number, number] = [244, 160, 75];
const GOLD_LIGHT: [number, number, number] = [253, 230, 138];

// MapLibre style: tema escuro CartoDB (mesmo do pulse-dashboard)
const MAP_STYLE = {
  version: 8,
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
    "carto-labels": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#06070d" } },
    { id: "carto-dark", type: "raster", source: "carto-dark", paint: { "raster-opacity": 0.85 } },
  ],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

interface Props {
  data: RouteArcsData;
  aeroporto: string;
  onAirportClick?: (icao: string) => void;
  height?: number;
  /** Modo controlado pelo pai (tabs no SectionCard). Default: "volume". */
  mode?: Mode;
}

interface Tip { x: number; y: number; html: string }

export default function HeroMap({ data, onAirportClick, height = 520, mode = "volume" }: Props) {
  const mapRef        = useRef<HTMLDivElement>(null);
  const mapInstance   = useRef<maplibregl.Map | null>(null);
  const overlayRef    = useRef<MapboxOverlay | null>(null);
  const onClickRef    = useRef(onAirportClick);
  const setTipRef     = useRef<((t: Tip | null) => void) | null>(null);
  const [tip, setTip]   = useState<Tip | null>(null);
  const [zoom, setZoom] = useState<number>(3.4);

  onClickRef.current = onAirportClick;
  setTipRef.current  = setTip;

  // Inicialização do mapa (uma vez)
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const m = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [-50.5, -14.5],
      zoom: 3.4,
      pitch: 38,
      bearing: 0,
      attributionControl: false,
      // preserveDrawingBuffer permite capturar PNG; o typing dele caiu no v3
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ preserveDrawingBuffer: true } as any),
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    m.on("zoom", () => setZoom(m.getZoom()));

    m.on("load", () => {
      m.addLayer({
        id: "carto-labels",
        type: "raster",
        source: "carto-labels",
        paint: { "raster-opacity": 0.55 },
      });
    });

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m.addControl(overlay as any);

    mapInstance.current = m;
    overlayRef.current  = overlay;

    return () => {
      m.remove();
      mapInstance.current = null;
      overlayRef.current  = null;
    };
  }, []);

  // Atualiza layers quando dados, modo ou zoom mudam (zoom controla a escala visual)
  useEffect(() => {
    if (!overlayRef.current || !data) return;
    overlayRef.current.setProps({
      layers: buildLayers(data, mode, zoom, onClickRef.current, setTipRef.current),
    });
  }, [data, mode, zoom]);

  const overlayInfo = useMemo(() => {
    switch (mode) {
      case "volume": return { title: "Volume por aeroporto", sub: "Colunas extrudadas · altura ∝ passageiros" };
      case "calor":  return { title: "Densidade espacial",    sub: "Heatmap nacional ponderado por pax" };
      case "rotas":  return { title: "Malha de rotas",         sub: "Arcos sobre o território brasileiro" };
    }
  }, [mode]);

  // Quantis pra legenda numérica (paleta magma mapeia sqrt(pax/paxMax))
  const legendStats = useMemo(() => {
    const pax = (data?.airports ?? []).map(a => a.pax).filter(p => p > 0).sort((a, b) => a - b);
    if (!pax.length) return null;
    const fmt = (v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`;
    const max = pax[pax.length - 1];
    return {
      min: fmt(pax[0]),
      mid: fmt(max * 0.25),   // sqrt(0.25) = 0.5 — posição central na escala visual
      max: fmt(max),
    };
  }, [data]);

  return (
    <div id="chart-hero" className="relative overflow-hidden rounded-md" style={{ height, background: "#06070d" }}>
      <div ref={mapRef} className="absolute inset-0" />

      {/* Overlay card (top-left) */}
      <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-md border border-white/15 rounded px-3 py-2 max-w-[260px] pointer-events-none">
        <div className="text-white text-sm font-semibold leading-tight">{overlayInfo.title}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mt-0.5">{overlayInfo.sub}</div>
      </div>

      {/* Legend bottom-left — agora com valores numéricos ancorados */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-md border border-white/15 rounded px-3 py-2 pointer-events-none">
        <div className="text-[9px] uppercase tracking-[0.14em] text-gray-400 mb-1.5">Passageiros / ano</div>
        <div
          className="w-44 h-1.5 rounded"
          style={{ background: "linear-gradient(to right, rgb(26,10,58), rgb(74,29,138), rgb(201,59,110), rgb(244,160,75), rgb(253,230,138))" }}
        />
        <div className="flex justify-between text-[9px] font-mono text-gray-300 mt-1 w-44">
          <span>{legendStats?.min ?? "0"}</span>
          <span>{legendStats?.mid ?? ""}</span>
          <span>{legendStats?.max ?? ""}</span>
        </div>
      </div>

      {/* HUD bottom-right */}
      <div className="absolute bottom-3 right-12 z-10 text-[10px] font-mono text-gray-500 uppercase tracking-[0.12em] text-right leading-snug pointer-events-none">
        <div>WebGL · <span className="text-gray-300">{zoom.toFixed(1)}</span></div>
        <div>deck.gl + maplibre</div>
      </div>

      {tip && (
        <div
          className="chart-tooltip"
          style={{ left: tip.x, top: tip.y, background: "rgba(6,7,13,0.92)", color: "#f4ece0", border: "1px solid rgba(255,255,255,0.15)" }}
          dangerouslySetInnerHTML={{ __html: tip.html }}
        />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLayers(data: RouteArcsData, mode: Mode, zoom: number, onClick: ((icao: string) => void) | undefined, setTip: ((t: Tip | null) => void) | null): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers: any[] = [];

  // Escala inversa ao zoom — mantém a altura visual aproximadamente constante na tela.
  const zoomFactor = Math.pow(2, 3 - Math.max(2, Math.min(zoom, 9)));

  if (mode === "volume") {
    const paxMax = data.airports.reduce((m, a) => Math.max(m, a.pax), 1);

    // Uma coluna redonda por aeroporto. Altura ∝ √(pax), cor por gradiente magma.
    const colRadius = 8000 * Math.sqrt(zoomFactor);
    const maxElevation = 350000 * zoomFactor;

    layers.push(new ColumnLayer({
      id: "volume",
      data: data.airports.filter(a => !a.is_ref),
      diskResolution: 24,                  // redondo / suave
      radius: colRadius,
      extruded: true,
      pickable: true,
      getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
      getElevation: (d: { pax: number }) => Math.sqrt(d.pax / paxMax) * maxElevation,
      getFillColor: (d: { pax: number }) => {
        const ratio = Math.sqrt(d.pax / paxMax);
        const idx = Math.min(MAGMA.length - 1, Math.floor(ratio * MAGMA.length));
        return MAGMA[idx];
      },
      opacity: 0.92,
      material: { ambient: 0.55, diffuse: 0.6, shininess: 32, specularColor: [255, 220, 180] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onHover: ((info: any) => {
        if (info.object && setTip && info.x != null) {
          setTip({
            x: info.x + 14, y: info.y - 8,
            html: `<b>${info.object.icao}</b> — ${info.object.nome}/${info.object.uf}<br>${(info.object.pax / 1e6).toFixed(1)} M pax`,
          });
        } else if (setTip) {
          setTip(null);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick: ((info: any) => {
        if (info.object?.icao) onClick?.(info.object.icao);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    }));

    // Coluna dourada destacada para o aeroporto de referência
    const ref = data.airports.find(a => a.is_ref);
    if (ref) {
      const refHeight = Math.sqrt(ref.pax / paxMax) * maxElevation * 1.15 + maxElevation * 0.05;
      layers.push(new ColumnLayer({
        id: "ref-pyramid",
        data: [ref],
        diskResolution: 24,
        radius: colRadius * 1.3,
        extruded: true,
        pickable: false,
        getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
        getElevation: () => refHeight,
        getFillColor: GOLD_LIGHT,
        material: { ambient: 0.75, diffuse: 0.5, shininess: 60, specularColor: [255, 240, 200] },
      }));
      // Halo de chão (disco translúcido) — ancora a coluna no aeroporto selecionado
      layers.push(new ColumnLayer({
        id: "ref-halo",
        data: [ref],
        diskResolution: 32,
        radius: colRadius * 4,
        extruded: false,
        pickable: false,
        getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
        getFillColor: [...GOLD_LIGHT, 55] as unknown as [number, number, number],
      }));
    }
  }

  if (mode === "calor") {
    layers.push(new HeatmapLayer({
      id: "heat",
      data: data.airports,
      getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
      getWeight: (d: { pax: number }) => d.pax,
      radiusPixels: 55,
      intensity: 1.6,
      threshold: 0.04,
      colorRange: MAGMA,
      opacity: 0.92,
    }));
    // Bola sutil no aeroporto de referência mesmo no modo calor
    const ref = data.airports.find(a => a.is_ref);
    if (ref) {
      layers.push(new ColumnLayer({
        id: "ref-dot",
        data: [ref],
        diskResolution: 24,
        radius: 9000,
        extruded: false,
        pickable: false,
        getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
        getFillColor: [...GOLD_LIGHT, 220] as unknown as [number, number, number],
      }));
    }
  }

  // Arcos: sempre todos. is_focus continua diferenciando o aeroporto de referência.
  if (mode === "rotas" || mode === "volume") {
    if (data.arcs.length) {
      const paxMaxArc = data.arcs.reduce((m, a) => Math.max(m, a.pax), 1);
      layers.push(new ArcLayer({
        id: `arcs-${mode}`,
        data: data.arcs,
        getSourcePosition: (d: { lon_o: number; lat_o: number }) => [d.lon_o, d.lat_o],
        getTargetPosition: (d: { lon_d: number; lat_d: number }) => [d.lon_d, d.lat_d],
        getSourceColor: (d: { is_focus: boolean }) => d.is_focus ? GOLD       : [110,  95, 170],
        getTargetColor: (d: { is_focus: boolean }) => d.is_focus ? GOLD_LIGHT : [210, 125, 195],
        getWidth: (d: { pax: number; is_focus: boolean }) =>
          d.is_focus
            ? Math.max(1.0, Math.sqrt(d.pax / paxMaxArc) * 3.5 + 0.8)
            : Math.max(0.25, Math.sqrt(d.pax / paxMaxArc) * 1.2),
        // No modo volume os arcos sobem mais para passar por cima das pirâmides
        getHeight: mode === "volume" ? 0.7 : 0.4,
        opacity: mode === "volume" ? 0.55 : 0.6,
        greatCircle: true,
        pickable: false,
      }));
    }
  }

  return layers;
}
