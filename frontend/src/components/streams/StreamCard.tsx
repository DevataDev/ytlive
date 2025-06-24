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
  faEyeSlash,
  faExclamationTriangle
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindModalError, setBindModalError] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showModal, itemId, itemType, openModal, closeModal } = useFfmpegLogsModal();
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPlatformModal, setShowPlatformModal] = useState(false);
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
        <div className="flex items-center">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1.5"></span>
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">Live</span>
        </div>
      );
    } else if (isScheduled) {
      return (
        <div className="flex items-center">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1 text-blue-500" />
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Scheduled</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Idle</span>
        </div>
      );
    }
  };
  
  // State for dropdown menu
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDropdown && !target.closest('.dropdown-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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
      setIsDeleting(true);
      setError('');
      await onDeleteStream(stream.id);
      setShowDeleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stream');
    } finally {
      setIsDeleting(false);
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
    <div className="bg-white rounded-lg shadow-sm overflow-visible border border-gray-200 hover:shadow-md transition-shadow duration-200">
      {/* Card Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-medium text-gray-900 truncate" title={stream.name || 'Untitled Stream'}>
                {stream.name || 'Untitled Stream'}
              </h3>
              {renderStatusBadge()}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              <div>ID: {stream.id || 'N/A'}</div>
              {stream.createdAt && (
                <div className="mt-1">{new Date(stream.createdAt).toLocaleString()}</div>
              )}
            </div>
          </div>

          {/* Dropdown Menu */}
          <div className="relative dropdown-container">
            <button 
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} className="w-4 h-4" />
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 max-h-96 overflow-y-auto">
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    setShowRenameModal(true);
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faPencil} className="w-4 h-4 mr-2 text-gray-500" />
                  Rename
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    setShowBindModal(true);
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faLink} className="w-4 h-4 mr-2 text-gray-500" />
                  Bind Channel
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    handleViewMediaFiles();
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faFolderOpen} className="w-4 h-4 mr-2 text-gray-500" />
                  Media Files
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    handleViewLogs(stream.id);
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faTerminal} className="w-4 h-4 mr-2 text-gray-500" />
                  View Logs
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    handleViewSettings();
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faGear} className="w-4 h-4 mr-2 text-gray-500" />
                  Settings
                </button>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  onClick={() => {
                    setShowPlatformModal(true);
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faLink} className="w-4 h-4 mr-2 text-gray-500" />
                  Change Platform
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button 
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowDropdown(false);
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
            {error}
          </div>
        )}



        {/* File Info */}
        {stream.fileSizeBytes && (
          <div className="flex items-center text-sm text-gray-500 mb-4">
            <FontAwesomeIcon icon={faFileText} className="w-4 h-4 mr-2 text-gray-400" />
            <span>{formatFileSize(stream.fileSizeBytes)}</span>
          </div>
        )}

        {/* Loop Toggle */}
        <div className="flex items-center justify-between">
          <label htmlFor={`loop-switch-${stream.id}`} className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                id={`loop-switch-${stream.id}`}
                className="sr-only"
                checked={isLooping}
                onChange={handleToggleLoop}
              />
              <div className={`w-10 h-5 rounded-full ${isLooping ? 'bg-blue-500' : 'bg-gray-300'} transition-colors`}></div>
              <div className={`absolute w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isLooping ? 'translate-x-5' : 'translate-x-1'}`} 
                   style={{top: '2px'}}></div>
            </div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              <FontAwesomeIcon icon={faRepeat} className="w-4 h-4 mr-1 text-gray-500" /> Loop Video
            </span>
          </label>
        </div>
      </div>

      {/* Card Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
        <div className="flex justify-between items-center">
          {/* Main Action Button */}
          {isLive ? (
            <button
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isStopping ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
              onClick={handleStop}
              disabled={isStopping}
            >
              {isStopping ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Stopping...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faStop} className="w-3.5 h-3.5 mr-1.5" />
                  <span>Stop</span>
                </>
              )}
            </button>
          ) : (
            <button
              className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                !streamKeyIsSet || isStarting ? 'bg-green-300' : 'bg-green-600 hover:bg-green-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
              onClick={handleStart}
              disabled={!streamKeyIsSet || isStarting}
            >
              {isStarting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlay} className="w-3.5 h-3.5 mr-1.5" />
                  <span>Start</span>
                </>
              )}
            </button>
          )}

          <div className="flex space-x-2">
            <button
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => handleViewLogs(stream.id)}
              title="View Logs"
            >
              <FontAwesomeIcon icon={faTerminal} className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setShowMediaModal(true)}
              title="Media Files"
            >
              <FontAwesomeIcon icon={faFolderOpen} className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="rename-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowRenameModal(false)}
            ></div>

            {/* Modal panel */}
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="rename-modal-title">
                      Rename Stream
                    </h3>
                    <div className="mt-4">
                      <div className="mb-4">
                        <label htmlFor="stream-name" className="block text-sm font-medium text-gray-700 mb-1">
                          Name
                        </label>
                        <input
                          type="text"
                          id="stream-name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Enter stream name"
                        />
                      </div>
                      <div>
                        <label htmlFor="stream-description" className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          id="stream-description"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="Enter description"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRename}
                  disabled={!newName.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowRenameModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="delete-modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              aria-hidden="true"
              onClick={() => setShowDeleteModal(false)}
            ></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="delete-modal-title">
                      Delete Stream
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this stream? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Deleting...
                    </>
                  ) : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Platform Selector Modal */}
      {showPlatformModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={() => setShowPlatformModal(false)}>
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Change Streaming Platform</h3>
                <button
                  onClick={() => setShowPlatformModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mt-4">
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
                    setShowPlatformModal(false);
                  }}
                  isLoading={isLoading}
                  showStreamKey={showPassword}
                  onToggleStreamKeyVisibility={() => setShowPassword(!showPassword)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamCard;
