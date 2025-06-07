export interface Monitor {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isActive: boolean;
  lastChecked?: string;
  status?: 'online' | 'offline' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface MonitorFormData {
  username: string;
  isActive: boolean;
}
