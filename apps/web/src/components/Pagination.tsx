"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { FOCUS } from "@/components/ui";

type Props = {
  page: number;
  pageCount: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function Pagination({
  page,
  pageCount,
  disabled = false,
  onPageChange,
}: Props) {
  const visible = [...new Set([0, page - 1, page, page + 1, pageCount - 1])]
    .filter((n) => n >= 0 && n < pageCount)
    .sort((a, b) => a - b);
  const pages: (number | "ellipsis")[] = [];
  let previous = -1;

  for (const current of visible) {
    if (current - previous === 2) pages.push(previous + 1);
    else if (current - previous > 2) pages.push("ellipsis");
    pages.push(current);
    previous = current;
  }

  const buttonClass = `inline-flex h-9 min-w-9 items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium tabular-nums transition ${FOCUS}`;

  return (
    <nav aria-label="Navigasi halaman" className="w-full sm:w-auto">
      <ul className="flex items-center justify-center gap-1 sm:justify-end">
        <li>
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            disabled={disabled || page === 0}
            onClick={() => onPageChange(page - 1)}
            className={`${buttonClass} gap-1 border border-[#e6e6e6] px-2 text-[#4a4a4a] hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3`}
          >
            <CaretLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>
        </li>
        {pages.map((item, index) => (
          <li key={`${item}-${index}`}>
            {item === "ellipsis" ? (
              <span className="grid h-9 min-w-7 place-items-center text-sm text-[#8a8a8a]">
                <span aria-hidden="true">…</span>
                <span className="sr-only">Halaman dilewati</span>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Halaman ${item + 1}`}
                aria-current={page === item ? "page" : undefined}
                disabled={disabled}
                onClick={() => onPageChange(item)}
                className={`${buttonClass} px-2 ${
                  page === item
                    ? "bg-[#202020] text-white"
                    : "text-[#4a4a4a] hover:bg-[#f1f1f1]"
                }`}
              >
                {item + 1}
              </button>
            )}
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-label="Halaman berikutnya"
            disabled={disabled || page + 1 >= pageCount}
            onClick={() => onPageChange(page + 1)}
            className={`${buttonClass} gap-1 border border-[#e6e6e6] px-2 text-[#4a4a4a] hover:bg-[#f6f6f6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3`}
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <CaretRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
