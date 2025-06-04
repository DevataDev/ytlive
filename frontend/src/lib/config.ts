// Runtime configuration service
interface AppConfig {
  apiUrl: string;
  apiBaseUrl: string;
}

class ConfigService {
  private config: AppConfig | null = null;
  private isLoaded = false;

  async getConfig(): Promise<AppConfig> {
    if (this.config?.apiUrl && this.isLoaded) {
      // If already loaded, return it
      console.log('Returning existing config : ', this.config);
      return this.config;
    }

    this.config = await this.loadConfig();
    console.log('Loaded config : ', this.config);
    return this.config;
  }

  private async loadConfig(): Promise<AppConfig> {
    try {
      // Try to load from runtime config endpoint first
      const response = await fetch('/config.json');
      const config = await response.json();
      console.log(`Loaded config got status ${response.status} and text ${JSON.stringify(config)}`);
      if (response.ok) {
        this.isLoaded = true;
        return {
          apiUrl: config.apiUrl || config.NEXT_PUBLIC_API_URL,
          apiBaseUrl: config.apiBaseUrl || config.NEXT_PUBLIC_API_BASE_URL
        };
      }
    } catch (error) {
      console.warn('Failed to load runtime config, falling back to environment variables : ', error);
    }

    console.log('Returning fallback config');

    // Fallback to build-time environment variables
    return {
      apiUrl: process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
      apiBaseUrl: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8081'
    };
  }

  // Synchronous getter for cases where config is already loaded
  getConfigSync(): AppConfig | null {
    return this.config;
  }

  // Method to set config manually (useful for testing or manual override)
  setConfig(config: AppConfig): void {
    this.config = config;
  }
}

export const configService = new ConfigService();
export type { AppConfig };