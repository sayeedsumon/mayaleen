"use client";

import { useState } from "react";

export function CopyButton({ text, label, done }: { text: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" aria-live="polite"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* clipboard blocked */ } }}
      className="h-[34px] rounded-lg border border-field bg-white px-2.5 text-[13px] font-semibold text-ink">
      {ok ? done : label}
    </button>
  );
}
