"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ScatterPoint } from "@/lib/types";

const GOLD = "#C89600";

interface Props {
  /** Pontos do scatter já enriquecidos com idade_frota e n_aeronaves */
  points: ScatterPoint[];
}

export default function FrotaEmpresas({ points }: Props) {
  const ref  = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !wrap.current) return;

    // Mantém apenas empresas com dados de frota mapeados
    const data = points
      .filter(p => p.idade_frota != null && p.n_aeronaves != null)
      .sort((a, b) => (a.idade_frota! - b.idade_frota!));   // mais novas no topo

    const W = wrap.current.clientWidth;
    const H = Math.max(180, data.length * 34 + 64);
    const fmtDecimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

    // Layout em 6 colunas alinhadas: empresa · barra · idade · frota/pont · CA · modelo
    const ML = 110;                       // coluna nome
    const COL_IDADE_W = 64;
    const COL_EXTRA_W = 120;
    const COL_CA_W    = 90;
    const COL_MOD_W   = 130;
    const MR = COL_IDADE_W + COL_EXTRA_W + COL_CA_W + COL_MOD_W + 20;
    const MT = 28, MB = 32;
    const iW = W - ML - MR, iH = H - MT - MB;

    const svg = d3.select(ref.current).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();

    if (!data.length) {
      svg.append("text")
        .attr("x", W / 2).attr("y", H / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#94A3B8").attr("font-size", 12)
        .text("Sem informações de frota para as empresas deste aeroporto");
      return;
    }

    const g = svg.append("g").attr("transform", `translate(${ML},${MT})`);

    const xMax = (d3.max(data, d => d.idade_frota!) ?? 30) * 1.05;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, iW]);
    const y = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, iH]).padding(0.28);

    // Cabeçalhos de coluna
    svg.append("text")
      .attr("x", ML - 6).attr("y", MT - 10)
      .attr("text-anchor", "end")
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .attr("text-transform", "uppercase")
      .text("Empresa");
    svg.append("text")
      .attr("x", ML + iW / 2).attr("y", MT - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .text("Idade da frota (anos)");
    svg.append("text")
      .attr("x", ML + iW + COL_IDADE_W).attr("y", MT - 10)
      .attr("text-anchor", "end")
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .text("Idade média");
    svg.append("text")
      .attr("x", ML + iW + COL_IDADE_W + 12).attr("y", MT - 10)
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .text("Aeronaves · no horário");
    svg.append("text")
      .attr("x", ML + iW + COL_IDADE_W + COL_EXTRA_W + 16).attr("y", MT - 10)
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .text("Certificado");
    svg.append("text")
      .attr("x", ML + iW + COL_IDADE_W + COL_EXTRA_W + COL_CA_W + 20).attr("y", MT - 10)
      .attr("font-size", 9).attr("font-weight", 700)
      .attr("fill", "#64748B")
      .text("Modelo mais usado");

    // Grid vertical (na área da barra apenas)
    g.append("g")
      .call(d3.axisTop(x).ticks(4).tickSize(-iH).tickFormat(() => ""))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("line").attr("stroke", "#F1F5F9"));

    // Faixa "frota nova ↔ velha" no fundo (gradiente sutil) — apenas na área da barra
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient")
      .attr("id", "frota-gradient")
      .attr("x1", "0%").attr("x2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#16A34A").attr("stop-opacity", 0.04);
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#DC2626").attr("stop-opacity", 0.06);
    g.append("rect")
      .attr("x", 0).attr("y", 0)
      .attr("width", iW).attr("height", iH)
      .attr("fill", "url(#frota-gradient)");

    // Barras
    g.selectAll("rect.bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.label)!)
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", 0)
      .attr("fill", d => d.color)
      .attr("opacity", 0.85)
      .attr("rx", 3)
      .transition().duration(500).delay((_, i) => i * 60)
      .attr("width", d => x(d.idade_frota!));

    // COLUNA: Idade média — sempre alinhada à direita da coluna fixa, fora das barras
    g.selectAll("text.idade")
      .data(data)
      .enter().append("text")
      .attr("class", "idade")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", iW + COL_IDADE_W)
      .attr("text-anchor", "end")
      .attr("font-size", 11).attr("font-weight", 700)
      .attr("fill", "#0F172A")            // alto contraste, fora da barra
      .text(d => `${fmtDecimal(d.idade_frota!)} anos`);

    // COLUNA: Frota · Pontualidade — separador visual + dois números
    g.selectAll("text.extra")
      .data(data)
      .enter().append("text")
      .attr("class", "extra")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", iW + COL_IDADE_W + 12)
      .attr("font-size", 10)
      .attr("fill", "#64748B")
      .text(d => `${d.n_aeronaves!.toLocaleString("pt-BR")} aeronaves · ${fmtDecimal(d.pontualidade)}%`);

    // COLUNA: CA vigente — mini bar horizontal + número + semáforo de cor
    const CA_X = iW + COL_IDADE_W + COL_EXTRA_W + 16;
    const CA_BAR_W = COL_CA_W - 4;
    const caColor = (pct: number) =>
      pct >= 80 ? "#16A34A" : pct >= 50 ? "#F59E0B" : "#DC2626";

    g.selectAll("rect.ca-track")
      .data(data.filter(d => d.pct_ca_vigente != null))
      .enter().append("rect")
      .attr("class", "ca-track")
      .attr("x", CA_X).attr("y", d => y(d.label)! + y.bandwidth() / 2 - 3)
      .attr("width", CA_BAR_W).attr("height", 6)
      .attr("rx", 2)
      .attr("fill", "#E2E8F0");

    g.selectAll("rect.ca-fill")
      .data(data.filter(d => d.pct_ca_vigente != null))
      .enter().append("rect")
      .attr("class", "ca-fill")
      .attr("x", CA_X).attr("y", d => y(d.label)! + y.bandwidth() / 2 - 3)
      .attr("width", 0).attr("height", 6)
      .attr("rx", 2)
      .attr("fill", d => caColor(d.pct_ca_vigente!))
      .transition().duration(500).delay((_, i) => i * 60)
      .attr("width", d => (d.pct_ca_vigente! / 100) * CA_BAR_W);

    g.selectAll("text.ca-val")
      .data(data)
      .enter().append("text")
      .attr("class", "ca-val")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 12)
      .attr("x", CA_X)
      .attr("font-size", 9).attr("font-weight", 600)
      .attr("fill", d => d.pct_ca_vigente != null ? caColor(d.pct_ca_vigente) : "#94A3B8")
      .text(d => d.pct_ca_vigente != null ? `${d.pct_ca_vigente.toFixed(0)}%` : "—");

    // COLUNA: Modelo dominante — text truncado pra caber, tooltip nativo com nome completo
    const MOD_X = iW + COL_IDADE_W + COL_EXTRA_W + COL_CA_W + 20;
    const MAX_MOD = 18;
    const truncModelo = (m: string | null) => {
      if (!m) return "—";
      return m.length > MAX_MOD ? m.slice(0, MAX_MOD - 1) + "…" : m;
    };
    g.selectAll("text.modelo")
      .data(data)
      .enter().append("text")
      .attr("class", "modelo")
      .attr("y", d => y(d.label)! + y.bandwidth() / 2 + 4)
      .attr("x", MOD_X)
      .attr("font-size", 10).attr("font-weight", 500)
      .attr("fill", "#334155")
      .text(d => truncModelo(d.modelo_top))
      .append("title")
      .text(d => d.modelo_top ?? "Sem informação");

    // Y axis (labels das empresas)
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(s => s.select(".domain").remove())
      .call(s => s.selectAll("text").attr("font-size", 11).attr("fill", "#334155").attr("dx", -4));

    // X axis
    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(v => `${v} anos`))
      .call(s => s.select(".domain").attr("stroke", "#E2E8F0"))
      .call(s => s.selectAll("text").attr("font-size", 9).attr("fill", "#64748B"));

    // Rótulos das extremidades — só renderiza se houver espaço (iW > 200 px),
    // senão fica embolado. Comprimentos abreviados pra caber em layouts apertados.
    if (iW > 200) {
      svg.append("text")
        .attr("x", ML + 2).attr("y", MT + iH + 22)
        .attr("font-size", 8).attr("font-style", "italic")
        .attr("fill", "#16A34A").text("◀ mais nova");
      svg.append("text")
        .attr("x", ML + iW - 2).attr("y", MT + iH + 22)
        .attr("text-anchor", "end")
        .attr("font-size", 8).attr("font-style", "italic")
        .attr("fill", "#DC2626").text("mais antiga ▶");
    }

    // Marca a empresa "mais nova" com estrela dourada
    const top = data[0];
    if (top) {
      svg.append("text")
        .attr("x", ML - 8)
        .attr("y", MT + y(top.label)! + y.bandwidth() / 2 + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("fill", GOLD)
        .text("★");
    }
  }, [points]);

  return (
    <div ref={wrap} className="w-full">
      <svg ref={ref} id="chart-frota-empresas" className="w-full" />
    </div>
  );
}
