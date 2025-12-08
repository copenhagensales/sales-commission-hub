export interface CrmAdapter {
  validateSales(sales: SaleToValidate[], credentials: any, config: CrmConfig): Promise<SaleUpdate[]>;
}

export interface SaleToValidate {
  id: string;
  adversus_external_id: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  agent_name: string | null;
  sale_datetime: string;
}

export interface SaleUpdate {
  id: string;
  new_status: 'approved' | 'cancelled' | 'pending' | 'pending_validation';
  opp_number?: string;
  metadata?: Record<string, any>;
}

export interface CrmConfig {
  search_field?: 'phone' | 'email' | 'company' | 'order_id';
  status_map?: Record<string, string>;
  [key: string]: any;
}

export interface CrmCredentials {
  api_key?: string;
  access_token?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  [key: string]: any;
}
