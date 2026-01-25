import { env } from '../utils/env';

const IMAGE_API_URL = env.VITE_IMAGE_API_URL;

// Types
export interface PresignUploadRequest {
  files: string[];
  folder?: string;
}

export interface PresignUploadFile {
  filename: string;
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface PresignUploadResponse {
  files: PresignUploadFile[];
  count: number;
}

export interface SetPublicAclRequest {
  keys: string[];
}

export interface SetPublicAclResponse {
  success: boolean;
  successful: Array<{ key: string; success: boolean }>;
  failed: Array<{ key: string; error: string }>;
  total: number;
  successCount: number;
  failedCount: number;
}

// API call helper
const apiCall = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const url = `${IMAGE_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Image Upload Service
export const imageUploadService = {
  // Get presigned URLs for batch upload
  getPresignedUrls: async (filenames: string[], folder?: string): Promise<PresignUploadFile[]> => {
    const response = await apiCall<PresignUploadResponse>(
      '/presign-upload-batch',
      {
        method: 'POST',
        body: JSON.stringify({ files: filenames, folder }),
      }
    );
    return response.files;
  },

  // Upload image to presigned URL
  uploadImage: async (presignedUrl: string, imageFile: File | Blob): Promise<void> => {
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: imageFile,
      headers: {
        'Content-Type': imageFile.type || 'image/jpeg',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.status}`);
    }
  },

  // Set public ACL for uploaded files
  setPublicAcl: async (keys: string[]): Promise<SetPublicAclResponse> => {
    return apiCall<SetPublicAclResponse>(
      '/set-public-acl-batch',
      {
        method: 'POST',
        body: JSON.stringify({ keys }),
      }
    );
  },

  // Complete upload flow: get presigned URL, upload, set ACL
  uploadImageComplete: async (
    imageFile: File | Blob,
    filename: string,
    folder: string = 'inspection-failed-items'
  ): Promise<string> => {
    // Step 1: Get presigned URL
    const [presignedFile] = await imageUploadService.getPresignedUrls([filename], folder);
    
    if (!presignedFile) {
      throw new Error('Failed to get presigned URL');
    }

    // Step 2: Upload image
    await imageUploadService.uploadImage(presignedFile.uploadUrl, imageFile);

    // Step 3: Set public ACL
    await imageUploadService.setPublicAcl([presignedFile.key]);

    // Return public URL
    return presignedFile.publicUrl;
  },
};

