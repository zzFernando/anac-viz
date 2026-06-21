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

interface Props {
  data: RotasData;
  groupMetros?: boolean;
}

export default function TreemapD3({ data, groupMetros = false }: Props) {
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

    const totalRaw = data.total_raw || rotasUsadas.reduce((s, r) => s + r.pax_raw, 0);
    const unitLabel = data.unit === "M" ? "mi" : "mil";
    const fmtPax = (v: number) => `${v.toFixed(data.unit === "M" ? 1 : 0).replace(".", ",")}${unitLabel}`;

    const root = d3.hierarchy({ label: "root", pax: 0, pax_raw: 0, dest: "", children: rotasUsadas } as never)
      .sum((d: never) => (d as Rota).pax ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    d3.treemap<never>()
      .size([W, H])
      .paddingInner(3)
      .paddingOuter(0)
      .round(true)(root);

    const leaves = (root.leaves() as unknown) as d3.HierarchyRectangularNode<Rota>[];

    const cell = svg.selectAll("g.cell")
      .data(leaves)
      .enter().append("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);

    cell.append("rect")
      .attr("width", 0)
      .attr("height", d => d.y1 - d.y0)
      .attr("fill", (d) => paletteColor(leaves.indexOf(d)))
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 60)
      .attr("width", d => d.x1 - d.x0);

    // Label principal — nome do destino
    cell.append("text")
      .attr("x", 8)
      .attr("y", 18)
      .attr("font-size", d => {
        const w = d.x1 - d.x0;
        return w < 80 ? 8 : w < 140 ? 10 : 12;
      })
      .attr("font-weight", 700)
      .attr("fill", "#FFFFFF")
      .attr("clip-path", (_, i) => `url(#clip-${i})`)
      .text(d => {
        const w = d.x1 - d.x0;
        const label = d.data.label;
        if (w < 50) return "";
        if (w < 120) return d.data.dest;
        return label;
      });

    // Valor passageiros
    cell.append("text")
      .attr("x", 8)
      .attr("y", d => {
        const h = d.y1 - d.y0;
        return h > 60 ? 34 : 32;
      })
      .attr("font-size", 10)
      .attr("fill", "rgba(255,255,255,0.85)")
      .text(d => {
        const w = d.x1 - d.x0;
        if (w < 50) return "";
        return fmtPax(d.data.pax);
      });

    // Percentual — só em células grandes
    cell.append("text")
      .attr("x", 8)
      .attr("y", d => {
        const h = d.y1 - d.y0;
        return h > 60 ? 47 : 44;
      })
      .attr("font-size", 9)
      .attr("fill", "rgba(255,255,255,0.65)")
      .text(d => {
        const w = d.x1 - d.x0;
        const h = d.y1 - d.y0;
        if (w < 60 || h < 40) return "";
        return totalRaw > 0 ? `${((d.data.pax_raw / totalRaw) * 100).toFixed(0)}%` : "";
      });

    // Clip paths para texto não vazar
    const defs = svg.append("defs");
    leaves.forEach((d, i) => {
      defs.append("clipPath")
        .attr("id", `clip-${i}`)
        .append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", d.x1 - d.x0 - 4)
        .attr("height", d.y1 - d.y0);
    });
  }, [rotasUsadas, data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-treemap" className="w-full" />
    </div>
  );
}
