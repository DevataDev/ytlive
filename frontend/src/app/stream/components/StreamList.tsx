'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, InputGroup, Spinner, Alert, Badge, Pagination } from 'react-bootstrap';
import { Plus, Search, Funnel, ArrowClockwise } from 'react-bootstrap-icons';
import { 
  fetchStreams, 
  Stream, 
  StreamListResponse, 
  startStream, 
  stopStream, 
  deleteStream,
  renameStream,
  updateStreamKey,
  updateRtmpUrl,
  toggleLoopVideo,
  bindChannel
} from '@/services/streamService';
import StreamCard from '@/components/streams/StreamCard';
import styles from './StreamList.module.css';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

interface StatsState {
  live: number;
  scheduled: number;
}

export default function StreamList() {
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [stats, setStats] = useState<StatsState>({
    live: 0,
    scheduled: 0
  });

  const updateStats = useCallback((data: StreamListResponse) => {
    const liveCount = data.countLive;
    const scheduledCount = data.countScheduled;
    setStats({ live: liveCount, scheduled: scheduledCount });
  }, []);

  const loadStreams = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await fetchStreams(
        pagination.page,
        pagination.pageSize,
        searchQuery
      );

      setStreams(data.streams);
      setPagination(prev => ({
        ...prev,
        total: data.total
      }));

      updateStats(data);
    } catch (err) {
      console.error('Failed to load streams:', err);
      setError('Failed to load streams. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, searchQuery, updateStats]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = useCallback((newPage: number) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  }, []);

  const handleStartStream = async (id: string) => {
    try {
      await startStream(id);
      await loadStreams();
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError('Failed to start stream. Please try again.');
      throw err; // Re-throw to allow StreamCard to handle the error
    }
  };

  const handleStopStream = async (id: string) => {
    try {
      await stopStream(id);
      await loadStreams();
    } catch (err) {
      console.error('Failed to stop stream:', err);
      setError('Failed to stop stream. Please try again.');
      throw err; // Re-throw to allow StreamCard to handle the error
    }
  };

  const handleDeleteStream = async (id: string) => {
    if (confirm('Are you sure you want to delete this stream? This action cannot be undone.')) {
      try {
        await deleteStream(id);
        await loadStreams();
      } catch (err) {
        console.error('Failed to delete stream:', err);
        setError('Failed to delete stream. Please try again.');
        throw err; // Re-throw to allow StreamCard to handle the error
      }
    }
  };

  const handleRenameStream = async (id: string, name: string, description: string) => {
    try {
      await renameStream(id, name, description);
      await loadStreams();
    } catch (err) {
      console.error('Failed to rename stream:', err);
      setError('Failed to rename stream. Please try again.');
      throw err;
    }
  };

  const handleUpdateStreamKey = async (id: string, streamKey: string) => {
    try {
      await updateStreamKey(id, streamKey);
      await loadStreams();
    } catch (err) {
      console.error('Failed to update stream key:', err);
      setError('Failed to update stream key. Please try again.');
      throw err;
    }
  };

  const handleUpdateRtmpUrl = async (id: string, rtmpUrl: string) => {
    try {
      await updateRtmpUrl(id, rtmpUrl);
      await loadStreams();
    } catch (err) {
      console.error('Failed to update RTMP URL:', err);
      setError('Failed to update RTMP URL. Please try again.');
      throw err;
    }
  };

  const handleToggleLoopVideo = async (id: string, loop: boolean) => {
    try {
      await toggleLoopVideo(id, loop);
      await loadStreams();
    } catch (err) {
      console.error('Failed to toggle loop video:', err);
      setError('Failed to update video loop setting. Please try again.');
      throw err;
    }
  };

  const handleBindChannel = async (streamId: string, channelId: string, streamKey: string) => {
    try {
      await bindChannel(streamId, channelId, streamKey);
      await loadStreams();
    } catch (err) {
      console.error('Failed to bind channel:', err);
      setError('Failed to bind channel. Please try again.');
      throw err;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge bg="success">Live</Badge>;
      case 'idle':
        return <Badge bg="secondary">Idle</Badge>;
      case 'error':
        return <Badge bg="danger">Error</Badge>;
      default:
        return <Badge bg="secondary">Unknown</Badge>;
    }
  };

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  return (
    <div className={styles.StreamList}>
      <div className="container-xxl">
        {/* Page Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
          <div className="mb-3 mb-md-0">
            <h1 className="h3 mb-2">Stream Manager</h1>
            <p className="text-muted mb-0">Manage your live streams and media content</p>
          </div>
          <div className="d-flex gap-2">
            <div className="d-flex flex-column align-items-end me-3">
              <div className="d-flex align-items-center mb-1">
                <span className={styles.liveIndicator}></span>
                <span className="text-muted small ms-1">Live:</span>
                <span className="ms-1 fw-semibold">{stats.live}</span>
              </div>
              <div className="d-flex align-items-center">
                <i className="bi bi-alarm text-primary me-1"></i>
                <span className="text-muted small">Scheduled:</span>
                <span className="ms-1 fw-semibold">{stats.scheduled}</span>
              </div>
            </div>
            <Button variant="primary" onClick={() => router.push('/stream/new')}>
              <Plus className="me-1" /> New Stream
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-4">
          <Form onSubmit={handleSearch} className="mb-3">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <Search />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Search streams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowFilters(!showFilters)}
                className="d-lg-none"
              >
                <Funnel />
              </Button>
              <Button type="submit" variant="primary">
                Search
              </Button>
            </InputGroup>
          </Form>

          {showFilters && (
            <Card className="mb-3 d-lg-none">
              <Card.Body>
                <h6 className="mb-3">Filters</h6>
                <div className="d-flex flex-wrap gap-2">
                  <Form.Select size="sm" style={{ width: 'auto' }}>
                    <option>All Status</option>
                    <option>Live</option>
                    <option>Idle</option>
                    <option>Error</option>
                  </Form.Select>
                  <Form.Select size="sm" style={{ width: 'auto' }}>
                    <option>All Types</option>
                    <option>RTMP</option>
                    <option>HLS</option>
                    <option>MP4</option>
                  </Form.Select>
                  <Button variant="outline-secondary" size="sm">
                    <ArrowClockwise className="me-1" /> Reset
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Stream List */}
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            {isLoading ? (
              <div className="text-center p-5">
                <Spinner animation="border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
                <p className="mt-2 text-muted">Loading streams...</p>
              </div>
            ) : error ? (
              <Alert variant="danger" className="m-3">
                {error}
              </Alert>
            ) : streams.length === 0 ? (
              <div className="text-center p-5">
                <div className="mx-auto" style={{ width: '120px' }}>
                  <img
                    src="/img/empty-state.svg"
                    alt="No streams"
                    className="img-fluid mb-3"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTkgMTNIMTlNMTUgMTNIMTlNMTkgMTdIMTlNMTkgMTdIMTlNMTkgMTdIMTlNMTkgMTdIMTlNMjEgN0gxN0MxNi4yMzA5IDcgMTUuNjE2NyA3LjU5Njk1IDE1LjUgOC4yNkMxNS4yMjY4IDguMTEzODIgMTQuOTI0MSA4IDE0LjYwNjFDMTMuNzE3OSA4IDEzIDguNzE3OTQgMTMgOS42MDYwNkMxMyA5LjkyNDEyIDEzLjExMzggMTAuMjI2OCAxMy4yNjAxIDEwLjVINVMzIDExLjM5NTQgMyAxMi41VjE5UzMuODk1NDMgMjEgNSAyMWgxNGMxLjEwNDYgMCAxLS44OTU0IDEtMnYtNnYtM1oiIHN0cm9rZT0iNzM3RkZGIiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPg=='; // Fallback SVG
                    }}
                  />
                </div>
                <h5 className="mb-2">No streams found</h5>
                <p className="text-muted mb-4">
                  Get started by adding your first stream with the "New Stream" button
                </p>
              </div>
            ) : (
              <div className="row g-4 p-3">
                {streams.map((stream) => (
                  <div key={stream.ID} className="col-12 col-md-6 col-xl-4 mb-4">
                    <StreamCard
                      stream={stream}
                      onStartStream={handleStartStream}
                      onStopStream={handleStopStream}
                      onDeleteStream={handleDeleteStream}
                      onRenameStream={handleRenameStream}
                      onUpdateStreamKey={handleUpdateStreamKey}
                      onUpdateRtmpUrl={handleUpdateRtmpUrl}
                      onToggleLoopVideo={handleToggleLoopVideo}
                      onBindChannel={handleBindChannel}
                      onViewMediaFiles={() => router.push(`/streams/${stream.ID}/media`)}
                      onViewLogs={() => router.push(`/streams/${stream.ID}/logs`)}
                      onViewSettings={() => router.push(`/streams/${stream.ID}/settings`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card.Body>

          {/* Pagination */}
          {streams.length > 0 && (
            <Card.Footer className="bg-white border-top-0 d-flex flex-column flex-md-row justify-content-between align-items-center">
              <div className="text-muted small mb-2 mb-md-0">
                Showing <span>{(pagination.page - 1) * pagination.pageSize + 1}</span> to{' '}
                <span>{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of{' '}
                <span>{pagination.total}</span> streams
              </div>
              <Pagination className="mb-0">
                <Pagination.Prev
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                />
                {Array.from({ length: Math.min(5, Math.ceil(pagination.total / pagination.pageSize)) }, (_, i) => {
                  let pageNum;
                  if (Math.ceil(pagination.total / pagination.pageSize) <= 5) {
                    pageNum = i + 1;
                  } else {
                    const halfWay = Math.floor(5 / 2);
                    if (pagination.page <= halfWay) {
                      pageNum = i + 1;
                    } else if (pagination.page > Math.ceil(pagination.total / pagination.pageSize) - halfWay) {
                      pageNum = Math.ceil(pagination.total / pagination.pageSize) - 4 + i;
                    } else {
                      pageNum = pagination.page - halfWay + i;
                    }
                  }

                  return (
                    <Pagination.Item
                      key={pageNum}
                      active={pageNum === pagination.page}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Item>
                  );
                })}
                <Pagination.Next
                  disabled={pagination.page * pagination.pageSize >= pagination.total}
                  onClick={() => handlePageChange(pagination.page + 1)}
                />
              </Pagination>
            </Card.Footer>
          )}
        </Card>
      </div>
    </div>
  );
}
