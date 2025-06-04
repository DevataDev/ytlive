import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Form, Alert, Spinner, ListGroup, Badge, Row, Col, InputGroup } from 'react-bootstrap';
import { MediaFile } from '@/services/streamService';
import { toast } from 'react-toastify';
import { getSession } from 'next-auth/react';
import { api }  from '@/lib/api';
import { MediaFileData } from '@/services/streamService';

export interface MediaFileSelectionModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (selectedFiles: MediaFile[]) => void;
  selectedFileIds?: string[]; // Pre-selected files for editing
  title?: string;
  allowMultiple?: boolean;
  mediaTypeFilter?: 'video' | 'audio' | 'all';
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
  mediaTypeFilter = 'all'
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>(selectedFileIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState<'video' | 'audio' | 'all'>(mediaTypeFilter);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const loadUserMediaFiles = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setMediaFiles([]);
        setPagination({ total: 0, limit: 20, offset: 0, has_more: false });
      } else {
        setLoadingMore(true);
      }

      const session = await getSession();
      if (!session) {
        setError('Please log in to view media files');
        return;
      }

      const sessionToken = await session.user?.backendToken;
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: (reset ? 0 : pagination.offset).toString(),
      });

      if (currentFilter && currentFilter !== 'all') {
        params.append('type', currentFilter);
      } else {
        params.append('type', 'all');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/user?${params}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch media files: ${response.statusText}`);
      }

      const data = await response.json();
      const newFiles: MediaFile[] = data.files?.map((file: any) => ({
        ID: file.id,
        FileName: file.file_name,
        FilePath: file.file_path,
        FileSize: file.file_size,
        MediaType: file.media_type,
        MimeType: file.mime_type,
        CreatedAt: file.created_at,
        UpdatedAt: file.updated_at,
      } as MediaFile)) || [];

      if (reset) {
        setMediaFiles(newFiles);
      } else {
        setMediaFiles(prev => [...prev, ...newFiles]);
      }

      setPagination({
        total: data.total || 0,
        limit: data.limit || 20,
        offset: data.offset || 0,
        has_more: data.has_more || false,
      });
    } catch (err) {
      console.error('Error loading media files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load media files');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pagination.limit, pagination.offset, currentFilter]);

  // Load media files when modal opens
  useEffect(() => {
    if (show && !hasLoadedInitial) {
      loadUserMediaFiles(true);
      setHasLoadedInitial(true);
    }
  }, [show, hasLoadedInitial, loadUserMediaFiles]);

  // Handle filter changes
  useEffect(() => {
    setCurrentFilter(mediaTypeFilter);
  }, [mediaTypeFilter]);

  // Reload when filter changes
  useEffect(() => {
    if (show && hasLoadedInitial) {
      loadUserMediaFiles(true);
    }
  }, [currentFilter, show, hasLoadedInitial, loadUserMediaFiles]);

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
    
    // Filter by media type
    if (currentFilter !== 'all') {
      filtered = filtered.filter(file => {
        const fileType = file.MimeType.split('/')[0];
        return fileType === currentFilter;
      });
    }
    
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
          <Col md={6}>
            <InputGroup>
              <InputGroup.Text>
                <i className="bi bi-search"></i>
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </InputGroup>
          </Col>
          <Col md={3}>
            <Form.Select
              value={currentFilter}
              onChange={(e) => setCurrentFilter(e.target.value as 'video' | 'audio' | 'all')}
            >
              <option value="all">All Media</option>
              <option value="video">Video Only</option>
              <option value="audio">Audio Only</option>
            </Form.Select>
          </Col>
          <Col md={3}>
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
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </Alert>
        )}

        {/* Clean File List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
              <div className="mt-2">Loading files...</div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-folder2-open fs-1 d-block mb-2"></i>
              {searchTerm ? 'No files match your search' : `No ${mediaTypeFilter} files available`}
            </div>
          ) : (
            <>
              <ListGroup variant="flush">
                {filteredFiles.map((file) => (
                  <ListGroup.Item
                    key={file.ID}
                    className={`d-flex align-items-center py-3 ${
                      selectedFiles.includes(file.ID) ? 'bg-light border-primary' : ''
                    }`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleFileToggle(file.ID)}
                  >
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
                      <div className="fw-medium mb-1">{file.FileName}</div>
                      <div className="text-muted small">
                        {formatFileSize(file.FileSize)} • 
                        <Badge bg="secondary" className="ms-1 me-1">{file.MediaType}</Badge> • 
                        {new Date(file.CreatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              
              {/* Load More */}
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