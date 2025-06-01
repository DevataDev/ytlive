import { api, ApiResponse } from '@/lib/api';
import { getSession } from 'next-auth/react';

export interface Stream {
  ID: string;
  Name: string;
  Description?: string;
  RTMPUrl: string;
  StreamKey: string;
  Status: 'live' | 'idle' | 'scheduled' | 'error' | string;
  CreatedAt: string;
  UpdatedAt: string;
  StartedAt?: string;
  StoppedAt?: string;
  ScheduledAt?: string;
  ScheduledStartAt?: string;
  ScheduledEndAt?: string;
  LoopCount?: number;
  LoopVideo: boolean;
  MaxBitrate?: number;
  FileSizeBytes?: number;
  MediaFiles: MediaFile[];
  FileSize?: number;
  FilePath?: string;
  MimeType?: string;
  ThumbnailUrl?: string;
  IsActive?: boolean;
  UserID?: string;
  ChannelID?: string;
  ChannelTitle?: string;
  StreamURL?: string;
  PlaybackURL?: string;
  HLSPlaybackURL?: string;
  DashPlaybackURL?: string;
  RecordingEnabled?: boolean;
  RecordingPath?: string;
  RecordingRetentionDays?: number;
  IsArchived?: boolean;
  Tags?: string[];
  Metadata?: Record<string, any>;
}

export interface MediaFile {
  ID: string;
  FileName: string;
  FilePath: string;
  FileSize: number;
  MediaType: string;
  MimeType: string;
  Order: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface StreamListResponse {
  countLive: number;
  countScheduled: number;
  page: number;
  per_page: number;
  streams: Stream[];
  total: number;
}

export interface SuccessResponse {
  success: boolean;
}

export const fetchStreams = async (page = 1, pageSize = 10, search = ''): Promise<StreamListResponse> => {
  const session = await getSession();
  let url = `/api/streams?page=${page}&per_page=${pageSize}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const response = await api.getRaw<StreamListResponse>(url, { 
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` } 
  });
  return response.data;
};

export const updateStream = async (id: string, streamData: Partial<Stream>): Promise<Stream> => {
  const session = await getSession();
  const response = await api.putRaw<Stream>(`/api/streams/${id}`, streamData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export const deleteStream = async (id: string): Promise<void> => {
  const session = await getSession();
  await api.delete(`/api/streams/${id}`, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
};

export const startStream = async (id: string): Promise<Stream> => {
  const session = await getSession();
  const response = await api.postRaw<Stream>(`/api/streams/${id}/start`, {}, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export const stopStream = async (id: string): Promise<Stream> => {
  const session = await getSession();
  const response = await api.postRaw<Stream>(`/api/streams/${id}/stop`, {}, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export const renameStream = async (id: string, name: string, description: string): Promise<Stream> => {
  const session = await getSession();
  const response = await api.putRaw<Stream>(
    `/api/streams/${id}`, 
    { Name: name, Description: description },
    { 
      headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` } 
    }
  );
  return response.data;
};

export const updateStreamKey = async (id: string, streamKey: string): Promise<boolean> => {
  const session = await getSession();
  const response = await api.putRaw<SuccessResponse>(`/api/streams/${id}/streamkey`, { "stream_key": streamKey }, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.success;
};

export const updateRtmpUrl = async (id: string, rtmpUrl: string): Promise<Stream> => {
  const session = await getSession();
  const response = await api.putRaw<Stream>(`/api/streams/${id}`, { RTMPUrl: rtmpUrl }, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export const toggleLoopVideo = async (id: string, loop: boolean): Promise<Stream> => {
  const session = await getSession();
  const response = await api.putRaw<Stream>(`/api/streams/${id}`, { LoopVideo: loop }, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export const bindChannel = async (streamId: string, channelId: string, streamKey: string): Promise<Stream> => {
  const session = await getSession();
  const response = await api.postRaw<Stream>(
    `/api/streams/${streamId}/bind-channel`,
    { channelId, streamKey },
    { headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` } }
  );
  return response.data;
};

export const createStream = async (streamData: Omit<Stream, 'ID' | 'CreatedAt' | 'UpdatedAt' | 'Status' | 'MediaFiles'>): Promise<Stream> => {
  const session = await getSession();
  const response = await api.postRaw<Stream>('/api/streams', streamData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};
