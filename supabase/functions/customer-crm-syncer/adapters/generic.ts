import { CrmAdapter, SaleToValidate, SaleUpdate, CrmConfig, CrmCredentials } from "../types.ts";

export class GenericApiAdapter implements CrmAdapter {
  async validateSales(sales: SaleToValidate[], credentials: CrmCredentials, config: CrmConfig): Promise<SaleUpdate[]> {
    const results: SaleUpdate[] = [];
    const apiKey = credentials.api_key;
    const baseUrl = config.base_url;

    if (!apiKey || !baseUrl) {
      console.error('[GenericAPI] Faltan credenciales (api_key o base_url en config)');
      throw new Error("GenericAPI api_key y config.base_url son requeridos");
    }

    console.log(`[GenericAPI] Validando ${sales.length} ventas contra ${baseUrl}...`);

    // Configuración del endpoint
    const searchEndpoint = config.search_endpoint || '/orders/search';
    const method = config.method || 'POST';
    const authHeader = config.auth_header || 'Authorization';
    const authPrefix = config.auth_prefix || 'Bearer';

    for (const sale of sales) {
      try {
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

        if (!searchValue) continue;

        // Construir request según configuración
        const url = `${baseUrl}${searchEndpoint}`;
        const headers: Record<string, string> = {
          [authHeader]: `${authPrefix} ${apiKey}`,
          'Content-Type': 'application/json'
        };

        // Agregar headers adicionales si existen
        if (config.extra_headers) {
          Object.assign(headers, config.extra_headers);
        }

        const body = config.body_template 
          ? JSON.stringify(config.body_template).replace('{{search_value}}', searchValue)
          : JSON.stringify({ [searchField]: searchValue });

        const response = await fetch(url, {
          method,
          headers,
          body: method !== 'GET' ? body : undefined
        });

        if (!response.ok) {
          console.error(`[GenericAPI] Error: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Extraer resultados según configuración
        const resultsPath = config.results_path || 'data';
        const statusPath = config.status_path || 'status';
        const idPath = config.id_path || 'id';

        const records = getNestedValue(data, resultsPath) || [];
        
        if (Array.isArray(records) && records.length > 0) {
          const record = records[0];
          const recordStatus = getNestedValue(record, statusPath);
          const recordId = getNestedValue(record, idPath);

          const statusMap = config.status_map || {};
          const newStatus = statusMap[recordStatus];

          if (newStatus) {
            results.push({
              id: sale.id,
              new_status: newStatus as SaleUpdate['new_status'],
              opp_number: String(recordId),
              metadata: { external_record: record }
            });
            console.log(`[GenericAPI] Venta ${sale.id} -> ${newStatus}`);
          }
        }
      } catch (error) {
        console.error(`[GenericAPI] Error procesando venta ${sale.id}:`, error);
      }
    }

    console.log(`[GenericAPI] Procesadas ${results.length}/${sales.length} ventas con actualizaciones`);
    return results;
  }
}

// Utilidad para acceder a valores anidados
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}
