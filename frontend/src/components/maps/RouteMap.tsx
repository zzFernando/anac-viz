"use client";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { RouteArcsData } from "@/lib/types";

const ANAC_BLUE  = "#003F7F";
const ANAC_LIGHT = "#0066CC";
const GOLD       = "#C89600";

interface Tip { x: number; y: number; html: string }

const TIER_STYLE: Record<string, { stroke: string; width: number; opacity: number }> = {
  hi:    { stroke: GOLD,      width: 4.0, opacity: 0.90 },
  mid:   { stroke: ANAC_LIGHT, width: 2.5, opacity: 0.75 },
  lo:    { stroke: "#5BA4CF",  width: 1.5, opacity: 0.55 },
  top10: { stroke: ANAC_BLUE,  width: 1.2, opacity: 0.30 },
  top50: { stroke: "#94A3B8",  width: 0.7, opacity: 0.18 },
  tail:  { stroke: "#CBD5E1",  width: 0.4, opacity: 0.09 },
};


let geoCache: unknown = null;

export default function RouteMap({
  data,
  onAirportClick,
}: {
  data: RouteArcsData;
  onAirportClick?: (icao: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref  = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current || !data) return;
    const W = wrap.current.clientWidth || 900;
    const H = 520;

    const render = (geo: unknown) => {
      const svg = d3.select(ref.current!).attr("width", W).attr("height", H);
      svg.selectAll("*").remove();

      svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#EBF4FB");

      // Build projection from actual airport coordinates so fitExtent is always valid
      const airportCoords = data.airports
        .filter(a => a.lon && a.lat)
        .map(a => [a.lon, a.lat] as [number, number]);

      // Add fixed boundary points to ensure Brazil is always included even with few airports
      const boundaryPoints: [number, number][] = [
        [-74, -34], [-28, -34], [-28, 6], [-74, 6],
      ];
      const allCoords = [...airportCoords, ...boundaryPoints];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boundsGeo: any = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "MultiPoint", coordinates: allCoords },
          properties: null,
        }],
      };

      const padding = 32;
      const projection = d3.geoMercator().fitExtent(
        [[padding, padding], [W - padding, H - padding]],
        boundsGeo
      );

      const path = d3.geoPath().projection(projection);

      const countries = (geo as { features: unknown[] }).features;
      svg.append("g")
        .selectAll("path")
        .data(countries)
        .enter().append("path")
        .attr("d", d => path(d as d3.GeoPermissibleObjects) ?? "")
        .attr("fill", "#F0F4F8")
        .attr("stroke", "#D1D5DB")
        .attr("stroke-width", 0.5);

      // Arcs — dim first, focus arcs on top
      const dim   = data.arcs.filter(a => !a.is_focus).sort((a, b) => a.pax_ratio - b.pax_ratio);
      const focus = data.arcs.filter(a => a.is_focus).sort((a, b) => a.pax_ratio - b.pax_ratio);

      for (const arc of [...dim, ...focus]) {
        const s = TIER_STYLE[arc.tier] ?? TIER_STYLE.tail;
        const p1 = projection([arc.lon_o, arc.lat_o]);
        const p2 = projection([arc.lon_d, arc.lat_d]);
        if (!p1 || !p2) continue;
        const [x1, y1] = p1, [x2, y2] = p2;
        const cx = (x1 + x2) / 2 - (y2 - y1) * 0.20;
        const cy = (y1 + y2) / 2 + (x2 - x1) * 0.20;

        const el = svg.append("path")
          .attr("d", `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`)
          .attr("fill", "none")
          .attr("stroke", s.stroke)
          .attr("stroke-width", s.width)
          .attr("opacity", s.opacity)
          .attr("stroke-linecap", "round");

        if (arc.is_focus) {
          el.style("cursor", "default")
            .on("mousemove", (ev: MouseEvent) => {
              setTip({
                x: ev.clientX + 12, y: ev.clientY - 8,
                html: `<b>${arc.origem} → ${arc.destino}</b><br/>${arc.nome_o} → ${arc.nome_d}<br/>${(arc.pax / 1e6).toFixed(2)} M pax`,
              });
            })
            .on("mouseleave", () => setTip(null));
        }
      }

      // Top 8 airports by pax for labels
      const sorted = [...data.airports].sort((a, b) => b.pax - a.pax);
      const top8 = new Set(sorted.slice(0, 8).map(a => a.icao));

      // Regular airport nodes
      for (const ap of data.airports.filter(a => !a.is_ref)) {
        const pt = projection([ap.lon, ap.lat]);
        if (!pt) continue;
        svg.append("circle")
          .attr("cx", pt[0]).attr("cy", pt[1])
          .attr("r", ap.sz / 2)
          .attr("fill", ANAC_LIGHT).attr("opacity", 0.75)
          .attr("stroke", "white").attr("stroke-width", 0.5)
          .style("cursor", "pointer")
          .on("mousemove", (ev: MouseEvent) => {
            setTip({
              x: ev.clientX + 12, y: ev.clientY - 8,
              html: `<b>${ap.icao}</b> — ${ap.nome}/${ap.uf}<br/>${(ap.pax / 1e6).toFixed(1)} M pax`,
            });
          })
          .on("mouseleave", () => setTip(null))
          .on("click", () => onAirportClick?.(ap.icao));

        if (top8.has(ap.icao)) {
          const lx = pt[0] + ap.sz / 2 + 3;
          const ly = pt[1] + 3.5;
          svg.append("rect")
            .attr("x", lx - 2).attr("y", ly - 9)
            .attr("width", ap.icao.length * 6 + 4).attr("height", 13)
            .attr("fill", "rgba(255,255,255,0.82)").attr("rx", 2);
          svg.append("text")
            .attr("x", lx).attr("y", ly)
            .attr("font-size", 9).attr("font-weight", 600).attr("fill", "#334155")
            .text(ap.icao);
        }
      }

      // Reference airport (gold highlight)
      for (const ap of data.airports.filter(a => a.is_ref)) {
        const pt = projection([ap.lon, ap.lat]);
        if (!pt) continue;
        svg.append("circle")
          .attr("cx", pt[0]).attr("cy", pt[1])
          .attr("r", ap.sz * 1.6)
          .attr("fill", GOLD).attr("opacity", 0.18);
        svg.append("circle")
          .attr("cx", pt[0]).attr("cy", pt[1])
          .attr("r", ap.sz * 0.75)
          .attr("fill", GOLD).attr("stroke", "white").attr("stroke-width", 1.5)
          .on("mousemove", (ev: MouseEvent) => {
            setTip({
              x: ev.clientX + 12, y: ev.clientY - 8,
              html: `<b>★ ${ap.icao}</b> — ${ap.nome}/${ap.uf}<br/>${(ap.pax / 1e6).toFixed(1)} M pax`,
            });
          })
          .on("mouseleave", () => setTip(null));
        // Label with background
        const lx = pt[0] + ap.sz * 0.85;
        const ly = pt[1] - ap.sz * 0.5;
        svg.append("rect")
          .attr("x", lx - 2).attr("y", ly - 11)
          .attr("width", ap.icao.length * 7 + 4).attr("height", 14)
          .attr("fill", "rgba(255,255,255,0.88)").attr("rx", 2);
        svg.append("text")
          .attr("x", lx).attr("y", ly)
          .attr("font-size", 11).attr("font-weight", 700).attr("fill", GOLD)
          .text(ap.icao);
      }

      // Legend
      const legendItems = [
        { label: "Rota principal",   stroke: GOLD,      width: 4 },
        { label: "Rota média",       stroke: ANAC_LIGHT, width: 2.5 },
        { label: "Rota secundária",  stroke: "#5BA4CF",  width: 1.5 },
        { label: "Top 10 nacional",  stroke: ANAC_BLUE,  width: 1.2, opacity: 0.4 },
      ];
      const lgx = 12, lgy = H - 12 - legendItems.length * 18;
      svg.append("rect")
        .attr("x", lgx - 4).attr("y", lgy - 6)
        .attr("width", 150).attr("height", legendItems.length * 18 + 8)
        .attr("fill", "rgba(255,255,255,0.82)").attr("rx", 4);
      legendItems.forEach((item, i) => {
        const y = lgy + i * 18 + 8;
        svg.append("line")
          .attr("x1", lgx).attr("y1", y).attr("x2", lgx + 22).attr("y2", y)
          .attr("stroke", item.stroke).attr("stroke-width", item.width)
          .attr("opacity", item.opacity ?? 0.9).attr("stroke-linecap", "round");
        svg.append("text")
          .attr("x", lgx + 28).attr("y", y + 3.5)
          .attr("font-size", 9).attr("fill", "#334155")
          .text(item.label);
      });
    };

    if (geoCache) {
      render(geoCache);
      return;
    }

    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json")
      .then(r => r.json())
      .then(world => {
        const { feature } = require("topojson-client") as { feature: Function };
        const countries = feature(world, world.objects.countries);
        geoCache = countries;
        render(countries);
      })
      .catch(() => {
        geoCache = { features: [] };
        render({ features: [] });
      });
  }, [data, onAirportClick]);

  return (
    <div ref={wrap} className="w-full relative">
      <svg ref={ref} id="chart-routemap" className="w-full rounded-b" />
      {tip && (
        <div className="chart-tooltip" style={{ left: tip.x, top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  );
}
