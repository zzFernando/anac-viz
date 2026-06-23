"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { ChartId } from "@/lib/downloadUtils";

const ChartModal = dynamic(() => import("./ChartModal"), { ssr: false });

interface SectionCardProps {
  title:       React.ReactNode;
  /** Slot opcional à direita do título (ex: tabs, toggles). */
  actions?:    React.ReactNode;
  children:    React.ReactNode;
  className?:  string;
  chartId?:    ChartId;
}

export default function SectionCard({ title, actions, children, className = "", chartId }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  async function handleDownload() {
    if (!chartId) return;
    const { downloadChart } = await import("@/lib/downloadUtils");
    await downloadChart(chartId);
  }

  return (
    <>
      <div className={`bg-white dark:bg-slate-800 rounded-card shadow-card border border-gray-100 dark:border-slate-700 p-3 flex flex-col ${className}`}>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap shrink-0">
          <div className="section-title !mb-0">{title}</div>
          <div className="flex items-center gap-2">
            {actions}
            {/* Expand */}
            <button
              onClick={() => setExpanded(true)}
              title="Expandir"
              className="flex items-center gap-1 text-[0.65rem] font-semibold text-slate-400
                         hover:text-anac-blue dark:hover:text-blue-400 transition-colors px-1.5 py-0.5 rounded
                         hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent hover:border-gray-200 dark:hover:border-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M1.75 1h4a.75.75 0 0 1 0 1.5H3.56l3.22 3.22a.75.75 0 0 1-1.06 1.06L2.5 3.56v2.19a.75.75 0 0 1-1.5 0v-4C1 1.336 1.336 1 1.75 1Zm8.5 0h4c.414 0 .75.336.75.75v4a.75.75 0 0 1-1.5 0V3.56l-3.22 3.22a.75.75 0 1 1-1.06-1.06L12.44 2.5h-2.19a.75.75 0 0 1 0-1.5Zm-6.56 8.28a.75.75 0 0 1 1.06 1.06L2.5 12.44h2.19a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 1 13.25v-4a.75.75 0 0 1 1.5 0v2.19l2.19-2.16ZM13.5 9.25a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-.75.75h-4a.75.75 0 0 1 0-1.5h2.19l-3.22-3.22a.75.75 0 1 1 1.06-1.06l3.22 3.22V9.25Z" />
              </svg>
            </button>
            {/* Download PNG */}
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
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>

      {expanded && (
        <ChartModal title={title} chartId={chartId} onClose={() => setExpanded(false)}>
          {children}
        </ChartModal>
      )}
    </>
  );
}
