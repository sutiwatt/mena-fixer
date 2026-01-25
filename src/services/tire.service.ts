import { env } from '../utils/env';

const API_URL = env.VITE_API_URL_MAINTENANCE;
const BASE_URL = API_URL;

// Types
export interface TireInfoResponse {
  truckplate: string;
  trucknum?: string | null;
  customer?: string | null;
  plant?: string | null;
  typetruck?: string | null;
}

export interface TireDataResponse {
  tire_position: string;
  serial_no?: string | null;
  tread_mm?: number | null;
  initial_mileage?: number | null;
}

export interface UpdateLastMmRequest {
  tire_position: string;
  last_mm: number;
  serial_no: string;
}

export interface TireMileageResponse {
  truckplate: string;
  tire_position: string;
  product?: string | null;
  serial_no?: string | null;
  tread_mm?: number | null;
  last_mm?: number | null;
  initial_mileage?: number | null;
  request_ref?: string | null;
  changed_in?: string | null;
  updated_at?: string | null;
}

export interface TireWithInfoResponse {
  info: TireInfoResponse;
  data: TireDataResponse[];
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

// Tire Service
export const tireService = {
  // Get tires by truck plate
  getTiresByTruck: async (truckplate: string): Promise<TireWithInfoResponse> => {
    if (!truckplate || !truckplate.trim()) {
      throw new Error('Truck plate is required');
    }

    return apiCall<TireWithInfoResponse>(
      `/tire/truck/${encodeURIComponent(truckplate.trim())}`,
      {
        method: 'GET',
      }
    );
  },

  // Update last_mm (current mileage) for a tire
  updateLastMm: async (
    truckplate: string,
    request: UpdateLastMmRequest
  ): Promise<TireMileageResponse> => {
    if (!truckplate || !truckplate.trim()) {
      throw new Error('Truck plate is required');
    }

    if (!request.serial_no || !request.tire_position) {
      throw new Error('Serial no and tire position are required');
    }

    if (request.last_mm === null || request.last_mm === undefined || request.last_mm < 0) {
      throw new Error('Last mileage must be a positive number');
    }

    return apiCall<TireMileageResponse>(
      `/tire/update-last-mm/${encodeURIComponent(truckplate.trim())}`,
      {
        method: 'POST',
        body: JSON.stringify({
          tire_position: request.tire_position,
          last_mm: request.last_mm,
          serial_no: request.serial_no,
        }),
      }
    );
  },
};

