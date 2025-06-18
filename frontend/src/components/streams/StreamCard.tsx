'use client';

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlay, 
  faStop, 
  faSpinner, 
  faEllipsisVertical, 
  faPencil, 
  faLink, 
  faFolderOpen, 
  faTerminal, 
  faGear, 
  faTrash, 
  faCalendar, 
  faFileText, 
  faRepeat, 
  faClock,
  faTimes,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons';
import { Stream } from '@/services/streamService';
import BindChannelModal from '@/components/modals/BindChannelModal';
import styles from './StreamCard.module.css';
import { useFfmpegLogsModal } from '@/hooks/useFfmpegLogsModal';
import FfmpegLogsModal from '@/components/modals/FfmpegLogsModal';
import MediaFileModal from '@/components/modals/MediaFileModal';
import StreamSettingsModal from '@/components/modals/StreamSettingsModal';
import PlatformSelector, { Platform, STREAMING_PLATFORMS } from '@/components/PlatformSelector';

export interface StreamCardProps {
  stream: Stream;
  onStartStream: (id: string) => Promise<void>;
  onStopStream: (id: string) => Promise<void>;
  onDeleteStream: (id: string) => Promise<void>;
  onRenameStream: (id: string, name: string, description: string) => Promise<void>;
  onUpdateStreamKey: (id: string, streamKey: string) => Promise<void>;
  onUpdateRtmpUrl: (id: string, rtmpUrl: string) => Promise<void>;
  onToggleLoopVideo: (id: string, loop: boolean) => Promise<void>;
  onBindChannel: (streamId: string, channelId: string, streamKey: string) => Promise<void>;
  onViewMediaFiles: () => void;
  onViewLogs: () => void;
  onViewSettings: () => void; // Add this line
  className?: string;
}

const StreamCard: React.FC<StreamCardProps> = ({
  stream,
  onStartStream,
  onStopStream,
  onDeleteStream,
  onRenameStream,
  onUpdateStreamKey,
  onUpdateRtmpUrl,
  onToggleLoopVideo,
  onBindChannel,
  onViewMediaFiles,
  onViewLogs,
  onViewSettings,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [streamKey, setStreamKey] = useState(stream.streamKey || '');
  const [rtmpUrl, setRtmpUrl] = useState(stream.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2/');
  const [isLooping, setIsLooping] = useState(stream.loopVideo || false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState(stream.name || '');
  const [newDescription, setNewDescription] = useState(stream.description || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindModalError, setBindModalError] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const { showModal, itemId, itemType, openModal, closeModal } = useFfmpegLogsModal();
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // Add these state variables after the existing ones
  const [selectedPlatform, setSelectedPlatform] = useState<string>(() => {
    const currentUrl = stream.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2/';
    const detectedPlatform = STREAMING_PLATFORMS.find(p =>
      p.rtmpUrl && currentUrl.includes(p.rtmpUrl.replace('rtmp://', '').replace('rtmps://', '').split('/')[0])
    );
    return detectedPlatform?.id || 'youtube';
  });
  const [customRtmpUrl, setCustomRtmpUrl] = useState(stream.rtmpUrl || '');

  const handleViewMediaFiles = () => {
    setShowMediaModal(true);
  };
  const handleCloseMediaModal = () => {
    setShowMediaModal(false);
  };

  const handleViewSettings = () => {
    setShowSettingsModal(true);
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
  };

  const handleStreamUpdate = () => {
    // Refresh the stream data after settings update
    // This should trigger a re-fetch of streams in the parent component
    window.location.reload(); // Simple approach, or implement proper state management
  };


  const handleViewLogs = (streamId: string) => {
    openModal(streamId, 'stream');
  };

  const isLive = stream.status === 'live';
  const isScheduled = stream.status === 'scheduled';
  const streamKeyIsSet = !!(stream.streamKey && stream.streamKey.trim().length > 0);

  // Status badge
  const renderStatusBadge = () => {
    if (isLive) {
      return (
        <div className="d-flex align-items-center">
          <span className="live-indicator me-1"></span>
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Live</span>
        </div>
      );
    } else if (isScheduled) {
      return (
        <div className="d-flex align-items-center">
          <FontAwesomeIcon icon={faClock} className="me-1" />
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Scheduled</span>
        </div>
      );
    } else {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Idle</span>;
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle start stream
  const handleStart = async () => {
    try {
      setIsStarting(true);
      setError('');
      await onStartStream(stream.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start stream');
    } finally {
      setIsStarting(false);
    }
  };

  // Handle stop stream
  const handleStop = async () => {
    try {
      setIsStopping(true);
      setError('');
      await onStopStream(stream.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop stream');
    } finally {
      setIsStopping(false);
    }
  };

  // Handle stream key update
  const handleUpdateStreamKey = async () => {
    try {
      setIsLoading(true);
      setError('');
      await onUpdateStreamKey(stream.id, streamKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stream key');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle RTMP URL update
  const handleUpdateRtmpUrl = async () => {
    try {
      setIsLoading(true);
      setError('');
      await onUpdateRtmpUrl(stream.id, rtmpUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update RTMP URL');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle loop toggle
  const handleToggleLoop = async () => {
    const newLoopState = !isLooping;
    setIsLooping(newLoopState);
    try {
      await onToggleLoopVideo(stream.id, newLoopState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update loop setting');
      // Revert on error
      setIsLooping(!newLoopState);
    }
  };

  // Handle rename
  const handleRename = async () => {
    try {
      setIsLoading(true);
      setError('');
      await onRenameStream(stream.id, newName, newDescription);
      setShowRenameModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename stream');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      setIsLoading(true);
      setError('');
      await onDeleteStream(stream.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stream');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle bind channel
  const handleBindChannelSubmit = async (channelId: string, streamKey: string) => {
    try {
      setIsLoading(true);
      setBindModalError('');
      await onBindChannel(stream.id, channelId, streamKey);
      setShowBindModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bind channel';
      setBindModalError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to update local state when stream prop changes
  useEffect(() => {
    setStreamKey(stream.streamKey || '');
    setRtmpUrl(stream.rtmpUrl || 'rtmp://a.rtmp.youtube.com/live2/');
    setIsLooping(stream.loopVideo || false);
    setNewName(stream.name || '');
    setNewDescription(stream.description || '');
  }, [stream]);

  // Get file size from either FileSize or FileSizeBytes
  const fileSize = stream.fileSize || stream.fileSizeBytes;

  return (
    <div >
      <div className="card h-100 border-0 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="bg-white">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="d-flex align-items-center">
              <h5 className="card-title mb-0 text-truncate" style={{ maxWidth: '180px' }} title={stream.name || 'Untitled Stream'}>
                {stream.name || 'Untitled Stream'}
              </h5>
              <span className="ms-2">{renderStatusBadge()}</span>
            </div>

            {/* Dropdown Menu */}
            <div className="dropdown">
              <button className="btn btn-outline-secondary btn-sm dropdown-toggle" type="button" id={`dropdown-${stream.id}`} data-bs-toggle="dropdown" aria-expanded="false">
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </button>
              <ul className="dropdown-menu dropdown-menu-end" aria-labelledby={`dropdown-${stream.id}`}>
                <li><button className="dropdown-item" onClick={() => setShowRenameModal(true)}><FontAwesomeIcon icon={faPencil} className="me-2" />Rename</button></li>
                <li><button className="dropdown-item" onClick={() => setShowBindModal(true)}><FontAwesomeIcon icon={faLink} className="me-2" />Bind Channel</button></li>
                <li><button className="dropdown-item" onClick={() => handleViewMediaFiles()}><FontAwesomeIcon icon={faFolderOpen} className="me-2" />Media Files</button></li>
                <li><button className="dropdown-item" onClick={() => handleViewLogs(stream.id)}><FontAwesomeIcon icon={faTerminal} className="me-2" />View Logs</button></li>
                <li><button className="dropdown-item" onClick={() => { handleViewSettings() }}><FontAwesomeIcon icon={faGear} className="me-2" />Settings</button></li>
                <li><hr className="dropdown-divider" /></li>
                <li><button className="dropdown-item text-danger" onClick={() => setShowDeleteConfirm(true)}><FontAwesomeIcon icon={faTrash} className="me-2" />Delete</button></li>
              </ul>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">ID: {stream.id || 'N/A'}</small>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3">
          {/* Stream Info */}
          <div className="d-flex flex-column gap-1 mb-3">
            {stream.createdAt && (
              <div className="text-muted small">
                <FontAwesomeIcon icon={faCalendar} className="me-1" /> {new Date(stream.createdAt).toLocaleString()}
              </div>
            )}
            {stream.fileSizeBytes && (
              <div className="text-muted small">
                <FontAwesomeIcon icon={faFileText} className="me-1" /> {formatFileSize(stream.fileSizeBytes)}
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && <div className="alert alert-danger py-1 px-2" role="alert">{error}</div>}

          {/* Platform Selector */}
          <div className="mb-3">
            <PlatformSelector
              selectedPlatform={selectedPlatform}
              customRtmpUrl={customRtmpUrl}
              streamKey={streamKey}
              onPlatformChange={(platform: Platform) => {
                setSelectedPlatform(platform.id);
                if (platform.id !== 'custom') {
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
              onSave={async () => {
                await handleUpdateRtmpUrl();
                if (streamKey) {
                  await handleUpdateStreamKey();
                }
              }}
              isLoading={isLoading}
              showStreamKey={showPassword}
              onToggleStreamKeyVisibility={() => setShowPassword(!showPassword)}
            />
          </div>

          {/* Loop Toggle */}
          <div className="form-check">
            <input className="form-check-input" type="checkbox" id={`loop-switch-${stream.id}`} checked={isLooping} onChange={handleToggleLoop} />
            <label className="form-check-label" htmlFor={`loop-switch-${stream.id}`}>
              <FontAwesomeIcon icon={faRepeat} className="me-1" /> Loop Video
            </label>
          </div>
        </div>

        {/* Card Footer */}
        <div className={`bg-white border-top-0 pt-0 ${styles.cardFooter}`}>
          <div className="d-flex justify-content-between align-items-center">
            {/* Main Action Button */}
            {isLive ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? (
                  <><FontAwesomeIcon icon={faSpinner} className="me-1" spin /> Stopping...</>
                ) : (
                  <><FontAwesomeIcon icon={faStop} className="me-1" /> Stop</>
                )}
              </button>
            ) : (
              <button
                className="btn btn-success btn-sm"
                onClick={handleStart}
                disabled={!streamKeyIsSet || isStarting}
              >
                {isStarting ? (
                  <><FontAwesomeIcon icon={faSpinner} className="me-1" spin /> Starting...</>
                ) : (
                  <><FontAwesomeIcon icon={faPlay} className="me-1" /> Start</>
                )}
              </button>
            )}

            <div className="d-flex align-items-center">
              <button
                className="btn btn-outline-secondary btn-sm me-2"
                onClick={() => handleViewLogs(stream.id)}
                title="View Logs"
              >
                <FontAwesomeIcon icon={faTerminal} />
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowMediaModal(true)}
                title="Media Files"
              >
                <FontAwesomeIcon icon={faFolderOpen} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      <div className="modal fade" id={`rename-modal-${stream.id}`} tabIndex={-1} aria-labelledby={`rename-modal-label-${stream.id}`} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={`rename-modal-label-${stream.id}`}>Rename Stream</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Name</label>
                <input type="text" className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter stream name" />
              </div>
              <div>
                <label className="form-label">Description (Optional)</label>
                <textarea className="form-control" rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Enter description"></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleRename} disabled={!newName.trim() || isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <div className="modal fade" id={`delete-modal-${stream.id}`} tabIndex={-1} aria-labelledby={`delete-modal-label-${stream.id}`} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id={`delete-modal-label-${stream.id}`}>Delete Stream</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this stream? This action cannot be undone.</p>
              <p className="mb-0"><strong>Stream ID:</strong> {stream.id}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={isLoading}>
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global FFmpeg Logs Modal */}
      <FfmpegLogsModal
        show={showModal}
        onHide={closeModal}
        itemId={itemId}
        itemType={itemType}
        title="Stream FFmpeg Logs"
      />

      {/* Bind Channel Modal */}
      <BindChannelModal
        show={showBindModal}
        onHide={() => {
          setShowBindModal(false);
          setBindModalError('');
        }}
        onBind={handleBindChannelSubmit}
        streamName={stream.name}
        fetchChannels={async () => []} // TODO: Implement channel fetching if needed
        fetchStreams={async () => []} // TODO: Implement stream fetching if needed
        title="Bind Channel to Stream"
        loading={isLoading}
        error={bindModalError}
      />

      {/* Add Media File Modal */}
      <MediaFileModal
        show={showMediaModal}
        onHide={() => handleCloseMediaModal()}
        streamId={stream.id}
        streamName={stream.name || 'Untitled Stream'}
      />

      {/* Stream Settings Modal */}
      <StreamSettingsModal
        show={showSettingsModal}
        onHide={handleCloseSettingsModal}
        stream={stream}
        onStreamUpdate={handleStreamUpdate}
      />
    </div>
  );
};

export default StreamCard;
