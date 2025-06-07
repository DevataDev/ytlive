'use client';
import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Badge, Card, InputGroup } from 'react-bootstrap';
import { FaSearch, FaFilter, FaSync, FaPlay } from 'react-icons/fa';
import { BsArrowRepeat } from 'react-icons/bs';
import TikTokCard from '@/components/tiktok/TikTokCard';
import { fetchLiveFeeds, addToMirror, TikTokRoom } from '@/services/tiktokService';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function TikTokLivePage() {
  // State
  const [rooms, setRooms] = useState<TikTokRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState<{
    has_more: boolean;
    search_id?: string;
    offset?: number;
    total?: number;
  }>({
    has_more: false,
    search_id: '',
    offset: 0,
    total: 0,
  });
  const [filters, setFilters] = useState({
    sort: 'popular', // popular, newest
    minViewers: 0,
  });

  // Fetch live feeds
  const loadLiveFeeds = useCallback(async (loadMore = false) => {
    try {
      if (loadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetchLiveFeeds({
        isLoadMore: loadMore,
        offset: loadMore ? pagination.offset || 0 : 0,
        limit: 12,
        searchId: loadMore ? pagination.search_id || '' : ''
      });

      if (loadMore) {
        // Only add new rooms that aren't already in the list
        const newRooms = response.rooms.filter(
          (newRoom) => !rooms.some((room) => room.id_str === newRoom.id_str)
        );
        setRooms((prevRooms) => [...prevRooms, ...newRooms]);
      } else {
        setRooms(response.rooms || []);
      }

      setPagination({
        has_more: response.pagination?.has_more || false,
        search_id: response.pagination?.search_id || '',
        offset: response.pagination?.offset || 0,
        total: response.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Failed to load live feeds:', error);
      toast.error('Failed to load live streams. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [pagination.offset, pagination.search_id, rooms]);

  // Initial load
  useEffect(() => {
    loadLiveFeeds();
  }, []);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLiveFeeds();
  };

  // Handle load more
  const handleLoadMore = () => {
    if (pagination.has_more) {
      loadLiveFeeds(true);
    }
  };

  // Handle adding to mirror
  const handleAddToMirror = async (roomId: string) => {
    try {
      setIsLoading(true);
      await addToMirror({ tiktok: roomId });
    } catch (error) {
      console.error('Failed to add to mirror:', error);
      toast.error('Failed to add to mirror. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && rooms.length === 0) {
    return (
      <Container className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading TikTok live streams...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <div className="mb-3 mb-md-0">
          <h4 className="mb-1 d-flex align-items-center">
            <FaPlay className="me-2 text-primary" />
            TikTok Live Streams
          </h4>
          <p className="text-muted small mb-0">Discover and add live TikTok streams to your mirrors</p>
        </div>
        <div className="d-flex gap-2">
          <div className="d-flex flex-column align-items-end me-3">
            <div className="d-flex align-items-center mb-1">
              <span className="badge bg-danger me-2">LIVE</span>
              <span className="text-muted small">Streams:</span>
              <span className="ms-1 fw-semibold">{rooms.length}</span>
            </div>
          </div>
          <Button 
            variant="outline-secondary"
            onClick={() => loadLiveFeeds()}
            disabled={isLoading}
          >
            <BsArrowRepeat className={isLoading ? 'fa-spin me-1' : 'me-1'} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Live Streams */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {rooms.length === 0 ? (
            <div className="text-center p-5">
              <div className="mx-auto mb-3" style={{ width: '80px' }}>
                <FaPlay size={48} className="text-muted" />
              </div>
              <h5 className="mb-2">No live streams found</h5>
              <p className="text-muted mb-4">
                {searchQuery ? 'Try adjusting your search terms' : 'No TikTok live streams are currently available'}
              </p>
              <Button 
                variant="outline-primary"
                onClick={() => loadLiveFeeds()}
                disabled={isLoading}
              >
                <BsArrowRepeat className="me-1" /> Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="row g-4 p-3">
                {rooms.map((room) => (
                  <div key={room.id_str} className="col-12 col-md-6 col-lg-4 col-xl-3">
                    <TikTokCard 
                      room={room} 
                      onAddToMirror={handleAddToMirror}
                      loading={isLoading}
                    />
                  </div>
                ))}
              </div>
              
              {/* Load More Section */}
              {pagination.has_more && (
                <Card.Footer className="bg-white border-top-0 text-center">
                  <Button 
                    variant="outline-primary" 
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-4"
                  >
                    {isLoadingMore ? (
                      <>
                        <Spinner as="span" size="sm" animation="border" role="status" className="me-2" />
                        Loading more streams...
                      </>
                    ) : (
                      'Load More Streams'
                    )}
                  </Button>
                  { (pagination.total ?? 0) > 0 && (
                    <div className="text-muted small mt-2">
                      Showing {rooms.length} streams
                    </div>
                  )}
                </Card.Footer>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}