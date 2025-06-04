'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Dropdown, Form, Spinner, Badge, Modal, Alert } from 'react-bootstrap';
import { Stream } from '@/services/streamService';
import BindChannelModal from '@/components/modals/BindChannelModal';
import styles from './StreamCard.module.css';
import { useFfmpegLogsModal } from '@/hooks/useFfmpegLogsModal';
import FfmpegLogsModal from '@/components/modals/FfmpegLogsModal';
import MediaFileModal from '@/components/modals/MediaFileModal';
import StreamSettingsModal from '@/components/modals/StreamSettingsModal';


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
          <Badge bg="danger" className="bg-opacity-10 text-danger">Live</Badge>
        </div>
      );
    } else if (isScheduled) {
      return (
        <div className="d-flex align-items-center">
          <i className="bi bi-alarm me-1"></i>
          <Badge bg="primary" className="bg-opacity-10 text-primary">Scheduled</Badge>
        </div>
      );
    } else {
      return <Badge bg="secondary" className="bg-opacity-10 text-secondary">Idle</Badge>;
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
      <Card className="card h-100 border-0 shadow-sm overflow-hidden">
        {/* Card Header */}
        <Card.Header className="bg-white">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div className="d-flex align-items-center">
              <h5 className="card-title mb-0 text-truncate" style={{ maxWidth: '180px' }} title={stream.name || 'Untitled Stream'}>
                {stream.name || 'Untitled Stream'}
              </h5>
              <span className="ms-2">{renderStatusBadge()}</span>
            </div>

            {/* Dropdown Menu */}
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary" size="sm" id={`dropdown-${stream.id}`}>
                <i className="bi bi-three-dots-vertical"></i>
              </Dropdown.Toggle>
              <Dropdown.Menu align="end">
                <Dropdown.Item onClick={() => setShowRenameModal(true)}>
                  <i className="bi bi-pencil me-2"></i>Rename
                </Dropdown.Item>
                <Dropdown.Item onClick={() => setShowBindModal(true)}>
                  <i className="bi bi-link-45deg me-2"></i>Bind Channel
                </Dropdown.Item>
                <Dropdown.Item onClick={() => handleViewMediaFiles()}>
                  <i className="bi bi-folder2-open me-2"></i>Media Files
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={() => handleViewLogs(stream.id)}>
                  <i className="bi bi-terminal me-2"></i>View Logs
                </Dropdown.Item>
                <Dropdown.Item onClick={() => { handleViewSettings() }}>
                  <i className="bi bi-gear me-2"></i>Settings
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  className="text-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <i className="bi bi-trash me-2"></i>Delete
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">ID: {stream.id || 'N/A'}</small>
          </div>
        </Card.Header>

        {/* Card Body */}
        <Card.Body className="p-3">
          {/* Stream Info */}
          <div className="d-flex flex-column gap-1 mb-3">
            {stream.createdAt && (
              <div className="text-muted small">
                <i className="bi bi-calendar3 me-1"></i> {new Date(stream.createdAt).toLocaleString()}
              </div>
            )}
            {stream.fileSizeBytes && (
              <div className="text-muted small">
                <i className="bi bi-file-earmark me-1"></i> {formatFileSize(stream.fileSizeBytes)}
              </div>
            )}
          </div>

          {/* Error Alert */}
          {error && <Alert variant="danger" className="py-1 px-2" onClose={() => setError('')} dismissible>{error}</Alert>}

          {/* Stream Key */}
          <div className="mb-3">
            <Form.Label className="small text-muted mb-1">Stream Key</Form.Label>
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-key"></i></span>
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="Stream Key"
                aria-label="Stream Key"
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide' : 'Show'}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </Button>
              <Button
                variant="outline-success"
                onClick={handleUpdateStreamKey}
                disabled={isLoading}
                title="Save Stream Key"
              >
                {isLoading ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg"></i>}
              </Button>
            </div>
          </div>

          {/* RTMP URL */}
          <div className="mb-3">
            <Form.Label className="small text-muted mb-1">RTMP URL</Form.Label>
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-link-45deg"></i></span>
              <Form.Control
                type="text"
                value={rtmpUrl}
                onChange={(e) => setRtmpUrl(e.target.value)}
                placeholder="RTMP URL"
                aria-label="RTMP URL"
              />
              <Button
                variant="outline-success"
                onClick={handleUpdateRtmpUrl}
                disabled={isLoading}
                title="Save RTMP URL"
              >
                {isLoading ? <Spinner animation="border" size="sm" /> : <i className="bi bi-check-lg"></i>}
              </Button>
            </div>
          </div>

          {/* Loop Toggle */}
          <Form.Check
            type="switch"
            id={`loop-switch-${stream.id}`}
            label={
              <>
                <i className="bi bi-arrow-repeat me-1"></i> Loop Video
              </>
            }
            checked={isLooping}
            onChange={handleToggleLoop}
            className="mb-0"
          />
        </Card.Body>

        {/* Card Footer */}
        <Card.Footer className={`bg-white border-top-0 pt-0 ${styles.cardFooter}`}>
          <div className="d-flex justify-content-between align-items-center">
            {/* Main Action Button */}
            {isLive ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? (
                  <><Spinner as="span" animation="border" size="sm" className="me-1" /> Stopping...</>
                ) : (
                  <><i className="bi bi-stop-fill me-1"></i> Stop</>
                )}
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                className={`btn btn-success btn-sm ${styles.streamStart}`}
                onClick={handleStart}
                disabled={!streamKeyIsSet || isStarting}
              >
                {isStarting ? (
                  <><Spinner as="span" animation="border" size="sm" className="me-1" /> Starting...</>
                ) : (
                  <><i className="bi bi-play-fill me-1"></i> Start</>
                )}
              </Button>
            )}

            <div className="d-flex align-items-center">
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => handleViewLogs(stream.id)}
                className="me-2"
                title="View Logs"
              >
                <i className="bi bi-terminal"></i>
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setShowMediaModal(true)}
                title="Media Files"
              >
                <i className="bi bi-folder2-open"></i>
              </Button>
            </div>
          </div>
        </Card.Footer>
      </Card>

      {/* Rename Modal */}
      <Modal show={showRenameModal} onHide={() => setShowRenameModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rename Stream</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter stream name"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description (Optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Enter description"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRenameModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRename} disabled={!newName.trim() || isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Stream</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this stream? This action cannot be undone.</p>
          <p className="mb-0"><strong>Stream ID:</strong> {stream.id}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>

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

