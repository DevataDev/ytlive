import { api } from '@/lib/api';
import { getSession } from 'next-auth/react';

export interface Channels {
    channels: Channel[];
}

export interface Channel {
    ID: string;
    ChannelID: string;
    ChannelName: string;
    ThumbnailURL?: string;
    AccessToken: string;
    RefreshToken: string;
    ExpiresAt: string;
    CreatedAt: string;
    UpdatedAt: string;
    DeletedAt: string;
    UserId: string;
}

export interface ChannelStreamKeys {
    streams: StreamKey[];
}

export interface StreamKey {
    id: string;
    stream_key: string;
    title: string;
}

export interface AuthorizeResponse {
    auth_url: string;
}

export const fetchListYoutubeChannels = async (): Promise<Channel[]> => {
  const session = await getSession();
  const response = await api.get<Channels>('/api/youtube/list-channels', {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  
  // The response is already the Channels object
  const channels = response as unknown as Channels;
  return channels.channels || [];
};

export const fetchChannelStreamKeys = async (channelId: string): Promise<ChannelStreamKeys> => {
  const session = await getSession();
  const response = await api.get<ChannelStreamKeys>(`/api/youtube/channel/${channelId}/streams`, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  // The response is already the ChannelStreamKeys object
  return response as unknown as ChannelStreamKeys;
};

export const authorizeYouTubeChannel = async (): Promise<AuthorizeResponse> => {
  const session = await getSession();
  const response = await api.get<AuthorizeResponse>('/api/youtube/authorize', {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
  return response as unknown as AuthorizeResponse;
};

export const deleteYouTubeChannel = async (channelId: string): Promise<void> => {
  const session = await getSession();
  await api.delete(`/api/youtube/channels/${channelId}`, {
    headers: { 'Authorization': `Bearer ${session?.user?.backendToken}` }
  });
};
  