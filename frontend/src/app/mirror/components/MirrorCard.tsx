import React, { useState } from 'react';
import { BsCircle, BsTrash, BsEye, BsEyeSlash, BsFloppyFill } from 'react-icons/bs';
import { toast } from 'react-toastify';
import { MirrorItem, saveStreamKey, saveRtmpUrl, bindChannel } from '@/services/mirrorService';
import BindChannelModal from '@/components/modals/BindChannelModal';
import ReactPlayer from 'react-player';
import FfmpegLogsModal from '@/components/modals/FfmpegLogsModal';
import { useFfmpegLogsModal } from '@/hooks/useFfmpegLogsModal';

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
    }
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

          {/* Stream URL */}
          <div className="mb-3">
            <div className="input-group input-group-sm">
              <input
                type="text"
                className="form-control"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                style={{ fontSize: '12px' }}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => saveStreamData(mirror.ID, rtmpUrl, 'Stream URL')}
                title="Save URL"
              >
                <BsFloppyFill size={14} />
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="mb-3">
            <label className="form-label small text-muted mb-1">Stream Key</label>
            <div className="input-group input-group-sm">
              <input
                type={showStreamKey ? 'text' : 'password'}
                className="form-control"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="Enter stream key"
                style={{ fontSize: '12px' }}
              />
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setShowStreamKey(!showStreamKey)}
                title={showStreamKey ? 'Hide stream key' : 'Show stream key'}
              >
                {showStreamKey ? <BsEyeSlash size={14} /> : <BsEye size={14} />}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => saveStreamData(mirror.ID, streamKey, 'Stream key')}
                title="Save stream key"
              >
                <BsFloppyFill size={14} />
              </button>
            </div>
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
