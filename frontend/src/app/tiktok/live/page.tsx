'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, Spinner, Badge } from 'react-bootstrap';
import { FaSearch, FaFilter, FaSync } from 'react-icons/fa';
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
      toast.success('Added to mirror successfully!');
    } catch (error) {
      console.error('Failed to add to mirror:', error);
      toast.error('Failed to add to mirror. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-2">
          TikTok Live Streams
        </h1>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Loading live streams...</p>
        </div>
      ) : (
        <>
          {/* No results */}
          {rooms.length === 0 && (
            <div className="text-center py-5">
              <h4>No live streams found</h4>
              <p>Try adjusting your search or filters</p>
            </div>
          )}

          {/* Stream grid */}
          <Row xs={1} md={2} lg={3} xl={4} className="g-4">
            {rooms.map((room) => (
              <Col key={room.id_str}>
                <TikTokCard 
                  room={room} 
                  onAddToMirror={handleAddToMirror}
                  loading={isLoading}
                />
              </Col>
            ))}
          </Row>

          {/* Load more button */}
          {pagination.has_more && (
            <div className="text-center mt-4">
              <Button 
                variant="outline-primary" 
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Spinner as="span" size="sm" animation="border" role="status" className="me-2" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </Container>
  );
}