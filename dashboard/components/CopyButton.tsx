// File: dashboard/components/CopyButton.tsx
"use client";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`copy ${done ? "done" : ""}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      aria-label={`Copy ${value}`}
    >
      {done ? "copied" : "copy"}
    </button>
  );
}
