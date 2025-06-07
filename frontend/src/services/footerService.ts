import { getSession } from 'next-auth/react';
import { api } from '@/lib/api';

export interface VersionInfo {
    version: string;
    commit: string;
    date: string;
}

export async function fetchFooterInfo() {
    const session = await getSession();
    const data = await api.get<VersionInfo>(`/api/version`, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    return {
        version: data.version,
        commit: data.commit,
        buildTime: data.date
    };
}