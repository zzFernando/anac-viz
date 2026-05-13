import type { ChartId } from "@/lib/downloadUtils";

interface SectionCardProps {
  title:       string;
  children:    React.ReactNode;
  className?:  string;
  chartId?:    ChartId;
}

export default function SectionCard({ title, children, className = "", chartId }: SectionCardProps) {
  async function handleDownload() {
    if (!chartId) return;
    const { downloadChart } = await import("@/lib/downloadUtils");
    await downloadChart(chartId);
  }

  return (
    <div className={`bg-white rounded-card shadow-card border border-gray-100 p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="section-title !mb-0">{title}</div>
        {chartId && (
          <button
            onClick={handleDownload}
            title="Baixar como PNG"
            className="flex items-center gap-1 text-[0.65rem] font-semibold text-slate-400
                       hover:text-anac-blue transition-colors px-1.5 py-0.5 rounded
                       hover:bg-slate-50 border border-transparent hover:border-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8 11.31l-3.78-3.78a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1Zm-5.25 9.5a.75.75 0 0 1 .75.75v1.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-1.5a.75.75 0 0 1 1.5 0v1.5A2 2 0 0 1 12 15H4a2 2 0 0 1-2-2v-1.5a.75.75 0 0 1 .75-.75Z" />
            </svg>
            PNG
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
