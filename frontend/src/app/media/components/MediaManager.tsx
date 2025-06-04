'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Container, Row, Col, Card, Form, Button, Table, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MediaFileRow from './MediaFileRow';
import MediaFileDetailsModal from './MediaFileDetailsModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import Pagination from './Pagination';
import { api } from '@/lib/api';
import { MediaListResponse, Stream } from '@/services/streamService';
import MediaUploadModal from './MediaUploadModal';

interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  media_type: 'video' | 'audio';
  mime_type: string;
  duration?: number;
  resolution?: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
  streams: Stream[];
  stream_count: number;
  stream_names: string[];
}

interface ApiResponse {
  data: MediaFile[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export default function MediaManager() {
  const { data: session } = useSession();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const limit = 20;

  const fetchMediaFiles = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        user_id: session.user.id,
        page: currentPage.toString(),
        limit: limit.toString(),
        type: mediaType,
        sort: sortBy,
        order: sortOrder,
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await api.get<MediaListResponse>(`/api/media/user?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.user?.backendToken}`,
        }
      });

      const mappedFiles = response.files?.map((file) => ({
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        file_size: file.file_size,
        media_type: file.media_type,
        mime_type: file.mime_type,
        created_at: file.created_at,
        updated_at: file.updated_at,
        stream_count: file.stream_count,
        stream_names: file.stream_names?.split(","),
        streams: file.streams,
      } as MediaFile)) || [];

      const total = response.pagination.total || 0;
      const totalPages = Math.ceil(total / limit);
    
      setMediaFiles(mappedFiles);
      setTotal(total || 0);
      setTotalPages(totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load media files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaFiles();
  }, [session, currentPage, mediaType, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMediaFiles();
  };

  const handleDelete = async (file: MediaFile) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete || !session?.user?.id) return;

    try {
      setDeleting(true);
      const response = await api.delete<void>(`/api/media/${fileToDelete.id}`, {
        headers: {
          'Authorization': `Bearer ${session.user?.backendToken}`,
        }
      });

      toast.success('Media file deleted successfully');
      setShowDeleteModal(false);
      setFileToDelete(null);
      fetchMediaFiles();
    } catch (err) {
      toast.error('Failed to delete media file');
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadComplete = () => {
    fetchMediaFiles(); // Refresh the media files list
  };

  if (!session) {
    return (
      <div className="container-xxl py-4">
        <Alert variant="warning">Please log in to access the Media Manager.</Alert>
      </div>
    );
  }

  return (
    <div className="container-xxl py-4">
      <Row>
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">
                <i className="bi bi-collection-play me-2"></i>
                Media Manager
              </h4>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{total} files</Badge>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => setShowUploadModal(true)}
                >
                  <i className="bi bi-cloud-upload me-2"></i>
                  Upload Files
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {/* Search and Filter Controls */}
              <Row className="mb-4">
                <Col md={4}>
                  <Form onSubmit={handleSearch}>
                    <Form.Group>
                      <Form.Label>Search Files</Form.Label>
                      <div className="d-flex">
                        <Form.Control
                          type="text"
                          placeholder="Search by filename or path..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Button type="submit" variant="outline-primary" className="ms-2">
                          <i className="bi bi-search"></i>
                        </Button>
                      </div>
                    </Form.Group>
                  </Form>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Media Type</Form.Label>
                    <Form.Select
                      value={mediaType}
                      onChange={(e) => {
                        setMediaType(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">All Types</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Sort By</Form.Label>
                    <Form.Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="created_at">Date Created</option>
                      <option value="file_name">File Name</option>
                      <option value="file_size">File Size</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label>Order</Form.Label>
                    <Form.Select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex align-items-end">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => {
                      setSearchTerm('');
                      setMediaType('all');
                      setSortBy('created_at');
                      setSortOrder('desc');
                      setCurrentPage(1);
                    }}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Reset
                  </Button>
                </Col>
              </Row>

              {/* Loading State */}
              {loading && (
                <div className="text-center py-4">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </div>
              )}

              {/* Error State */}
              {error && (
                <Alert variant="danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </Alert>
              )}

              {/* Media Files Table */}
              {!loading && !error && (
                <>
                  <div className="table-responsive">
                    <Table striped hover>
                      <thead>
                        <tr>
                          <th>File</th>
                          <th>Type</th>
                          <th>Size</th>
                          <th>Duration</th>
                          <th>Streams</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mediaFiles.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-4">
                              <i className="bi bi-inbox display-4 text-muted d-block mb-2"></i>
                              <span className="text-muted">No media files found</span>
                            </td>
                          </tr>
                        ) : (
                          mediaFiles.map((file) => (
                            <MediaFileRow
                              key={file.id}
                              file={file}
                              onViewDetails={(file) => {
                                setSelectedFile(file);
                                setShowDetailsModal(true);
                              }}
                              onDelete={handleDelete}
                              formatFileSize={formatFileSize}
                              formatDuration={formatDuration}
                            />
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modals */}
      <MediaFileDetailsModal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        file={selectedFile}
        formatFileSize={formatFileSize}
        formatDuration={formatDuration}
      />

      <DeleteConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        file={fileToDelete}
        loading={deleting}
      />

      {/* Upload Modal */}
      <MediaUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}