"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from "react";
import type { NetworkData, NetworkNode } from "@/lib/types";

type ColorMode = "airline" | "betweenness" | "degree";

const ANAC_BLUE = "#003F7F";
const GOLD      = "#C89600";

function betweennessColor(v: number): string {
  // blue → gold gradient
  const t = Math.min(1, v * 8);
  const r = Math.round(0 + t * 200);
  const g = Math.round(63 + t * 87);
  const b = Math.round(127 - t * 127);
  return `rgb(${r},${g},${b})`;
}

function degreeColor(v: number, max: number): string {
  const t = max > 0 ? v / max : 0;
  const r = Math.round(0 + t * 94);
  const g = Math.round(63 + t * 87);
  const b = Math.round(127 - t * 127);
  return `rgb(${r},${g},${b})`;
}

export default function NetworkGraph2D({
  data,
  focusAirport,
  onNodeClick,
}: {
  data: NetworkData;
  focusAirport?: string;
  onNodeClick?: (icao: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef  = useRef<{ kill: () => void } | null>(null);

  const [colorMode, setColorMode] = useState<ColorMode>("airline");
  const [nAirports, setNAirports] = useState(60);

  const handleClick = useCallback((icao: string) => {
    onNodeClick?.(icao);
  }, [onNodeClick]);

  // Derived: top-N nodes + their links
  const topNodes = [...data.nodes]
    .sort((a, b) => b.pax - a.pax)
    .slice(0, nAirports);
  const topIds = new Set(topNodes.map(n => n.id));
  const filteredLinks = data.links.filter(
    l => topIds.has(l.source as string) && topIds.has(l.target as string)
  );
  const filteredData: NetworkData = { nodes: topNodes, links: filteredLinks };

  const maxDegree = Math.max(...topNodes.map(n => n.degree ?? 0), 1);

  // Top 5 by degree and betweenness
  const top5degree = [...topNodes]
    .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
    .slice(0, 5);
  const top5between = [...topNodes]
    .sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0))
    .slice(0, 5);

  useEffect(() => {
    if (!containerRef.current || !filteredData.nodes.length) return;

    rendererRef.current?.kill();
    let cancelled = false;

    Promise.all([
      import("graphology"),
      import("graphology-layout-forceatlas2"),
      import("sigma"),
    ]).then(([graphologyModule, fa2Module, sigmaModule]) => {
      if (cancelled || !containerRef.current) return;

      const Graphology  = graphologyModule as any;
      const forceAtlas2 = fa2Module as any;
      const SigmaLib    = sigmaModule as any;

      const GraphClass: new () => any =
        Graphology.UndirectedGraph ?? Graphology.default ?? Graphology;
      const FA2: any  = forceAtlas2.default ?? forceAtlas2;
      const Sigma: new (...a: any[]) => any =
        SigmaLib.Sigma ?? SigmaLib.default;

      const graph = new GraphClass();

      filteredData.nodes.forEach((n: NetworkNode) => {
        let color = n.color;
        if (colorMode === "betweenness") color = betweennessColor(n.betweenness ?? 0);
        else if (colorMode === "degree")  color = degreeColor(n.degree ?? 0, maxDegree);

        const isFocus = n.id === focusAirport;
        graph.addNode(n.id, {
          label:       n.label,
          size:        isFocus ? Math.max(6, n.size * 0.5 + 4) : Math.max(4, n.size * 0.45),
          color:       isFocus ? GOLD : color,
          borderColor: isFocus ? GOLD : undefined,
          x:           Math.random() * 200 - 100,
          y:           Math.random() * 200 - 100,
        });
      });

      const added = new Set<string>();
      filteredData.links.forEach(l => {
        const src = l.source as string;
        const tgt = l.target as string;
        const key = [src, tgt].sort().join("~");
        if (added.has(key)) return;
        if (!graph.hasNode(src) || !graph.hasNode(tgt)) return;
        added.add(key);
        try {
          graph.addEdge(src, tgt, {
            size:  Math.max(0.8, l.value * 0.5),
            color: "rgba(100,116,139,0.35)",
          });
        } catch { /* skip duplicates */ }
      });

      const inferSettings = FA2.inferSettings ?? FA2.default?.inferSettings;
      FA2.assign(graph, {
        iterations: 150,
        settings: {
          ...(inferSettings ? inferSettings(graph) : {}),
          gravity:           1.5,
          scalingRatio:      10,
          strongGravityMode: false,
          slowDown:          4,
          barnesHutOptimize: true,
        },
      });

      const renderer = new Sigma(graph, containerRef.current!, {
        defaultEdgeType:  "line",
        defaultEdgeColor: "rgba(100,116,139,0.35)",
        defaultNodeColor: ANAC_BLUE,
        labelFont:        "Inter, sans-serif",
        labelSize:        9,
        labelWeight:      "600",
        labelColor:       { color: "#334155" },
        renderEdgeLabels: false,
        minCameraRatio:   0.05,
        maxCameraRatio:   10,
        edgeLabelSize:    0,
      });

      renderer.on("clickNode", ({ node }: { node: string }) => handleClick(node));

      rendererRef.current = { kill: () => renderer.kill() };
    });

    return () => {
      cancelled = true;
      rendererRef.current?.kill();
      rendererRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredData.nodes.length, filteredData.links.length, colorMode, focusAirport, handleClick]);

  if (!data || !data.nodes.length) {
    return (
      <div className="flex items-center justify-center h-[520px] text-slate-400 text-sm">
        Sem dados de rede
      </div>
    );
  }

  return (
    <div className="flex gap-0" style={{ height: 520 }}>
      {/* Graph canvas */}
      <div className="relative flex-1 min-w-0">
        <div id="chart-2d" ref={containerRef} className="w-full h-full rounded-bl overflow-hidden bg-slate-50" />
        <div className="absolute bottom-2 left-0 right-0 text-center text-[0.65rem] text-slate-400 pointer-events-none">
          Clique em um nó para selecionar · Scroll para zoom · Arraste para mover
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-[220px] flex-shrink-0 bg-white border-l border-slate-100 rounded-br flex flex-col gap-3 p-3 overflow-y-auto">
        {/* Slider */}
        <div>
          <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Aeroportos
          </div>
          <input
            type="range" min={20} max={Math.min(150, data.nodes.length)} step={5}
            value={nAirports}
            onChange={e => setNAirports(+e.target.value)}
            className="w-full accent-blue-700"
          />
          <div className="text-[0.7rem] text-slate-400 text-right">{nAirports} nós · {filteredLinks.length} arestas</div>
        </div>

        {/* Color toggle */}
        <div>
          <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Cor dos nós
          </div>
          <div className="flex flex-col gap-1">
            {([["airline", "Companhia aérea"], ["betweenness", "Intermediação"], ["degree", "Grau"]] as [ColorMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setColorMode(m)}
                className={`text-left text-[0.72rem] px-2 py-1 rounded transition-colors ${
                  colorMode === m
                    ? "bg-blue-700 text-white font-semibold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Top-5 degree */}
        <div>
          <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Top 5 Grau
          </div>
          <table className="w-full text-[0.68rem]">
            <tbody>
              {top5degree.map((n, i) => (
                <tr key={n.id} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                  <td className="py-0.5 pl-1 font-semibold text-blue-800">{n.label}</td>
                  <td className="py-0.5 pr-1 text-right text-slate-500">{n.degree}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top-5 betweenness */}
        <div>
          <div className="text-[0.7rem] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Top 5 Intermediação
          </div>
          <table className="w-full text-[0.68rem]">
            <tbody>
              {top5between.map((n, i) => (
                <tr key={n.id} className={i % 2 === 0 ? "bg-slate-50" : ""}>
                  <td className="py-0.5 pl-1 font-semibold text-blue-800">{n.label}</td>
                  <td className="py-0.5 pr-1 text-right text-slate-500">{((n.betweenness ?? 0) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
