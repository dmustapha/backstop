// File: dashboard/components/Reveal.tsx
// Mounts once (in layout). Reveals .io exhibits on scroll, and picks up
// streamed cards added later via a MutationObserver. Reduced-motion: CSS already
// forces .io opacity:1, so this is purely additive.
"use client";
import { useEffect } from "react";

export function Reveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("seen");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const observeAll = () =>
      document.querySelectorAll(".io:not(.seen)").forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
