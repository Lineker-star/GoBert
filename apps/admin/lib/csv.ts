/** Builds a CSV file (Excel-friendly: UTF-8 BOM, semicolons for French locales) and downloads it. */
export type CsvColumn<T> = { label: string; value: (row: T) => string | number | boolean | null | undefined };

function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Neutralise spreadsheet formulas typed into user-controlled fields (CSV injection).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.label)).join(";");
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"));
  return [head, ...body].join("\r\n");
}

export function downloadCsv<T>(name: string, rows: T[], columns: CsvColumn<T>[]) {
  const blob = new Blob(["﻿", toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
