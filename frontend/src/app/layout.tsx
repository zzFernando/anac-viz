import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Panorama da Aviação Doméstica — ANAC",
  description: "Dashboard executivo de aviação doméstica brasileira · Dados Abertos ANAC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-surface font-sans antialiased">{children}</body>
    </html>
  );
}
