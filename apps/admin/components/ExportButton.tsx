"use client";
import { Download } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@/lib/csv";

export default function ExportButton<T>({ name, rows, columns, label = "Exporter CSV" }: { name: string; rows: T[] | null | undefined; columns: CsvColumn<T>[]; label?: string }) {
  const n = rows?.length ?? 0;
  return (
    <button
      type="button"
      disabled={n === 0}
      onClick={() => rows && downloadCsv(name, rows, columns)}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-grey bg-white px-4 text-sm font-semibold text-charcoal transition hover:border-green/40 hover:text-green disabled:cursor-not-allowed disabled:opacity-40"
      title={n ? `${n} ligne(s)` : "Rien à exporter"}
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
