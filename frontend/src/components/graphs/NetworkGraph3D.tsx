"use client";
import dynamic from "next/dynamic";
import { useRef, useEffect, useCallback, useState } from "react";
import type { NetworkData, NetworkNode } from "@/lib/types";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[520px] text-slate-400 text-sm">
      Carregando grafo 3D…
    </div>
  ),
});

export default function NetworkGraph3D({
  data,
  focusAirport,
  onNodeClick,
}: {
  data: NetworkData;
  focusAirport?: string;
  onNodeClick?: (icao: string) => void;
}) {
  const fgRef = useRef<unknown>(null);
  const rafRef = useRef<number | null>(null);
  const interactingRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Determine top-10 by degree for labels
  const top10ids = new Set(
    [...data.nodes]
      .sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0))
      .slice(0, 10)
      .map(n => n.id)
  );

  // Auto-rotation
  useEffect(() => {
    if (!ready || !fgRef.current) return;
    const fg = fgRef.current as {
      scene?: () => { rotation: { y: number } };
      camera?: () => { position: { x: number; y: number; z: number }; lookAt: (x:number,y:number,z:number)=>void };
    };

    const animate = () => {
      if (!interactingRef.current && fg.camera && fg.scene) {
        const cam = fg.camera();
        const angle = Date.now() * 0.0003;
        const dist = Math.sqrt(cam.position.x ** 2 + cam.position.z ** 2);
        cam.position.x = dist * Math.sin(angle);
        cam.position.z = dist * Math.cos(angle);
        cam.lookAt(0, 0, 0);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready]);

  // Configure forces after mount
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current as {
      d3Force: (name: string) => unknown;
      d3ReheatSimulation?: () => void;
    };
    const timer = setTimeout(() => {
      try {
        // Strong repulsion to spread nodes
        const charge = fg.d3Force("charge") as { strength?: (v: number) => void } | null;
        charge?.strength?.(-500);
        // Comfortable link distance
        const link = fg.d3Force("link") as { distance?: (v: number) => void } | null;
        link?.distance?.(100);
        fg.d3ReheatSimulation?.();
        setTimeout(() => setReady(true), 2500);
      } catch {
        setReady(true);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [data]);

  const handleNodeClick = useCallback((node: unknown) => {
    const n = node as { id?: string };
    if (n?.id) onNodeClick?.(n.id);
    interactingRef.current = true;
    setTimeout(() => { interactingRef.current = false; }, 4000);
  }, [onNodeClick]);

  const handleNodeDrag = useCallback(() => { interactingRef.current = true; }, []);

  if (!data || !data.nodes.length) {
    return (
      <div className="flex items-center justify-center h-[520px] text-slate-400 text-sm">
        Sem dados de rede
      </div>
    );
  }

  return (
    <div id="chart-3d" style={{ background: "#0D1117", borderRadius: "0 0 0.6rem 0.6rem", overflow: "hidden" }}>
      <ForceGraph3D
        ref={fgRef as never}
        graphData={data}
        backgroundColor="#0D1117"
        nodeId="id"
        nodeLabel={(n: unknown) => {
          const node = n as NetworkNode;
          return `${node.label} — ${node.empresa}\n${(node.pax / 1e6).toFixed(1)} M pax`;
        }}
        nodeColor={(n: unknown) => {
          const node = n as NetworkNode;
          if (node.id === focusAirport) return "#C89600";
          return node.color;
        }}
        nodeVal={(n: unknown) => (n as { size: number }).size}
        nodeOpacity={0.92}
        nodeThreeObjectExtend={false}
        nodeThreeObject={(n: unknown) => {
          const node = n as NetworkNode;
          if (!top10ids.has(node.id) && node.id !== focusAirport) return null;
          try {
            // Dynamically import SpriteText
            const SpriteText = require("three-spritetext").default;
            const sprite = new SpriteText(node.label);
            sprite.color = node.id === focusAirport ? "#C89600" : "#F1F5F9";
            sprite.textHeight = node.id === focusAirport ? 5 : 4;
            sprite.backgroundColor = "rgba(0,0,0,0.55)";
            sprite.padding = 1.5;
            sprite.borderRadius = 2;
            return sprite;
          } catch {
            return null;
          }
        }}
        linkWidth={(l: unknown) => Math.max(0.3, (l as { value: number }).value * 0.4)}
        linkColor={() => "rgba(148,163,184,0.55)"}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.4}
        linkDirectionalParticleColor={(l: unknown) => {
          const link = l as { source: unknown };
          const src = link.source as { color?: string };
          return src?.color ?? "#94A3B8";
        }}
        linkDirectionalParticleSpeed={0.004}
        linkOpacity={0.6}
        onNodeClick={handleNodeClick}
        onNodeDrag={handleNodeDrag}
        enableNodeDrag={true}
        width={typeof window !== "undefined" ? Math.min(window.innerWidth - 48, 1400) : 900}
        height={520}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        showNavInfo={false}
        rendererConfig={{ antialias: true }}
      />
      <div className="text-center text-[0.65rem] text-slate-500 py-1 bg-[#0D1117]">
        Clique em um nó para selecionar o aeroporto · Arraste para explorar · Scroll para zoom
      </div>
    </div>
  );
}
