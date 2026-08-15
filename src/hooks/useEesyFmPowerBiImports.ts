import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { parseExcelFile } from "@/utils/excel";

export const POWERBI_BUCKET = "eesy-fm-powerbi";

export type PowerBiSheetType = "gaden_coop" | "marked";

export const SHEET_LABELS: Record<PowerBiSheetType, string> = {
  gaden_coop: "Gaden/Coop",
  marked: "Marked",
};

export interface PowerBiImport {
  id: string;
  sheetType: PowerBiSheetType;
  fileName: string;
  storagePath: string | null;
  rowCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface PowerBiRow {
  id: string;
  importId: string;
  sheetType: PowerBiSheetType;
  saleDate: string | null;
  sellerName: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  subscriptionName: string | null;
  campaignName: string | null;
  operator: string | null;
}

/** Normaliser telefonnummer: kun cifre, uden landekode og Excel-decimaler. */
export function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  let raw = String(value).trim();
  if (!raw) return null;
  // Excel-tal kan komme som "20138808.0"
  raw = raw.replace(/\.0+$/, "");
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0045")) digits = digits.slice(4);
  else if (digits.length > 8 && digits.startsWith("45")) digits = digits.slice(2);
  return digits || null;
}

const COLUMN_SPEC = [
  { key: "saleDate", header: "year - month - date - date", index: 0 },
  { key: "sellerName", header: "sælger", index: 1 },
  { key: "phone", header: "nummer", index: 2 },
  { key: "subscriptionName", header: "subscription name", index: 4 },
  { key: "campaignName", header: "salgskampagne", index: 5 },
  { key: "operator", header: "operator", index: 8 },
] as const;

function resolveColumns(columns: string[]): Record<string, string | undefined> {
  const lower = columns.map((c) => c.toLowerCase().trim());
  const result: Record<string, string | undefined> = {};
  for (const spec of COLUMN_SPEC) {
    const byName = lower.findIndex((c) => c === spec.header);
    const idx = byName >= 0 ? byName : spec.index;
    result[spec.key] = columns[idx];
  }
  return result;
}

function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const str = String(value).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dk = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dk) {
    return `${dk[3]}-${dk[2].padStart(2, "0")}-${dk[1].padStart(2, "0")}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return toDateString(parsed);
  return null;
}

function cellText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value !== null) {
    const rich = value as { text?: string; result?: unknown };
    if (typeof rich.text === "string") return rich.text.trim() || null;
    if (rich.result !== undefined) return cellText(rich.result);
  }
  const str = String(value).trim();
  return str || null;
}

export function useEesyFmPowerBiImports() {
  return useQuery({
    queryKey: ["eesy-fm-powerbi-imports"],
    queryFn: async (): Promise<PowerBiImport[]> => {
      const { data, error } = await supabase
        .from("eesy_fm_powerbi_imports")
        .select(
          "id, sheet_type, file_name, storage_path, row_count, period_from, period_to, uploaded_by, created_at",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((row) => ({
        id: row.id,
        sheetType: row.sheet_type as PowerBiSheetType,
        fileName: row.file_name,
        storagePath: row.storage_path,
        rowCount: row.row_count,
        periodFrom: row.period_from,
        periodTo: row.period_to,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at,
      }));
    },
  });
}

export function useEesyFmPowerBiRows(imports: PowerBiImport[] | undefined) {
  const importIds = (imports || []).map((i) => i.id).sort();
  const typeById = new Map((imports || []).map((i) => [i.id, i.sheetType]));

  return useQuery({
    queryKey: ["eesy-fm-powerbi-rows", importIds],
    enabled: importIds.length > 0,
    queryFn: async (): Promise<PowerBiRow[]> => {
      const rows = await fetchAllRows<{
        id: string;
        import_id: string;
        sale_date: string | null;
        seller_name: string | null;
        phone_raw: string | null;
        phone_normalized: string | null;
        subscription_name: string | null;
        campaign_name: string | null;
        operator: string | null;
      }>(
        "eesy_fm_powerbi_rows",
        "id, import_id, sale_date, seller_name, phone_raw, phone_normalized, subscription_name, campaign_name, operator",
        (query) => query.in("import_id", importIds),
        { orderBy: "sale_date", ascending: false },
      );
      return rows.map((r) => ({
        id: r.id,
        importId: r.import_id,
        sheetType: (typeById.get(r.import_id) || "gaden_coop") as PowerBiSheetType,
        saleDate: r.sale_date,
        sellerName: r.seller_name,
        phoneRaw: r.phone_raw,
        phoneNormalized: r.phone_normalized,
        subscriptionName: r.subscription_name,
        campaignName: r.campaign_name,
        operator: r.operator,
      }));
    },
  });
}

export function useUploadPowerBiSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, sheetType }: { file: File; sheetType: PowerBiSheetType }) => {
      const buffer = await file.arrayBuffer();
      const { rows, columns } = await parseExcelFile(buffer);
      if (rows.length === 0) throw new Error("Arket indeholder ingen rækker");

      const map = resolveColumns(columns);
      const parsed = rows
        .map((row) => {
          const phoneRaw = cellText(map.phone ? row[map.phone] : null);
          return {
            sale_date: toDateString(map.saleDate ? row[map.saleDate] : null),
            seller_name: cellText(map.sellerName ? row[map.sellerName] : null),
            phone_raw: phoneRaw,
            phone_normalized: normalizePhone(phoneRaw),
            subscription_name: cellText(map.subscriptionName ? row[map.subscriptionName] : null),
            campaign_name: cellText(map.campaignName ? row[map.campaignName] : null),
            operator: cellText(map.operator ? row[map.operator] : null),
          };
        })
        .filter((r) => r.phone_normalized || r.sale_date);

      if (parsed.length === 0) {
        throw new Error("Kunne ikke finde relevante kolonner i arket (Nummer/dato)");
      }

      const dates = parsed.map((r) => r.sale_date).filter(Boolean) as string[];
      dates.sort();

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      // Upload selve filen (må gerne fejle uden at vælte indlæsningen)
      const storagePath = `${sheetType}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      let uploadedPath: string | null = null;
      const { error: storageError } = await supabase.storage
        .from(POWERBI_BUCKET)
        .upload(storagePath, file, { upsert: true });
      if (!storageError) uploadedPath = storagePath;

      // Deaktiver og fjern tidligere aktivt ark af samme type
      const { data: existing } = await supabase
        .from("eesy_fm_powerbi_imports")
        .select("id, storage_path")
        .eq("sheet_type", sheetType)
        .eq("is_active", true);

      for (const old of existing || []) {
        if (old.storage_path) {
          await supabase.storage.from(POWERBI_BUCKET).remove([old.storage_path]);
        }
        const { error: delError } = await supabase
          .from("eesy_fm_powerbi_imports")
          .delete()
          .eq("id", old.id);
        if (delError) throw delError;
      }

      const { data: created, error: insertError } = await supabase
        .from("eesy_fm_powerbi_imports")
        .insert({
          sheet_type: sheetType,
          file_name: file.name,
          storage_path: uploadedPath,
          row_count: parsed.length,
          period_from: dates[0] ?? null,
          period_to: dates[dates.length - 1] ?? null,
          uploaded_by: userId,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const CHUNK = 500;
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const chunk = parsed.slice(i, i + CHUNK).map((r) => ({ ...r, import_id: created.id }));
        const { error: rowError } = await supabase.from("eesy_fm_powerbi_rows").insert(chunk);
        if (rowError) throw rowError;
      }

      return { importId: created.id, rowCount: parsed.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eesy-fm-powerbi-imports"] });
      queryClient.invalidateQueries({ queryKey: ["eesy-fm-powerbi-rows"] });
    },
  });
}

export function useRemovePowerBiImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: PowerBiImport) => {
      if (item.storagePath) {
        await supabase.storage.from(POWERBI_BUCKET).remove([item.storagePath]);
      }
      const { error } = await supabase
        .from("eesy_fm_powerbi_imports")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eesy-fm-powerbi-imports"] });
      queryClient.invalidateQueries({ queryKey: ["eesy-fm-powerbi-rows"] });
    },
  });
}
