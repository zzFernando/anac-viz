"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ScatterPoint } from "@/lib/types";
import { UI } from "@/lib/palette";
import { useExpanded } from "@/lib/expandedContext";

interface Dim {
  key:    keyof ScatterPoint;
  label:  string;
  label2?: string;          // segunda linha do título
  fmt:    (v: number) => string;
  flip?:  boolean;           // menor valor = topo do eixo
}

const DIMS: Dim[] = [
  { key: "idade_frota",  label: "Idade",         label2: "da frota (anos)", fmt: v => `${v.toFixed(1)}a`, flip: true },
  { key: "market_share", label: "Market share",  label2: "no aeroporto (%)", fmt: v => `${v.toFixed(1)}%`           },
  { key: "pct_jato",    label: "Frota a jato",  label2: "(%)",              fmt: v => `${v.toFixed(0)}%`            },
  { key: "pontualidade", label: "Pontualidade",  label2: "(%)",              fmt: v => `${v.toFixed(1)}%`            },
];

/** Distribui rótulos verticalmente para evitar colisão. */
function deconflict(ys: number[], minGap = 13): number[] {
  const out = [...ys];
  // ordena por posição, ajusta, restaura ordem original
  const idx = out.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < idx.length; k++) {
    if (idx[k].y - idx[k - 1].y < minGap)
      idx[k].y = idx[k - 1].y + minGap;
  }
  const res = new Array(out.length);
  idx.forEach(({ y, i }) => { res[i] = y; });
  return res;
}

export default function FrotaEmpresasParallel({ points }: { points: ScatterPoint[] }) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const expanded = useExpanded();

  useEffect(() => {
    if (!ref.current || !wrap.current) return;

    const data = points.filter(p =>
      p.idade_frota != null && p.n_aeronaves != null && p.pct_ca_vigente != null
    );
    if (!data.length) return;

    const W   = wrap.current.clientWidth;
    const H   = expanded ? 520 : 260;
    // Margens generosas: espaço para labels nas laterais e legenda em baixo
    const ML  = 52, MR = 52, MT = 48, MB = 36;
    const iW  = W - ML - MR;
    const iH  = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    // Fundo suave atrás da área de plot
    svg.append("rect")
      .attr("x", ML).attr("y", MT)
      .attr("width", iW).attr("height", iH)
      .attr("fill", "#F8FAFC").attr("rx", 6);

    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    // Escala por dimensão
    const scales = Object.fromEntries(
      DIMS.map(dim => {
        const vals = data.map(d => d[dim.key] as number).filter(v => v != null);
        const [lo, hi] = d3.extent(vals) as [number, number];
        const pad  = (hi - lo) * 0.18 || 2;
        const range = dim.flip ? [iH * 0.1, iH * 0.9] : [iH * 0.9, iH * 0.1];
        return [dim.key, d3.scaleLinear().domain([lo - pad, hi + pad]).range(range).clamp(true)];
      })
    ) as Record<string, d3.ScaleLinear<number, number>>;

    const axisX = (i: number) => (iW / (DIMS.length - 1)) * i;

    const linePath = (d: ScatterPoint) =>
      d3.line<Dim>()
        .x((_, i) => axisX(i))
        .y(dim  => scales[dim.key](d[dim.key] as number ?? 0))
        .curve(d3.curveCatmullRom.alpha(0.5))
        (DIMS) ?? "";

    // Halo branco (stroke mais largo e branco) para separar linhas que se cruzam
    g.selectAll("path.halo")
      .data(data)
      .enter().append("path")
      .attr("d", d => linePath(d))
      .attr("fill", "none")
      .attr("stroke", "#fff")
      .attr("stroke-width", 6)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    // Linhas coloridas animadas
    const paths = g.selectAll("path.line")
      .data(data)
      .enter().append("path")
      .attr("class", "line")
      .attr("d", d => linePath(d))
      .attr("fill", "none")
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("opacity", 0.9);

    paths.each(function() {
      const len = (this as SVGPathElement).getTotalLength();
      d3.select(this)
        .attr("stroke-dasharray", len)
        .attr("stroke-dashoffset", len)
        .transition().duration(800).delay((_, i) => i * 100)
        .attr("stroke-dashoffset", 0);
    });

    // Por eixo: círculos + rótulos de valor com deconflict
    DIMS.forEach((dim, i) => {
      const rawYs  = data.map(d => scales[dim.key](d[dim.key] as number ?? 0));
      const safeYs = deconflict(rawYs, 14);

      // Círculos na posição real
      g.selectAll(`circle.node-${i}`)
        .data(data)
        .enter().append("circle")
        .attr("cx", axisX(i))
        .attr("cy", (d) => scales[dim.key](d[dim.key] as number ?? 0))
        .attr("r", 5)
        .attr("fill", d => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0)
        .transition().delay((_, j) => j * 100 + 700).duration(150)
        .attr("opacity", 1);

      // Tooltip nativo
      g.selectAll(`title.tip-${i}`)
        .data(data)
        .enter().append("title")
        .text(d => `${d.label} — ${dim.label}: ${dim.fmt(d[dim.key] as number)}`);

      // Rótulo com background branco, na posição deconflicted
      const isLast = i === DIMS.length - 1;
      const LX = isLast ? axisX(i) - 9 : axisX(i) + 9;
      const anchor = isLast ? "end" : "start";

      // Fundo branco atrás do texto
      g.selectAll(`rect.lbg-${i}`)
        .data(data)
        .enter().append("rect")
        .attr("x", isLast ? LX - 30 : LX - 2)
        .attr("y", (_, j) => safeYs[j] - 10)
        .attr("width", 32).attr("height", 13)
        .attr("fill", "#fff").attr("rx", 2).attr("opacity", 0.75);

      g.selectAll(`text.nv-${i}`)
        .data(data)
        .enter().append("text")
        .attr("x", LX)
        .attr("y", (_, j) => safeYs[j])
        .attr("text-anchor", anchor)
        .attr("font-size", 9).attr("font-weight", 700)
        .attr("fill", d => d.color)
        .attr("opacity", 0)
        .text(d => d[dim.key] != null ? dim.fmt(d[dim.key] as number) : "")
        .transition().delay((_, j) => j * 100 + 700).duration(150)
        .attr("opacity", 1);
    });

    // Eixos verticais com título em 2 linhas
    DIMS.forEach((dim, i) => {
      const ax = g.append("g").attr("transform", `translate(${axisX(i)},0)`);

      ax.append("line")
        .attr("y1", 0).attr("y2", iH)
        .attr("stroke", "#CBD5E1").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3,3");

      ax.append("text")
        .attr("y", -26)
        .attr("text-anchor", "middle")
        .attr("font-size", 9).attr("font-weight", 700)
        .attr("fill", UI.labelDark)
        .text(dim.label);

      if (dim.label2) {
        ax.append("text")
          .attr("y", -14)
          .attr("text-anchor", "middle")
          .attr("font-size", 8).attr("fill", UI.axisText)
          .text(dim.label2);
      }

      // Min e max do eixo
      const sc = scales[dim.key];
      [[sc.domain()[0], 0], [sc.domain()[1], iH]].forEach(([v, py]) => {
        ax.append("text")
          .attr("x", 0).attr("y", py === 0 ? -3 : iH + 11)
          .attr("text-anchor", "middle")
          .attr("font-size", 7).attr("fill", UI.axisText)
          .text(dim.fmt(v as number));
      });
    });

    // Legenda centralizada na base
    const totalLegW = data.reduce((acc, d) => acc + d.label.length * 6.5 + 24, 0);
    let legX = (W - totalLegW) / 2;
    const legY = H - 12;

    data.forEach(d => {
      svg.append("circle").attr("cx", legX + 5).attr("cy", legY).attr("r", 5).attr("fill", d.color);
      svg.append("text")
        .attr("x", legX + 13).attr("y", legY + 4)
        .attr("font-size", 9).attr("font-weight", 600)
        .attr("fill", UI.labelDark)
        .text(d.label);
      legX += d.label.length * 6.5 + 24;
    });

  }, [points, expanded]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-empresas" className="w-full" />
    </div>
  );
}
