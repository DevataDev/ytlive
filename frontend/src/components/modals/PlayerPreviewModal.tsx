import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { MediaFile } from '@/services/streamService';
import { getMediaPreview } from '@/services/mediaFileService';

export interface PlayerPreviewModalProps {
  show: boolean;
  onHide: () => void;
  mediaFile: MediaFile | null;
  streamId: string;
}

const PlayerPreviewModal: React.FC<PlayerPreviewModalProps> = ({
  show,
  onHide,
  mediaFile,
  streamId
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (show && mediaFile && streamId) {
      setLoading(true);
      setError('');
      const url = getMediaPreview(streamId, mediaFile.ID);
      setPreviewUrl(url);
      setLoading(false);
    } else {
      setPreviewUrl('');
      setLoading(true);
      setError('');
    }
  }, [show, mediaFile, streamId]);

  const handleMediaLoad = () => {
    setLoading(false);
    setError('');
  };

  const handleMediaError = () => {
    setLoading(false);
    setError('Failed to load media file. The file may be corrupted or not accessible.');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return 'bi-camera-video';
      case 'audio': return 'bi-music-note';
      case 'image': return 'bi-image';
      default: return 'bi-file-earmark';
    }
  };

  const renderMediaPlayer = () => {
    if (!mediaFile || !previewUrl) return null;

    switch (mediaFile.MediaType) {
      case 'video':
        return (
          <div className="position-relative">
            {loading && (
              <div className="position-absolute top-50 start-50 translate-middle">
                <Spinner animation="border" />
              </div>
            )}
            <video
              controls
              className="w-100"
              style={{ maxHeight: '70vh', backgroundColor: '#000' }}
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
              preload="metadata"
            >
              <source src={previewUrl} type={mediaFile.MimeType} />
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="text-center py-5">
            <div className="mb-4">
              <i className="bi bi-music-note display-1 text-primary"></i>
            </div>
            {loading && (
              <div className="mb-3">
                <Spinner animation="border" />
              </div>
            )}
            <audio
              controls
              className="w-100"
              style={{ maxWidth: '500px' }}
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
              preload="metadata"
            >
              <source src={previewUrl} type={mediaFile.MimeType} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case 'image':
        return (
          <div className="text-center">
            {loading && (
              <div className="py-5">
                <Spinner animation="border" />
              </div>
            )}
            <img
              src={previewUrl}
              alt={mediaFile.FileName}
              className="img-fluid"
              style={{ 
                maxHeight: '70vh', 
                maxWidth: '100%',
                display: loading ? 'none' : 'block'
              }}
              onLoad={handleMediaLoad}
              onError={handleMediaError}
            />
          </div>
        );

      default:
        return (
          <div className="text-center py-5">
            <i className="bi bi-file-earmark display-1 text-muted"></i>
            <p className="mt-3 text-muted">Preview not available for this file type</p>
            <Button
              variant="primary"
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="bi bi-download me-2"></i>
              Download File
            </Button>
          </div>
        );
    }
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      centered
      className="player-preview-modal"
    >
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="d-flex align-items-center">
          <i className={`bi ${getMediaTypeIcon(mediaFile?.MediaType || '')} me-2`}></i>
          {mediaFile?.FileName || 'Media Preview'}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="p-0">
        {error ? (
          <div className="p-4">
            <Alert variant="danger" className="mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          </div>
        ) : (
          renderMediaPlayer()
        )}
      </Modal.Body>
      
      <Modal.Footer className="border-top">
        <div className="d-flex justify-content-between align-items-center w-100">
          <div className="text-muted small">
            {mediaFile && (
              <>
                <span className="me-3">
                  <i className="bi bi-hdd me-1"></i>
                  {formatFileSize(mediaFile.FileSize)}
                </span>
                <span className="me-3">
                  <i className="bi bi-calendar3 me-1"></i>
                  {new Date(mediaFile.CreatedAt).toLocaleDateString()}
                </span>
                <span>
                  <i className="bi bi-file-earmark me-1"></i>
                  {mediaFile.MimeType}
                </span>
              </>
            )}
          </div>
          <div className="d-flex gap-2">
            {mediaFile && previewUrl && (
              <Button
                variant="outline-primary"
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
              >
                <i className="bi bi-box-arrow-up-right me-1"></i>
                Open in New Tab
              </Button>
            )}
            <Button variant="secondary" onClick={onHide}>
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PlayerPreviewModal;