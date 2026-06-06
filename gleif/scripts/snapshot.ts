#!/usr/bin/env bun
import { Database } from "bun:sqlite";
import { normalizeCompanyName } from "../src/index";

/**
 * Build a compact SQLite snapshot of GLEIF LEI records for offline, rate-limit-
 * free company resolution by @absolutejs/dataset-gleif.
 *
 * INPUT is a GLEIF "Golden Copy" LEI2 file (Level 1) — the full ~2.7M-entity
 * dump, as the CSV, or a .zip containing it. Download it yourself from
 * https://goldencopy.gleif.org (it is CC0; their bulk host WAF-blocks many
 * data-center IPs, which is why this tool does NOT fetch it for you), then:
 *
 *   bun run scripts/snapshot.ts <golden-copy.csv | golden-copy.zip> [out.sqlite]
 *
 * Point the adapter at the result: gleifSource({ snapshotPath: "out.sqlite" }).
 */

const COLUMNS = {
  country: "Entity.LegalAddress.Country",
  lei: "LEI",
  name: "Entity.LegalName",
  status: "Entity.EntityStatus",
};
const BATCH_SIZE = 10_000;
const PROGRESS_EVERY = 100_000;

// Streaming RFC-4180 CSV parser (handles quoted fields, "" escapes, CRLF, and
// quotes/newlines that straddle chunk boundaries).
async function* csvRows(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let quotePending = false;
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    for (const char of text) {
      if (quotePending) {
        quotePending = false;
        if (char === '"') {
          field += '"';
          inQuotes = true;
          continue;
        }
        inQuotes = false;
      }
      if (inQuotes) {
        if (char === '"') quotePending = true;
        else field += char;
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        yield row;
        field = "";
        row = [];
      } else if (char !== "\r") {
        field += char;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    yield row;
  }
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "gleif-snapshot.sqlite";
if (!inputPath) {
  console.error(
    "usage: bun run scripts/snapshot.ts <golden-copy.csv|.zip> [out.sqlite]",
  );
  process.exit(1);
}

const source: ReadableStream<Uint8Array> = inputPath.endsWith(".zip")
  ? Bun.spawn(["unzip", "-p", inputPath]).stdout
  : Bun.file(inputPath).stream();

const db = new Database(outputPath, { create: true });
db.run("PRAGMA journal_mode = WAL");
db.run("DROP TABLE IF EXISTS company");
db.run(
  "CREATE TABLE company (lei TEXT PRIMARY KEY, name TEXT NOT NULL, norm_name TEXT NOT NULL, country TEXT, status TEXT)",
);
const insert = db.query(
  "INSERT OR REPLACE INTO company (lei, name, norm_name, country, status) VALUES (?1, ?2, ?3, ?4, ?5)",
);
const insertBatch = db.transaction((batch: string[][]) => {
  for (const values of batch) insert.run(...values);
});

let cols: {
  lei: number;
  name: number;
  country: number;
  status: number;
} | null = null;
let batch: string[][] = [];
let total = 0;

const flush = () => {
  if (batch.length > 0) {
    insertBatch(batch);
    batch = [];
  }
};

for await (const row of csvRows(source)) {
  if (!cols) {
    const map: Record<string, number> = {};
    row.forEach((column, index) => {
      map[column.replace(/^﻿/, "").trim()] = index;
    });
    const lei = map[COLUMNS.lei];
    const name = map[COLUMNS.name];
    if (lei === undefined || name === undefined) {
      console.error(
        `Missing required columns. Found headers: ${row.slice(0, 8).join(", ")}…`,
      );
      process.exit(1);
    }
    cols = {
      country: map[COLUMNS.country] ?? -1,
      lei,
      name,
      status: map[COLUMNS.status] ?? -1,
    };
    continue;
  }
  const lei = row[cols.lei]?.trim();
  const name = row[cols.name]?.trim();
  if (!lei || !name) continue;
  batch.push([
    lei,
    name,
    normalizeCompanyName(name),
    cols.country >= 0 ? (row[cols.country]?.trim() ?? "") : "",
    cols.status >= 0 ? (row[cols.status]?.trim() ?? "") : "",
  ]);
  total += 1;
  if (batch.length >= BATCH_SIZE) flush();
  if (total % PROGRESS_EVERY === 0) {
    console.log(`  ${total.toLocaleString()} rows…`);
  }
}
flush();

console.log("Indexing…");
db.run("CREATE INDEX idx_company_norm_name ON company(norm_name)");
db.run("PRAGMA wal_checkpoint(TRUNCATE)");
db.close();
console.log(`Done — ${total.toLocaleString()} entities → ${outputPath}`);
