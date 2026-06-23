"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { FiltersData } from "@/lib/types";

interface Props {
  filters: FiltersData | undefined;
  anoIni: number;
  anoFim: number;
  aeroporto: string;
  setAnoIni: (v: number) => void;
  setAnoFim: (v: number) => void;
  setAeroporto: (v: string) => void;
  nomeAeroporto?: string;
}

export default function FiltersBar({
  filters, anoIni, anoFim, aeroporto,
  setAnoIni, setAnoFim, setAeroporto, nomeAeroporto,
}: Props) {
  const anoMin = filters?.ano_min ?? 2000;
  const anoMax = filters?.ano_max ?? 2026;
  const anos   = Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i);
  const aeroportos = filters?.aeroportos ?? [];
  const selectedAirport = aeroportos.find(a => a.value === aeroporto);
  const selectedLabel = selectedAirport?.label
    ?? [aeroporto, nomeAeroporto].filter(Boolean).join(" · ");

  return (
    <div className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-slate-700 -mx-3 md:-mx-5 px-3 md:px-5 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 md:gap-5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Período</span>
          <select
            value={anoIni}
            onChange={e => setAnoIni(Math.min(+e.target.value, anoFim - 1))}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 dark:text-slate-200 rounded-md text-sm px-2 py-1 focus:outline-none focus:border-anac-light"
          >
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-slate-400 dark:text-slate-500">→</span>
          <select
            value={anoFim}
            onChange={e => setAnoFim(Math.max(+e.target.value, anoIni + 1))}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 dark:text-slate-200 rounded-md text-sm px-2 py-1 focus:outline-none focus:border-anac-light"
          >
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <span className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Aeroporto</span>
          <AirportCombobox
            airports={aeroportos}
            value={aeroporto}
            selectedLabel={selectedLabel}
            onChange={setAeroporto}
          />
        </div>

        {nomeAeroporto && (
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{nomeAeroporto}</span>
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
            <span>{anoIni}–{anoFim}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type AirportOption = FiltersData["aeroportos"][number];

interface AirportComboboxProps {
  airports: AirportOption[];
  value: string;
  selectedLabel: string;
  onChange: (value: string) => void;
}

function AirportCombobox({ airports, value, selectedLabel, onChange }: AirportComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedDisplay = formatAirport(selectedLabel, value);
  const results = useMemo(() => {
    const q = normalize(query);
    const terms = q.split(/\s+/).filter(Boolean);

    return airports
      .map((airport) => ({
        airport,
        score: scoreAirport(airport, terms, q, value),
      }))
      .filter(item => item.score < 100)
      .sort((a, b) => a.score - b.score || a.airport.label.localeCompare(b.airport.label, "pt-BR"))
      .slice(0, 12)
      .map(item => item.airport);
  }, [airports, query, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function choose(airport: AirportOption) {
    onChange(airport.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-[220px] max-w-[460px]">
      <div className={`flex h-8 items-center gap-2 rounded-md border bg-white dark:bg-slate-800 px-2 text-sm transition-colors
        ${open ? "border-anac-light ring-2 ring-anac-light/10" : "border-gray-200 dark:border-slate-600"}`}
      >
        <Search size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={formatAirportLine(selectedDisplay)}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="airport-results"
        />
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            inputRef.current?.focus();
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Abrir lista de aeroportos"
        >
          <ChevronsUpDown size={15} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div
          id="airport-results"
          role="listbox"
          className="absolute left-0 right-0 top-9 z-50 max-h-80 overflow-auto rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lift"
        >
          {results.length > 0 ? results.map((airport, index) => {
            const display = formatAirport(airport.label, airport.value, airport);
            const selected = airport.value === value;
            const active = index === activeIndex;

            return (
              <button
                key={airport.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(airport)}
                className={`grid w-full grid-cols-[4.2rem_2.2rem_minmax(0,1fr)_1.4rem] items-center gap-2 px-3 py-2 text-left text-sm
                  ${active ? "bg-slate-50 dark:bg-slate-700" : "bg-white dark:bg-slate-800"}
                  ${selected ? "text-anac-blue dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}
              >
                <span className="font-mono text-[0.8rem] font-bold tracking-wide">{display.code}</span>
                <span className="text-[0.72rem] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{display.uf || "—"}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{display.cidade || "—"}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{display.nome || "—"}</span>
                </span>
                {selected && <Check size={15} className="text-anac-blue dark:text-blue-400" aria-hidden="true" />}
              </button>
            );
          }) : (
            <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">Nenhum aeroporto encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreAirport(airport: AirportOption, terms: string[], query: string, selectedValue: string): number {
  const code = normalize(airport.icao || airport.value);
  const uf = normalize(airport.uf);
  const cidade = normalize(airport.cidade);
  const nome = normalize(airport.nome);
  const label = normalize(airport.label);
  const haystack = `${code} ${uf} ${cidade} ${nome} ${label}`;

  if (!query) return airport.value === selectedValue ? 0 : 20;
  if (!terms.every(term => haystack.includes(term))) return 100;
  if (code === query) return 1;
  if (code.startsWith(query)) return 2;
  if (uf === query) return 3;
  if (cidade.startsWith(query)) return 4;
  if (nome.startsWith(query)) return 5;
  return 10;
}

function formatAirport(label: string, fallbackCode: string, airport?: Partial<AirportOption>) {
  if (airport) {
    return {
      code: airport.icao || airport.value || fallbackCode,
      uf: airport.uf || "",
      cidade: airport.cidade || "",
      nome: airport.nome || "",
    };
  }

  const parts = label.split("·").map(part => part.trim());
  const [maybeCode, maybeUf, maybeCidade, ...nameParts] = parts;
  const code = /^[A-Z]{4}$/.test(maybeCode) ? maybeCode : fallbackCode;
  const uf = /^[A-Z]{2}$/.test(maybeUf) ? maybeUf : "";
  const cidade = uf ? (maybeCidade ?? "") : "";
  const nome = uf ? nameParts.join(" · ").trim() : parts.slice(1).join(" · ").trim();

  return { code, uf, cidade, nome };
}

function formatAirportLine(airport: ReturnType<typeof formatAirport>) {
  return [airport.code, airport.uf, airport.cidade, airport.nome].filter(Boolean).join(" · ");
}
