"use client";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import type { RotasData, Rota } from "@/lib/types";

import { paletteColor } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

/** Grupos metropolitanos multi-aeroporto. Aplicado quando groupMetros=true. */
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
      out.push({
        dest: key,
        label: `${name} (${rs.length} aeroportos)`,
        pax: +pax.toFixed(2),
        pax_raw: paxRaw,
      });
    } else {
      out.push(rs[0]);
    }
  });
  return out.sort((a, b) => b.pax - a.pax);
}

interface Props {
  data: RotasData;
  /** Quando true, agrupa SBGR+SBSP+SBKP em "Grande São Paulo" (idem RJ). */
  groupMetros?: boolean;
}

export default function BarChartD3({ data, groupMetros = false }: Props) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  // Pré-processa: aplica grouping (se ativo) e mantém top 5 do resultado
  const rotasUsadas = useMemo(() => {
    const base = groupMetros ? groupMetropolitan(data.rotas) : [...data.rotas];
    return base.slice(0, 5);
  }, [data, groupMetros, expanded]);

  useEffect(() => {
    if (!ref.current || !wrap.current || !rotasUsadas.length) return;
    const W = wrap.current.clientWidth;
    const H = expanded ? 560 : 280;
    const ML = 180, MR = 80, MT = 10, MB = 30;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const rotas = [...rotasUsadas].reverse();   // primeiro da lista vai pro topo do bar chart
    const xMax  = (d3.max(rotas, d => d.pax) ?? 1) * 1.22;
    const unitLabel = data.unit === "M" ? "mi" : "mil";
    const fmtPax = (v: number) => `${v.toFixed(data.unit === "M" ? 1 : 0).replace(".", ",")}${unitLabel}`;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(rotas.map(d => d.label))
      .range([0, iH]).padding(0.3);

    // Grid
    g.append("g").attr("class", "grid")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9"));

    // Bars — destaque dourado para grupo metropolitano agregado
    g.selectAll("rect.bar")
      .data(rotas)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.label)!)
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 0)
      .attr("fill", (d, i) => paletteColor(rotas.length - 1 - i))
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 60)
      .attr("width", d => x(d.pax));

    // Valor + percentual à direita
    const totalRaw = data.total_raw || rotasUsadas.reduce((s, r) => s + r.pax_raw, 0);
    g.selectAll("text.val")
      .data(rotas)
      .enter().append("text")
      .attr("class", "val")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.pax) + 6)
      .attr("font-size", 11).attr("font-weight", 700)
      .attr("fill", "#0F172A")
      .text(d => fmtPax(d.pax));

    g.selectAll("text.pct")
      .data(rotas)
      .enter().append("text")
      .attr("class", "pct")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", d => x(d.pax) + 6 + fmtPax(d.pax).length * 7 + 4)
      .attr("font-size", 9)
      .attr("fill", "#94A3B8")
      .text(d => totalRaw > 0 ? `(${((d.pax_raw / totalRaw) * 100).toFixed(0)}%)` : "");

    // Y axis labels
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text")
        .attr("font-size", 10)
        .attr("fill", "#334155")
        .attr("font-weight", 400)
        .attr("dx", -4));

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(v => `${v}${unitLabel}`))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));
  }, [rotasUsadas, data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-bar" className="w-full" />
    </div>
  );
}
