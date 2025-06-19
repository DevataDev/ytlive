import { api, ApiResponse } from '@/lib/api';
import { getSession } from 'next-auth/react';

export interface Stream {
  id: string;
  name: string;
  description?: string;
  rtmpUrl: string;
  streamKey: string;
  status: 'live' | 'idle' | 'scheduled' | 'error' | string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  stoppedAt?: string;
  scheduledAt?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  loopCount?: number;
  loopVideo: boolean;
  maxBitrate?: number;
  fileSizeBytes?: number;
  mediaFiles: MediaFile[];
  fileSize?: number;
  filePath?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  isActive?: boolean;
  userID?: string;
  channelID?: string;
  channelTitle?: string;
  streamURL?: string;
  playbackURL?: string;
  hlsPlaybackURL?: string;
  dashPlaybackURL?: string;
  recordingEnabled?: boolean;
  recordingPath?: string;
  recordingRetentionDays?: number;
  isArchived?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
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

export interface MediaListResponse {
  files: MediaFileData[];
  pagination: MediaListPagination;
}


export interface MediaListPagination {
  has_more: boolean;
  limit: number;
  offset: number;
  total: number;
}

export interface MediaFileData {
  id: string;
  stream_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  media_type: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
  stream_count: number;
  stream_names: string;
  streams: Stream[];
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
  let url = `/api/streams?page=${page}&per_page=${pageSize}&search=${search}`;
  const response = await api.get<StreamListResponse>(url, { 
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` } 
  });
  return response;
};

export const updateStream = async (id: string, streamData: Partial<Stream>): Promise<Stream> => {
  const session = await getSession();
  const jsonData = {
    "name": streamData.name,
    "description": streamData.description,
  }
  const response = await api.putRaw<Stream>(`/api/streams/${id}`, jsonData, {
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

export const bindChannel = async (streamId: string, channelId: string, streamKey: string): Promise<void> => {
  const session = await getSession();
  const response = await api.put<void>(
    `/api/streams/${streamId}/channel-id`,
    { "channel_id": channelId, "stream_key": streamKey  },
    { headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` } }
  );
  return response;
};

export interface CreateStreamNewData {
  Name: string;
  Description?: string;
  MediaFileIds?: string[];
  IsActive?: boolean;
}

export interface CreateStreamNewResponse extends SuccessResponse {
  ID: string;
}

export interface CreateStreamNewUploadResponse extends SuccessResponse {
  stream: Stream;
}

export const createStreamNew = async (streamData: CreateStreamNewData): Promise<CreateStreamNewResponse> => {
  const session = await getSession();
  const jsonData = {
    name: streamData.Name,
    description: streamData.Description,
    media_file_ids: streamData.MediaFileIds,
    is_active: streamData.IsActive !== undefined ? streamData.IsActive : false,
  };
  const response = await api.post<CreateStreamNewResponse>('/api/streams/new', jsonData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response;
}

export const createStreamNewUpload = async (streamData: CreateStreamNewData): Promise<CreateStreamNewUploadResponse> => {
  const session = await getSession();
  const jsonData = {
    name: streamData.Name,
    description: streamData.Description,
    media_file_ids: streamData.MediaFileIds,
    is_active: streamData.IsActive !== undefined ? streamData.IsActive : false,
  };
  const response = await api.post<CreateStreamNewUploadResponse>('/api/streams/new', jsonData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response;
}

export const createStream = async (streamData: Omit<Stream, 'ID' | 'CreatedAt' | 'UpdatedAt' | 'Status' | 'MediaFiles'>): Promise<Stream> => {
  const session = await getSession();
  const response = await api.postRaw<Stream>('/api/streams', streamData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response.data;
};

export interface StreamScheduleRequest {
  ScheduledAt: string | null;
  StoppedAt: string | null;
  Timezone: string;
}

export interface StreamDurationRequest {
  DurationHours: number;
}

export interface StreamLoopCountRequest {
  LoopCount: number;
}

export const setStreamSchedule = async (id: string, scheduleData: StreamScheduleRequest): Promise<void> => {
  const session = await getSession();
  await api.putRaw(`/api/streams/${id}/schedule`, scheduleData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
};

export const setStreamDuration = async (id: string, durationData: StreamDurationRequest): Promise<void> => {
  const session = await getSession();
  await api.putRaw(`/api/streams/${id}/duration`, durationData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
};

export const setStreamLoopCount = async (id: string, loopCountData: StreamLoopCountRequest): Promise<void> => {
  const session = await getSession();
  await api.putRaw(`/api/streams/${id}/loopcount`, loopCountData, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
};
