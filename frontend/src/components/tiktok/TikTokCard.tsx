'use client';
import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, Button, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  FaEye,
  FaUserFriends,
  FaPlusCircle,
  FaVolumeMute,
  FaVolumeUp,
  FaPlay,
  FaPause,
  FaExclamationTriangle,
  FaFire
} from 'react-icons/fa';
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

  // Toggle play/pause on hover
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (playerRef.current) {
      setIsPlaying(true);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (playerRef.current) {
      setIsPlaying(false);
    }
  }, []);

  // Toggle play/pause on click
  const togglePlayPause = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
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

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('Error playing video:', error);
    setHasError(true);
  }, []);

  const handleReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const handleBuffer = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handleBufferEnd = useCallback(() => {
    setIsBuffering(false);
  }, []);

  // Check if the URL is a supported format
  const isSupportedFormat = useCallback((url: string): boolean => {
    if (!url) return false;
    const supportedFormats = ['.m3u8', '.mp4', '.webm', '.ogg', '.flv', '.f4v'];
    return supportedFormats.some(format => url.includes(format));
  }, []);

  const blinkingStyles = `
  @keyframes blink-live {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }
  @keyframes blink-hot {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.4; }
  }
  .blink-live {
    animation: blink-live 1.5s infinite;
  }
  .blink-hot {
    animation: blink-hot 1.2s infinite;
  }
`;

  const renderPlayer = () => {
    if (!room.live_url) {
      return (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-light">
          <div className="text-center">
            <div className="text-muted mb-2">
              <FaEye size={24} />
            </div>
            <p className="mb-0 text-muted">No stream available</p>
          </div>
        </div>
      );
    }

    if (!isSupportedFormat(room.live_url)) {
      return (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-dark text-white p-3">
          <FaExclamationTriangle className="text-warning mb-2" size={32} />
          <p className="text-center mb-0">Unsupported video format</p>
          <small className="text-muted text-center">URL: {room.live_url.substring(0, 30)}...</small>
        </div>
      );
    }

    return (
      <div className="position-absolute top-0 start-0 w-100 h-100" style={{ backgroundColor: '#000' }}>
        <ReactPlayer
          ref={playerRef}
          url={room.live_url}
          playing={isPlaying}
          muted={isMuted}
          width="100%"
          height="100%"
          playsinline
          controls={isHovered}
          mute
          style={{ position: 'absolute', top: 0, left: 0 }}
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          onBuffer={handleBuffer}
          onBufferEnd={handleBufferEnd}
          config={{
            file: {
              forceFLV: room.live_url.includes('.flv'),
              forceHLS: room.live_url.includes('.m3u8'),
              hlsOptions: {
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
              },
            },
          }}
        />
        {/* Live badge and Trending indicator */}
        <div className="position-absolute top-0 end-0 m-2">
          <div className="d-flex flex-column gap-1">
            {isTrending && (
              <span className="badge bg-warning text-dark blink-hot">
                <FaFire className="me-1" /> HOT
              </span>
            )}
            {!isTrending && (
              <span className="badge bg-danger blink-live">
                <FaEye className="me-1" /> LIVE
              </span>
            )}
          </div>
        </div>
        {/* Loading overlay */}
        {!isReady || isBuffering ? (
          <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
            <Spinner animation="border" variant="light" />
          </div>
        ) : null}

        {/* Play/Pause overlay */}
        {!isHovered && isReady && !isBuffering && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{ cursor: 'pointer', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
            onClick={togglePlayPause}
          >
            {!isPlaying && (
              <div className="bg-dark bg-opacity-50 rounded-circle p-3">
                <FaPlay size={24} className="text-white" />
              </div>
            )}
          </div>
        )}

        {/* Mute/Unmute button */}
        {isReady && !isBuffering && (
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={`mute-tooltip-${room.id_str}`}>
              {isMuted ? 'Unmute' : 'Mute'}
            </Tooltip>}
          >
            <div
              className="position-absolute bottom-0 end-0 m-2"
              onClick={toggleMute}
              style={{
                width: '30px',
                height: '30px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              {isMuted ? (
                <FaVolumeMute className="text-white" size={14} />
              ) : (
                <FaVolumeUp className="text-white" size={14} />
              )}
            </div>
          </OverlayTrigger>
        )}
      </div>
    );
  };

  return (
    <>
    <style>{blinkingStyles}</style>
    <Card
      className="h-100 shadow-sm"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      <div
        ref={containerRef}
        className="position-relative"
        style={{
          paddingTop: '56.25%', // 16:9 Aspect Ratio
          backgroundColor: '#000',
          overflow: 'hidden',
        }}
      >
        {renderPlayer()}
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
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id={`title-tooltip-${room.id_str}`}>
                  {room.title || 'Untitled Stream'}
                </Tooltip>
              }
            >
              <h6
                className="mb-1 text-truncate"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  display: 'inline-block',
                  verticalAlign: 'middle'
                }}
              >
                {room.title || 'Untitled Stream'}
              </h6>
            </OverlayTrigger>
            <p className="text-muted small mb-0 text-truncate">@{username}</p>
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
              onClick={(e) => {
                e.stopPropagation();
                handleAddToMirror();
              }}
              disabled={isAdding || loading}
            >
              {isAdding ? (
                <>
                  <Spinner as="span" size="sm" animation="border" role="status" className="me-1" />
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
    </>
  );
}
