"use client";

const SCALE = 2; // 2× resolução para PNG nítido

async function svgToPng(svgEl: SVGSVGElement, filename: string): Promise<void> {
  const W = svgEl.clientWidth  || parseInt(svgEl.getAttribute("width")  || "800");
  const H = svgEl.clientHeight || parseInt(svgEl.getAttribute("height") || "400");

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width",  String(W));
  clone.setAttribute("height", String(H));

  // Fundo branco para PNG
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "white");
  clone.insertBefore(bg, clone.firstChild);

  // Embedar fontes básicas para o texto ficar legível sem rede
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `text { font-family: Arial, Helvetica, sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = W * SCALE;
      canvas.height = H * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(SCALE, SCALE);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) triggerDownload(URL.createObjectURL(pngBlob), `${filename}.png`);
        resolve();
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  });
}

async function canvasToPng(container: HTMLElement, filename: string): Promise<void> {
  const canvas = container.querySelector("canvas");
  if (!canvas) return;
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(URL.createObjectURL(blob), `${filename}.png`);
      resolve();
    }, "image/png");
  });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export type ChartId =
  | "chart-hero"
  | "chart-serie"
  | "chart-heatmap"
  | "chart-scatter"
  | "chart-bar"
  | "chart-frota-fabricantes"
  | "chart-frota-modelos"
  | "chart-frota-empresas"
  | "chart-ata"
  | "chart-ads"
  | "chart-ocorr-fase"
  | "chart-ocorrmap";

const CHART_LABELS: Record<ChartId, string> = {
  "chart-hero":              "mapa_panorama",
  "chart-serie":             "serie_temporal",
  "chart-heatmap":           "heatmap_atrasos",
  "chart-scatter":           "participacao_pontualidade",
  "chart-bar":               "top_rotas",
  "chart-frota-fabricantes": "frota_fabricantes",
  "chart-frota-modelos":     "frota_modelos",
  "chart-frota-empresas":    "frota_empresas",
  "chart-ata":               "sdr_componentes_ata",
  "chart-ads":               "regras_assuntos",
  "chart-ocorr-fase":        "ocorrencias_fase",
  "chart-ocorrmap":          "ocorrencias_mapa",
};

export async function downloadChart(chartId: ChartId): Promise<void> {
  const el = document.getElementById(chartId);
  if (!el) return;
  const filename = CHART_LABELS[chartId];

  if (el instanceof SVGSVGElement) {
    await svgToPng(el, filename);
  } else {
    // canvas container (3D / 2D graph)
    await canvasToPng(el as HTMLElement, filename);
  }
}

export async function downloadAllCharts(): Promise<void> {
  const ids: ChartId[] = [
    "chart-hero", "chart-serie", "chart-bar",
    "chart-heatmap", "chart-scatter",
    "chart-frota-fabricantes", "chart-frota-modelos", "chart-frota-empresas",
    "chart-ata", "chart-ads", "chart-ocorr-fase", "chart-ocorrmap",
  ];

  for (const id of ids) {
    await downloadChart(id);
    // Pequeno delay para o browser não bloquear múltiplos downloads
    await new Promise((r) => setTimeout(r, 400));
  }
}
