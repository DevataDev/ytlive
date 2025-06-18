'use client';

import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faSync } from '@fortawesome/free-solid-svg-icons';
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TikTok Live Search</h1>
            <p className="text-gray-600">Search and discover live TikTok streams</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
              TikTok
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Live Streams
            </span>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faSearch} className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  placeholder="Search TikTok live streams..."
                  value={query}
                  onChange={handleSearchChange}
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    type="submit"
                    className={`mr-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                      isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Searching...
                      </>
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </div>
            </form>
            
            {/* Search Status */}
            {isSearching && !isLoading && query && (
              <div className="flex items-center justify-center mt-4 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-gray-600">Searching for "{query}"...</span>
              </div>
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Initial State */}
          {!hasSearched && !query && (
            <div className="text-center py-12 px-6">
              <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <FontAwesomeIcon icon={faSearch} className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Search TikTok Live Streams</h3>
              <p className="text-gray-500 text-sm">
                Enter a search term above to find live TikTok streams
              </p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !isLoadingMore && (
            <div className="text-center py-12 px-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Searching...</h3>
              <p className="text-gray-500 text-sm">Finding live streams for "{query}"</p>
            </div>
          )}

          {/* No Results */}
          {!isLoading && !isSearching && hasSearched && query && results.length === 0 && (
            <div className="text-center py-12 px-6">
              <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <FontAwesomeIcon icon={faSearch} className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-500 mb-6">
                No live streams found for "{query}". Try a different search term.
              </p>
              <button 
                className="inline-flex items-center px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {results.map((room) => (
                  <div key={`${room.id_str}-${room.create_time || ''}`}>
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
                <div className="bg-white border-t border-gray-200 text-center py-6">
                  <button 
                    className={`inline-flex items-center px-6 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium ${
                      isLoadingMore ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Loading more results...
                      </>
                    ) : (
                      'Load More Results'
                    )}
                  </button>
                  <div className="text-gray-500 text-sm mt-2">
                    Showing {results.length} results for "{query}"
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}