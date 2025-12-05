import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @deno-types="https://esm.sh/jspdf@2.5.1"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strip HTML tags and decode entities
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Format date in Danish
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('da-DK', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId } = await req.json();

    if (!contractId) {
      return new Response(
        JSON.stringify({ error: "Contract ID required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract with employee and signatures
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select(`
        *,
        employee:employee_master_data(first_name, last_name, cpr_number, private_email),
        signatures:contract_signatures(signer_type, signer_name, signed_at, acceptance_text)
      `)
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract fetch error:", contractError);
      return new Response(
        JSON.stringify({ error: "Contract not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating PDF for contract: ${contract.title}`);

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Header
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Copenhagen Sales', margin, 15);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Kontraktdokument', margin, 25);

    yPos = 45;

    // Contract title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(contract.title, margin, yPos);
    yPos += 10;

    // Employee info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const employeeName = contract.employee 
      ? `${contract.employee.first_name} ${contract.employee.last_name}`
      : 'Ukendt medarbejder';
    doc.text(`Medarbejder: ${employeeName}`, margin, yPos);
    yPos += 5;
    doc.text(`Sendt: ${formatDate(contract.sent_at)}`, margin, yPos);
    yPos += 10;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Contract content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const contentText = htmlToText(contract.content);
    const lines = doc.splitTextToSize(contentText, contentWidth);

    for (const line of lines) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += 5;
    }

    // Signatures section
    if (contract.signatures && contract.signatures.length > 0) {
      yPos += 10;
      
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin;
      }

      // Separator
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Underskrifter', margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      for (const sig of contract.signatures) {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }

        const signerLabel = sig.signer_type === 'employee' ? 'Medarbejder' : 'Leder';
        doc.setFont('helvetica', 'bold');
        doc.text(`${signerLabel}: ${sig.signer_name}`, margin, yPos);
        yPos += 5;

        doc.setFont('helvetica', 'normal');
        if (sig.signed_at) {
          doc.setTextColor(34, 139, 34); // Green
          doc.text(`✓ Underskrevet: ${formatDate(sig.signed_at)}`, margin + 5, yPos);
          yPos += 5;
          if (sig.acceptance_text) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(8);
            doc.text(`"${sig.acceptance_text}"`, margin + 5, yPos);
            doc.setFontSize(10);
            yPos += 5;
          }
        } else {
          doc.setTextColor(200, 100, 0); // Orange
          doc.text('⏳ Afventer underskrift', margin + 5, yPos);
          yPos += 5;
        }
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      }
    }

    // Footer on last page
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Genereret: ${new Date().toLocaleDateString('da-DK')} | Kontrakt ID: ${contract.id}`,
      margin,
      pageHeight - 10
    );

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    console.log(`PDF generated successfully for contract ${contractId}`);

    return new Response(
      JSON.stringify({ 
        pdf: pdfBase64,
        filename: `kontrakt-${contract.title.toLowerCase().replace(/\s+/g, '-')}-${employeeName.toLowerCase().replace(/\s+/g, '-')}.pdf`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
