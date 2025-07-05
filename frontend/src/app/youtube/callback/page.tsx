'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { getSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export const dynamic = 'force-dynamic';
  

function CallbackContent() {
    const searchParams = useSearchParams();
    const [result, setResult] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [countdown, setCountdown] = useState<number>(5);
    const router = useRouter();


    useEffect(() => {
        const handleCallback = async () => {
            const code = searchParams?.get('code');
            const state = searchParams?.get('state');
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
        <div className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold mb-6">YouTube OAuth Callback</h2>
            {isLoading ? (
                <div className="flex items-center">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin h-5 w-5 mr-2" />
                    <span>Processing callback...</span>
                </div>
            ) : (
                <>
                    <p className={isSuccess ? 'text-green-600' : 'text-red-600'}>
                        {result}
                    </p>
                    {isSuccess && countdown > 0 && (
                        <p className="text-gray-500 mt-2">
                            Redirecting to channels in {countdown} seconds...
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

export default function YouTubeCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-screen">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin h-8 w-8 text-blue-600" />
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}