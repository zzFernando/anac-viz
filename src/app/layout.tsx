import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panorama da Aviação Doméstica — ANAC",
  description: "Painel público sobre voos domésticos, aeroportos, empresas e frota no Brasil.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-surface font-sans antialiased">{children}</body>
    </html>
  );
}
