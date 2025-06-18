import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faSearch, faVideo, faMusic, faFile, faFolderOpen, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { MediaFile, MediaListResponse } from '@/services/streamService';
import { toast } from 'react-toastify';
import { getSession } from 'next-auth/react';
import { api }  from '@/lib/api';
import { MediaFileData } from '@/services/streamService';
import { useConfig } from '@/hooks/useConfig';

export interface MediaFileSelectionModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (selectedFiles: MediaFile[]) => void;
  selectedFileIds?: string[]; // Pre-selected files for editing
  title?: string;
  allowMultiple?: boolean;
  mediaTypeFilter?: 'video' | 'audio' | 'all';
}

interface UserMediaFilesResponse {
  files: MediaFileData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

const MediaFileSelectionModal: React.FC<MediaFileSelectionModalProps> = ({
  show,
  onHide,
  onSelect,
  selectedFileIds = [],
  title = 'Select Media Files',
  allowMultiple = true,
  mediaTypeFilter = 'all'
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>(selectedFileIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFilter, setCurrentFilter] = useState<'video' | 'audio' | 'all'>(mediaTypeFilter);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const config = useConfig();

  const loadUserMediaFiles = useCallback(async (reset = false) => {
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

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: (reset ? 0 : pagination.offset).toString(),
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
  }, [pagination.limit, pagination.offset, currentFilter]);

  // Load media files when modal opens
  useEffect(() => {
    if (show && !hasLoadedInitial) {
      setHasLoadedInitial(true);
      loadUserMediaFiles(true);
    }
  }, [show, loadUserMediaFiles, hasLoadedInitial]);

  // Reset when modal closes
  useEffect(() => {
    if (!show) {
      setHasLoadedInitial(false);
      setSearchTerm('');
      setError('');
      setSelectedFiles(selectedFileIds);
      setCurrentFilter(mediaTypeFilter);
    }
  }, [show, selectedFileIds, mediaTypeFilter]);

  // Update selected files when prop changes
  useEffect(() => {
    setSelectedFiles(selectedFileIds);
  }, [selectedFileIds]);

  // Reload when filter changes
  useEffect(() => {
    if (hasLoadedInitial) {
      loadUserMediaFiles(true);
    }
  }, [currentFilter, loadUserMediaFiles, hasLoadedInitial]);

  const handleLoadMore = () => {
    setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }));
    loadUserMediaFiles(false);
  };

  const handleFileToggle = (fileId: string) => {
    if (allowMultiple) {
      setSelectedFiles(prev => 
        prev.includes(fileId) 
          ? prev.filter(id => id !== fileId)
          : [...prev, fileId]
      );
    } else {
      setSelectedFiles([fileId]);
    }
  };

  const handleSelectAll = () => {
    const allFileIds = getFilteredFiles().map(file => file.ID);
    setSelectedFiles(allFileIds);
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
  };

  const handleConfirmSelection = () => {
    const selectedMediaFiles = mediaFiles.filter(file => selectedFiles.includes(file.ID));
    onSelect(selectedMediaFiles);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaTypeIcon = (mediaType: string) => {
    if (mediaType.startsWith('video/')) {
      return <FontAwesomeIcon icon={faVideo} className="text-blue-500" />;
    } else if (mediaType.startsWith('audio/')) {
      return <FontAwesomeIcon icon={faMusic} className="text-green-500" />;
    } else {
      return <FontAwesomeIcon icon={faFile} className="text-gray-500" />;
    }
  };

  const filteredFiles = getFilteredFiles();

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <button
                onClick={onHide}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white max-h-96 overflow-y-auto">
            <div className="p-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <div className="flex">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-red-400 mr-2" />
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                </div>
              )}

              {/* Search and Filter Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search Files</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FontAwesomeIcon icon={faSearch} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by filename..."
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
                  <select
                    value={currentFilter}
                    onChange={(e) => setCurrentFilter(e.target.value as 'video' | 'audio' | 'all')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Files</option>
                    <option value="video">Video Files</option>
                    <option value="audio">Audio Files</option>
                  </select>
                </div>
              </div>

              {/* Selection Controls */}
              {allowMultiple && filteredFiles.length > 0 && (
                <div className="flex justify-between items-center mb-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleClearSelection}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {/* Selection Summary */}
              {selectedFiles.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                  <div className="flex">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-400 mr-2" />
                    <div className="text-sm text-blue-700">
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                </div>
              )}

              {/* File List */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    <span>Loading files...</span>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FontAwesomeIcon icon={faFolderOpen} className="text-4xl mb-2" />
                    <div>{searchTerm ? 'No files match your search' : `No ${mediaTypeFilter} files available`}</div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {filteredFiles.map((file) => (
                        <div
                          key={file.ID}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                            selectedFiles.includes(file.ID) ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                          }`}
                          onClick={() => handleFileToggle(file.ID)}
                        >
                          <input
                            type={allowMultiple ? 'checkbox' : 'radio'}
                            checked={selectedFiles.includes(file.ID)}
                            onChange={() => handleFileToggle(file.ID)}
                            className="mr-3"
                          />
                          
                          <div className="mr-3">
                            {getMediaTypeIcon(file.MediaType)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 mb-1">{file.FileName}</div>
                            <div className="text-sm text-gray-500">
                              {formatFileSize(file.FileSize)} • 
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 ml-1 mr-1">
                                {file.MediaType}
                              </span> • 
                              {new Date(file.CreatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Load More */}
                    {pagination.has_more && (
                      <div className="text-center mt-4">
                        <button 
                          onClick={handleLoadMore}
                          disabled={loadingMore}
                          className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingMore ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                              Loading...
                            </>
                          ) : (
                            `Load More (${pagination.total - pagination.offset} remaining)`
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {pagination.total > 0 && `${filteredFiles.length} of ${pagination.total} files`}
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={onHide}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmSelection}
                  disabled={selectedFiles.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaFileSelectionModal;