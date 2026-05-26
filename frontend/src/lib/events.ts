/**
 * Eventos contextuais que afetam a leitura dos gráficos (COVID, enchentes RS etc).
 * Centralizado aqui pra que SerieTemporal, Sparkline e Heatmap leiam da mesma fonte.
 */

export interface ContextualEvent {
  /** Data de início — formato YYYY-MM-DD */
  date:    string;
  /** Data de fim opcional, para faixas temporais (ex: período de pico da COVID) */
  dateEnd?: string;
  label:   string;
  short:   string;          // versão curta para sparkline / espaço limitado
  color:   string;
  scope:   "national" | "regional";
  /** Lista de ICAOs afetados se scope = regional */
  airports?: string[];
}

export const CONTEXTUAL_EVENTS: ContextualEvent[] = [
  {
    date: "2020-03-01",
    dateEnd: "2021-09-01",
    label: "COVID-19",
    short: "COVID",
    color: "#DC2626",
    scope: "national",
  },
  {
    date: "2024-05-01",
    dateEnd: "2025-01-01",
    label: "Enchentes RS",
    short: "Enchentes RS",
    color: "#EA580C",
    scope: "regional",
    airports: ["SBPA", "SBCX", "SBNF", "SBCO", "SBPK", "SBSM"],
  },
];

/**
 * Retorna os eventos que se aplicam ao aeroporto: nacionais sempre,
 * regionais só se o ICAO estiver na lista do evento.
 */
export function eventsForAirport(icao: string): ContextualEvent[] {
  return CONTEXTUAL_EVENTS.filter(e =>
    e.scope === "national" ||
    (e.scope === "regional" && e.airports?.includes(icao))
  );
}

/** Eventos dentro de uma janela temporal (intersecção qualquer). */
export function eventsInRange(
  events: ContextualEvent[],
  startDate: string,
  endDate: string,
): ContextualEvent[] {
  return events.filter(e => {
    const eStart = e.date;
    const eEnd   = e.dateEnd ?? e.date;
    return !(eEnd < startDate || eStart > endDate);
  });
}
