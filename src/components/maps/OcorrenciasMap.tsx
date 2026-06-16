"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { OcorrenciaEvento } from "@/lib/types";

type Mode = "pontos" | "calor";

const COR_ACIDENTE = [220,  60,  60] as [number, number, number];
const COR_GRAVE    = [244, 160,  75] as [number, number, number];
const COR_INC      = [120, 130, 200] as [number, number, number];

const MAGMA: [number, number, number][] = [
  [26, 10, 58], [74, 29, 138], [201, 59, 110], [244, 160, 75], [253, 230, 138],
];

const _NF = new Intl.NumberFormat("pt-BR");
const fmt = (n: number) => _NF.format(n);

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
    { id: "bg",         type: "background", paint: { "background-color": "#06070d" } },
    { id: "carto-dark", type: "raster", source: "carto-dark", paint: { "raster-opacity": 0.85 } },
  ],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

interface Tip { x: number; y: number; html: string }

interface Props {
  eventos: OcorrenciaEvento[];
  /** Default mode. Aceita controle externo via prop opcional */
  mode?: Mode;
  height?: number;
}

export default function OcorrenciasMap({ eventos, mode: modeExt, height = 460 }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInst    = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const setTipRef  = useRef<((t: Tip | null) => void) | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [modeInt, setModeInt] = useState<Mode>("pontos");
  const mode = modeExt ?? modeInt;
  setTipRef.current = setTip;

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;
    const m = new maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [-50.5, -14.5],
      zoom: 3.4, pitch: 0, bearing: 0,
      attributionControl: false,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    m.on("load", () => {
      m.addLayer({
        id: "carto-labels", type: "raster", source: "carto-labels",
        paint: { "raster-opacity": 0.55 },
      });
    });
    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    m.addControl(overlay as any);
    mapInst.current = m;
    overlayRef.current = overlay;
    return () => { m.remove(); mapInst.current = null; overlayRef.current = null; };
  }, []);

  useEffect(() => {
    if (!overlayRef.current || !eventos) return;
    overlayRef.current.setProps({ layers: buildLayers(eventos, mode, setTipRef.current) });
  }, [eventos, mode]);

  const stats = useMemo(() => {
    const acid = eventos.filter(e => e.cls === "Acidente").length;
    const grav = eventos.filter(e => e.cls === "Incidente Grave").length;
    const inc  = eventos.filter(e => e.cls === "Incidente").length;
    const fat  = eventos.reduce((s, e) => s + (e.fatais || 0), 0);
    return { acid, grav, inc, fat };
  }, [eventos]);

  return (
    <div id="chart-ocorrmap" className="relative overflow-hidden rounded-md" style={{ height, background: "#06070d" }}>
      <div ref={mapRef} className="absolute inset-0" />

      <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur-md border border-white/15 rounded px-3 py-2 max-w-[280px] pointer-events-none">
        <div className="text-white text-sm font-semibold leading-tight">Ocorrências investigadas</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mt-0.5">
          {fmt(stats.acid)} acidentes · {fmt(stats.grav)} incidentes graves
          {stats.inc > 0 && <> · {fmt(stats.inc)} incidentes</>}
          {stats.fat > 0 && <> · {fmt(stats.fat)} fatalidades</>}
        </div>
      </div>

      {modeExt == null && (
        <div className="absolute top-3 right-12 z-10 flex items-center bg-black/70 backdrop-blur-md rounded border border-white/15 overflow-hidden">
          {(["pontos", "calor"] as const).map(id => (
            <button key={id} onClick={() => setModeInt(id)}
              className={`px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors
                ${mode === id ? "bg-[#f4a04b] text-black" : "text-gray-300 hover:bg-white/10"}`}>
              {id === "pontos" ? "Pontos" : "Concentração"}
            </button>
          ))}
        </div>
      )}

      {mode === "pontos" && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-md border border-white/15 rounded px-3 py-2 pointer-events-none">
          <div className="text-[9px] uppercase tracking-[0.14em] text-gray-400 mb-1.5">Classificação</div>
          <div className="space-y-0.5">
            {[["Acidente", COR_ACIDENTE], ["Incidente grave", COR_GRAVE], ["Incidente", COR_INC]].map(([label, c]) => {
              const col = c as [number, number, number];
              return (
                <div key={label as string} className="flex items-center gap-2 text-[10px] text-gray-200">
                  <span className="w-2 h-2 rounded-full" style={{ background: `rgb(${col[0]},${col[1]},${col[2]})` }} />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tip && (
        <div className="chart-tooltip"
          style={{ left: tip.x, top: tip.y, background: "rgba(6,7,13,0.92)", color: "#f4ece0", border: "1px solid rgba(255,255,255,0.15)" }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}

function buildLayers(eventos: OcorrenciaEvento[], mode: Mode, setTip: ((t: Tip | null) => void) | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers: any[] = [];
  if (mode === "pontos") {
    layers.push(new ScatterplotLayer({
      id: "events",
      data: eventos,
      getPosition: (d: OcorrenciaEvento) => [d.lon, d.lat],
      getFillColor: (d: OcorrenciaEvento) => {
        if (d.cls === "Acidente")        return COR_ACIDENTE;
        if (d.cls === "Incidente Grave") return COR_GRAVE;
        return COR_INC;
      },
      getRadius: (d: OcorrenciaEvento) => 2500 + Math.min((d.fatais || 0) * 1500, 15000),
      radiusMinPixels: 2.5, radiusMaxPixels: 14,
      stroked: false, opacity: 0.85,
      pickable: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onHover: ((info: any) => {
        const o = info.object as OcorrenciaEvento | undefined;
        if (o && setTip && info.x != null) {
          const tipoCurto = (o.tipo || "").slice(0, 60);
          const fatLine = o.fatais ? `<br><span style="color:#f48b8b">${o.fatais} fatalidades</span>` : "";
          setTip({
            x: info.x + 14, y: info.y - 8,
            html: `<b>${o.cls}</b> · ${o.data}<br>${o.muni}/${o.uf}${o.icao ? " · " + o.icao : ""}<br><span style="color:#a8a4b8">${tipoCurto}</span>${fatLine}<br><span style="color:#a8a4b8">${o.fase}</span>`,
          });
        } else if (setTip) {
          setTip(null);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    }));
  } else {
    layers.push(new HeatmapLayer({
      id: "events-heat",
      data: eventos,
      getPosition: (d: OcorrenciaEvento) => [d.lon, d.lat],
      getWeight: (d: OcorrenciaEvento) => d.cls === "Acidente" ? 3 : (d.cls === "Incidente Grave" ? 2 : 1),
      radiusPixels: 50, intensity: 1.4, threshold: 0.04,
      colorRange: MAGMA,
      opacity: 0.92,
    }));
  }
  return layers;
}
