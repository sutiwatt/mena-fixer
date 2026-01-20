import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const BASE_URL = API_URL;

// Types
export interface ChecklistItem {
  id: number;
  category: string | null;
  part_name: string;
  check_method: string | null;
}

export interface ChecklistItemsResponse {
  items: ChecklistItem[];
}

export interface InspectionRecord {
  id: string;
  inspector_name: string;
  truck_plate: string;
  inspection_date: string;
  created_at?: string;
}

export interface InspectionRecordsListResponse {
  records: InspectionRecord[];
  total: number;
}

export interface TruckResponse {
  truckplate: string;
  trucknum?: string;
  brand?: string;
  customer?: string;
  plant?: string;
  datestart?: string;
  weight?: number;
  typetruck?: string;
  startdate?: string;
  latest_mileage?: number;
}

export interface TruckSearchResponse {
  trucks: TruckResponse[];
  total: number;
}

export interface MileageCreateRequest {
  truck_plate: string;
  mileage: number;
  date_create?: string;
}

export interface MileageCreateResponse {
  id: string;
  truck_plate: string;
  date_create: string;
  mileage: number;
  message: string;
}

export interface InspectionRecordCreateRequest {
  inspector_name: string;
  truck_plate: string;
  inspection_date?: string;
}

export interface InspectionRecordCreateResponse {
  id: string;
  inspector_name: string;
  truck_plate: string;
  inspection_date: string;
  created_at: string;
  message: string;
}

export interface InspectionFailedItemCreateRequest {
  truckplate: string;
  id_vehicle?: string;
  sub_vehicle?: string;
  description?: string;
  image_url?: string;
  status?: string;
  fail_type?: string;
  usercreate?: string;
  remark?: string;
}

export interface InspectionFailedItemCreateResponse {
  id: string;
  truckplate: string;
  id_vehicle?: string;
  sub_vehicle?: string;
  description?: string;
  image_url?: string;
  status: string;
  fail_type?: string;
  usercreate?: string;
  remark?: string;
  created_at: string;
  message: string;
}

// API call helper with authentication
const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const accessToken = authService.getAccessToken();
  
  if (!accessToken) {
    throw new Error('No access token available. Please login again.');
  }

  const url = `${BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try to refresh token
      try {
        await authService.refreshToken();
        const newToken = authService.getAccessToken();
        if (newToken) {
          // Retry with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${newToken}`,
              ...options.headers,
            },
          });
          
          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({ detail: 'An error occurred' }));
            throw new Error(errorData.detail || `HTTP error! status: ${retryResponse.status}`);
          }
          
          return retryResponse.json();
        }
      } catch (refreshError) {
        throw new Error('Session expired. Please login again.');
      }
    }
    
    const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Inspection Service
export const inspectionService = {
  // Get checklist items by customer
  getChecklistItems: async (customer: string): Promise<ChecklistItem[]> => {
    const response = await apiCall<ChecklistItemsResponse>(
      `/mixer-inspection/checklist?customer=${encodeURIComponent(customer)}`,
      {
        method: 'GET',
      }
    );
    return response.items;
  },

  // Search trucks (autocomplete)
  searchTrucks: async (query: string, limit: number = 20): Promise<TruckResponse[]> => {
    if (!query || query.length < 1) {
      return [];
    }
    
    try {
      const response = await apiCall<TruckSearchResponse>(
        `/staticmixer/trucks/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          method: 'GET',
        }
      );
      
      if (!response.trucks || !Array.isArray(response.trucks)) {
        return [];
      }
      
      return response.trucks;
    } catch (error) {
      console.error('Error searching trucks:', error);
      return [];
    }
  },

  // Create mileage record
  createMileage: async (data: MileageCreateRequest): Promise<MileageCreateResponse> => {
    return apiCall<MileageCreateResponse>(
      '/staticmixer/mileage',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  // Create inspection record
  createInspectionRecord: async (data: InspectionRecordCreateRequest): Promise<InspectionRecordCreateResponse> => {
    return apiCall<InspectionRecordCreateResponse>(
      '/mixer-inspection/records',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  // Get inspection records
  getInspectionRecords: async (
    inspector_name?: string,
    truck_plate?: string,
    limit: number = 100
  ): Promise<InspectionRecordsListResponse> => {
    const params = new URLSearchParams();
    if (inspector_name) {
      params.append('inspector_name', inspector_name);
    }
    if (truck_plate) {
      params.append('truck_plate', truck_plate);
    }
    params.append('limit', limit.toString());

    return apiCall<InspectionRecordsListResponse>(
      `/mixer-inspection/records?${params.toString()}`,
      {
        method: 'GET',
      }
    );
  },

  // Create inspection failed item
  createInspectionFailedItem: async (data: InspectionFailedItemCreateRequest): Promise<InspectionFailedItemCreateResponse> => {
    return apiCall<InspectionFailedItemCreateResponse>(
      '/mixer-inspection/failed-items',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },
};

