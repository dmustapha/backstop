// File: dashboard/app/layout.tsx
import type { Metadata } from "next";
import { DM_Serif_Display, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "../components/Nav";
import { Seal } from "../components/Seal";
import { Reveal } from "../components/Reveal";

const serif = DM_Serif_Display({ weight: ["400"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = IBM_Plex_Sans({ weight: ["400", "500", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Backstop — the AI that judges another AI",
  description: "A veto-only on-chain co-signer: simulates every transaction an autonomous agent makes on live Mantle, co-signs the safe ones, and vetoes the drainers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="grain" aria-hidden="true" />
        <Reveal />
        <Nav />
        <main className="relative z-10">{children}</main>
        <footer className="rule relative z-10">
          <div className="mx-auto flex max-w-[1140px] flex-wrap items-center justify-between gap-4 px-6 py-12">
            <div className="flex items-center gap-3">
              <Seal size={26} glyphSize={13} />
              <span className="text-[.82rem]" style={{ color: "var(--ink-dim)" }}>
                Backstop · veto-only on-chain co-signer · Mantle Sepolia · chainId 5003
              </span>
            </div>
            <span className="mono text-[.72rem]" style={{ color: "var(--ink-faint)" }}>
              sepolia.mantlescan.xyz · chainId 5003
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
