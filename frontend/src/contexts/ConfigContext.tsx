'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { configService } from '@/lib/config';

type AppConfig = {
  apiUrl: string;
  apiBaseUrl: string;
  nextAuthUrl?: string;
};

type ConfigContextType = {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

type ConfigProviderProps = {
  children: ReactNode;
  initialConfig?: AppConfig | null; // Accept preloaded config
};

export function ConfigProvider({ children, initialConfig }: ConfigProviderProps) {
  const [config, setConfig] = useState<AppConfig | null>(initialConfig || null);
  const [loading, setLoading] = useState(!initialConfig); // Don't load if we have initial config
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Skip loading if we already have initial config
    if (initialConfig) {
      setConfig(initialConfig);
      setLoading(false);
      return;
    }

    async function loadConfig() {
      try {
        setLoading(true);
        const appConfig = await configService.getConfig();
        setConfig(appConfig);
        setError(null);
      } catch (err) {
        console.error('Failed to load config:', err);
        setError(err instanceof Error ? err.message : 'Failed to load config');
        // Set fallback config
        setConfig({
          apiUrl: 'http://localhost:8081',
          apiBaseUrl: 'http://localhost:8081',
          nextAuthUrl: 'http://localhost:3000'
        });
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [initialConfig]);

  return (
    <ConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}