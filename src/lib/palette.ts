/** Paleta categórica — 5 cores distintas usadas em todos os charts do dashboard. */
export const PALETTE = [
  "#003F7F", // azul ANAC
  "#C89600", // dourado
  "#0E7B6E", // teal
  "#B83232", // vermelho
  "#6B3FA0", // roxo
] as const;

function isDark() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Cor neutra de UI (grids, eixos, textos) — dark-aware via getters. */
export const UI = {
  get grid()       { return isDark() ? "#1E293B" : "#F1F5F9"; },
  get axisDomain() { return isDark() ? "#334155" : "#E2E8F0"; },
  get axisText()   { return isDark() ? "#94A3B8" : "#64748B"; },
  get labelDark()  { return isDark() ? "#CBD5E1" : "#334155"; },
  get labelDim()   { return isDark() ? "#64748B" : "#94A3B8"; },
  get textHi()     { return isDark() ? "#F1F5F9" : "#0F172A"; },
};

export function paletteColor(i: number): string {
  return PALETTE[i % PALETTE.length];
}
