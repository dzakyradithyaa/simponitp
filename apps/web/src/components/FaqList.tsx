"use client";

import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { FOCUS, INPUT } from "./ui";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => !k || `${it.q} ${it.a}`.toLowerCase().includes(k));
  }, [items, q]);

  return (
    <div>
      <div className="relative mb-4">
        <MagnifyingGlass
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]"
          aria-hidden="true"
        />
        <input
          className={`${INPUT} pl-9`}
          placeholder="Cari pertanyaan..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Cari pertanyaan"
        />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d9d9d9] px-4 py-8 text-center text-sm text-[#6b6b6b]">
          Tidak ada yang cocok dengan &ldquo;{q}&rdquo;.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map(({ it, i }) => {
            const on = open === i;
            return (
              <li
                key={it.q}
                className={`rounded-xl border bg-white transition-colors duration-300 ${
                  on ? "border-[#D71920]/40" : "border-[#e6e6e6]"
                }`}
              >
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(on ? null : i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left ${FOCUS}`}
                >
                  <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-[#D71920]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-[#202020]">
                    {it.q}
                  </span>
                  <Plus
                    className={`h-4 w-4 shrink-0 text-[#6b6b6b] transition-transform duration-[420ms] ease-apple ${
                      on ? "rotate-45 text-[#D71920]" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-[420ms] ease-apple ${
                    on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p
                      className={`px-4 pb-4 pl-[52px] text-[13px] leading-6 text-[#4a4a4a] transition-opacity duration-300 ${
                        on ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {it.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
