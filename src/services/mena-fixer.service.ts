import { env } from '../utils/env';

const API_URL = env.VITE_API_URL_MAINTENANCE;
const BASE_URL = API_URL;

// Types
export interface RepairRecordsInfo {
  total: number;
  status_counts: {
    completed: number;
    saved: number;
    draft: number;
  };
  overall_status: 'has_completed' | 'has_saved' | 'has_draft' | 'no_records';
}

export interface MaintenanceRequest {
  code: string;
  flow: string;
  branch_name?: string | null;
  is_broken?: boolean | null;
  dispatcher_name?: string | null;
  mechanic_name?: string | null;
  schedule_at?: string | null;
  estimate_finish_at?: string | null;
  truckplate?: string | null;
  vehicle_name?: string | null; // ทะเบียนรถ
  vehicle_code?: string | null; // เลขรถ
  customer?: string | null; // ลูกค้า
  plant?: string | null; // แพล้นท์
  repair_records?: RepairRecordsInfo;
}

export interface MaintenanceRequestQueryRequest {
  mechanic_name?: string | null;
  truckplate?: string | null;
  flow?: string | null;
  customer?: string | null;
  plant?: string | null;
  is_broken?: boolean | null;
  datestart?: string | null; // YYYY-MM-DD
  dateend?: string | null; // YYYY-MM-DD
  limit?: number;
  offset?: number;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  has_next: boolean;
  has_prev: boolean;
  total_pages: number;
}

export interface MaintenanceRequestQueryResponse {
  data: MaintenanceRequest[];
  count: number;
  total_count: number;
  pagination: PaginationInfo;
}

export interface CustomerPlantAutocompleteResponse {
  customers: string[];
  plants: string[];
  customer_plant_pairs: Array<{
    customer: string;
    plant: string;
  }>;
}

export interface MaintenanceTask {
  id: number;
  problem: string;
  inform_mile_no: number;
  trucknum?: string | null;
  truckplate?: string | null;
}

export interface MaintenanceTasksResponse {
  maintenance_request: string;
  tasks_by_type: Record<string, MaintenanceTask[]>;
}

export interface MaintenanceRepairRecordItem {
  maintenance_request_code: string;
  maintenance_task_id: number;
  repair_description?: string | null;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  status?: string | null;
  mechanic_name?: string | null;
}

export interface MaintenanceRepairRecordsRequest {
  records: MaintenanceRepairRecordItem[];
}

export interface MaintenanceRepairRecordResponse {
  id: number;
  maintenance_request_code: string;
  maintenance_task_id: number;
  repair_description?: string | null;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  status?: string | null;
  mechanic_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
}

export interface MaintenanceRepairRecordsResponse {
  success: boolean;
  message: string;
  count: number;
  records: MaintenanceRepairRecordResponse[];
}

export interface TaskRepairRecords {
  maintenance_task_id: number;
  maintenance_type: string;
  problem: string;
  inform_mile_no: number;
  records: MaintenanceRepairRecordResponse[];
}

export interface LatestRepairRecord {
  id: number;
  maintenance_request_code: string;
  repair_description?: string | null;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  status?: string | null;
  mechanic_name?: string | null;
  updated_at?: string | null;
}

export interface RepairRecordsByRequestResponse {
  maintenance_request_code: string;
  tasks_records: Record<string, TaskRepairRecords>;
  latest_records: Record<string, LatestRepairRecord>;
  total_records: number;
}

export interface MaintenanceRepairRecordUpdateRequest {
  repair_description?: string | null;
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  status?: string | null;
  mechanic_name?: string | null;
}

export interface MaintenanceRepairRecordUpdateResponse {
  success: boolean;
  message: string;
  record: MaintenanceRepairRecordResponse;
}

export interface MaintenanceTaskItem {
  id: number;
  problem: string;
}

export interface MaintenanceTasksBatchRequest {
  maintenance_requests: string[];
}

export interface MaintenanceTasksBatchResponse {
  results: Record<string, MaintenanceTaskItem[]>;
}

// API call helper (no authentication required)
const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Mechanic name mapping for dev/test
const MECHANIC_NAME_MAP: Record<string, string> = {
  'sutiwatt': 'สันติ สุขดี',
  'mena': 'สันติ สุขดี',
  // Add more mappings here as needed
};

const getMechanicName = (username: string): string => {
  return MECHANIC_NAME_MAP[username.toLowerCase()] || username;
};

// Mena Fixer Service
export const menaFixerService = {
  // Query maintenance requests
  queryMaintenanceRequest: async (
    request: MaintenanceRequestQueryRequest
  ): Promise<MaintenanceRequestQueryResponse> => {
    return apiCall<MaintenanceRequestQueryResponse>(
      '/mena-fixer/query',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },
  // Get customer/plant autocomplete
  getCustomerPlantAutocomplete: async (
    searchTerm?: string,
    limit: number = 20
  ): Promise<CustomerPlantAutocompleteResponse> => {
    const params = new URLSearchParams();
    if (searchTerm) {
      params.append('q', searchTerm);
    }
    params.append('limit', limit.toString());
    return apiCall<CustomerPlantAutocompleteResponse>(
      `/mena-fixer/autocomplete?${params.toString()}`,
      {
        method: 'GET',
      }
    );
  },
  // Get maintenance tasks by request code
  getMaintenanceTasksByRequest: async (
    maintenanceRequest: string
  ): Promise<MaintenanceTasksResponse> => {
    return apiCall<MaintenanceTasksResponse>(
      '/mena-fixer/maintenance-tasks',
      {
        method: 'POST',
        body: JSON.stringify({
          maintenance_request: maintenanceRequest,
        }),
      }
    );
  },
  // Create maintenance repair records
  createRepairRecords: async (
    request: MaintenanceRepairRecordsRequest
  ): Promise<MaintenanceRepairRecordsResponse> => {
    return apiCall<MaintenanceRepairRecordsResponse>(
      '/mena-fixer/repair-records',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  },
  // Get repair records by maintenance request code
  getRepairRecordsByRequest: async (
    maintenanceRequestCode: string
  ): Promise<RepairRecordsByRequestResponse> => {
    const params = new URLSearchParams();
    params.append('maintenance_request_code', maintenanceRequestCode);
    return apiCall<RepairRecordsByRequestResponse>(
      `/mena-fixer/repair-records?${params.toString()}`,
      {
        method: 'GET',
      }
    );
  },
  // Update maintenance repair record
  updateRepairRecord: async (
    recordId: number,
    request: MaintenanceRepairRecordUpdateRequest
  ): Promise<MaintenanceRepairRecordUpdateResponse> => {
    return apiCall<MaintenanceRepairRecordUpdateResponse>(
      `/mena-fixer/repair-records/${recordId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(request),
      }
    );
  },
  // Get maintenance tasks by multiple request codes (batch)
  getMaintenanceTasksByRequests: async (
    maintenanceRequests: string[]
  ): Promise<MaintenanceTasksBatchResponse> => {
    return apiCall<MaintenanceTasksBatchResponse>(
      '/mena-fixer/maintenance-tasks/batch',
      {
        method: 'POST',
        body: JSON.stringify({
          maintenance_requests: maintenanceRequests,
        }),
      }
    );
  },
};

export { getMechanicName };


