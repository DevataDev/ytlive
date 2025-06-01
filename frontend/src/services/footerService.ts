import { getSession } from 'next-auth/react';

export async function fetchFooterInfo() {
    const session = await getSession();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/version`, {
        headers: {
            'Authorization': `Bearer ${session?.user?.backendToken}`
        }
    });
    const data = await response.json();
    return {
        version: data.version,
        commit: data.commit,
        buildTime: data.date
    };
}