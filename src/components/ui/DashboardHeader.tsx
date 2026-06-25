"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Database,
  ExternalLink,
  Github,
  Instagram,
  Mail,
  PlaneTakeoff,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

function HeaderLink({
  icon: Icon,
  href,
  children,
}: {
  icon: LucideIcon;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[0.68rem] font-medium text-blue-50/85 transition-colors hover:border-white/35 hover:bg-white/15 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2.2} aria-hidden="true" />
      <span>{children}</span>
    </a>
  );
}

export default function DashboardHeader() {
  return (
    <div
      className="relative overflow-hidden rounded-card border border-white/10 px-5 py-4 shadow-lift"
      style={{ background: "linear-gradient(125deg, #001B45 0%, #003F7F 48%, #0066CC 100%)" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-yellow-100">
              <PlaneTakeoff className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              ANAC Vis
            </span>
            <a
              href="https://sistemas.anac.gov.br/dadosabertos/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold text-blue-100/90 transition-colors hover:border-white/35 hover:bg-white/15 hover:text-white"
            >
              <Database className="h-3.5 w-3.5 text-gold" strokeWidth={2.2} aria-hidden="true" />
              Fonte: dados abertos ANAC
              <ExternalLink className="h-3 w-3 text-blue-100/70" strokeWidth={2.2} aria-hidden="true" />
            </a>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-blue-100/80">
              <CalendarDays className="h-3.5 w-3.5 text-gold" strokeWidth={2.2} aria-hidden="true" />
              2000–2026
            </span>
            <HeaderLink href="https://github.com/zzfernando" icon={Github}>
              github.com/zzfernando
            </HeaderLink>
            <HeaderLink href="https://instagram.com/voltekavinsky" icon={Instagram}>
              @voltekavinsky
            </HeaderLink>
            <HeaderLink href="mailto:fernando.kavinsky@ufrgs.br" icon={Mail}>
              fernando.kavinsky@ufrgs.br
            </HeaderLink>
            <HeaderLink href="mailto:fernando.silveira@inf.ufrgs.br" icon={Mail}>
              fernando.silveira@inf.ufrgs.br
            </HeaderLink>
          </div>

          <h1 className="mt-2 text-xl font-bold leading-tight text-white md:text-2xl">
            Panorama da Aviação Doméstica Brasileira
          </h1>

          <div className="mt-1 max-w-3xl text-sm leading-relaxed text-blue-100/85">
            Dados públicos da ANAC sobre voos domésticos regulares, rotas,
            pontualidade, frota e segurança operacional.
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
