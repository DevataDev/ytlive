'use client';

import { useState } from 'react';
import TikTokCard, { TikTokRoom } from '@/components/tiktok/TikTokCard';

export default function TikTokLivePage() {
  // State for loading state
  const [isLoading, setIsLoading] = useState(false);

  // Handle adding to mirror
  const handleAddToMirror = async (roomId: string) => {
    setIsLoading(true);
    try {
      // Your logic to add to mirror
      console.log('Adding room to mirror:', roomId);
      // Example API call:
      // await api.post('/api/mirrors', { roomId });
    } catch (error) {
      console.error('Failed to add to mirror:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock room data - replace with actual data fetching
  const roomData: TikTokRoom = {
    id_str: '123',
    title: 'Room Title',
    owner: {
      display_id: 'ownerId',
      avatar_thumb: {
        url_list: ['https://example.com/avatar.jpg'],
      },
    },
    stats: {
      total_user: 100,
    },
    live_url: 'https://example.com/live',
  };

  return (
    <div className="container py-4">
      <h1>TikTok Live Streams</h1>
      <div className="row">
        <div className="col-md-6 col-lg-4 mb-4">
          <TikTokCard 
            room={roomData} 
            onAddToMirror={handleAddToMirror}
            loading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}