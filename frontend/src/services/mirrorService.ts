import { getSession } from 'next-auth/react';
import { api } from '@/lib/api';

export interface AddMirrorResponse {
    message: string;
    mirror: MirrorItem;
}

export interface MirrorItem {
    ID: string;
    RoomId: string;
    DisplayName: string;
    Title: string;
    LiveUrl: string;
    RtmpUrl: string;
    StreamKey: string;
    UserAgent: string;
    IsAlive: boolean;
    StartedAt: string | null;
    StoppedAt: string | null;
    CreatedAt: string;
    UpdatedAt: string;
    DeletedAt: string | null;
    FFmpegPID: string | null;
    Status: string;
    UserId: string;
    ChannelId: string;
}

export interface MirrorListResponse {
    mirrors: MirrorItem[];
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}

export async function addMirror(roomId: string) {
    const session = await getSession();
    const data = {
        "tiktok": roomId
    };
    const response = await api.post<AddMirrorResponse>(`/api/mirrors`, data, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });

    return response;
}

export async function getMirrors() {
    const session = await getSession();
    const response = await api.get<MirrorListResponse>(`/api/mirrors`, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    return response;
}

export async function saveStreamKey(mirrorId: string, streamKey: string) {
    const session = await getSession();
    const response = await api.put<void>(`/api/mirrors/${mirrorId}/stream-key`, {
        "stream_key": streamKey
    }, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    })

    return response;
}

export async function deleteMirror(mirrorId: string) {
    const session = await getSession();
    const response = await api.delete<void>(`/api/mirrors/${mirrorId}`, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    return response;
}

export async function saveRtmpUrl(mirrorId: string, rtmpUrl: string) {
    const session = await getSession();
    const response = await api.put<void>(`/api/mirrors/${mirrorId}/rtmp-url`, {
        "rtmp_url": rtmpUrl
    }, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    })
    return response;
}


export async function actionMirror(mirrorId: string, action: 'start' | 'stop') {
    const session = await getSession();
    const response = await api.post<void>(`/api/mirrors/${mirrorId}/${action}`, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    return response;
}

export async function bindChannel(mirrorId: string, channelId: string, streamKey: string) {
    const session = await getSession();
    const response = await api.post<void>(`/api/mirrors/${mirrorId}/channel-id`, {
        "channel_id": channelId,
        "stream_key": streamKey
    }, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    return response;
}