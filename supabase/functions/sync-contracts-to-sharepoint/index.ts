import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get M365 access token
async function getM365AccessToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365 credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("M365 token error:", error);
    throw new Error("Failed to get M365 access token");
  }

  const data = await response.json();
  return data.access_token;
}

// Decode base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Upload file to SharePoint site
async function uploadToSharePoint(
  accessToken: string,
  fileContent: Uint8Array,
  filename: string,
  employeeName: string
): Promise<string> {
  const siteName = "CopenhagenSalesXScaleUp";
  
  console.log(`Uploading to SharePoint site: ${siteName}`);

  try {
    // Get the SharePoint site ID
    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/copenhagensalesaps.sharepoint.com:/sites/${siteName}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!siteResponse.ok) {
      const error = await siteResponse.text();
      console.error("Could not get SharePoint site:", error);
      return "";
    }

    const siteData = await siteResponse.json();
    const siteId = siteData.id;

    // Get the default document library
    const driveResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drive`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!driveResponse.ok) {
      const error = await driveResponse.text();
      console.error("Could not get SharePoint drive:", error);
      return "";
    }

    const driveData = await driveResponse.json();
    const driveId = driveData.id;

    // Create folder path: Kontrakter/[Employee Name]/
    const sanitizedName = employeeName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const folderPath = `Kontrakter/${sanitizedName}`;
    const filePath = `${folderPath}/${filename}`;

    console.log(`Uploading file to: ${filePath}`);

    // Upload the file
    const uploadResponse = await fetch(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${filePath}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/pdf",
        },
        body: fileContent as unknown as BodyInit,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error("SharePoint upload error:", error);
      return "";
    }

    const uploadData = await uploadResponse.json();
    console.log(`File uploaded successfully: ${uploadData.webUrl}`);
    return uploadData.webUrl || "";
  } catch (error) {
    console.error("SharePoint upload error:", error);
    return "";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all signed contracts with employee info
    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select(`
        id,
        title,
        employee_id
      `)
      .eq("status", "signed");

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      throw new Error("Could not fetch contracts");
    }

    // Get employee names separately
    const employeeIds = contracts?.map(c => c.employee_id).filter(Boolean) || [];
    const { data: employees } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name")
      .in("id", employeeIds);

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      throw new Error("Could not fetch contracts");
    }

    console.log(`Found ${contracts?.length || 0} signed contracts to sync`);

    if (!contracts || contracts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: "No signed contracts to sync" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get M365 access token
    const accessToken = await getM365AccessToken();

    let syncedCount = 0;
    let errorCount = 0;
    const results: { contractId: string; status: string; url?: string }[] = [];

    for (const contract of contracts) {
      try {
        const employee = employees?.find(e => e.id === contract.employee_id);
        const employeeName = `${employee?.first_name || 'Unknown'} ${employee?.last_name || ''}`.trim();
        
        console.log(`Processing contract ${contract.id} for ${employeeName}`);

        // Generate PDF
        const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-contract-pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ contractId: contract.id }),
        });

        if (!pdfResponse.ok) {
          const error = await pdfResponse.text();
          console.error(`PDF generation failed for ${contract.id}:`, error);
          results.push({ contractId: contract.id, status: "pdf_error" });
          errorCount++;
          continue;
        }

        const pdfData = await pdfResponse.json();
        const pdfBytes = base64ToUint8Array(pdfData.pdf);

        // Upload to SharePoint
        const sharePointUrl = await uploadToSharePoint(
          accessToken,
          pdfBytes,
          pdfData.filename,
          employeeName
        );

        if (sharePointUrl) {
          results.push({ contractId: contract.id, status: "success", url: sharePointUrl });
          syncedCount++;
        } else {
          results.push({ contractId: contract.id, status: "upload_error" });
          errorCount++;
        }
      } catch (error) {
        console.error(`Error processing contract ${contract.id}:`, error);
        results.push({ contractId: contract.id, status: "error" });
        errorCount++;
      }
    }

    console.log(`Sync complete: ${syncedCount} synced, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncedCount, 
        errors: errorCount,
        total: contracts.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sync-contracts-to-sharepoint:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
