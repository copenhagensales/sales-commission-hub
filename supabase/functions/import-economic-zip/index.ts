import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

    console.log(`Processing import ${importId} from ${storagePath}`);

    // Update status to processing
    await supabase
      .from("economic_imports")
      .update({ status: "processing" })
      .eq("id", importId);

    // Download ZIP from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("economic-imports")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download ZIP: ${downloadError?.message}`);
    }

    // Unzip in memory
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(await fileData.arrayBuffer());

    const filesFound: string[] = [];
    let kontoPlanData: Record<string, string>[] = [];
    let posteringData: Record<string, string>[] = [];

    // Find and parse CSV files
    for (const [filename, file] of Object.entries(zipContent.files)) {
      if (file.dir) continue;
      
      const lowerName = filename.toLowerCase();
      if (!lowerName.endsWith(".csv")) continue;
      
      filesFound.push(filename);
      
      const content = await file.async("uint8array");
      const text = decodeContent(content);
      const rows = parseCSV(text);

      console.log(`Parsed ${filename}: ${rows.length} rows`);

      // Extract base filename (handle nested paths like "folder/Konto.csv")
      const baseName = filename.split('/').pop()?.toLowerCase() || '';
      
      // Use exact filename matching to avoid conflicts
      // (e.g., SystemKonto.csv, AfgiftsKonto.csv should NOT match)
      if (baseName === "konto.csv") {
        kontoPlanData = rows;
        console.log(`→ Matched as Kontoplan: ${rows.length} rows`);
      } else if (baseName === "postering.csv") {
        posteringData = rows;
        console.log(`→ Matched as Posteringer: ${rows.length} rows`);
      }
    }

    console.log(`Found files: ${filesFound.join(", ")}`);
    console.log(`Konto rows: ${kontoPlanData.length}, Postering rows: ${posteringData.length}`);

    // Import Kontoplan first (due to foreign key)
    let kontoPlanCount = 0;
    if (kontoPlanData.length > 0) {
      const kontoBatch = kontoPlanData.map((row) => ({
        konto_nr: parseIntSafe(row["KontoNr"]),
        navn: row["Navn"] || "Ukendt",
        type: parseIntSafe(row["Type"]),
        sum_fra: parseIntSafe(row["SumFra"]),
        momskode: row["MomsKode"] || null,
        debet_kredit: row["DebetKredit"] || null,
        modkonto: parseIntSafe(row["Modkonto"]),
        overfoer_primo_til: parseIntSafe(row["OverfoerPrimoTil"]),
        noegletalskode: row["NoegletalsKode"] || null,
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
        const dato = parseDanishDate(row["Dato"]);
        
        // Track date range
        if (dato) {
          if (!minDate || dato < minDate) minDate = dato;
          if (!maxDate || dato > maxDate) maxDate = dato;
        }

        return {
          loebe_nr: parseIntSafe(row["LoebeNr"]),
          posterings_type: row["PosteringsType"] || null,
          dato: dato,
          konto_nr: parseIntSafe(row["KontoNr"]),
          bilags_nr: parseIntSafe(row["BilagsNr"]),
          tekst: row["Tekst"] || null,
          beloeb_dkk: parseDanishNumber(row["BeloebDKK"]),
          valuta: row["Valuta"] || "DKK",
          beloeb: parseDanishNumber(row["Beloeb"]),
          projekt_nr: parseIntSafe(row["ProjektNr"]),
          aktivitets_nr: parseIntSafe(row["AktivitetsNr"]),
          kunde_nr: parseIntSafe(row["KundeNr"]),
          leverandoer_nr: parseIntSafe(row["LeverandoerNr"]),
          faktura_nr: parseIntSafe(row["FakturaNr"]),
          leverandoer_faktura_nr: row["LeverandoerFakturaNr"] || null,
          forfalds_dato: parseDanishDate(row["ForfaldsDato"]),
          momskode: row["MomsKode"] || null,
          enhed1_nr: parseIntSafe(row["Enhed1Nr"]),
          enhed2_nr: parseIntSafe(row["Enhed2Nr"]),
          antal: parseDanishNumber(row["Antal"]),
          antal2: parseDanishNumber(row["Antal2"]),
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

    console.log(`Import complete: ${kontoPlanCount} konti, ${posteringCount} posteringer in ${processingTime}ms`);

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
