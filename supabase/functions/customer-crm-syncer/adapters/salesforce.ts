import { CrmAdapter, SaleToValidate, SaleUpdate, CrmConfig, CrmCredentials } from "../types.ts";

export class SalesforceAdapter implements CrmAdapter {
  async validateSales(sales: SaleToValidate[], credentials: CrmCredentials, config: CrmConfig): Promise<SaleUpdate[]> {
    const results: SaleUpdate[] = [];
    const accessToken = credentials.access_token;
    const instanceUrl = credentials.instance_url;

    if (!accessToken || !instanceUrl) {
      console.error('[Salesforce] Faltan credenciales (access_token o instance_url)');
      throw new Error("Salesforce access_token e instance_url son requeridos");
    }

    console.log(`[Salesforce] Validando ${sales.length} ventas en ${instanceUrl}...`);

    for (const sale of sales) {
      try {
        const searchField = config.search_field || 'phone';
        let searchValue = '';
        let soqlField = 'Phone';

        switch (searchField) {
          case 'phone':
            searchValue = sale.customer_phone || '';
            soqlField = 'Phone';
            break;
          case 'company':
            searchValue = sale.customer_company || '';
            soqlField = 'Account.Name';
            break;
          case 'order_id':
            searchValue = sale.adversus_external_id || '';
            soqlField = 'OrderNumber__c'; // Campo personalizado típico
            break;
        }

        if (!searchValue) continue;

        // Query SOQL
        const soql = encodeURIComponent(
          `SELECT Id, StageName, Name FROM Opportunity WHERE ${soqlField} = '${searchValue}' LIMIT 1`
        );
        
        const response = await fetch(`${instanceUrl}/services/data/v58.0/query?q=${soql}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error(`[Salesforce] Error en query: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.totalSize > 0) {
          const opp = data.records[0];
          const stageName = opp.StageName;

          const statusMap = config.status_map || {
            'Closed Won': 'approved',
            'Closed Lost': 'cancelled'
          };

          const newStatus = statusMap[stageName];
          if (newStatus) {
            results.push({
              id: sale.id,
              new_status: newStatus as SaleUpdate['new_status'],
              opp_number: opp.Id,
              metadata: { salesforce_opp_id: opp.Id, stage: stageName }
            });
            console.log(`[Salesforce] Venta ${sale.id} -> ${newStatus} (Opp: ${opp.Id})`);
          }
        }
      } catch (error) {
        console.error(`[Salesforce] Error procesando venta ${sale.id}:`, error);
      }
    }

    console.log(`[Salesforce] Procesadas ${results.length}/${sales.length} ventas con actualizaciones`);
    return results;
  }
}
