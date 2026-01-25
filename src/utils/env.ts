// Runtime environment variable utility
// Reads from window.__ENV__ (injected at runtime) or falls back to import.meta.env (build time)

interface EnvConfig {
  VITE_API_URL?: string;
  VITE_API_URL_MAINTENANCE?: string;
  VITE_IMAGE_API_URL?: string;
}

declare global {
  interface Window {
    __ENV__?: EnvConfig;
  }
}

const getEnvVar = (key: keyof EnvConfig, defaultValue: string = ''): string => {
  // Try to get from runtime config (Cloud Run)
  // But check if it's not a placeholder (contains {{ or }})
  if (typeof window !== 'undefined' && window.__ENV__?.[key]) {
    const runtimeValue = window.__ENV__[key]!;
    // If it's a placeholder, skip it and use build-time env instead
    if (!runtimeValue.includes('{{') && !runtimeValue.includes('}}')) {
      return runtimeValue;
    }
  }
  
  // Fall back to build-time env (development)
  return import.meta.env[key] || defaultValue;
};

export const env = {
  VITE_API_URL: getEnvVar('VITE_API_URL', 'http://localhost:8000'),
  VITE_API_URL_MAINTENANCE: getEnvVar('VITE_API_URL_MAINTENANCE', 'http://localhost:8000'),
  VITE_IMAGE_API_URL: getEnvVar('VITE_IMAGE_API_URL', ''),
};

