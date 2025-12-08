import { CrmAdapter, SaleToValidate, SaleUpdate, CrmConfig, CrmCredentials } from "../types.ts";

export class HubSpotAdapter implements CrmAdapter {
  async validateSales(sales: SaleToValidate[], credentials: CrmCredentials, config: CrmConfig): Promise<SaleUpdate[]> {
    const results: SaleUpdate[] = [];
    const accessToken = credentials.access_token;

    if (!accessToken) {
      console.error('[HubSpot] No access_token provided');
      throw new Error("HubSpot access_token es requerido");
    }

    console.log(`[HubSpot] Validando ${sales.length} ventas...`);

    for (const sale of sales) {
      try {
        // Determinar campo de búsqueda
        const searchField = config.search_field || 'phone';
        let searchValue = '';
        
        switch (searchField) {
          case 'phone':
            searchValue = sale.customer_phone || '';
            break;
          case 'company':
            searchValue = sale.customer_company || '';
            break;
          case 'order_id':
            searchValue = sale.adversus_external_id || '';
            break;
        }

        if (!searchValue) {
          console.log(`[HubSpot] Venta ${sale.id} sin valor de búsqueda, saltando...`);
          continue;
        }

        // Buscar en HubSpot
        const searchUrl = 'https://api.hubapi.com/crm/v3/objects/deals/search';
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: searchField,
                operator: 'EQ',
                value: searchValue
              }]
            }],
            properties: ['dealstage', 'dealname', 'hs_object_id']
          })
        });

        if (!response.ok) {
          console.error(`[HubSpot] Error buscando deal: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.total > 0) {
          const deal = data.results[0];
          const dealStage = deal.properties.dealstage;

          // Mapear estado según configuración
          const statusMap = config.status_map || {
            'closedwon': 'approved',
            'closedlost': 'cancelled'
          };

          const newStatus = statusMap[dealStage];
          if (newStatus) {
            results.push({
              id: sale.id,
              new_status: newStatus as SaleUpdate['new_status'],
              opp_number: deal.properties.hs_object_id,
              metadata: { hubspot_deal_id: deal.id, dealstage: dealStage }
            });
            console.log(`[HubSpot] Venta ${sale.id} -> ${newStatus} (Deal: ${deal.id})`);
          }
        }
      } catch (error) {
        console.error(`[HubSpot] Error procesando venta ${sale.id}:`, error);
      }
    }

    console.log(`[HubSpot] Procesadas ${results.length}/${sales.length} ventas con actualizaciones`);
    return results;
  }
}
