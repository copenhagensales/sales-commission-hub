#!/usr/bin/env bun
/**
 * Genererer docs/system-snapshot.md — fuld DB + edge function rapport
 * til ekstern AI (Codex/Claude Code) UDEN at give dem DB-adgang.
 *
 * PII redaction: whitelist-baseret. Følsomme kolonnenavne erstattes med [REDACTED].
 * Følsomme tabeller: kun skema, ingen sample-data.
 *
 * Kør: bun run scripts/generate-system-snapshot.ts
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = "docs/system-snapshot.md";

// Tabeller hvor vi ALDRIG inkluderer sample-data (kun skema)
const NO_SAMPLE_TABLES = new Set([
  "employee_master_data", "candidates", "contract_signatures",
  "sensitive_data_access_log", "gdpr_consents", "gdpr_cleanup_log",
  "gdpr_data_requests", "consent_log", "security_incidents",
  "failed_login_attempts", "login_events", "communication_log",
  "communication_logs", "sms_notification_log", "user_roles",
  "ai_instruction_log", "contract_access_log",
]);

// Kolonnenavn-mønstre der altid redactes
const PII_PATTERNS = [
  /cpr/i, /ssn/i, /personal_?id/i,
  /bank/i, /iban/i, /account_?number/i,
  /password/i, /token/i, /secret/i, /api_?key/i,
  /\bemail\b/i, /\bphone\b/i, /\bmobile\b/i,
  /first_?name/i, /last_?name/i, /full_?name/i,
  /\baddress\b/i, /\bzip\b/i, /postal/i,
  /birth/i, /dob/i,
];

function redactValue(col: string, val: any): any {
  if (val === null || val === undefined) return val;
  if (PII_PATTERNS.some((r) => r.test(col))) return "[REDACTED]";
  if (typeof val === "string" && val.length > 200) return val.slice(0, 200) + "…";
  return val;
}

function psql(sql: string): any[] {
  const json = execSync(`psql -At -F$'\\t' -c ${JSON.stringify(`SELECT json_agg(t) FROM (${sql}) t`)}`, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  }).trim();
  if (!json || json === "") return [];
  try {
    return JSON.parse(json) ?? [];
  } catch {
    return [];
  }
}

console.log("→ Henter tabeller…");
const tables = psql(`
  SELECT c.relname AS name,
         obj_description(c.oid) AS comment,
         (SELECT reltuples::bigint FROM pg_class WHERE oid = c.oid) AS approx_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
`);

console.log(`  ${tables.length} tabeller`);

console.log("→ Henter kolonner…");
const allColumns = psql(`
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`);
const columnsByTable = new Map<string, any[]>();
for (const c of allColumns) {
  if (!columnsByTable.has(c.table_name)) columnsByTable.set(c.table_name, []);
  columnsByTable.get(c.table_name)!.push(c);
}

console.log("→ Henter foreign keys…");
const fks = psql(`
  SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
  JOIN information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
`);
const fksByTable = new Map<string, any[]>();
for (const f of fks) {
  if (!fksByTable.has(f.table_name)) fksByTable.set(f.table_name, []);
  fksByTable.get(f.table_name)!.push(f);
}

console.log("→ Henter indexes…");
const indexes = psql(`
  SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
`);
const idxByTable = new Map<string, any[]>();
for (const i of indexes) {
  if (!idxByTable.has(i.tablename)) idxByTable.set(i.tablename, []);
  idxByTable.get(i.tablename)!.push(i);
}

console.log("→ Henter RLS policies…");
const policies = psql(`
  SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
  FROM pg_policies WHERE schemaname = 'public'
`);
const polByTable = new Map<string, any[]>();
for (const p of policies) {
  if (!polByTable.has(p.tablename)) polByTable.set(p.tablename, []);
  polByTable.get(p.tablename)!.push(p);
}

console.log("→ Henter triggers…");
const triggers = psql(`
  SELECT event_object_table AS table, trigger_name, event_manipulation, action_timing, action_statement
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  ORDER BY event_object_table, trigger_name
`);
const trigByTable = new Map<string, any[]>();
for (const t of triggers) {
  if (!trigByTable.has(t.table)) trigByTable.set(t.table, []);
  trigByTable.get(t.table)!.push(t);
}

console.log("→ Henter functions/RPC'er…");
const functions = psql(`
  SELECT p.proname AS name,
         pg_get_function_identity_arguments(p.oid) AS args,
         pg_get_function_result(p.oid) AS returns,
         CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
         obj_description(p.oid) AS comment,
         LEFT(p.prosrc, 800) AS body_preview
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  ORDER BY p.proname
`);

console.log("→ Henter realtime publications…");
const realtime = psql(`
  SELECT schemaname, tablename
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
`);

console.log("→ Henter cron jobs…");
let cronJobs: any[] = [];
try {
  cronJobs = psql(`
    SELECT jobname, schedule, command, active
    FROM cron.job ORDER BY jobname
  `);
} catch {
  console.log("  (cron schema ikke tilgængeligt)");
}

console.log("→ Sample-data…");
const samples = new Map<string, any[]>();
for (const t of tables) {
  if (NO_SAMPLE_TABLES.has(t.name)) continue;
  try {
    const rows = psql(`SELECT * FROM public."${t.name}" LIMIT 2`);
    if (!rows.length) continue;
    const redacted = rows.map((row: any) => {
      const out: any = {};
      for (const [k, v] of Object.entries(row)) out[k] = redactValue(k, v);
      return out;
    });
    samples.set(t.name, redacted);
  } catch (e) {
    // skip
  }
}
console.log(`  sample for ${samples.size} tabeller`);

console.log("→ Edge functions…");
const edgeFns: { name: string; firstComment: string; secrets: string[]; verifyJwt: boolean }[] = [];
const FN_DIR = "supabase/functions";
for (const name of readdirSync(FN_DIR)) {
  if (name.startsWith("_")) continue;
  const indexPath = join(FN_DIR, name, "index.ts");
  if (!existsSync(indexPath)) continue;
  try {
    const src = readFileSync(indexPath, "utf8");
    const firstCommentMatch = src.match(/\/\*\*?([\s\S]{0,400}?)\*\//) ?? src.match(/^\s*\/\/(.{0,200})/m);
    const firstComment = (firstCommentMatch?.[1] ?? "").replace(/\*/g, "").trim().split("\n")[0]?.slice(0, 200) ?? "";
    const secrets = Array.from(new Set([...src.matchAll(/Deno\.env\.get\(["'`]([A-Z0-9_]+)["'`]\)/g)].map((m) => m[1])));
    edgeFns.push({ name, firstComment, secrets, verifyJwt: !src.includes("verify_jwt = false") });
  } catch {}
}

console.log("→ Bygger markdown…");
const md: string[] = [];
md.push(`# System Snapshot\n`);
md.push(`Genereret: ${new Date().toISOString()}\n`);
md.push(`Database: Supabase (PostgreSQL). Project ref: jwlimmeijpfmaksvmuru\n`);
md.push(`\n## Indhold\n`);
md.push(`- Tabeller: ${tables.length}`);
md.push(`- RPC'er / functions: ${functions.length}`);
md.push(`- RLS policies: ${policies.length}`);
md.push(`- Triggers: ${triggers.length}`);
md.push(`- Realtime tabeller: ${realtime.length}`);
md.push(`- Cron jobs: ${cronJobs.length}`);
md.push(`- Edge functions: ${edgeFns.length}\n`);

md.push(`## PII-redaction\n`);
md.push(`Sample-data er udeladt for: ${[...NO_SAMPLE_TABLES].join(", ")}.\n`);
md.push(`Følsomme kolonner (CPR, bank, email, navn, etc.) er erstattet med \`[REDACTED]\`.\n`);

md.push(`\n---\n\n# Tabeller\n`);
for (const t of tables) {
  md.push(`\n## \`${t.name}\``);
  if (t.comment) md.push(`\n_${t.comment}_`);
  md.push(`\nApprox rows: ${t.approx_rows ?? "?"}\n`);

  const cols = columnsByTable.get(t.name) ?? [];
  md.push(`\n### Kolonner\n`);
  md.push(`| Kolonne | Type | Nullable | Default |`);
  md.push(`|---|---|---|---|`);
  for (const c of cols) {
    const def = (c.column_default ?? "").toString().slice(0, 60);
    md.push(`| \`${c.column_name}\` | ${c.data_type} | ${c.is_nullable} | ${def} |`);
  }

  const tfks = fksByTable.get(t.name) ?? [];
  if (tfks.length) {
    md.push(`\n### Foreign keys\n`);
    for (const f of tfks) md.push(`- \`${f.column_name}\` → \`${f.ref_table}.${f.ref_column}\``);
  }

  const tidx = idxByTable.get(t.name) ?? [];
  if (tidx.length) {
    md.push(`\n### Indexes\n`);
    for (const i of tidx) md.push(`- \`${i.indexname}\``);
  }

  const tpol = polByTable.get(t.name) ?? [];
  if (tpol.length) {
    md.push(`\n### RLS policies\n`);
    for (const p of tpol) {
      md.push(`- **${p.policyname}** (${p.cmd}) roles=${p.roles}`);
      if (p.qual) md.push(`  - USING: \`${p.qual.slice(0, 200)}\``);
      if (p.with_check) md.push(`  - WITH CHECK: \`${p.with_check.slice(0, 200)}\``);
    }
  }

  const ttrig = trigByTable.get(t.name) ?? [];
  if (ttrig.length) {
    md.push(`\n### Triggers\n`);
    for (const tr of ttrig) {
      md.push(`- **${tr.trigger_name}** ${tr.action_timing} ${tr.event_manipulation}`);
    }
  }

  const sample = samples.get(t.name);
  if (sample?.length) {
    md.push(`\n### Sample (anonymiseret)\n`);
    md.push("```json");
    md.push(JSON.stringify(sample, null, 2));
    md.push("```");
  } else if (NO_SAMPLE_TABLES.has(t.name)) {
    md.push(`\n_Sample udeladt — følsom tabel._\n`);
  }
}

md.push(`\n---\n\n# RPC'er / Database functions\n`);
for (const f of functions) {
  md.push(`\n## \`${f.name}(${f.args})\``);
  md.push(`Returns: \`${f.returns}\` · ${f.security}`);
  if (f.comment) md.push(`\n_${f.comment}_`);
  md.push(`\n\`\`\`sql\n${f.body_preview}\n\`\`\``);
}

md.push(`\n---\n\n# Edge functions\n`);
md.push(`| Function | verify_jwt | Secrets brugt | Beskrivelse |`);
md.push(`|---|---|---|---|`);
for (const fn of edgeFns.sort((a, b) => a.name.localeCompare(b.name))) {
  md.push(`| \`${fn.name}\` | ${fn.verifyJwt} | ${fn.secrets.join(", ") || "—"} | ${fn.firstComment.replace(/\|/g, "\\|") || "—"} |`);
}

md.push(`\n---\n\n# Realtime publications\n`);
for (const r of realtime) md.push(`- \`${r.tablename}\``);

if (cronJobs.length) {
  md.push(`\n---\n\n# Cron jobs\n`);
  md.push(`| Navn | Schedule | Active | Command |`);
  md.push(`|---|---|---|---|`);
  for (const c of cronJobs) {
    md.push(`| ${c.jobname} | \`${c.schedule}\` | ${c.active} | \`${(c.command ?? "").toString().slice(0, 120).replace(/\|/g, "\\|")}\` |`);
  }
}

mkdirSync("docs", { recursive: true });
writeFileSync(OUT, md.join("\n"));
const size = statSync(OUT).size;
console.log(`✓ ${OUT} (${(size / 1024).toFixed(1)} KB)`);
