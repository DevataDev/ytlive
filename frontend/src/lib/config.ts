// Create a new config file
interface AppConfig {
  apiUrl: string;
  apiBaseUrl: string;
}

export const getConfig = (): AppConfig => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081';
  
  return {
    apiUrl,
    apiBaseUrl
  };
};