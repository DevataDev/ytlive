import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faTrash, faEye, faEyeSlash, faSave } from '@fortawesome/free-solid-svg-icons';
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
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <FontAwesomeIcon icon={faCircle} className="mr-1 h-2 w-2" />
          Live
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <FontAwesomeIcon icon={faCircle} className="mr-1 h-2 w-2" />
          Offline
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full">
      <div className="p-4">
        {/* Header with title */}
        <div className="mb-4">
          <div className="font-semibold text-gray-900 truncate" title={mirror.Title || mirror.DisplayName}>
            {mirror.Title || 'Untitled'}
          </div>
          <div className="text-sm text-gray-500 truncate">
            {mirror.DisplayName}
          </div>
        </div>

        {/* Video Preview */}
        <div className="mb-4">
          {mirror.LiveUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <ReactPlayer
                url={mirror.LiveUrl}
                width="100%"
                height="180px"
                playing
                controls
                muted={isMuted}
                playsinline
                className="w-full"
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
            </div>
          ) : (
            <div className="w-full h-45 flex items-center justify-center text-white bg-black rounded-lg">
              <span>No video available</span>
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="mb-4">
          {getStatusBadge()}
        </div>

        {/* Platform Selector */}
        <div className="mb-4">
          <PlatformSelector
            selectedPlatform={selectedPlatform}
            customRtmpUrl={customRtmpUrl}
            streamKey={streamKey}
            onPlatformChange={(platform: Platform) => {
              setSelectedPlatform(platform.id);
              if (platform.id !== 'custom' &&  platform.id !== 'shopee' && platform.isDynamicRtmpUrl == false ) {
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
        <div className="space-y-3">
          <button
            className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
              isLive 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-green-600 hover:bg-green-700 text-white'
            } ${
              (!canStart || isQueued || isProcessing) 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
            onClick={() => onToggle(mirror.ID, isLive ? 'stop' : 'start')}
            disabled={!canStart || isQueued || isProcessing}
          >
            {isProcessing && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {isLive ? 'Stop' : 'Start'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium"
              onClick={() => { setShowBindModal(true); }}
            >
              Bind
            </button>
            <button
              className="px-4 py-2 border border-cyan-300 text-cyan-700 rounded-lg hover:bg-cyan-50 transition-colors font-medium"
              onClick={() => { handleViewLogs(mirror.ID);  }}
            >
              Logs
            </button>
          </div>

          <button
            className={`w-full px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => onDelete(mirror.ID)}
            disabled={isProcessing}
          >
            <FontAwesomeIcon icon={faTrash} className="mr-2 h-4 w-4" />
            Delete
          </button>
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
