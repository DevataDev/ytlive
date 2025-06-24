'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faPlus, 
  faSync, 
  faSpinner, 
  faExclamationTriangle, 
  faInbox 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import MediaFileRow from './MediaFileRow';
import MediaFileDetailsModal from './MediaFileDetailsModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import Pagination from './Pagination';
import { api } from '@/lib/api';
import { MediaListResponse, Stream } from '@/services/streamService';
import { renameMediaFile } from '@/services/mediaFileService';
import MediaUploadModal from './MediaUploadModal';

interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  media_type: 'video' | 'audio';
  mime_type: string;
  duration?: number;
  resolution?: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
  streams: Stream[];
  stream_count: number;
  stream_names: string[];
}

interface ApiResponse {
  data: MediaFile[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export default function MediaManager() {
  const { data: session } = useSession();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [fileToRename, setFileToRename] = useState<MediaFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const limit = 20;

  const fetchMediaFiles = async () => {
    if (!session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        user_id: session.user.id,
        page: currentPage.toString(),
        limit: limit.toString(),
        type: mediaType,
        sort: sortBy,
        order: sortOrder,
      });

      if (searchTerm.trim()) {
        params.append('query', searchTerm.trim());
      }

      const response = await api.get<MediaListResponse>(`/api/media/user?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.user?.backendToken}`,
        }
      });

      const mappedFiles = response.files?.map((file) => ({
        id: file.id,
        file_name: file.file_name,
        file_path: file.file_path,
        file_size: file.file_size,
        media_type: file.media_type,
        mime_type: file.mime_type,
        created_at: file.created_at,
        updated_at: file.updated_at,
        stream_count: file.stream_count,
        stream_names: file.stream_names?.split(","),
        streams: file.streams,
      } as MediaFile)) || [];

      const total = response.pagination.total || 0;
      const totalPages = Math.ceil(total / limit);
    
      setMediaFiles(mappedFiles);
      setTotal(total || 0);
      setTotalPages(totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to load media files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaFiles();
  }, [session, currentPage, mediaType, sortBy, sortOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchMediaFiles();
  };

  const handleDelete = async (file: MediaFile) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!fileToDelete || !session?.user?.id) return;

    try {
      setDeleting(true);
      const response = await api.delete<void>(`/api/media/${fileToDelete.id}`, {
        headers: {
          'Authorization': `Bearer ${session.user?.backendToken}`,
        }
      });

      toast.success('Media file deleted successfully');
      setShowDeleteModal(false);
      setFileToDelete(null);
      fetchMediaFiles();
    } catch (err) {
      toast.error('Failed to delete media file');
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadComplete = () => {
    fetchMediaFiles(); // Refresh the media files list
  };

  const handleRename = (file: MediaFile) => {
    setFileToRename(file);
    setNewFileName(file.file_name);
    setShowRenameModal(true);
  };

  const confirmRename = async () => {
    if (!fileToRename || !newFileName.trim()) return;

    try {
      setRenaming(true);
      await renameMediaFile(fileToRename.id, newFileName.trim());
      toast.success('File renamed successfully');
      setShowRenameModal(false);
      setFileToRename(null);
      setNewFileName('');
      fetchMediaFiles();
    } catch (err) {
      toast.error('Failed to rename file');
    } finally {
      setRenaming(false);
    }
  };

  if (!session) {
    return (
      <div className="container mx-auto p-4">
        <div className="alert alert-warning">
          Please log in to access the Media Manager.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          <FontAwesomeIcon icon={faInbox} className="mr-2" />
          Media Manager
        </h2>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">{total} files</span>
          <button 
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => setShowUploadModal(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Upload Files
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4">
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div className="md:col-span-2">
              <form onSubmit={handleSearch}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Files</label>
                <div className="flex">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search by filename or path..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="px-3 py-2 bg-blue-600 text-white border border-blue-600 rounded-r-md hover:bg-blue-700 transition-colors"
                  >
                    <FontAwesomeIcon icon={faSearch} />
                  </button>
                </div>
              </form>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Media Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={mediaType}
                onChange={(e) => {
                  setMediaType(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Types</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at">Date Created</option>
                <option value="file_name">File Name</option>
                <option value="file_size">File Size</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                className="w-full px-3 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
                onClick={() => {
                  setSearchTerm('');
                  setMediaType('all');
                  setSortBy('created_at');
                  setSortOrder('desc');
                  setCurrentPage(1);
                }}
              >
                <FontAwesomeIcon icon={faSync} className="mr-1" />
                Reset
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <FontAwesomeIcon icon={faSpinner} className="text-2xl text-gray-400 animate-spin" />
              <p className="text-gray-500 mt-2">Loading...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Media Files Table */}
          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Streams</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mediaFiles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center">
                          <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-300 mb-2 block" />
                          <span className="text-gray-500">No media files found</span>
                        </td>
                      </tr>
                    ) : (
                      mediaFiles.map((file) => (
                        <MediaFileRow
                          key={file.id}
                          file={file}
                          onViewDetails={(file) => {
                            setSelectedFile(file);
                            setShowDetailsModal(true);
                          }}
                          onDelete={handleDelete}
                          onRename={handleRename}
                          formatFileSize={formatFileSize}
                          formatDuration={formatDuration}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <MediaFileDetailsModal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        file={selectedFile}
        formatFileSize={formatFileSize}
        formatDuration={formatDuration}
      />

      <DeleteConfirmModal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        file={fileToDelete}
        loading={deleting}
      />

      {/* Upload Modal */}
      <MediaUploadModal
        show={showUploadModal}
        onHide={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Rename File</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new file name"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRenameModal(false);
                    setFileToRename(null);
                    setNewFileName('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  disabled={renaming}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRename}
                  disabled={renaming || !newFileName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {renaming ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                      Renaming...
                    </>
                  ) : (
                    'Rename'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}