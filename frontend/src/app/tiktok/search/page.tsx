'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, Spinner, InputGroup } from 'react-bootstrap';
import { FaSearch, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import TikTokCard from '@/components/tiktok/TikTokCard';
import { searchLiveRooms, TikTokRoom } from '@/services/tiktokService';

export default function TikTokSearchPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<TikTokRoom[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pagination, setPagination] = useState({
    has_more: false,
    search_id: '',
    offset: 0,
    limit: 12
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string, isLoadMore = false) => {
      if (!searchQuery.trim() && !isLoadMore) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      try {
        if (isLoadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        
        const data = await searchLiveRooms(
          searchQuery,
          isLoadMore ? pagination.offset + pagination.limit : 0,
          pagination.limit,
          isLoadMore ? pagination.search_id : ''
        );
        
        if (isLoadMore) {
          setResults(prev => [...prev, ...(data.rooms || [])]);
        } else {
          setResults(data.rooms || []);
        }
        
        setPagination({
          has_more: data.pagination?.has_more || false,
          search_id: data.pagination?.search_id || '',
          offset: data.pagination?.offset || 0,
          limit: pagination.limit
        });
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to search TikTok');
        if (!isLoadMore) {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsSearching(false);
      }
    }, 500),
    []
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      setIsSearching(true);
      debouncedSearch(value, false);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  // Handle manual search submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsSearching(true);
      debouncedSearch(query, false);
    }
  };
  
  // Handle load more
  const handleLoadMore = () => {
    if (pagination.has_more && query.trim()) {
      debouncedSearch(query, true);
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <Container className="py-4">
      <div className="mb-4">
        <h1 className="h3 mb-4">Search TikTok Live Streams</h1>
        
        <Form onSubmit={handleSubmit} className="mb-4">
          <InputGroup>
            <Form.Control
              type="search"
              placeholder="Search TikTok live streams..."
              value={query}
              onChange={handleSearchChange}
              className="border-end-0"
            />
            <Button 
              variant="outline-secondary" 
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <Spinner as="span" size="sm" animation="border" role="status" />
              ) : (
                <FaSearch className="me-1" />
              )}
              Search
            </Button>
          </InputGroup>
        </Form>

        {isSearching && !isLoading && query && (
          <div className="text-center py-3">
            <Spinner animation="border" variant="primary" size="sm" className="me-2" />
            <span>Searching for "{query}"...</span>
          </div>
        )}

        {!isLoading && !isSearching && query && results.length === 0 && (
          <div className="text-center py-5">
            <h4>No results found for "{query}"</h4>
            <p className="text-muted">Try a different search term</p>
          </div>
        )}
      </div>

      <Row xs={1} md={2} lg={3} className="g-4">
        {results.map((room) => (
          <Col key={`${room.id_str}-${room.create_time || ''}`}>
            <TikTokCard 
              room={room} 
              onAddToMirror={async (roomId) => {
                // Implement add to mirror functionality here
                console.log('Add to mirror:', roomId);
                toast.success('Added to mirror!');
              }}
            />
          </Col>
        ))}
      </Row>
      
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
    </Container>
  );
}