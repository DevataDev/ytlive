import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { MediaFile, MediaFileData } from '@/services/streamService';
import { fetchMediaFiles, uploadMediaFile, deleteMediaFile, getMediaPreview, MediaFileUploadData } from '@/services/mediaFileService';
import PlayerPreviewModal from './PlayerPreviewModal';

export interface MediaFileModalProps {
  show: boolean;
  onHide: () => void;
  streamId: string;
  streamName: string;
}

const MediaFileModal: React.FC<MediaFileModalProps> = ({
  show,
  onHide,
  streamId,
  streamName
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'image'>('video');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState<MediaFile | null>(null);

  // Load media files when modal opens
  useEffect(() => {
    if (show && streamId) {
      loadMediaFiles();
    }
  }, [show, streamId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!show) {
      resetForm();
    }
  }, [show]);

  const updateMediaFileData = (files: MediaFileData[]) => {
    console.dir(files);
    // Map the MediaFileData array to MediaFile objects and set the state with the mapped values
    // Convert the MediaFileData array to MediaFile array using the map function
    const mappedFiles = files.map((file) => ({
        ID: file.id,
        FileName: file.file_name,
        FileSize: file.file_size,
        MediaType: file.media_type,
        FilePath: file.file_path,
        CreatedAt: file.created_at,
        UpdatedAt: file.updated_at,
        MimeType: file.mime_type,
        Order: file.order
    } as MediaFile))
    setMediaFiles(mappedFiles);
  };

  const loadMediaFiles = async () => {
    try {
      setLoading(true);
      setError('');
      const files = await fetchMediaFiles(streamId);
      updateMediaFileData(files.files);
    } catch (err) {
      setError('Failed to load media files');
      console.error('Error loading media files:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      const uploadData: MediaFileUploadData = {
        file: selectedFile,
        mediaType
      };
      
      await uploadMediaFile(streamId, uploadData);
      toast.success('Media file uploaded successfully');
      resetForm();
      await loadMediaFiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload media file';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteMediaFile(fileId);
      toast.success('Media file deleted successfully');
      setShowDeleteConfirm(null);
      await loadMediaFiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete media file';
      toast.error(errorMessage);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setMediaType('video');
    setError('');
    setShowDeleteConfirm(null);
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

  const getMediaTypeBadge = (type: string) => {
    switch (type) {
      case 'video': return <Badge bg="primary">Video</Badge>;
      case 'audio': return <Badge bg="success">Audio</Badge>;
      case 'image': return <Badge bg="info">Image</Badge>;
      default: return <Badge bg="secondary">File</Badge>;
    }
  };

  const handlePreviewFile = (file: MediaFile) => {
    setSelectedMediaFile(file);
    setShowPreviewModal(true);
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-folder2-open me-2"></i>
            Media File Management - {streamName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Current Media Files */}
          <div className="mb-4">
            <h6 className="mb-3">Current Media Files</h6>
            {loading ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading media files...
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="text-center py-3 text-muted">
                <i className="bi bi-folder2-open fs-1 d-block mb-2"></i>
                No media files uploaded yet
              </div>
            ) : (
              <ListGroup>
                {mediaFiles.map((file) => (
                  <ListGroup.Item key={file.ID} className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <i className={`bi ${getMediaTypeIcon(file.MediaType)} me-2`}></i>
                      <div>
                        <div className="fw-medium">{file.FileName}</div>
                        <small className="text-muted">
                          {formatFileSize(file.FileSize)} • {new Date(file.CreatedAt).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      {getMediaTypeBadge(file.MediaType)}
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handlePreviewFile(file)}
                        title="Preview"
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(file.ID)}
                        title="Delete"
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>

          {/* Upload New Media File */}
          <div>
            <h6 className="mb-3">Add New Media File</h6>
            <Form onSubmit={handleFileUpload}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <Form.Label>Media Type</Form.Label>
                  <Form.Select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'video' | 'audio' | 'image')}
                    disabled={uploading}
                  >
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                    <option value="image">Image</option>
                  </Form.Select>
                </div>
                <div className="col-md-8 mb-3">
                  <Form.Label>Select File</Form.Label>
                  <Form.Control
                    type="file"
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      setSelectedFile(target.files?.[0] || null);
                    }}
                    accept={mediaType === 'video' ? '.mp4,.mkv' : mediaType === 'audio' ? '.wav,.mp3' : '.jpg,.jpeg,.png,.gif'}
                    disabled={uploading}
                  />
                  <Form.Text className="text-muted">
                    {mediaType === 'video' && 'Supported formats: MP4, MKV'}
                    {mediaType === 'audio' && 'Supported formats: WAV, MP3'}
                    {mediaType === 'image' && 'Supported formats: JPG, PNG, GIF'}
                  </Form.Text>
                </div>
              </div>
              <div className="d-flex justify-content-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-upload me-2"></i>
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={!!showDeleteConfirm} onHide={() => setShowDeleteConfirm(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Media File</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete this media file? This action cannot be undone.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => showDeleteConfirm && handleDeleteFile(showDeleteConfirm)}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Player Preview Modal */}
      <PlayerPreviewModal
        show={showPreviewModal}
        onHide={() => {
          setShowPreviewModal(false);
          setSelectedMediaFile(null);
        }}
        mediaFile={selectedMediaFile}
        streamId={streamId}
      />
    </>
  );
};

export default MediaFileModal;