import { getSession } from 'next-auth/react';
import { api } from '@/lib/api';

interface AddMirrorResponse {
    message: string;
    mirror: Mirror;
}

interface Mirror {
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

interface MirrorListResponse {
    mirrors: Mirror[];
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
