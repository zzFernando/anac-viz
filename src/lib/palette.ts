/** Paleta categórica — 5 cores distintas usadas em todos os charts do dashboard. */
export const PALETTE = [
  "#003F7F", // azul ANAC
  "#C89600", // dourado
  "#0E7B6E", // teal
  "#B83232", // vermelho
  "#6B3FA0", // roxo
] as const;

/** Cor neutra de UI (grids, eixos, textos). */
export const UI = {
  grid:       "#F1F5F9",
  axisDomain: "#E2E8F0",
  axisText:   "#64748B",
  labelDark:  "#334155",
  labelDim:   "#94A3B8",
  textHi:     "#0F172A",
} as const;

export function paletteColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}
