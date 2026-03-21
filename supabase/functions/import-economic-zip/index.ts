import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Danish number parsing: "42.446,25" → 42446.25
function parseDanishNumber(value: string | null | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Danish date parsing: "02-01-2026" → "2026-01-02"
function parseDanishDate(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Parse integer safely
function parseIntSafe(value: string | null | undefined): number | null {
  if (!value || value.trim() === "") return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

// CSV Parser with proper quote handling
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header - handle potential BOM
  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xfeff) {
    headerLine = headerLine.substring(1);
  }
  
  const headers = parseCSVLine(headerLine);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    
    rows.push(row);
  }

  return rows;
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ";" && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Detect and decode text content (UTF-8 or Latin-1)
function decodeContent(buffer: Uint8Array): string {
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return decoder.decode(buffer);
  } catch {
    // Fallback to Latin-1/ISO-8859-1
    const decoder = new TextDecoder("iso-8859-1");
    return decoder.decode(buffer);
  }
}

// Helper: Convert ExcelJS worksheet to array of record objects
function worksheetToJson(ws: any): Record<string, string>[] {
  const headers: string[] = [];
  const headerRow = ws.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
    headers[colNumber - 1] = String(cell.value ?? "");
  });
  const validHeaders = headers.filter((h) => h !== "");
  
  const rows: Record<string, string>[] = [];
  ws.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string> = {};
    let hasValue = false;
    validHeaders.forEach((header, i) => {
      const cell = row.getCell(i + 1);
      const val = cell.value;
      if (val !== null && val !== undefined && val !== "") {
        obj[header] = String(val);
        hasValue = true;
      } else {
        obj[header] = "";
      }
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

// Parse Excel file and extract sheets as record arrays
async function parseExcel(buffer: ArrayBuffer): Promise<{ kontoPlanData: Record<string, string>[]; posteringData: Record<string, string>[]; sheetsFound: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  
  const sheetsFound = wb.worksheets.map((ws: any) => ws.name);
  let kontoPlanData: Record<string, string>[] = [];
  let posteringData: Record<string, string>[] = [];

  for (const ws of wb.worksheets) {
    const rows = worksheetToJson(ws);
    const lowerName = ws.name.toLowerCase();
    
    if (lowerName === "konto" || lowerName === "kontoplan" || lowerName.includes("konto")) {
      if (kontoPlanData.length === 0) kontoPlanData = rows;
    } else if (lowerName === "postering" || lowerName === "posteringer" || lowerName.includes("postering")) {
      if (posteringData.length === 0) posteringData = rows;
    }
  }

  if (posteringData.length === 0 && kontoPlanData.length === 0 && sheetsFound.length > 0) {
    const firstWs = wb.getWorksheet(1);
    if (firstWs) {
      const rows = worksheetToJson(firstWs);
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const hasPostColumns = columns.some(c => 
          c.toLowerCase().includes("dato") || 
          c.toLowerCase().includes("beløb") ||
          c.toLowerCase().includes("beloeb") ||
          c.toLowerCase().includes("konto")
        );
        if (hasPostColumns) posteringData = rows;
      }
    }
  }

  return { kontoPlanData, posteringData, sheetsFound };
}

// Detect file type from path
function isExcelFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { storagePath, importId } = await req.json();

    if (!storagePath || !importId) {
      return new Response(
        JSON.stringify({ error: "Missing storagePath or importId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    await supabase
      .from("economic_imports")
      .update({ status: "processing" })
      .eq("id", importId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("economic-imports")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const filesFound: string[] = [];
    let kontoPlanData: Record<string, string>[] = [];
    let posteringData: Record<string, string>[] = [];

    // Check if Excel or ZIP
    if (isExcelFile(storagePath)) {
      const buffer = await fileData.arrayBuffer();
      const result = await parseExcel(buffer);
      kontoPlanData = result.kontoPlanData;
      posteringData = result.posteringData;
      filesFound.push(...result.sheetsFound.map(s => `${s} (sheet)`));
    } else {
      // ZIP file processing
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(await fileData.arrayBuffer());

      // Find and parse CSV files
      for (const [filename, file] of Object.entries(zipContent.files)) {
        if (file.dir) continue;
        
        const lowerName = filename.toLowerCase();
        if (!lowerName.endsWith(".csv")) continue;
        
        filesFound.push(filename);
        
        const content = await file.async("uint8array");
        const text = decodeContent(content);
        const rows = parseCSV(text);

        // Extract base filename (handle nested paths like "folder/Konto.csv")
        const baseName = filename.split('/').pop()?.toLowerCase() || '';
        
        // Use exact filename matching to avoid conflicts
        if (baseName === "konto.csv") {
          kontoPlanData = rows;
        } else if (baseName === "postering.csv") {
          posteringData = rows;
        }
      }
    }

    // Import Kontoplan first (due to foreign key)
    let kontoPlanCount = 0;
    if (kontoPlanData.length > 0) {
      const kontoBatch = kontoPlanData.map((row) => ({
        konto_nr: parseIntSafe(row["KontoNr"]) || parseIntSafe(row["Konto Nr"]) || parseIntSafe(row["Kontonr"]),
        navn: row["Navn"] || row["Kontonavn"] || "Ukendt",
        type: parseIntSafe(row["Type"]),
        sum_fra: parseIntSafe(row["SumFra"]) || parseIntSafe(row["Sum Fra"]),
        momskode: row["MomsKode"] || row["Momskode"] || null,
        debet_kredit: row["DebetKredit"] || row["Debet/Kredit"] || null,
        modkonto: parseIntSafe(row["Modkonto"]),
        overfoer_primo_til: parseIntSafe(row["OverfoerPrimoTil"]) || parseIntSafe(row["Overfør Primo Til"]),
        noegletalskode: row["NoegletalsKode"] || row["Nøgletalskode"] || null,
        note: row["Note"] || null,
        adgang: parseIntSafe(row["Adgang"]),
        raw_json: row,
        import_id: importId,
        updated_at: new Date().toISOString(),
      })).filter((k) => k.konto_nr !== null);

      // Batch upsert in chunks
      const chunkSize = 500;
      for (let i = 0; i < kontoBatch.length; i += chunkSize) {
        const chunk = kontoBatch.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("economic_kontoplan")
          .upsert(chunk, { onConflict: "konto_nr" });
        
        if (error) {
          console.error(`Konto upsert error at chunk ${i}:`, error);
        } else {
          kontoPlanCount += chunk.length;
        }
      }
    }

    // Import Posteringer
    let posteringCount = 0;
    let minDate: string | null = null;
    let maxDate: string | null = null;

    if (posteringData.length > 0) {
      const posteringBatch = posteringData.map((row) => {
        const dato = parseDanishDate(row["Dato"]) || parseDanishDate(row["Bogføringsdato"]);
        
        // Track date range
        if (dato) {
          if (!minDate || dato < minDate) minDate = dato;
          if (!maxDate || dato > maxDate) maxDate = dato;
        }

        return {
          loebe_nr: parseIntSafe(row["LoebeNr"]) || parseIntSafe(row["Løbenr"]) || parseIntSafe(row["Løbe Nr"]),
          posterings_type: row["PosteringsType"] || row["Posteringstype"] || null,
          dato: dato,
          konto_nr: parseIntSafe(row["KontoNr"]) || parseIntSafe(row["Konto Nr"]) || parseIntSafe(row["Kontonr"]),
          bilags_nr: parseIntSafe(row["BilagsNr"]) || parseIntSafe(row["Bilag Nr"]) || parseIntSafe(row["Bilagsnr"]),
          tekst: row["Tekst"] || null,
          beloeb_dkk: parseDanishNumber(row["BeloebDKK"]) || parseDanishNumber(row["Beløb DKK"]) || parseDanishNumber(row["Beløb"]),
          valuta: row["Valuta"] || "DKK",
          beloeb: parseDanishNumber(row["Beloeb"]) || parseDanishNumber(row["Beløb"]),
          projekt_nr: parseIntSafe(row["ProjektNr"]) || parseIntSafe(row["Projekt Nr"]),
          aktivitets_nr: parseIntSafe(row["AktivitetsNr"]) || parseIntSafe(row["Aktivitets Nr"]),
          kunde_nr: parseIntSafe(row["KundeNr"]) || parseIntSafe(row["Kunde Nr"]),
          leverandoer_nr: parseIntSafe(row["LeverandoerNr"]) || parseIntSafe(row["Leverandør Nr"]),
          faktura_nr: parseIntSafe(row["FakturaNr"]) || parseIntSafe(row["Faktura Nr"]),
          leverandoer_faktura_nr: row["LeverandoerFakturaNr"] || row["Leverandør Faktura Nr"] || null,
          forfalds_dato: parseDanishDate(row["ForfaldsDato"]) || parseDanishDate(row["Forfaldsdato"]),
          momskode: row["MomsKode"] || row["Momskode"] || null,
          enhed1_nr: parseIntSafe(row["Enhed1Nr"]) || parseIntSafe(row["Enhed 1 Nr"]),
          enhed2_nr: parseIntSafe(row["Enhed2Nr"]) || parseIntSafe(row["Enhed 2 Nr"]),
          antal: parseDanishNumber(row["Antal"]),
          antal2: parseDanishNumber(row["Antal2"]) || parseDanishNumber(row["Antal 2"]),
          raw_json: row,
          import_id: importId,
          updated_at: new Date().toISOString(),
        };
      }).filter((p) => p.loebe_nr !== null && p.dato !== null);

      // Batch upsert in chunks
      const chunkSize = 500;
      for (let i = 0; i < posteringBatch.length; i += chunkSize) {
        const chunk = posteringBatch.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("economic_posteringer")
          .upsert(chunk, { onConflict: "loebe_nr" });
        
        if (error) {
          console.error(`Postering upsert error at chunk ${i}:`, error);
        } else {
          posteringCount += chunk.length;
        }
      }
    }

    const processingTime = Date.now() - startTime;

    // Update import record with results
    const { error: updateError } = await supabase
      .from("economic_imports")
      .update({
        status: "success",
        files_found: filesFound,
        rows_konto: kontoPlanCount,
        rows_postering: posteringCount,
        detected_start_date: minDate,
        detected_end_date: maxDate,
        processing_time_ms: processingTime,
      })
      .eq("id", importId);

    if (updateError) {
      console.error("Failed to update import status:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        filesFound,
        kontoPlanCount,
        posteringCount,
        dateRange: { from: minDate, to: maxDate },
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Import error:", errorMessage);

    // Try to update the import record with error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { importId } = await req.json().catch(() => ({}));
      if (importId) {
        await supabase
          .from("economic_imports")
          .update({
            status: "error",
            error_message: errorMessage,
            processing_time_ms: Date.now() - startTime,
          })
          .eq("id", importId);
      }
    } catch {
      // Ignore update errors
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
