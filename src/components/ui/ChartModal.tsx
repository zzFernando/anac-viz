"use client";
import { useEffect, useRef } from "react";
import type { ChartId } from "@/lib/downloadUtils";
import { ExpandedContext } from "@/lib/expandedContext";

interface Props {
  title:    React.ReactNode;
  children: React.ReactNode;
  chartId?: ChartId;
  onClose:  () => void;
}

export default function ChartModal({ title, children, chartId, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fecha no Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleDownload() {
    if (!chartId) return;
    const { downloadChart } = await import("@/lib/downloadUtils");
    await downloadChart(chartId);
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-card shadow-2xl border border-gray-100 dark:border-slate-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="section-title !mb-0">{title}</div>
          <div className="flex items-center gap-2">
            {chartId && (
              <button
                onClick={handleDownload}
                title="Baixar como PNG"
                className="flex items-center gap-1 text-[0.65rem] font-semibold text-slate-400
                           hover:text-anac-blue dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded
                           hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8 11.31l-3.78-3.78a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1Zm-5.25 9.5a.75.75 0 0 1 .75.75v1.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1.5a.75.75 0 0 1 1.5 0v1.5A2 2 0 0 1 12 15H4a2 2 0 0 1-2-2v-1.5a.75.75 0 0 1 .75-.75Z" />
                </svg>
                PNG
              </button>
            )}
            <button
              onClick={onClose}
              title="Fechar (Esc)"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Conteúdo — cresce para preencher o modal; contexto sinaliza altura expandida */}
        <div className="flex-1 overflow-auto p-4 min-h-0">
          <ExpandedContext.Provider value={true}>
            {children}
          </ExpandedContext.Provider>
        </div>
      </div>
    </div>
  );
}
