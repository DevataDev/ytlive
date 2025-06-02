'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSession } from 'next-auth/react';

export default function YouTubeCallbackPage() {
    const [result, setResult] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [countdown, setCountdown] = useState<number>(5);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const session = await getSession();
            const jwtToken = session?.user?.backendToken;

            if (!code || !state) {
                setResult('Missing required parameters');
                setIsSuccess(false);
                setIsLoading(false);
                return;
            }

            if (!jwtToken) {
                setResult('Authentication required');
                setIsSuccess(false);
                setIsLoading(false);
                return;
            }

            try {
                const response = await api.get<void>(`/api/youtube/callback?code=${code}&state=${state}`);
                setIsLoading(false);

                setResult("Success");
                setIsSuccess(true);

                // Start countdown
                const timer = setInterval(() => {
                    setCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            router.push('/channels');
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);

                return () => clearInterval(timer);
            } catch (error) {
                console.error('Callback error:', error);
                setResult('Failed to callback');
                setIsSuccess(false);
                setIsLoading(false);
            }
        };

        handleCallback();
    }, [searchParams, router]);

    return (
        <div className="container-fluid container-xl dashboard-container">
            <h2>YouTube OAuth Callback</h2>
            {isLoading ? (
                <div className="d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <span>Processing callback...</span>
                </div>
            ) : (
                <>
                    <p className={isSuccess ? 'text-success' : 'text-danger'}>
                        {result}
                    </p>
                    {isSuccess && countdown > 0 && (
                        <p className="text-muted">
                            Redirecting to channels in {countdown} seconds...
                        </p>
                    )}
                </>
            )}
        </div>
    );
}