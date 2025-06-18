'use client';
import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEye,
  faUserFriends,
  faPlus,
  faVolumeMute,
  faVolumeUp,
  faPlay,
  faPause,
  faExclamationTriangle,
  faFire,
  faCircle
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Dynamically import ReactPlayer with no SSR
const ReactPlayer = dynamic(() => import('react-player/lazy'), { ssr: false });

interface TikTokOwner {
  display_id: string;
  avatar_thumb?: {
    url_list?: string[];
  };
}

interface TikTokStats {
  total_user?: number;
}

interface TikTokRoom {
  id_str: string;
  title: string;
  owner: TikTokOwner;
  stats?: TikTokStats;
  live_url?: string;
}

interface TikTokCardProps {
  room: TikTokRoom;
  onAddToMirror?: (roomId: string) => Promise<void>;
  loading?: boolean;
}

export default function TikTokCard({ room, onAddToMirror, loading = false }: TikTokCardProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const username = room.owner?.display_id || 'unknown';
  const avatarUrl = room.owner?.avatar_thumb?.url_list?.[0];
  const avatarText = username.charAt(0).toUpperCase();
  const viewCount = formatNumber(room.stats?.total_user || 0);
  const isTrending = (room.stats?.total_user || 0) > 10000;

  // Format number for display (e.g., 1500 -> 1.5K)
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  // Toggle play/pause state
  const togglePlayState = useCallback((shouldPlay: boolean) => {
    setIsPlaying(prev => shouldPlay);
  }, []);

  // Toggle play/pause on hover
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Only pause if not clicked to play
    if (!isPlaying) {
      togglePlayState(false);
    }
  }, [isPlaying]);

  // Toggle play/pause on click
  const togglePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlayState(!isPlaying);
  }, [isPlaying]);

  // Toggle mute on click
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  }, [isMuted]);

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
  };

  const handleReady = useCallback(() => {
    console.log('Video is ready to play');
    setIsReady(true);
    setIsBuffering(false);
  }, []);

  const handleBuffer = useCallback(() => {
    console.log('Buffering video...');
    setIsBuffering(true);
  }, []);

  const handleBufferEnd = useCallback(() => {
    console.log('Buffering complete');
    setIsBuffering(false);
  }, []);
  
  const handlePlay = useCallback(() => {
    console.log('Video started playing');
    setIsPlaying(true);
    setIsBuffering(false);
  }, []);
  
  const handlePause = useCallback(() => {
    console.log('Video paused');
    setIsPlaying(false);
  }, []);
  
  const handleError = useCallback((error: any) => {
    console.error('Video error:', error);
    setHasError(true);
    setIsBuffering(false);
  }, []);

  // Check if the URL is a supported format
  const isSupportedFormat = useCallback((url: string): boolean => {
    if (!url) return false;
    
    // Check for common video formats
    const supportedFormats = ['.mp4', '.webm', '.ogg', '.m3u8', '.flv'];
    const lowerUrl = url.toLowerCase();
    
    return supportedFormats.some(format => lowerUrl.includes(format)) ||
           lowerUrl.includes('youtube.com') ||
           lowerUrl.includes('youtu.be') ||
           lowerUrl.includes('vimeo.com') ||
           lowerUrl.includes('twitch.tv') ||
           lowerUrl.includes('facebook.com') ||
           lowerUrl.includes('dailymotion.com') ||
           lowerUrl.includes('tiktok') ||
           lowerUrl.includes('tiktokcdn.com');
  }, []);

  // Blinking animation styles
  const blinkingStyles = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0.3; }
    }
    .blinking {
      animation: blink 1s infinite;
    }
  `;

  const renderPlayer = () => {
    const liveUrl = room.live_url;
    
    if (!liveUrl) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <FontAwesomeIcon icon={faExclamationTriangle} className="h-8 w-8 mb-2" />
            <p className="text-sm">No stream available</p>
          </div>
        </div>
      );
    }

    if (hasError || !isSupportedFormat(liveUrl)) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center text-white">
            <FontAwesomeIcon icon={faExclamationTriangle} className="h-8 w-8 mb-2" />
            <p className="text-sm">Stream unavailable</p>
            <p className="text-xs text-gray-400">Format not supported</p>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute inset-0">
        <ReactPlayer
          ref={playerRef}
          url={liveUrl}
          playing={isHovered || isPlaying}
          muted={isMuted}
          width="100%"
          height="100%"
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          onBuffer={handleBuffer}
          onBufferEnd={handleBufferEnd}
          playsinline
          config={{
            file: {
              attributes: {
                crossOrigin: 'anonymous',
                playsInline: true,
                disablePictureInPicture: true,
              },
              forceHLS: liveUrl.includes('m3u'),
              forceFLV: liveUrl.includes('flv'),
              hlsOptions: {
                enableWorker: true,
              },
            },
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          progressInterval={100}
          playIcon={<div />}
          light={false}
          fallback={<div>Loading video...</div>}
        />
        
        {/* Loading overlay - Only show when buffering or not ready */}
        {(isBuffering || !isReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}

        {/* Play/Pause overlay */}
        {isHovered && isReady && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className="w-16 h-16 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <FontAwesomeIcon 
                icon={isPlaying ? faPause : faPlay} 
                className="h-6 w-6 text-white" 
              />
            </div>
          </div>
        )}

        {/* Live indicator */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-600 text-white blinking">
            <FontAwesomeIcon icon={faCircle} className="h-2 w-2 mr-1" />
            LIVE
          </span>
        </div>

        {/* Trending indicator */}
        {isTrending && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-500 text-white">
              <FontAwesomeIcon icon={faFire} className="h-3 w-3 mr-1" />
              Trending
            </span>
          </div>
        )}

        {/* Mute/Unmute button */}
        {isHovered && isReady && (
          <div className="absolute bottom-2 right-2">
            <button
              onClick={toggleMute}
              className="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center cursor-pointer hover:bg-opacity-70 transition-opacity"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <FontAwesomeIcon 
                icon={isMuted ? faVolumeMute : faVolumeUp} 
                className="h-3 w-3 text-white" 
              />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <style>{blinkingStyles}</style>
      <div
        className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleCardClick}
      >
        <div
          ref={containerRef}
          className="relative bg-black overflow-hidden"
          style={{ paddingTop: '56.25%' }} // 16:9 Aspect Ratio
        >
          {renderPlayer()}
        </div>

        <div className="p-4">
          <div className="flex items-start mb-3">
            <div className="mr-3 flex-shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center text-sm font-medium">
                  {avatarText}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 
                className="text-sm font-medium text-gray-900 truncate mb-1"
                title={room.title || 'Untitled Stream'}
              >
                {room.title || 'Untitled Stream'}
              </h3>
              <p className="text-xs text-gray-500 truncate">@{username}</p>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center text-gray-500 text-xs">
              <FontAwesomeIcon icon={faUserFriends} className="h-3 w-3 mr-1" />
              <span>{viewCount} watching</span>
            </div>

            {onAddToMirror && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToMirror();
                }}
                disabled={isAdding || loading}
                className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                  (isAdding || loading) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isAdding ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPlus} className="h-3 w-3 mr-1" />
                    Add to Mirror
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
