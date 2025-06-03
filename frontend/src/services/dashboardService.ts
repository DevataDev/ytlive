import { getSession } from 'next-auth/react';
import DashboardWebSocket from '@/lib/websocket';
import { api } from '@/lib/api';

export interface WebSocketMetrics {
  cpu: number;
  memory: number;
  ram_total: number;
  ram_used: number;
  upload: number;
  download: number;
  type: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  ramTotal: number;
  ramUsed: number;
  upload: number;
  download: number;
}

export interface DashboardStats {
  totalStreams: number;
  activeStreams: number;
  totalMirrors: number;
  activeMonitors: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  recentActivities: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface FileCounts {
  audio: number;
  videos: number;
}

export interface StorageInfo {
  fileCounts: FileCounts;
  free: number;
  total: number;
  used: number;
  used_percent: number;
}

export interface StreamStats {
  started: number;
  scheduled: number;
  total: number;
}

export interface RecentActivities {
  activities: Array<Activity>;
  success: boolean;
}

export interface Activity {
    description: string,
    event: string,
    icon: string,
    id: string,
    status: string,
    timestamp: string
}

class DashboardService {
  private static instance: DashboardService;
  private ws: DashboardWebSocket | null = null;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  private formatMbps(bytes: number): number {
    return (bytes / 1024 / 1024);
  }

  public async fetchStorageInfo(): Promise<StorageInfo> {
    const session = await getSession();
    const data = await api.get<StorageInfo>(`api/dashboard/storage`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.user?.backendToken}`,
      },
    });
    
    // Ensure we have default values in case the API changes
    return {
      fileCounts: data.fileCounts || { audio: 0, videos: 0 },
      free: data.free || 0,
      total: data.total || 0,
      used: data.used || 0,
      used_percent: data.used_percent || 0
    };
  }

  public async fetchStreamStats(): Promise<StreamStats> {
    const session = await getSession();
    const response = await api.get<StreamStats>(`/api/dashboard/streams`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.user?.backendToken}`,
      },
    });
    
    return response;
  }

  public async fetchRecentActivities(): Promise<RecentActivities> {
    const session = await getSession();
    const response = await api.get<RecentActivities>(`/api/dashboard/activities/recent`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.user?.backendToken}`,
      },
    });
    
    return response;
  }

  public connectWebSocket(
    onMetricsUpdate: (metrics: SystemMetrics) => void,
    onError?: (error: Event) => void
  ) {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new DashboardWebSocket({
      onMessage: (message: WebSocketMetrics) => {
        if (message.type === 'dashboard_metrics') {
          // Transform the WebSocket message to match SystemMetrics interface
          const metrics: SystemMetrics = {
            cpu: message.cpu,
            memory: message.memory,
            ramTotal: message.ram_total,
            ramUsed: message.ram_used,
            upload: message.upload,
            download: message.download
          };
          onMetricsUpdate(metrics);
        }
      },
      onError: (error: Event) => {
        console.error('WebSocket error:', error);
        if (onError) {
          onError(error);
        }
      },
      onClose: () => {
        console.log('WebSocket connection closed');
      },
      onOpen: () => {
        console.log('WebSocket connection established');
      }
    });

    this.ws.connect();
  }

  public disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default DashboardService.getInstance();
