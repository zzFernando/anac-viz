"use client";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import type { RotasData, Rota } from "@/lib/types";

import { paletteColor } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

const METRO_GROUPS: { key: string; name: string; airports: string[] }[] = [
  { key: "GSP", name: "Grande São Paulo",      airports: ["SBGR", "SBSP", "SBKP"] },
  { key: "GRJ", name: "Grande Rio de Janeiro", airports: ["SBGL", "SBRJ", "SBJR"] },
];

function groupMetropolitan(rotas: Rota[]): Rota[] {
  const byKey = new Map<string, { rotas: Rota[]; name: string }>();
  const out: Rota[] = [];
  for (const r of rotas) {
    const group = METRO_GROUPS.find(g => g.airports.includes(r.dest));
    if (!group) { out.push(r); continue; }
    const entry = byKey.get(group.key) ?? { rotas: [], name: group.name };
    entry.rotas.push(r);
    byKey.set(group.key, entry);
  }
  Array.from(byKey.entries()).forEach(([key, { rotas: rs, name }]) => {
    if (rs.length > 1) {
      const paxRaw = rs.reduce((s: number, r: Rota) => s + r.pax_raw, 0);
      const pax    = rs.reduce((s: number, r: Rota) => s + r.pax,     0);
      out.push({ dest: key, label: `${name} (${rs.length} aeroportos)`, pax: +pax.toFixed(2), pax_raw: paxRaw });
    } else {
      out.push(rs[0]);
    }
  });
  return out.sort((a, b) => b.pax - a.pax);
}

function sliceColor(_d: Rota, i: number): string {
  return paletteColor(i);
}

interface Props {
  data: RotasData;
  groupMetros?: boolean;
}

export default function DonutD3({ data, groupMetros = false }: Props) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  const rotasUsadas = useMemo(() => {
    const base = groupMetros ? groupMetropolitan(data.rotas) : [...data.rotas];
    return base.slice(0, 5);
  }, [data, groupMetros, expanded]);

  useEffect(() => {
    if (!ref.current || !wrap.current || !rotasUsadas.length) return;
    const W = wrap.current.clientWidth;
    const H = expanded ? 560 : 280;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const totalRaw  = data.total_raw || rotasUsadas.reduce((s, r) => s + r.pax_raw, 0);
    const unitLabel = data.unit === "M" ? "mi" : "mil";
    const fmtPax    = (v: number) => `${v.toFixed(data.unit === "M" ? 1 : 0).replace(".", ",")}${unitLabel}`;

    // Layout: donut à esquerda, legenda à direita
    const legendW = Math.min(180, W * 0.42);
    const donutW  = W - legendW;
    const cx = donutW / 2;
    const cy = H / 2;
    const outerR = Math.min(cx, cy) - 12;
    const innerR = outerR * 0.52;

    const pie = d3.pie<Rota>().value(d => d.pax_raw).sort(null);
    const arc = d3.arc<d3.PieArcDatum<Rota>>().innerRadius(innerR).outerRadius(outerR);
    const arcHover = d3.arc<d3.PieArcDatum<Rota>>().innerRadius(innerR).outerRadius(outerR + 6);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    const slices = g.selectAll("path.slice")
      .data(pie(rotasUsadas))
      .enter().append("path")
      .attr("class", "slice")
      .attr("fill", (d, i) => sliceColor(d.data, i))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .each(function(d) { (this as SVGPathElement & { _current: typeof d })._current = d; });

    // Animação de entrada — arco cresce do zero
    slices
      .transition().duration(600).delay((_, i) => i * 80)
      .attrTween("d", function(d) {
        const el = this as SVGPathElement & { _current: d3.PieArcDatum<Rota> };
        const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
        return (t) => arc(interp(t)) ?? "";
      });

    // Hover expand
    slices
      .on("mouseenter", function(_, d) {
        d3.select(this).transition().duration(150).attr("d", arcHover(d) ?? "");
        // atualiza centro
        center.select("text.val").text(fmtPax(d.data.pax));
        center.select("text.pct").text(totalRaw > 0 ? `${((d.data.pax_raw / totalRaw) * 100).toFixed(0)}%` : "");
        center.select("text.lbl").text(d.data.dest.length <= 4 ? d.data.dest : "");
      })
      .on("mouseleave", function(_, d) {
        d3.select(this).transition().duration(150).attr("d", arc(d) ?? "");
        center.select("text.val").text("");
        center.select("text.pct").text("");
        center.select("text.lbl").text("");
      });

    // Centro do donut — exibe valor ao hover
    const center = g.append("g").attr("class", "center");
    center.append("text").attr("class", "val")
      .attr("text-anchor", "middle").attr("y", -4)
      .attr("font-size", 13).attr("font-weight", 700).attr("fill", "#0F172A");
    center.append("text").attr("class", "pct")
      .attr("text-anchor", "middle").attr("y", 13)
      .attr("font-size", 11).attr("fill", "#64748B");
    center.append("text").attr("class", "lbl")
      .attr("text-anchor", "middle").attr("y", -18)
      .attr("font-size", 9).attr("fill", "#94A3B8");

    // Legenda à direita
    const legendG = svg.append("g").attr("transform", `translate(${donutW}, ${(H - rotasUsadas.length * 44) / 2})`);

    const colorByDest = new Map(rotasUsadas.map((r, i) => [r.dest, sliceColor(r, i)]));

    rotasUsadas.forEach((r, i) => {
      const row = legendG.append("g").attr("transform", `translate(0, ${i * 44})`);
      const pct = totalRaw > 0 ? ((r.pax_raw / totalRaw) * 100).toFixed(0) : "0";

      row.append("rect")
        .attr("width", 10).attr("height", 10).attr("y", 0).attr("rx", 2)
        .attr("fill", colorByDest.get(r.dest) ?? "#94A3B8");

      // label destino
      row.append("text")
        .attr("x", 14).attr("y", 10)
        .attr("font-size", 9).attr("fill", "#334155")
        .attr("font-weight", METRO_GROUPS.find(g => g.key === r.dest) ? 700 : 400)
        .text(() => {
          const maxW = legendW - 16;
          const chars = Math.floor(maxW / 5.5);
          return r.label.length > chars ? r.label.slice(0, chars - 1) + "…" : r.label;
        });

      // valor
      row.append("text")
        .attr("x", 14).attr("y", 22)
        .attr("font-size", 10).attr("fill", "#0F172A").attr("font-weight", 700)
        .text(fmtPax(r.pax));

      // percentual
      row.append("text")
        .attr("x", 14 + fmtPax(r.pax).length * 6.5 + 4).attr("y", 22)
        .attr("font-size", 9).attr("fill", "#94A3B8")
        .text(`(${pct}%)`);
    });
  }, [rotasUsadas, data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-donut" className="w-full" />
    </div>
  );
}
