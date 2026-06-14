// File: dashboard/components/Seal.tsx
// The gold wax seal — pure-CSS, reused across nav, hero, sandbox idle, footer.
import type { CSSProperties } from "react";

export function Seal({
  size = 96,
  glyph = "§",
  glyphSize,
  withArc = false,
  arcTop = "BACKSTOP · GUARDIAN",
  arcBot = "CO·SIGNER · 5003",
  className = "",
  style,
}: {
  size?: number;
  glyph?: string;
  glyphSize?: number;
  withArc?: boolean;
  arcTop?: string;
  arcBot?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={`seal ${className}`} style={{ ["--s" as string]: `${size}px`, ...style } as CSSProperties}>
      <span className="sheen" aria-hidden="true" />
      {withArc && (
        <svg className="arc" viewBox="0 0 128 128" aria-hidden="true">
          <defs>
            <path id="arcTop" d="M 18 64 A 46 46 0 0 1 110 64" />
            <path id="arcBot" d="M 110 70 A 44 44 0 0 1 18 70" />
          </defs>
          <text>
            <textPath href="#arcTop" startOffset="50%" textAnchor="middle">{arcTop}</textPath>
          </text>
          <text>
            <textPath href="#arcBot" startOffset="50%" textAnchor="middle">{arcBot}</textPath>
          </text>
        </svg>
      )}
      <span className="glyph" style={glyphSize ? { fontSize: `${glyphSize}px` } : undefined}>{glyph}</span>
    </span>
  );
}
