"use client";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import type { RotasData, Rota } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
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

export default function DonutD3({ data, groupMetros = false }: Props) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  const items = useMemo(() => {
    const base = groupMetros ? groupMetropolitan(data.rotas) : [...data.rotas];
    return base.slice(0, expanded ? 8 : 5).map((r, i) => ({ ...r, color: paletteColor(i) }));
  }, [data, groupMetros, expanded]);

  useEffect(() => {
    if (!ref.current || !wrap.current || !items.length) return;

    const W    = wrap.current.clientWidth;
    const H    = expanded ? 420 : 280;
    const LEG  = expanded ? 200 : 170;
    const cx   = LEG + (W - LEG) / 2;
    const cy   = H / 2;
    const outerR = Math.min((W - LEG) / 2, cy) - (expanded ? 20 : 14);
    const innerR = outerR * 0.52;

    const totalRaw  = data.total_raw || items.reduce((s, r) => s + r.pax_raw, 0);
    const unitLabel = data.unit === "M" ? "mi" : "mil";
    const fmtPax    = (v: number) => `${v.toFixed(data.unit === "M" ? 1 : 0).replace(".", ",")}${unitLabel}`;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const pie = d3.pie<typeof items[0]>().value(d => d.pax_raw).sort(null).padAngle(0.018);
    const arc = d3.arc<d3.PieArcDatum<typeof items[0]>>()
      .innerRadius(innerR).outerRadius(outerR).cornerRadius(3);
    const arcHover = d3.arc<d3.PieArcDatum<typeof items[0]>>()
      .innerRadius(innerR).outerRadius(outerR + 8).cornerRadius(3);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    const slices = g.selectAll("path.slice")
      .data(pie(items))
      .enter().append("path")
      .attr("class", "slice")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("opacity", 0)
      .style("cursor", "pointer");

    slices.transition().duration(500).delay((_, i) => i * 50).attr("opacity", 0.88);

    // Centro
    const center = g.append("g");
    center.append("text").attr("class", "lbl")
      .attr("text-anchor", "middle").attr("y", -10)
      .attr("font-size", 9).attr("fill", UI.axisText);
    center.append("text").attr("class", "val")
      .attr("text-anchor", "middle").attr("y", 8)
      .attr("font-size", 15).attr("font-weight", 700).attr("fill", UI.textHi);
    center.append("text").attr("class", "pct")
      .attr("text-anchor", "middle").attr("y", 24)
      .attr("font-size", 11).attr("fill", UI.axisText);

    // Legenda à esquerda
    const rowH    = Math.min(H / items.length, expanded ? 40 : 32);
    const offsetY = (H - items.length * rowH) / 2;
    const fs      = expanded ? 9 : 8;
    const maxChars = Math.floor((LEG - 34) / (fs * 0.58));

    function highlight(idx: number | null) {
      const st = slices.transition().duration(100);
      if (idx === null) {
        st.attr("opacity", 0.88).attr("d", d => arc(d) ?? "");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (st as any)
          .attr("opacity", (_: unknown, j: number) => j === idx ? 1 : 0.15)
          .attr("d", (d: d3.PieArcDatum<typeof items[0]>, j: number) =>
            (j === idx ? arcHover(d) : arc(d)) ?? "");
      }
      const item = idx !== null ? items[idx] : null;
      center.select("text.val").text(item ? fmtPax(item.pax) : "");
      center.select("text.pct").text(item && totalRaw > 0 ? `${((item.pax_raw / totalRaw) * 100).toFixed(0)}%` : "");
      center.select("text.lbl").text(item ? (item.dest.length <= 4 ? item.dest : "") : "");
      const lt = legRows.transition().duration(100);
      if (idx === null) {
        lt.attr("opacity", 1);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lt as any).attr("opacity", (_: unknown, j: number) => j === idx ? 1 : 0.35);
      }
    }

    slices
      .on("mouseenter", (_, d) => highlight(items.indexOf(d.data)))
      .on("mouseleave", () => highlight(null));

    const legG = svg.append("g").attr("transform", "translate(0,0)");

    const legRows = legG.selectAll("g.leg-row")
      .data(items)
      .enter().append("g")
      .attr("class", "leg-row")
      .attr("transform", (_, i) => `translate(0, ${offsetY + i * rowH})`)
      .style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlight(items.indexOf(d)))
      .on("mouseleave", () => highlight(null));

    legRows.append("rect")
      .attr("x", 0).attr("y", rowH / 2 - 5)
      .attr("width", 9).attr("height", 9).attr("rx", 2)
      .attr("fill", d => d.color);

    legRows.append("text")
      .attr("x", 13).attr("y", rowH / 2 - 2)
      .attr("font-size", fs).attr("fill", UI.labelDark)
      .text(d => d.label.length > maxChars ? d.label.slice(0, maxChars - 1) + "…" : d.label)
      .append("title").text(d => d.label);

    legRows.append("text")
      .attr("x", 13).attr("y", rowH / 2 + 10)
      .attr("font-size", fs).attr("font-weight", 700)
      .attr("fill", d => d.color)
      .text(d => {
        const pct = totalRaw > 0 ? `${((d.pax_raw / totalRaw) * 100).toFixed(0)}%` : "";
        return `${fmtPax(d.pax)}  ${pct}`;
      });

  }, [items, data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-donut" className="w-full" />
    </div>
  );
}
