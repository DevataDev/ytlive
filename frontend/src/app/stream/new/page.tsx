'use client'

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUpload, 
  faTimes, 
  faVideo, 
  faMusic, 
  faFile, 
  faExclamationTriangle, 
  faSpinner, 
  faFileVideo,
  faSearch,
  faFolderOpen,
  faInfoCircle,
  faPlay
} from '@fortawesome/free-solid-svg-icons';
import { getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useConfig } from '@/hooks/useConfig';
import { api } from '@/lib/api';
import { createStreamNew, CreateStreamNewData, CreateStreamNewResponse, MediaFile, createStreamNewUpload, MediaListResponse, MediaFileData } from '@/services/streamService';

export default function StreamNewPage() {
  // Media file selection state
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState<'video' | 'audio' | 'all'>('all');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [isCreatingStream, setIsCreatingStream] = useState(false);

  const router = useRouter()
  const config = useConfig();

  // Load user media files function
  const loadUserMediaFiles = useCallback(async (reset = false, customOffset?: number) => {
    try {
      if (reset) {
        setLoading(true);
        setMediaFiles([]);
        setPagination({ total: 0, limit: 20, offset: 0, has_more: false });
      } else {
        setLoadingMore(true);
      }

      const apiUrl = config.config?.apiUrl || process.env.API_URL || 'http://localhost:8081'
      const session = await getSession();
      if (!session) {
        setError('Please log in to view media files');
        return;
      }

      const sessionToken = await session.user?.backendToken;
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const currentOffset = reset ? 0 : (customOffset !== undefined ? customOffset : pagination.offset);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: currentOffset.toString(),
      });

      if (currentFilter && currentFilter !== 'all') {
        params.append('type', currentFilter);
      } else {
        params.append('type', 'all');
      }

      const response = await api.get<MediaListResponse>(`/api/media/user?${params}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      const newFiles: MediaFile[] = response.files?.map((file: any) => ({
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
        total: response.pagination?.total || 0,
        limit: response.pagination?.limit || 20,
        offset: response.pagination?.offset || 0,
        has_more: response.pagination?.has_more || false,
      });
    } catch (err) {
      console.error('Error loading media files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load media files');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pagination.limit, currentFilter, config.config?.apiUrl]);

  // Load media files on component mount
  useEffect(() => {
    if (!hasLoadedInitial) {
      setHasLoadedInitial(true);
      loadUserMediaFiles(true);
    }
  }, [loadUserMediaFiles, hasLoadedInitial]);

  // Reload when filter changes
  useEffect(() => {
    if (hasLoadedInitial) {
      loadUserMediaFiles(true);
    }
  }, [currentFilter, loadUserMediaFiles, hasLoadedInitial]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getMediaTypeIcon = (mediaType: string) => {
    if (mediaType.startsWith('video/')) {
      return <FontAwesomeIcon icon={faVideo} className="text-blue-500" />;
    } else if (mediaType.startsWith('audio/')) {
      return <FontAwesomeIcon icon={faMusic} className="text-green-500" />;
    } else {
      return <FontAwesomeIcon icon={faFile} className="text-gray-500" />;
    }
  };

  const handleLoadMore = () => {
    const nextOffset = pagination.offset + pagination.limit;
    loadUserMediaFiles(false, nextOffset);
  };

  const handleFileToggle = (fileId: string) => {
    const isSelected = selectedFileIds.includes(fileId);
    if (isSelected) {
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
      setSelectedMediaFiles(prev => prev.filter(file => file.ID !== fileId));
    } else {
      setSelectedFileIds(prev => [...prev, fileId]);
      const file = mediaFiles.find(f => f.ID === fileId);
      if (file) {
        setSelectedMediaFiles(prev => [...prev, file]);
      }
    }
  };

  const handleSelectAll = () => {
    const allFileIds = getFilteredFiles().map(file => file.ID);
    setSelectedFileIds(allFileIds);
    setSelectedMediaFiles(getFilteredFiles());
  };

  const handleClearSelection = () => {
    setSelectedFileIds([]);
    setSelectedMediaFiles([]);
  };

  const getFilteredFiles = () => {
    return mediaFiles.filter(file => {
      const matchesSearch = !searchTerm || 
        file.FileName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = currentFilter === 'all' || 
        (currentFilter === 'video' && file.MediaType.startsWith('video/')) ||
        (currentFilter === 'audio' && file.MediaType.startsWith('audio/'));
      
      return matchesSearch && matchesType;
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/(\d+)\/(\d+)\/(\d+),\s*(\d+:\d+:\d+)/, '$3-$1-$2 $4');
  };

  const createStreamWithSelectedFiles = useCallback(async (): Promise<boolean> => {
    if (selectedMediaFiles.length === 0) {
      setError('Please select media files to create a stream.');
      return false;
    }

    const validFileIds = selectedMediaFiles.map(file => file.ID);
    
    try {
      setIsCreatingStream(true);
      setError('');
      
      const streamData: CreateStreamNewData = {
        Name: `Stream ${formatDateTime(new Date())}`,
        Description: 'Stream created from selected media files',
        MediaFileIds: validFileIds,
        IsActive: false,
      };
      
      const response = await createStreamNewUpload(streamData);
      
      if (response.success && response.stream.id) {
        setSuccess('Stream created successfully!');
        
        setTimeout(() => {
          router.push(`/stream`);
        }, 1500);
        
        return true;
      } else {
        throw new Error('Failed to create stream: Invalid response from server');
      }
    } catch (err) {
      console.error('Error creating stream:', err);
      setError(`Failed to create stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    } finally {
      setIsCreatingStream(false);
    }
  }, [selectedMediaFiles, router]);

  const handleCreateStream = async () => {
    await createStreamWithSelectedFiles();
  };


  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Create New Stream</h1>
            <p className="mt-1 text-sm text-gray-600">
              Select existing media files to create a new stream
            </p>
          </div>
          
          <div className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mr-2" />
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <button
                    onClick={() => setError('')}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Search and Filter Controls */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search media files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={currentFilter}
                    onChange={(e) => setCurrentFilter(e.target.value as 'all' | 'video' | 'audio')}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="video">Video Only</option>
                    <option value="audio">Audio Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  disabled={getFilteredFiles().length === 0}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Select All ({getFilteredFiles().length})
                </button>
                <button
                  onClick={handleClearSelection}
                  disabled={selectedFileIds.length === 0}
                  className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Clear Selection
                </button>
              </div>
              <div className="text-sm text-gray-600">
                {selectedFileIds.length} of {getFilteredFiles().length} selected
              </div>
            </div>

            {/* Selection Summary */}
            {selectedMediaFiles.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">
                  Selected Files ({selectedMediaFiles.length})
                </h3>
                <div className="space-y-1">
                  {selectedMediaFiles.slice(0, 3).map((file) => (
                    <div key={file.ID} className="text-sm text-blue-700">
                      {file.FileName} ({formatFileSize(file.FileSize)})
                    </div>
                  ))}
                  {selectedMediaFiles.length > 3 && (
                    <div className="text-sm text-blue-600">
                      ... and {selectedMediaFiles.length - 3} more files
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* File List */}
            <div className="border border-gray-200 rounded-lg">
              {loadingMore && mediaFiles.length === 0 ? (
                <div className="p-8 text-center">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-2xl mb-2" />
                  <p className="text-gray-500">Loading media files...</p>
                </div>
              ) : getFilteredFiles().length === 0 ? (
                <div className="p-8 text-center">
                  <FontAwesomeIcon icon={faFile} className="text-gray-300 text-3xl mb-4" />
                  <p className="text-gray-500 mb-2">No media files found</p>
                  <p className="text-sm text-gray-400">
                    {searchTerm || currentFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria'
                      : 'Upload some media files first to create a stream'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {getFilteredFiles().map((file) => {
                    const isSelected = selectedFileIds.includes(file.ID);
                    return (
                      <div
                        key={file.ID}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => handleFileToggle(file.ID)}
                      >
                        <div className="flex items-center">
                          <div className="flex-shrink-0 mr-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg">
                              {getMediaTypeIcon(file.MediaType)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {file.FileName}
                              </h4>
                              <div className="ml-4 flex-shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleFileToggle(file.ID)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <span>{formatFileSize(file.FileSize)}</span>
                              <span className="mx-2">•</span>
                              <span className="capitalize">
                                {file.MediaType.split('/')[0]}
                              </span>
                              <span className="mx-2">•</span>
                              <span>{new Date(file.CreatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Load More Button */}
            {pagination.has_more && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCreateStream}
                disabled={selectedMediaFiles.length === 0 || isCreatingStream}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingStream ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Creating Stream...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPlay} className="mr-2" />
                    Create Stream ({selectedMediaFiles.length} file{selectedMediaFiles.length !== 1 ? 's' : ''})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
