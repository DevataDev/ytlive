import { MonitorFormData } from '@/app/monitor/types/monitor';
import { api } from '@/lib/api';
import { getSession } from 'next-auth/react';


export interface MonitorListResponse {
  monitors: MonitorData[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface MonitorData {
  ID: string;
  UniqueId: string;
  StartedAt: string | null;
  StoppedAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  LastCheckedAt: string | null;
  RtmpUrl: string;
  StreamKey: string;
  UserId: string;
  IsLive: boolean;
  ChannelId: string;
}

export const fetchMonitors = async (page = 1, pageSize = 10, search = ''): Promise<{ data: Monitor[]; total: number }> => {
  const session = await getSession();
  let offset = (page - 1) * pageSize;
  let url = `/api/monitors?offset=${offset}&limit=${pageSize}`;
  
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  
  const response = await api.get<MonitorListResponse>(url, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken }` }
  });
  
  return {
    data: response.monitors || [],
    total: response.pagination.total || 0
  };
};

export const createMonitor = async (data: MonitorFormData): Promise<MonitorData> => {
  const session = await getSession();
  const response = await api.post('/api/monitors', data, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken }` }
  });
  return response as MonitorData;
};

export const updateMonitor = async (id: string, data: Partial<MonitorFormData>): Promise<MonitorData> => {
  const session = await getSession();
  const response = await api.put(`/api/monitors/${id}`, data, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken }` }
  });
  return response as MonitorData;
};

export const deleteMonitor = async (id: string): Promise<void> => {
  const session = await getSession();
  await api.delete(`/api/monitors/${id}`, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken }` }
  });
};

export const toggleMonitorStatus = async (id: string, isActive: boolean): Promise<void> => {
  const session = await getSession();
  await api.patch(`/api/monitors/${id}/status`, { isActive }, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken }` }
  });
};
