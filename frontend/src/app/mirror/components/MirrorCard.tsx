import React, { useState } from 'react';
import { BsCircle, BsTrash, BsEye, BsEyeSlash, BsFloppyFill } from 'react-icons/bs';
import { toast } from 'react-toastify';
import { MirrorItem, saveStreamKey, saveRtmpUrl, bindChannel } from '@/services/mirrorService';
import BindChannelModal from '@/components/modals/BindChannelModal';
import ReactPlayer from 'react-player';
import FfmpegLogsModal from '@/components/modals/FfmpegLogsModal';
import { useFfmpegLogsModal } from '@/hooks/useFfmpegLogsModal';
import PlatformSelector, { Platform, STREAMING_PLATFORMS } from '@/components/PlatformSelector';

interface MirrorCardProps {
  mirror: MirrorItem;
  onToggle: (id: string, action: 'start' | 'stop') => void;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  isProcessing: boolean;
}

export const MirrorCard: React.FC<MirrorCardProps> = ({
  mirror,
  onToggle,
  onDelete,
  onRefresh,
  isProcessing
}) => {
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [streamKey, setStreamKey] = useState(mirror.StreamKey || '');
  const [rtmpUrl, setRtmpUrl] = useState(mirror.RtmpUrl || 'rtmp://a.rtmp.youtube.com/live2/');
  const status = (mirror.Status || '').toLowerCase();
  const isLive = status === 'live';
  const isQueued = status === 'queued';
  const canStart =  !isLive ? (mirror.IsAlive && mirror.StreamKey && !isLive) : (mirror.IsAlive && mirror.StreamKey)
  const [isMuted, setIsMuted] = useState(true);
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindModalError, setBindModalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showModal, itemId, itemType, openModal, closeModal } = useFfmpegLogsModal();
  // Add these state variables after the existing ones
  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => {
    // Auto-detect platform based on current RTMP URL
    const currentUrl = mirror.RtmpUrl || 'rtmp://a.rtmp.youtube.com/live2/';
    const detectedPlatform = STREAMING_PLATFORMS.find(p => 
      p.rtmpUrl && currentUrl.includes(p.rtmpUrl.replace('rtmp://', '').replace('rtmps://', '').split('/')[0])
    );
    return detectedPlatform?.id || 'youtube';
  });
  const [customRtmpUrl, setCustomRtmpUrl] = useState(mirror.RtmpUrl || '');

  const handleViewLogs = (streamId: string) => {
    openModal(streamId, 'mirror');
  };

  // Handle bind channel
  const handleBindChannelSubmit = async (channelId: string, streamKey: string) => {
    try {
      setIsLoading(true);
      setBindModalError('');
      await bindChannel(mirror.ID, channelId, streamKey);
      setShowBindModal(false);
      onRefresh(mirror.ID);
      toast.success('Channel bound successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bind channel';
      setBindModalError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (isLive) {
      return (
        <span className="badge bg-success">
          <BsCircle className="me-1" /> Live
        </span>
      );
    } else {
      return (
        <span className="badge bg-secondary">
          <BsCircle className="me-1" /> Offline
        </span>
      );
    }
  };

  const saveStreamData = (mirrorId: string, data: string, label: string) => {
    // Save logic here
    if (label === 'Stream URL') {
      saveRtmpUrl(mirrorId, data);
    } else if (label === 'Stream key') {
      saveStreamKey(mirrorId, data);
      setStreamKey(data);
    }
    onRefresh(mirrorId);
    
    toast.success(`${label} saved successfully`);
    
  };

  return (
    <div className="">
      <div className="card h-100 shadow-sm" style={{ borderRadius: '12px' }}>
        <div className="card-body p-3">
          {/* Header with title */}
          <div className="mb-3">
            <div className="fw-bold fs-6" title={mirror.Title || mirror.DisplayName}>
              {mirror.Title || 'Untitled'}
            </div>
            <div className="text-muted small">
              @{mirror.DisplayName || ''}
            </div>
          </div>

          {/* Video Player Section */}
          <div className="mb-3">
            {mirror.LiveUrl ? (
              <ReactPlayer
                url={mirror.LiveUrl}
                width="100%"
                height="180px"
                playing
                controls
                muted={isMuted}
                playsinline
                className="w-100"
                style={{
                  maxHeight: '180px',
                  background: '#000',
                  borderRadius: '8px'
                }}
                config={{
                  file: {
                    forceFLV: mirror.LiveUrl.includes('.flv'),
                    forceHLS: mirror.LiveUrl.includes('.m3u8'),
                    hlsOptions: {
                      enableWorker: true,
                      lowLatencyMode: true,
                      backBufferLength: 90,
                    },
                  },
                }}
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23000'/%3E%3C/svg%3E"
              />
            ) : (
              <div
                className="w-100 d-flex align-items-center justify-content-center text-white"
                style={{
                  height: '180px',
                  background: '#000',
                  borderRadius: '8px'
                }}
              >
                <span>No video available</span>
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="mb-3">
            {getStatusBadge()}
          </div>

          {/* Platform Selector */}
          <div className="mb-3">
            <PlatformSelector
              selectedPlatform={selectedPlatform}
              customRtmpUrl={customRtmpUrl}
              streamKey={streamKey}
              onPlatformChange={(platform: Platform) => {
                setSelectedPlatform(platform.id);
                if (platform.id !== 'custom' &&  platform.id !== 'shopee' ) {
                  setRtmpUrl(platform.rtmpUrl);
                } else {
                  setRtmpUrl(customRtmpUrl);
                }
              }}
              onCustomRtmpChange={(url: string) => {
                setCustomRtmpUrl(url);
                setRtmpUrl(url);
              }}
              onStreamKeyChange={setStreamKey}
              onSave={() => {
                saveStreamData(mirror.ID, rtmpUrl, 'Stream URL');
                if (streamKey) {
                  saveStreamData(mirror.ID, streamKey, 'Stream key');
                }
              }}
              isLoading={false}
              showStreamKey={showStreamKey}
              onToggleStreamKeyVisibility={() => setShowStreamKey(!showStreamKey)}
            />
          </div>

          {/* Action Buttons */}
          <div className="d-grid gap-2">
            <button
              className={`btn ${isLive ? 'btn-danger' : 'btn-success'}`}
              onClick={() => onToggle(mirror.ID, isLive ? 'stop' : 'start')}
              disabled={!canStart || isQueued || isProcessing}
              style={{ borderRadius: '8px' }}
            >
              {isProcessing ? (
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              ) : null}
              {isLive ? 'Stop' : 'Start'}
            </button>

            <div className="row g-2">
              <div className="col">
                <button
                  className="btn btn-outline-primary w-100"
                  onClick={() => { setShowBindModal(true); }}
                  style={{ borderRadius: '8px' }}
                >
                  Bind
                </button>
              </div>
              <div className="col">
                <button
                  className="btn btn-outline-info w-100"
                  onClick={() => { handleViewLogs(mirror.ID);  }}
                  style={{ borderRadius: '8px' }}
                >
                  Logs
                </button>
              </div>
            </div>

            <button
              className="btn btn-outline-danger"
              onClick={() => onDelete(mirror.ID)}
              disabled={isProcessing}
              style={{ borderRadius: '8px' }}
            >
              <BsTrash className="me-1" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Global FFmpeg Logs Modal */}
      <FfmpegLogsModal
        show={showModal}
        onHide={closeModal}
        itemId={itemId}
        itemType={itemType}
        title="Mirror FFmpeg Logs"
      />

      {/* Bind Channel Modal */}
      <BindChannelModal
        show={showBindModal}
        onHide={() => {
          setShowBindModal(false);
          setBindModalError('');
        }}
        onBind={handleBindChannelSubmit}
        streamName={mirror.Title || ''}
        fetchChannels={async () => []} 
        fetchStreams={async () => []} 
        title="Bind Channel to Mirror"
        loading={isLoading}
        error={bindModalError}
      />
    </div>
  );
};

export default MirrorCard;
