import { configService } from '@/lib/config';
import { ConfigProvider } from '@/contexts/ConfigContext';

// Server component that preloads config
export async function ConfigPreloader({ children }: { children: React.ReactNode }) {
  // This runs on the server during SSR
  let preloadedConfig = null;
  
  try {
    // Load config server-side using environment variables
    preloadedConfig = {
      apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
      apiBaseUrl: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081',
      nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
    };
  } catch (error) {
    console.error('Failed to preload config:', error);
  }

  return (
    <ConfigProvider initialConfig={preloadedConfig}>
      {children}
    </ConfigProvider>
  );
}