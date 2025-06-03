import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, ListGroup, Badge, Row, Col } from 'react-bootstrap';
import { MediaFile } from '@/services/streamService';
import { toast } from 'react-toastify';
import { getSession } from 'next-auth/react';
import { api }  from '@/lib/api';

export interface MediaFileSelectionModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (selectedFiles: MediaFile[]) => void;
  selectedFileIds?: string[]; // Pre-selected files for editing
  title?: string;
  allowMultiple?: boolean;
  mediaTypeFilter?: 'video' | 'audio';
}

interface UserMediaFilesResponse {
  files: MediaFileData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

const MediaFileSelectionModal: React.FC<MediaFileSelectionModalProps> = ({
  show,
  onHide,
  onSelect,
  selectedFileIds = [],
  title = 'Select Media Files',
  allowMultiple = true,
  mediaTypeFilter = 'video'
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>(selectedFileIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Load media files when modal opens
  useEffect(() => {
    if (show && !hasLoadedInitial) {
      loadUserMediaFiles(true);
      setSelectedFiles(selectedFileIds);
      setHasLoadedInitial(true);
    }
  }, [show, mediaTypeFilter]);

  // Update selected files when selectedFileIds prop changes
  useEffect(() => {
    if (show) {
      setSelectedFiles(selectedFileIds);
    }
  }, [selectedFileIds, show]);

  // Reset when modal closes
  useEffect(() => {
    if (!show) {
      setSearchTerm('');
      setError('');
      setMediaFiles([]);
      setPagination({ total: 0, limit: 20, offset: 0, has_more: false });
      setHasLoadedInitial(false);
    }
  }, [show]);

  const loadUserMediaFiles = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setMediaFiles([]);
        setPagination(prev => ({ ...prev, offset: 0 }));
      } else {
        setLoadingMore(true);
      }
      setError('');
      
      const session = await getSession();
      if (!session) {
        setError('Please log in to view media files');
        return;
      }

      const offset = reset ? 0 : pagination.offset;
      const typeParam = mediaTypeFilter === 'video' ? 'video' : mediaTypeFilter; // API defaults to video, we'll handle 'all' client-side
      
      const response = await api.get<UserMediaFilesResponse>(
        `/api/media/user?limit=${pagination.limit}&offset=${offset}&type=${typeParam}`,
        {
          headers: { Authorization: `Bearer ${session.user?.backendToken}` },
        }
      );

      const newFiles = response.files || [];
      const mappedFiles = newFiles.map(file => ({
        ID: file.ID,
        FileName: file.file_name,
        MediaType: file.media_type,
        FileSize: file.file_size,
        CreatedAt: file.created_at,
      }))
      
      if (reset) {
        setMediaFiles(mappedFiles);
      } else {
        setMediaFiles(prev => [...prev, ...newFiles]);
      }
      
      setPagination({
        total: response.pagination?.total || 0,
        limit: response.pagination?.limit || 20,
        offset: offset + newFiles.length,
        has_more: response.pagination?.has_more || false
      });
      
    } catch (err) {
      setError('Failed to load media files');
      console.error('Error loading media files:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && pagination.has_more) {
      loadUserMediaFiles(false);
    }
  };

  const handleFileToggle = (fileId: string) => {
    if (allowMultiple) {
      setSelectedFiles(prev => 
        prev.includes(fileId) 
          ? prev.filter(id => id !== fileId)
          : [...prev, fileId]
      );
    } else {
      setSelectedFiles([fileId]);
    }
  };

  const handleSelectAll = () => {
    if (allowMultiple) {
      const filteredFiles = getFilteredFiles();
      const allIds = filteredFiles.map(file => file.ID);
      setSelectedFiles(allIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
  };

  const handleConfirmSelection = () => {
    const selectedMediaFiles = mediaFiles.filter(file => selectedFiles.includes(file.ID));
    onSelect(selectedMediaFiles);
    onHide();
  };

  const getFilteredFiles = () => {
    let filtered = mediaFiles;
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(file => 
        file.FileName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'video':
        return <i className="bi bi-camera-video text-primary"></i>;
      case 'audio':
        return <i className="bi bi-music-note text-success"></i>;
      case 'image':
        return <i className="bi bi-image text-warning"></i>;
      default:
        return <i className="bi bi-file-earmark text-secondary"></i>;
    }
  };

  const filteredFiles = getFilteredFiles();

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        {/* Search and Filter Controls */}
        <Row className="mb-3">
          <Col md={8}>
            <Form.Control
              type="text"
              placeholder="Search media files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Col>
          <Col md={4}>
            {allowMultiple && (
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-primary" 
                  size="sm" 
                  onClick={handleSelectAll}
                  disabled={filteredFiles.length === 0}
                >
                  Select All
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleClearSelection}
                  disabled={selectedFiles.length === 0}
                >
                  Clear
                </Button>
              </div>
            )}
          </Col>
        </Row>

        {/* Selection Summary */}
        {selectedFiles.length > 0 && (
          <Alert variant="info" className="mb-3">
            <i className="bi bi-info-circle me-2"></i>
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </Alert>
        )}

        {/* Media Files List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <div className="mt-2">Loading media files...</div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-folder2-open fs-1 d-block mb-2"></i>
              {searchTerm ? 'No media files match your search' : `No ${mediaTypeFilter} files available`}
            </div>
          ) : (
            <>
              <ListGroup>
                {filteredFiles.map((file) => (
                  <ListGroup.Item
                    key={file.ID}
                    className={`d-flex align-items-center justify-content-between ${
                      selectedFiles.includes(file.ID) ? 'border-primary bg-light' : ''
                    }`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleFileToggle(file.ID)}
                  >
                    <div className="d-flex align-items-center flex-grow-1">
                      <Form.Check
                        type={allowMultiple ? 'checkbox' : 'radio'}
                        checked={selectedFiles.includes(file.ID)}
                        onChange={() => handleFileToggle(file.ID)}
                        className="me-3"
                      />
                      <div className="me-3">
                        {getMediaTypeIcon(file.MediaType)}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{file.FileName}</div>
                        <div className="text-muted small">
                          {formatFileSize(file.FileSize)} • {file.MediaType}
                          <span className="ms-2">
                            {new Date(file.CreatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge bg="secondary">{file.MediaType}</Badge>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              
              {/* Load More Button */}
              {pagination.has_more && (
                <div className="text-center mt-3">
                  <Button 
                    variant="outline-primary" 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading...
                      </>
                    ) : (
                      `Load More (${pagination.total - pagination.offset} remaining)`
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100 align-items-center">
          <small className="text-muted">
            {pagination.total > 0 && `${filteredFiles.length} of ${pagination.total} files`}
          </small>
          <div>
            <Button variant="secondary" onClick={onHide} className="me-2">
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleConfirmSelection}
              disabled={selectedFiles.length === 0}
            >
              Select {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default MediaFileSelectionModal;