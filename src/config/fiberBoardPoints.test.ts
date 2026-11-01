import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FIBER_BOARD_POINTS, FIBER_SALE_PRODUCT_IDS, RELATEL_FIBER_LEAD_POINTS } from "./fiberBoardPoints";

const root = resolve(__dirname, "../..");
const edge = readFileSync(resolve(root, "supabase/functions/tv-dashboard-data/index.ts"), "utf8");
const migration = readFileSync(resolve(root, "drizzle/migrations/0075_tdc_fiber_tastning.sql"), "utf8");

function parseMap(src: string, name: string): Record<string, number> {
  const start = src.indexOf(`const ${name}`);
  const block = src.slice(start, src.indexOf("};", start));
  const out: Record<string, number> = {};
  for (const m of block.matchAll(/"([0-9a-f-]{36})":\s*([0-9.]+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

const forventet = { fuldt: 1, lukket: 0.5, lead: 0.5 } as const;

describe("TDC fiber-point", () => {
  it("serverens pointliste er identisk med sidens", () => {
    expect(parseMap(edge, "FIBER_BOARD_POINTS_EF")).toEqual(FIBER_BOARD_POINTS);
  });

  it("hvert produkt fibersiden kan oprette har rigtig point (Fuldt 1, Lukket 0,5, Lead 0,5)", () => {
    const linjer = [...migration.matchAll(/WHEN '(fuldt|lukket|lead)\|(HAP|VOK)\|(true|false)'\s+THEN '([0-9a-f-]{36})'/g)];
    expect(linjer).toHaveLength(12);
    for (const [, type, , , id] of linjer) {
      expect(FIBER_BOARD_POINTS[id]).toBe(forventet[type as keyof typeof forventet]);
      expect(FIBER_SALE_PRODUCT_IDS.includes(id)).toBe(type !== "lead");
    }
  });

  it("Relatel: serverens leadliste er identisk med sidens", () => {
    expect(parseMap(edge, "RELATEL_FIBER_LEAD_POINTS_EF")).toEqual(RELATEL_FIBER_LEAD_POINTS);
  });

  it("Relatel: kun de 4 Lead Provi-produkter tæller, og hvert lead giver 1", () => {
    const leads = [...migration.matchAll(/WHEN 'lead\|(HAP|VOK)\|(true|false)'\s+THEN '([0-9a-f-]{36})'/g)].map((m) => m[3]);
    expect(leads).toHaveLength(4);
    expect(Object.keys(RELATEL_FIBER_LEAD_POINTS).sort()).toEqual([...leads].sort());
    for (const id of leads) expect(RELATEL_FIBER_LEAD_POINTS[id]).toBe(1);
  });
});
