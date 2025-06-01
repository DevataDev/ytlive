import {api} from '@/lib/api';

export interface TikTokRoomOwner {
  display_id: string;
  avatar_thumb?: {
    url_list?: string[];
  };
}

export interface TikTokRoomStats {
  total_user?: number;
}

export interface TikTokRoom {
  id_str: string;
  title: string;
  owner: TikTokRoomOwner;
  stats?: TikTokRoomStats;
  live_url?: string;
  cover_url?: string;
  create_time?: number;
  status?: number;
}

export interface TikTokPagination {
  has_more: boolean;
  search_id?: string;
  offset?: number;
  total?: number;
}

export interface TikTokLiveFeedResponse {
  rooms: TikTokRoom[];
  pagination: TikTokPagination;
  total: number;
}

interface FetchLiveFeedsParams {
  isLoadMore?: boolean;
  offset?: number;
  limit?: number;
  searchId?: string;
}

/**
 * Fetches live TikTok feeds with pagination
 */
export const fetchLiveFeeds = async ({
  isLoadMore = false,
  offset = 0,
  limit = 6,
  searchId = ''
}: FetchLiveFeedsParams = {}): Promise<TikTokLiveFeedResponse> => {
  const params = new URLSearchParams();
  
  if (isLoadMore) {
    params.append('is_load_more', 'true');
  } else {
    params.append('is_load_more', 'false');
  }
  
  params.append('offset', offset.toString());
  params.append('limit', limit.toString());

  if (searchId) {
    params.append('search_id', searchId);
  }

  const response = await api.get<TikTokLiveFeedResponse>(`/api/tiktok/live-feed?${params.toString()}`);
  return response;
};

interface AddToMirrorParams {
  tiktok: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Adds a TikTok live to mirrors
 */
export const addToMirror = async (data: AddToMirrorParams): Promise<{ data: any }> => {
  return await api.post('/api/mirrors', data);
};

/**
 * Fetches a single TikTok live room details
 */
export const getLiveRoom = async (roomId: string): Promise<TikTokRoom> => {
  const response = await api.get<TikTokRoom>(`/api/tiktok/room/${roomId}`);
  return response;
};

/**
 * Searches for TikTok live rooms
 */
interface SearchLiveRoomsParams {
  query: string;
  page?: number;
  searchId?: string;
}

export const searchLiveRooms = async (
  query: string,
  page: number = 1,
  searchId: string = ''
): Promise<TikTokLiveFeedResponse> => {
  const params = new URLSearchParams();
  params.append('query', query);
  
  if (page) params.append('page', page.toString());
  if (page > 1) {
    params.append('is_load_more', 'true');
  } else {
    params.append('is_load_more', 'false');
  }
  if (searchId) params.append('search_id', searchId);
  
  const response = await api.get<TikTokLiveFeedResponse>(`/api/tiktok/search?${params.toString()}`);
  return response;
};