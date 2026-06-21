"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { OcorrenciaResumo } from "@/lib/types";
import { paletteColor, UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

// Ordem sequencial das fases do voo
const PHASE_ORDER = [
  "Táxi", "Corrida", "Decolagem", "Subida",
  "Cruzeiro", "Em rota", "Descida", "Aproximação",
  "Manobra", "Pouso", "Corrida após pouso", "Estacionamento",
];

function phaseOrder(fase: string): number {
  const upper = fase.toUpperCase();
  // Verifica frases mais longas primeiro para evitar falso-match (ex: "Corrida após" ⊂ "Corrida")
  const byLength = [...PHASE_ORDER].sort((a, b) => b.length - a.length);
  const match = byLength.find(p => upper.includes(p.toUpperCase()));
  return match ? PHASE_ORDER.indexOf(match) : 99;
}

export default function OcorrenciasFaseRadial({ data }: { data: OcorrenciaResumo }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current || !data?.por_fase?.length) return;

    const items = [...data.por_fase]
      .filter(d => d.fase && d.fase !== "DESCONHECIDA")
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    const W    = wrap.current.clientWidth;
    const H    = expanded ? 520 : 280;
    const LEG  = expanded ? 140 : 120;   // largura da legenda à esquerda
    const cx   = LEG + (W - LEG) / 2;
    const cy   = H / 2;
    const outerR = Math.min((W - LEG) / 2, cy) - (expanded ? 20 : 16);
    const innerR = outerR * 0.42;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    const total = d3.sum(items, d => d.n);
    const maxN  = d3.max(items, d => d.n) ?? 1;

    // Escala de raio: innerR → outerR baseado no valor
    const rScale = d3.scaleLinear().domain([0, maxN]).range([innerR, outerR]);

    // Ângulos — fatias iguais por fase
    const angleStep = (2 * Math.PI) / items.length;
    const gap = 0.08; // gap angular entre fatias

    const arc = d3.arc<typeof items[0]>()
      .innerRadius(innerR)
      .outerRadius(d => rScale(d.n))
      .startAngle((_, i) => i * angleStep + gap / 2 - Math.PI / 2)
      .endAngle((_, i) => (i + 1) * angleStep - gap / 2 - Math.PI / 2)
      .padRadius(innerR)
      .cornerRadius(3);

    const arcHover = d3.arc<typeof items[0]>()
      .innerRadius(innerR)
      .outerRadius(d => rScale(d.n) + 8)
      .startAngle((_, i) => i * angleStep + gap / 2 - Math.PI / 2)
      .endAngle((_, i) => (i + 1) * angleStep - gap / 2 - Math.PI / 2)
      .cornerRadius(3);

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // Círculos de referência
    [0.25, 0.5, 0.75, 1].forEach(pct => {
      g.append("circle")
        .attr("r", innerR + (outerR - innerR) * pct)
        .attr("fill", "none")
        .attr("stroke", UI.grid)
        .attr("stroke-dasharray", "3,3");
    });

    // Fatias
    const slices = g.selectAll("path.slice")
      .data(items)
      .enter().append("path")
      .attr("class", "slice")
      .attr("d", (d, i) => arc(d, i) ?? "")
      .attr("fill", (_, i) => paletteColor(i))
      .attr("opacity", 0.88)
      .style("cursor", "pointer");

    // Animação de entrada — escala de raio 0→1
    slices
      .attr("transform", "scale(0)")
      .transition().duration(600).delay((_, i) => i * 60)
      .ease(d3.easeCubicOut)
      .attr("transform", "scale(1)");


    // Centro — mostra valor/% ao hover
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

    // Legenda à esquerda — interativa
    const legG    = svg.append("g").attr("transform", "translate(0,0)");
    const rowH    = Math.min(H / items.length, expanded ? 28 : 22);
    const offsetY = (H - items.length * rowH) / 2;
    const fs      = expanded ? 9 : 8;

    function highlightSlice(idx: number | null) {
      slices.transition().duration(100)
        .attr("opacity", idx === null ? 0.88 : (_, j) => j === idx ? 1 : 0.18)
        .attr("d", (d2, j) => (idx === null
          ? arc(d2, j)
          : j === idx ? arcHover(d2, j) : arc(d2, j)) ?? "");
      center.select("text.val").text(idx === null ? "" : items[idx].n.toLocaleString("pt-BR"));
      center.select("text.pct").text(idx === null ? "" : `${((items[idx].n / total) * 100).toFixed(0)}%`);
      center.select("text.lbl").text(idx === null ? "" : (() => {
        const f = items[idx].fase; return f.length > 14 ? f.slice(0, 13) + "…" : f;
      })());
      legRows.transition().duration(100)
        .attr("opacity", idx === null ? 1 : (_, j) => j === idx ? 1 : 0.35);
    }

    // Sincroniza hover das fatias com a legenda
    slices
      .on("mouseenter", function(_, d: FaseItem) {
        highlightSlice(items.indexOf(d));
      })
      .on("mouseleave", () => highlightSlice(null));

    const maxChars = Math.floor((LEG - 32) / (fs * 0.6));

    const legRows = legG.selectAll("g.leg-row")
      .data(items)
      .enter().append("g")
      .attr("class", "leg-row")
      .attr("transform", (_, i) => `translate(0, ${offsetY + i * rowH})`)
      .style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightSlice(items.indexOf(d)))
      .on("mouseleave", () => highlightSlice(null));

    legRows.append("rect")
      .attr("x", 0).attr("y", rowH / 2 - 5)
      .attr("width", 9).attr("height", 9).attr("rx", 2)
      .attr("fill", (_, i) => paletteColor(i));

    legRows.append("text")
      .attr("x", 13).attr("y", rowH / 2 + 4)
      .attr("font-size", fs).attr("fill", UI.labelDark)
      .text(d => d.fase.length > maxChars ? d.fase.slice(0, maxChars - 1) + "…" : d.fase)
      .append("title").text(d => d.fase);

    legRows.append("text")
      .attr("x", LEG - 2).attr("y", rowH / 2 + 4)
      .attr("text-anchor", "end")
      .attr("font-size", fs).attr("font-weight", 700)
      .attr("fill", (_, i) => paletteColor(i))
      .text(d => d.n.toLocaleString("pt-BR"));

  }, [data, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-ocorr-fase" className="w-full" />
    </div>
  );
}
