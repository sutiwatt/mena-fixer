import { env } from '../utils/env';

const API_URL = env.VITE_API_URL_MAINTENANCE;
const BASE_URL = API_URL;

// Types
export interface TruckImageUrls {
  left?: string | null;
  right?: string | null;
  front?: string | null;
  back?: string | null;
  interior?: string | null;
}

export interface TruckImageSubmissionResponse {
  truckplate: string;
  image_urls: TruckImageUrls | null;
  approve: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TruckImageSubmissionCreate {
  truckplate: string;
  image_urls?: TruckImageUrls | null;
  approve?: boolean;
}

export interface TruckImageSubmissionUpdate {
  image_urls?: TruckImageUrls | null;
  approve?: boolean;
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
    const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
    
    // Handle 404 or "ไม่พบข้อมูล" for GET requests (no existing record - this is normal)
    if (options.method === 'GET' && (
      response.status === 404 || 
      errorMessage.includes('ไม่พบข้อมูล') ||
      errorMessage.includes('Not found')
    )) {
      throw new Error('NOT_FOUND');
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
};

// Truck Photo Service
export const truckPhotoService = {
  // Get truck image submission by truckplate
  getTruckImageSubmission: async (
    truckplate: string
  ): Promise<TruckImageSubmissionResponse | null> => {
    try {
      return await apiCall<TruckImageSubmissionResponse>(
        `/truck-image-submissions/${truckplate}`,
        {
          method: 'GET',
        }
      );
    } catch (error: any) {
      if (error.message === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  },

  // Create truck image submission
  createTruckImageSubmission: async (
    submission: TruckImageSubmissionCreate
  ): Promise<TruckImageSubmissionResponse> => {
    return apiCall<TruckImageSubmissionResponse>(
      '/truck-image-submissions/',
      {
        method: 'POST',
        body: JSON.stringify(submission),
      }
    );
  },

  // Update truck image submission
  updateTruckImageSubmission: async (
    truckplate: string,
    submission: TruckImageSubmissionUpdate
  ): Promise<TruckImageSubmissionResponse> => {
    return apiCall<TruckImageSubmissionResponse>(
      `/truck-image-submissions/${truckplate}`,
      {
        method: 'PUT',
        body: JSON.stringify(submission),
      }
    );
  },
};

