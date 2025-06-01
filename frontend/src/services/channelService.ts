import { getSession } from 'next-auth/react';
import { api } from '@/lib/api';

export interface Channels {
    channels: Channel[];
}

export interface Channel {
    ID: string;
    ChannelID: string;
    ChannelName: string;
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
  