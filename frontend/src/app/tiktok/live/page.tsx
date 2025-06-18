'use client';
import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faFilter, faSync, faPlay } from '@fortawesome/free-solid-svg-icons';
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
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading TikTok live streams...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FontAwesomeIcon icon={faPlay} className="mr-3 text-blue-600" />
              TikTok Live Streams
            </h1>
            <p className="text-gray-600">Discover and add live TikTok streams to your mirrors</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-end">
              <div className="flex items-center mb-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                  LIVE
                </span>
                <span className="text-gray-500 text-sm">Streams:</span>
                <span className="ml-1 font-semibold text-gray-900">{rooms.length}</span>
              </div>
            </div>
            <button 
              className={`inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => loadLiveFeeds()}
              disabled={isLoading}
            >
              <FontAwesomeIcon 
                icon={faSync} 
                className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} 
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Live Streams */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {rooms.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <FontAwesomeIcon icon={faPlay} className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No live streams found</h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? 'Try adjusting your search terms' : 'No TikTok live streams are currently available'}
              </p>
              <button 
                className={`inline-flex items-center px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-medium ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => loadLiveFeeds()}
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faSync} className="mr-2 h-4 w-4" />
                Refresh
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
                {rooms.map((room) => (
                  <div key={room.id_str}>
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
                        Loading more streams...
                      </>
                    ) : (
                      'Load More Streams'
                    )}
                  </button>
                  { (pagination.total ?? 0) > 0 && (
                    <div className="text-gray-500 text-sm mt-2">
                      Showing {rooms.length} streams
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}