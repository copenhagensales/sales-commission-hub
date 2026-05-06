#!/usr/bin/env bun
/**
 * Genererer docs/ui-snapshot.md — komplet UI-lag rapport.
 *
 * Indhold:
 *  - Routes (path, component, access, position-permission)
 *  - Sider (fil, hooks brugt, supabase-kald, RPC-kald)
 *  - Komponenter (fil, props-signatur, hooks brugt)
 *  - Hooks (FULD KILDEKODE — kritisk for ekstern AI)
 *  - Lib/calculations (FULD KILDEKODE — pricing/løn = rød zone)
 *
 * Kør: bun run scripts/generate-ui-snapshot.ts
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "docs/ui-snapshot.md";
const ROOT = "src";

interface FileInfo {
  path: string;
  size: number;
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
          out.push({
            path: full,
            size: s.size,
            content: readFileSync(full, "utf8"),
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const isTsx = (p: string) => /\.(tsx?|jsx?)$/.test(p);

function extractHooksUsed(content: string): string[] {
  const hooks = new Set<string>();
  const re = /\b(use[A-Z]\w+)\s*\(/g;
  let m;
  while ((m = re.exec(content))) {
    if (!["useState", "useEffect", "useMemo", "useCallback", "useRef", "useContext", "useReducer", "useLayoutEffect"].includes(m[1])) {
      hooks.add(m[1]);
    }
  }
  return [...hooks].sort();
}

function extractSupabaseCalls(content: string): { tables: string[]; rpcs: string[]; channels: string[] } {
  const tables = new Set<string>();
  const rpcs = new Set<string>();
  const channels = new Set<string>();
  for (const m of content.matchAll(/\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) tables.add(m[1]);
  for (const m of content.matchAll(/\.rpc\(\s*["'`]([a-z_][a-z0-9_]*)["'`]/gi)) rpcs.add(m[1]);
  for (const m of content.matchAll(/\.channel\(\s*["'`]([^"'`]+)["'`]/gi)) channels.add(m[1]);
  for (const m of content.matchAll(/functions\.invoke\(\s*["'`]([a-z0-9_-]+)["'`]/gi)) rpcs.add(`edge:${m[1]}`);
  return {
    tables: [...tables].sort(),
    rpcs: [...rpcs].sort(),
    channels: [...channels].sort(),
  };
}

function extractDefaultExport(content: string): string {
  const m =
    content.match(/export\s+default\s+function\s+(\w+)/) ||
    content.match(/export\s+default\s+(\w+)/) ||
    content.match(/const\s+(\w+)[^=]*=[^;]*;\s*export\s+default\s+\1/);
  return m?.[1] ?? "(anon)";
}

function extractNamedExports(content: string): string[] {
  const out = new Set<string>();
  for (const m of content.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)) out.add(m[1]);
  for (const m of content.matchAll(/export\s+\{\s*([^}]+)\s*\}/g)) {
    for (const n of m[1].split(",")) {
      const name = n.trim().split(/\s+as\s+/)[0];
      if (name) out.add(name);
    }
  }
  return [...out].sort();
}

function firstNLines(content: string, n: number): string {
  return content.split("\n").slice(0, n).join("\n");
}

// ---------- Build ----------

const lines: string[] = [];
const push = (s = "") => lines.push(s);

push("# UI-snapshot");
push();
push(`Auto-genereret: ${new Date().toISOString()}`);
push();
push("Komplet kortlægning af frontend-laget: routes, sider, komponenter, hooks og forretningslogik.");
push("Bruges sammen med `system-snapshot.md` (DB) og `cross-reference.md` (krydsreferencer).");
push();
push("**For ekstern AI:** Hooks og `lib/calculations/` indeholder FULD kildekode fordi de er den primære forretningslogik. Sider/komponenter er kortlagt strukturelt.");
push();
push("---");
push();

// ===== ROUTES =====
push("## 1. Routes");
push();
const routeFiles = ["src/routes/config.ts", "src/routes/pages.ts", "src/routes/types.ts", "src/routes/guards.tsx", "src/routes/redirects.tsx", "src/routes/AppRouter.tsx"];
for (const rf of routeFiles) {
  try {
    const c = readFileSync(rf, "utf8");
    push(`### ${rf}`);
    push("```tsx");
    push(c);
    push("```");
    push();
  } catch {
    /* skip */
  }
}

// ===== PAGES =====
push("## 2. Sider (`src/pages/`)");
push();
const pages = walk(join(ROOT, "pages"), isTsx);
push(`Total: **${pages.length}** sider.`);
push();

for (const p of pages) {
  const rel = relative(".", p.path);
  const exp = extractDefaultExport(p.content);
  const hooks = extractHooksUsed(p.content);
  const sb = extractSupabaseCalls(p.content);
  push(`### \`${rel}\``);
  push(`- **Export:** \`${exp}\``);
  push(`- **Størrelse:** ${p.size} bytes, ${p.content.split("\n").length} linjer`);
  if (hooks.length) push(`- **Hooks brugt:** ${hooks.map((h) => `\`${h}\``).join(", ")}`);
  if (sb.tables.length) push(`- **Tabeller direkte:** ${sb.tables.map((t) => `\`${t}\``).join(", ")} ⚠️ (bryder service-lag-princip)`);
  if (sb.rpcs.length) push(`- **RPC/Edge:** ${sb.rpcs.map((r) => `\`${r}\``).join(", ")}`);
  if (sb.channels.length) push(`- **Realtime channels:** ${sb.channels.map((c) => `\`${c}\``).join(", ")}`);
  push();
}

// ===== COMPONENTS =====
push("## 3. Komponenter (`src/components/`)");
push();
const components = walk(join(ROOT, "components"), isTsx).filter((c) => !c.path.includes("/ui/"));
const uiComponents = walk(join(ROOT, "components/ui"), isTsx);
push(`Total: **${components.length}** feature-komponenter + **${uiComponents.length}** shadcn UI-primitiver (sidstnævnte ikke detaljeret).`);
push();

// Group by feature folder
const byFolder: Record<string, FileInfo[]> = {};
for (const c of components) {
  const parts = c.path.split("/");
  const folder = parts[2] || "_root";
  (byFolder[folder] ||= []).push(c);
}

for (const folder of Object.keys(byFolder).sort()) {
  push(`### components/${folder}/`);
  push(`${byFolder[folder].length} filer.`);
  push();
  for (const c of byFolder[folder]) {
    const rel = relative(".", c.path);
    const exp = extractDefaultExport(c.content);
    const named = extractNamedExports(c.content);
    const hooks = extractHooksUsed(c.content);
    const sb = extractSupabaseCalls(c.content);
    push(`#### \`${rel}\``);
    push(`- Export default: \`${exp}\`${named.length ? ` · Named: ${named.map((n) => `\`${n}\``).join(", ")}` : ""}`);
    push(`- ${c.size} bytes, ${c.content.split("\n").length} linjer`);
    if (hooks.length) push(`- Hooks: ${hooks.map((h) => `\`${h}\``).join(", ")}`);
    if (sb.tables.length) push(`- ⚠️ Direkte tabel-kald: ${sb.tables.map((t) => `\`${t}\``).join(", ")}`);
    if (sb.rpcs.length) push(`- RPC/Edge: ${sb.rpcs.map((r) => `\`${r}\``).join(", ")}`);
    push();
  }
}

// ===== HOOKS — FULL CODE =====
push("## 4. Hooks (`src/hooks/`) — FULD KILDEKODE");
push();
const hooks = walk(join(ROOT, "hooks"), isTsx);
push(`Total: **${hooks.length}** hooks. Alle dumpes med fuld kildekode da de er forretningslogikkens hjerte.`);
push();

for (const h of hooks) {
  const rel = relative(".", h.path);
  const sb = extractSupabaseCalls(h.content);
  push(`### \`${rel}\``);
  if (sb.tables.length) push(`**Tabeller:** ${sb.tables.map((t) => `\`${t}\``).join(", ")}  `);
  if (sb.rpcs.length) push(`**RPC/Edge:** ${sb.rpcs.map((r) => `\`${r}\``).join(", ")}  `);
  if (sb.channels.length) push(`**Channels:** ${sb.channels.map((c) => `\`${c}\``).join(", ")}  `);
  push();
  push("```tsx");
  push(h.content);
  push("```");
  push();
}

// ===== LIB/CALCULATIONS — FULL CODE (RED ZONE) =====
push("## 5. `src/lib/calculations/` — FULD KILDEKODE (RØD ZONE)");
push();
push("⚠️ Disse filer er forretningskritiske (løn, pricing, vacation, hours). Må ALDRIG ændres uden eksplicit godkendelse.");
push();
const calcs = walk(join(ROOT, "lib/calculations"), (p) => /\.tsx?$/.test(p));
for (const c of calcs) {
  const rel = relative(".", c.path);
  push(`### \`${rel}\``);
  push("```ts");
  push(c.content);
  push("```");
  push();
}

// ===== LIB/* (struktur) =====
push("## 6. `src/lib/` (øvrige helpers)");
push();
const libs = walk(join(ROOT, "lib"), (p) => /\.tsx?$/.test(p)).filter((f) => !f.path.includes("/calculations/"));
for (const l of libs) {
  const rel = relative(".", l.path);
  const named = extractNamedExports(l.content);
  push(`### \`${rel}\``);
  push(`- ${l.size} bytes · Exports: ${named.length ? named.map((n) => `\`${n}\``).join(", ") : "(none detected)"}`);
  push();
  push("```ts");
  push(firstNLines(l.content, 40));
  push("```");
  push();
}

// ===== UTILS (struktur) =====
push("## 7. `src/utils/`");
push();
const utils = walk(join(ROOT, "utils"), (p) => /\.tsx?$/.test(p));
for (const u of utils) {
  const rel = relative(".", u.path);
  const named = extractNamedExports(u.content);
  push(`### \`${rel}\``);
  push(`- ${u.size} bytes · Exports: ${named.length ? named.map((n) => `\`${n}\``).join(", ") : "(none detected)"}`);
  push();
}

// ===== CONFIG =====
push("## 8. `src/config/` — FULD KILDEKODE");
push();
const cfgs = walk(join(ROOT, "config"), (p) => /\.tsx?$/.test(p));
for (const c of cfgs) {
  const rel = relative(".", c.path);
  push(`### \`${rel}\``);
  push("```ts");
  push(c.content);
  push("```");
  push();
}

// ===== CONTEXTS =====
push("## 9. `src/contexts/`");
push();
const ctxs = walk(join(ROOT, "contexts"), isTsx);
for (const c of ctxs) {
  const rel = relative(".", c.path);
  const named = extractNamedExports(c.content);
  push(`### \`${rel}\``);
  push(`- Exports: ${named.map((n) => `\`${n}\``).join(", ")}`);
  push();
  push("```tsx");
  push(firstNLines(c.content, 60));
  push("```");
  push();
}

// ---------- Write ----------
writeFileSync(OUT, lines.join("\n"));
const sizeMb = (Buffer.byteLength(lines.join("\n")) / 1024 / 1024).toFixed(2);
console.log(`✅ ${OUT} skrevet (${sizeMb} MB, ${lines.length} linjer)`);
console.log(`   ${pages.length} sider · ${components.length} komponenter · ${hooks.length} hooks · ${calcs.length} calc-filer`);
