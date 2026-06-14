// File: dashboard/components/Nav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Seal } from "./Seal";

const LINKS = [
  { href: "/console", label: "Console" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/proof", label: "Proof" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="masthead sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Backstop home">
          <Seal size={30} glyphSize={15} />
          <span className="serif text-[1.35rem] leading-none">Backstop</span>
        </Link>
        <nav className="hidden items-center gap-7 sm:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const active = path === l.href || (l.href !== "/" && path.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href} className="navlink" aria-current={active ? "page" : undefined}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span className="pill pill-seal hidden md:inline-flex">veto-only co-signer</span>
      </div>
    </header>
  );
}
