#!/usr/bin/env bun
/**
 * Genererer docs/cross-reference.md — krydsreferencer mellem DB og UI.
 *
 * For ekstern AI er dette guld: "hvis jeg ændrer tabel X eller RPC Y,
 * hvilke hooks/sider/komponenter knækker?"
 *
 * Indhold:
 *  - Tabel → hvilke filer rører den (.from())
 *  - RPC → hvilke filer kalder den (.rpc())
 *  - Edge function → hvilke filer invoker den (functions.invoke())
 *  - Realtime channel → subscribers
 *  - Hook → hvor bruges den (importeret fra)
 *
 * Kør: bun run scripts/generate-cross-reference.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";

const OUT = "docs/cross-reference.md";

interface FileInfo {
  path: string;
  content: string;
}

function walk(dir: string, filter: (p: string) => boolean): FileInfo[] {
  const out: FileInfo[] = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e);
      let s;
      try {
        s = statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) stack.push(full);
      else if (filter(full)) {
        try {
          out.push({ path: full, content: readFileSync(full, "utf8") });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return out;
}

const isTsx = (p: string) => /\.(tsx?|jsx?)$/.test(p);
const allFiles = walk("src", isTsx);
const edgeFiles = walk("supabase/functions", (p) => /index\.tsx?$/.test(p));

// ---------- Build indexes ----------

const tableUsage: Record<string, Set<string>> = {};
const rpcUsage: Record<string, Set<string>> = {};
const edgeUsage: Record<string, Set<string>> = {};
const channelUsage: Record<string, Set<string>> = {};

for (const f of allFiles) {
  const rel = relative(".", f.path);
  for (const m of f.content.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) {
    (tableUsage[m[1]] ||= new Set()).add(rel);
  }
  for (const m of f.content.matchAll(/\.rpc\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) {
    (rpcUsage[m[1]] ||= new Set()).add(rel);
  }
  for (const m of f.content.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9_-]+)["'`]/gi)) {
    (edgeUsage[m[1]] ||= new Set()).add(rel);
  }
  for (const m of f.content.matchAll(/\.channel\(\s*["'`]([^"'`]+)["'`]/gi)) {
    (channelUsage[m[1]] ||= new Set()).add(rel);
  }
}

// Edge functions can also call tables — index them too
for (const f of edgeFiles) {
  const rel = relative(".", f.path);
  for (const m of f.content.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) {
    (tableUsage[m[1]] ||= new Set()).add(rel);
  }
  for (const m of f.content.matchAll(/\.rpc\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) {
    (rpcUsage[m[1]] ||= new Set()).add(rel);
  }
}

// Hook imports
const hookFiles = walk("src/hooks", isTsx);
const hookNames = new Set<string>();
for (const h of hookFiles) {
  const name = basename(h.path, extname(h.path));
  if (/^use[A-Z]/.test(name)) hookNames.add(name);
}

const hookUsage: Record<string, Set<string>> = {};
for (const f of allFiles) {
  const rel = relative(".", f.path);
  for (const hookName of hookNames) {
    const re = new RegExp(`\\b${hookName}\\b`);
    if (re.test(f.content) && !f.path.endsWith(`${hookName}.ts`) && !f.path.endsWith(`${hookName}.tsx`)) {
      (hookUsage[hookName] ||= new Set()).add(rel);
    }
  }
}

// ---------- Render ----------

const lines: string[] = [];
const push = (s = "") => lines.push(s);

push("# Cross-reference");
push();
push(`Auto-genereret: ${new Date().toISOString()}`);
push();
push("Kortlægger afhængigheder mellem DB-laget og UI-laget. Brug denne fil for at besvare:");
push("- *\"Hvis jeg ændrer tabel X — hvilke hooks/sider knækker?\"*");
push("- *\"Hvor bliver RPC Y kaldt fra?\"*");
push("- *\"Hvilke komponenter bruger hook Z?\"*");
push();
push("**Tæller både frontend (`src/`) og edge functions (`supabase/functions/`).**");
push();
push("---");
push();

// ===== TABLES =====
push("## 1. Tabel → Forbrugere");
push();
const sortedTables = Object.keys(tableUsage).sort();
push(`Total: **${sortedTables.length}** tabeller refereret i kode.`);
push();
for (const t of sortedTables) {
  const users = [...tableUsage[t]].sort();
  push(`### \`${t}\` (${users.length})`);
  for (const u of users) push(`- ${u}`);
  push();
}

// ===== RPCs =====
push("## 2. RPC → Kaldere");
push();
const sortedRpcs = Object.keys(rpcUsage).sort();
push(`Total: **${sortedRpcs.length}** RPC'er kaldt fra kode.`);
push();
for (const r of sortedRpcs) {
  const users = [...rpcUsage[r]].sort();
  push(`### \`${r}\` (${users.length})`);
  for (const u of users) push(`- ${u}`);
  push();
}

// ===== Edge functions =====
push("## 3. Edge Function → Invokers");
push();
const sortedEdges = Object.keys(edgeUsage).sort();
push(`Total: **${sortedEdges.length}** edge functions invoket fra kode.`);
push();
for (const e of sortedEdges) {
  const users = [...edgeUsage[e]].sort();
  push(`### \`${e}\` (${users.length})`);
  for (const u of users) push(`- ${u}`);
  push();
}

// ===== Channels =====
push("## 4. Realtime Channel → Subscribers");
push();
const sortedChannels = Object.keys(channelUsage).sort();
for (const c of sortedChannels) {
  const users = [...channelUsage[c]].sort();
  push(`### \`${c}\` (${users.length})`);
  for (const u of users) push(`- ${u}`);
  push();
}

// ===== Hooks =====
push("## 5. Hook → Forbrugere");
push();
const sortedHooks = [...hookNames].sort();
push(`Total: **${sortedHooks.length}** custom hooks.`);
push();
for (const h of sortedHooks) {
  const users = hookUsage[h] ? [...hookUsage[h]].sort() : [];
  push(`### \`${h}\` (${users.length})`);
  if (users.length === 0) {
    push("- ⚠️ **UBRUGT** — kandidat til sletning");
  } else {
    for (const u of users) push(`- ${u}`);
  }
  push();
}

// ===== Anti-pattern: direct supabase calls in components/pages =====
push("## 6. ⚠️ Anti-pattern: Direkte Supabase-kald udenfor `hooks/`");
push();
push("Princip 9: *Komponenter tilgår aldrig Supabase direkte — altid via custom hook.*");
push();
const violations: { file: string; tables: string[]; rpcs: string[] }[] = [];
for (const f of allFiles) {
  if (f.path.includes("/hooks/") || f.path.includes("/integrations/supabase/")) continue;
  const tables = new Set<string>();
  const rpcs = new Set<string>();
  for (const m of f.content.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) tables.add(m[1]);
  for (const m of f.content.matchAll(/\.rpc\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) rpcs.add(m[1]);
  if (tables.size || rpcs.size) {
    violations.push({ file: relative(".", f.path), tables: [...tables], rpcs: [...rpcs] });
  }
}
push(`**${violations.length} filer** bryder service-lag-princippet.`);
push();
for (const v of violations) {
  push(`### \`${v.file}\``);
  if (v.tables.length) push(`- Tabeller: ${v.tables.map((t) => `\`${t}\``).join(", ")}`);
  if (v.rpcs.length) push(`- RPC: ${v.rpcs.map((r) => `\`${r}\``).join(", ")}`);
  push();
}

// ---------- Write ----------
writeFileSync(OUT, lines.join("\n"));
const sizeKb = (Buffer.byteLength(lines.join("\n")) / 1024).toFixed(0);
console.log(`✅ ${OUT} skrevet (${sizeKb} KB)`);
console.log(`   ${sortedTables.length} tabeller · ${sortedRpcs.length} RPC'er · ${sortedEdges.length} edge funcs · ${sortedHooks.length} hooks`);
console.log(`   ⚠️  ${violations.length} filer bryder service-lag-princippet`);
