'use client';
import { useState, useEffect, useRef } from 'react';
import { Card, Button, Spinner } from 'react-bootstrap';
import { FaEye, FaUserFriends, FaPlusCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface TikTokOwner {
  display_id: string;
  avatar_thumb?: {
    url_list?: string[];
  };
}

interface TikTokStats {
  total_user?: number;
}

export interface TikTokRoom {
  id_str: string;
  title: string;
  owner: TikTokOwner;
  stats?: TikTokStats;
  live_url?: string;
  // Add other properties as needed
}

interface TikTokCardProps {
  room: TikTokRoom;
  onAddToMirror?: (roomId: string) => Promise<void>;
  loading?: boolean;
}

export default function TikTokCard({ room, onAddToMirror, loading = false }: TikTokCardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [player, setPlayer] = useState<any>(null);

  const username = room.owner?.display_id || 'unknown';
  const avatarUrl = room.owner?.avatar_thumb?.url_list?.[0];
  const avatarText = username.charAt(0).toUpperCase();
  const viewCount = formatNumber(room.stats?.total_user || 0);
  const isHls = room.live_url?.includes('.m3u8');
  const isFlv = room.live_url?.includes('.flv');

  // Format number for display (e.g., 1500 -> 1.5K)
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Initialize video player
  useEffect(() => {
    if (!room.live_url || !videoRef.current) return;

    let videoPlayer: any = null;

    const initializePlayer = async () => {
      try {
        if (isFlv) {
          // For FLV streams using flv.js
          const flvjs = (window as any).flvjs;
          if (flvjs && flvjs.isSupported() && videoRef.current) {
            videoPlayer = flvjs.createPlayer({
              type: 'flv',
              url: room.live_url,
              isLive: true,
              hasAudio: true,
              hasVideo: true,
              enableStashBuffer: false,
              stashInitialSize: 128,
            });
            videoPlayer.attachMediaElement(videoRef.current);
            videoPlayer.load();
            setPlayer(videoPlayer);
          }
        } else if (isHls) {
          // For HLS streams using hls.js
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported() && videoRef.current) {
            videoPlayer = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
            });
            videoPlayer.loadSource(room.live_url);
            videoPlayer.attachMedia(videoRef.current);
            setPlayer(videoPlayer);
          } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support for Safari
            videoRef.current.src = room.live_url;
          }
        }
      } catch (error) {
        console.error('Error initializing video player:', error);
      }
    };

    initializePlayer();

    // Cleanup function
    return () => {
      if (videoPlayer) {
        try {
          if (videoPlayer.destroy) {
            videoPlayer.destroy();
          } else if (videoPlayer.detachMedia) {
            videoPlayer.detachMedia();
          }
        } catch (e) {
          console.error('Error cleaning up video player:', e);
        }
      }
    };
  }, [room.live_url, isFlv, isHls]);

  const handleAddToMirror = async () => {
    if (!onAddToMirror) return;
    
    setIsAdding(true);
    try {
      await onAddToMirror(room.id_str);
      toast.success('Added to mirror successfully');
    } catch (error) {
      console.error('Error adding to mirror:', error);
      toast.error('Failed to add to mirror');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCardClick = () => {
    if (!session?.user) {
      router.push('/login');
      return;
    }
    // Handle card click if needed
  };

  return (
    <Card 
      className="h-100 shadow-sm" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="position-relative" style={{ paddingTop: '56.25%' }}> {/* 16:9 Aspect Ratio */}
        {room.live_url ? (
          <>
            <video
              ref={videoRef}
              className="position-absolute top-0 start-0 w-100 h-100"
              style={{ objectFit: 'cover' }}
              playsInline
              controls={isHovered}
              autoPlay
              muted
            />
            <div className="position-absolute top-0 end-0 m-2">
              <span className="badge bg-danger">
                <FaEye className="me-1" /> LIVE
              </span>
            </div>
          </>
        ) : (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-light">
            <div className="text-center">
              <div className="text-muted mb-2">
                <FaEye size={24} />
              </div>
              <p className="mb-0 text-muted">No stream available</p>
            </div>
          </div>
        )}
      </div>
      
      <Card.Body>
        <div className="d-flex align-items-start mb-3">
          <div className="me-3">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={username} 
                className="rounded-circle" 
                style={{ width: '40px', height: '40px', objectFit: 'cover' }} 
              />
            ) : (
              <div 
                className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                style={{ width: '40px', height: '40px' }}
              >
                {avatarText}
              </div>
            )}
          </div>
          <div className="flex-grow-1">
            <h6 className="mb-1 text-truncate" title={room.title}>
              {room.title || 'Untitled Stream'}
            </h6>
            <p className="text-muted small mb-0">@{username}</p>
          </div>
        </div>
        
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center text-muted small">
            <FaUserFriends className="me-1" />
            <span>{viewCount} watching</span>
          </div>
          
          {onAddToMirror && (
            <Button 
              variant="primary" 
              size="sm"
              onClick={handleAddToMirror}
              disabled={isAdding || loading}
            >
              {isAdding ? (
                <>
                  <Spinner as="span" size="sm" animation="border" role="status" aria-hidden="true" className="me-1" />
                  Adding...
                </>
              ) : (
                <>
                  <FaPlusCircle className="me-1" /> Add to Mirror
                </>
              )}
            </Button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
