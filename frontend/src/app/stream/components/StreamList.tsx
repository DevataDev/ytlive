'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faSearch, 
  faFilter, 
  faSync, 
  faSpinner,
  faExclamationTriangle,
  faAngleLeft,
  faAngleRight
} from '@fortawesome/free-solid-svg-icons';
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
import { toast } from 'react-toastify';

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
    // Remove the window.confirm() line
    try {
      await deleteStream(id);
      await loadStreams();
    } catch (err) {
      console.error('Failed to delete stream:', err);
      setError('Failed to delete stream. Please try again.');
      throw err; // Re-throw to allow StreamCard to handle the error
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
      setError('Failed to toggle loop video. Please try again.');
      throw err;
    }
  };

  const handleBindChannel = async (streamId: string, channelId: string, streamKey: string) => {
    try {
      await bindChannel(streamId, channelId, streamKey);
      await loadStreams();
      toast.success('Channel bound successfully');
    } catch (err) {
      console.error('Failed to bind channel:', err);
      setError('Failed to bind channel. Please try again.');
      throw err;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    switch (status) {
      case 'live':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'scheduled':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'stopped':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  return (
    <div className="container-fluid py-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Streams</h1>
                <div className="flex gap-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {stats.live} Live
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {stats.scheduled} Scheduled
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FontAwesomeIcon icon={faFilter} className="mr-2" />
                  Filters
                </button>
                <button
                  onClick={loadStreams}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FontAwesomeIcon 
                    icon={isLoading ? faSpinner : faSync} 
                    className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} 
                  />
                  Refresh
                </button>
                <button
                  onClick={() => router.push('/stream/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  New Stream
                </button>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="p-6 border-b border-gray-200">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faSearch} className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search streams..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FontAwesomeIcon icon={faSearch} className="mr-2" />
                Search
              </button>
            </form>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-12 text-center">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin h-8 w-8 text-blue-600 mb-4" />
              <p className="text-gray-600">Loading streams...</p>
            </div>
          )}

          {/* Content */}
          {!isLoading && (
            <>
              {streams.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      className="h-full w-full"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No streams found</h3>
                  <p className="text-gray-600 mb-6">
                    Get started by adding your first stream with the "New Stream" button
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {streams.map((stream) => (
                      <div key={stream.id}>
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
                          onViewMediaFiles={() => {}} // Remove router navigation
                          onViewLogs={() => router.push(`/streams/${stream.id}/logs`)}
                          onViewSettings={() => {}} // Add this line
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {streams.length > 0 && (
            <div className="bg-white px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center">
              <div className="text-sm text-gray-700 mb-4 sm:mb-0">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.pageSize + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> streams
              </div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <FontAwesomeIcon icon={faAngleLeft} className="h-4 w-4" />
                </button>
                
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
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === pagination.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page * pagination.pageSize >= pagination.total}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <FontAwesomeIcon icon={faAngleRight} className="h-4 w-4" />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
