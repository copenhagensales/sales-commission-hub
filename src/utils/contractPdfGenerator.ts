/**
 * Utility to generate and download a contract as PDF
 * Uses browser's print-to-PDF functionality for reliable rendering
 */

interface ContractData {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  status: string;
  employee_name?: string;
  signatures?: Array<{
    signer_type: string;
    signer_name: string | null;
    signed_at: string | null;
  }>;
}

/**
 * Creates a printable HTML document and triggers the browser's print dialog
 * which allows saving as PDF
 */
export function downloadContractAsPdf(contract: ContractData) {
  // Create a new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('Pop-up blokeret. Tillad venligst pop-ups for at downloade kontrakten.');
    return;
  }

  // Format the date
  const createdDate = new Date(contract.created_at).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Build signatures HTML if available
  const signaturesHtml = contract.signatures?.length 
    ? `
      <div class="signatures">
        <h3>Underskrifter</h3>
        <div class="signature-list">
          ${contract.signatures.map(sig => `
            <div class="signature-item">
              <strong>${sig.signer_type === 'employee' ? 'Medarbejder' : 'Leder'}:</strong>
              ${sig.signer_name || 'Ikke angivet'}
              ${sig.signed_at ? `<br><small>Underskrevet: ${new Date(sig.signed_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>` : '<br><small>Afventer underskrift</small>'}
            </div>
          `).join('')}
        </div>
      </div>
    ` 
    : '';

  // Create the print document
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="da">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${contract.title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1a1a1a;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .header {
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .header h1 {
          font-size: 24px;
          margin-bottom: 8px;
        }
        
        .header .meta {
          color: #666;
          font-size: 14px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-top: 10px;
        }
        
        .status-signed {
          background: #dcfce7;
          color: #166534;
        }
        
        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }
        
        .status-draft {
          background: #f3f4f6;
          color: #4b5563;
        }
        
        .content {
          margin-bottom: 40px;
        }
        
        .content h2, .content h3, .content h4 {
          margin-top: 20px;
          margin-bottom: 10px;
        }
        
        .content p {
          margin-bottom: 12px;
        }
        
        .content ul, .content ol {
          margin-left: 24px;
          margin-bottom: 12px;
        }
        
        .content li {
          margin-bottom: 4px;
        }
        
        .content table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        
        .content table th,
        .content table td {
          border: 1px solid #ddd;
          padding: 8px 12px;
          text-align: left;
        }
        
        .content table th {
          background: #f9fafb;
        }
        
        .signatures {
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
          margin-top: 30px;
        }
        
        .signatures h3 {
          font-size: 16px;
          margin-bottom: 16px;
        }
        
        .signature-list {
          display: flex;
          gap: 40px;
        }
        
        .signature-item {
          flex: 1;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }
        
        .signature-item small {
          color: #6b7280;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
        }
        
        @media print {
          body {
            padding: 20px;
          }
          
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${contract.title}</h1>
        <div class="meta">
          Oprettet: ${createdDate}
          ${contract.employee_name ? ` • Medarbejder: ${contract.employee_name}` : ''}
        </div>
        <span class="status-badge ${
          contract.status === 'signed' ? 'status-signed' : 
          contract.status === 'pending_employee' || contract.status === 'pending_manager' ? 'status-pending' : 
          'status-draft'
        }">
          ${getStatusLabel(contract.status)}
        </span>
      </div>
      
      <div class="content">
        ${contract.content || '<p>Ingen indhold</p>'}
      </div>
      
      ${signaturesHtml}
      
      <div class="footer">
        Dokument genereret ${new Date().toLocaleDateString('da-DK', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      
      <script>
        // Auto-trigger print dialog
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Kladde',
    pending_employee: 'Afventer medarbejder',
    pending_manager: 'Afventer leder',
    signed: 'Underskrevet',
    rejected: 'Afvist',
    expired: 'Udløbet'
  };
  return labels[status] || status;
}
