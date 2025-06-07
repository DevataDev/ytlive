'use client';

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Form, Button, Spinner, InputGroup, Card, Badge } from 'react-bootstrap';
import { FaSearch, FaSync } from 'react-icons/fa';
import { BsArrowRepeat, BsSearch } from 'react-icons/bs';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
import TikTokCard from '@/components/tiktok/TikTokCard';
import { searchLiveRooms, TikTokRoom, addToMirror} from '@/services/tiktokService';

export default function TikTokSearchPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<TikTokRoom[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [pageState, setPageState] = useState({
    currentOffset: 0,
  });
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
        setHasSearched(false);
        return;
      }

      try {
        if (isLoadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
          setHasSearched(true);
        }
        
        const currentOffset = isLoadMore ? pagination.offset + pagination.limit : 0;
        
        const data = await searchLiveRooms(
          searchQuery,
          currentOffset,
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
          offset: data.pagination?.offset || currentOffset,
          limit: pagination.limit
        });
        
        setPageState({
          currentOffset: data.pagination?.offset || currentOffset,
        });
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to search TikTok live streams');
        if (!isLoadMore) {
          setResults([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
        setIsSearching(false);
      }
    }, 500),
    [pagination.offset, pagination.limit, pagination.search_id]
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
      setHasSearched(false);
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

  // Handle add to mirror
  const handleAddToMirror = async (roomId: string) => {
    try {
      await addToMirror({ tiktok: roomId });
    } catch (error) {
      console.error('Failed to add to mirror:', error);
      toast.error('Failed to add to mirror. Please try again.');
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
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
        <div className="mb-3 mb-md-0">
          <h4 className="mb-1 d-flex align-items-center">
            <BsSearch className="me-2 text-primary" />
            Search TikTok Live Streams
          </h4>
          <p className="text-muted mb-0 small">Search and discover live TikTok streams to add to your mirrors</p>
        </div>
        <div className="d-flex gap-2">
          <div className="d-flex flex-column align-items-end me-3">
            <div className="d-flex align-items-center mb-1">
              <span className="badge bg-success me-2">FOUND</span>
              <span className="text-muted small">Results:</span>
              <span className="ms-1 fw-semibold">{results.length}</span>
            </div>
            {query && (
              <div className="d-flex align-items-center">
                <span className="text-muted small">Query:</span>
                <span className="ms-1 fw-semibold text-truncate" style={{maxWidth: '150px'}}>"{query}"</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <InputGroup size="lg">
              <InputGroup.Text className="bg-white border-end-0">
                <FaSearch className="text-muted" />
              </InputGroup.Text>
              <Form.Control
                type="search"
                placeholder="Search for TikTok live streams, usernames, or topics..."
                value={query}
                onChange={handleSearchChange}
                className="border-start-0 border-end-0"
              />
              <Button 
                variant="primary" 
                type="submit"
                disabled={isLoading || !query.trim()}
              >
                {isLoading ? (
                  <>
                    <Spinner as="span" size="sm" animation="border" role="status" className="me-2" />
                    Searching...
                  </>
                ) : (
                  'Search'
                )}
              </Button>
            </InputGroup>
          </Form>
          
          {/* Search Status */}
          {isSearching && !isLoading && query && (
            <div className="d-flex align-items-center justify-content-center mt-3 py-2">
              <Spinner animation="border" variant="primary" size="sm" className="me-2" />
              <span className="text-muted">Searching for "{query}"...</span>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Search Results */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {/* Initial State */}
          {!hasSearched && !query && (
            <div className="text-center p-5">
              <div className="mx-auto mb-3" style={{ width: '80px' }}>
                <BsSearch size={48} className="text-muted" />
              </div>
              <h6 className="mb-2">Search TikTok Live Streams</h6>
              <p className="text-muted mb-0 small">
                Enter a search term above to find live TikTok streams
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !isLoadingMore && (
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" className="mb-3" />
              <h6 className="mb-2">Searching...</h6>
              <p className="text-muted mb-0 small">Finding live streams for "{query}"</p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && !isSearching && hasSearched && query && results.length === 0 && (
            <div className="text-center p-5">
              <div className="mx-auto mb-3" style={{ width: '80px' }}>
                <BsSearch size={48} className="text-muted" />
              </div>
              <h5 className="mb-2">No results found</h5>
              <p className="text-muted mb-4">
                No live streams found for "{query}". Try a different search term.
              </p>
              <Button 
                variant="outline-primary"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                Clear Search
              </Button>
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 && (
            <>
              <div className="row g-4 p-3">
                {results.map((room) => (
                  <div key={`${room.id_str}-${room.create_time || ''}`} className="col-12 col-md-6 col-lg-4 col-xl-3">
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
                        Loading more results...
                      </>
                    ) : (
                      'Load More Results'
                    )}
                  </Button>
                  <div className="text-muted small mt-2">
                    Showing {results.length} results for "{query}"
                  </div>
                </Card.Footer>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}