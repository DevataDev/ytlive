import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faTrash, faEye, faVideo, faMusic, faFile, faFolderOpen, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { MediaFile, MediaFileData } from '@/services/streamService';
import { fetchMediaFiles, uploadMediaFile, deleteMapMediaFile, getMediaPreview, MediaFileUploadData } from '@/services/mediaFileService';
import PlayerPreviewModal from './PlayerPreviewModal';
import MediaFileSelectionModal from './MediaFileSelectionModal';
import { getSession } from 'next-auth/react';
import { useConfig } from '@/hooks/useConfig';
import TusUploaderComp from '@/components/TusUploaderComp';

export interface MediaFileModalProps {
    show: boolean;
    onHide: () => void;
    streamId: string;
    streamName: string;
}

const MediaFileModal: React.FC<MediaFileModalProps> = ({
    show,
    onHide,
    streamId,
    streamName
}) => {
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    // Remove selectedFile and mediaType states as TusUploaderComp will handle this
    // const [selectedFile, setSelectedFile] = useState<File | null>(null);
    // const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedMediaFile, setSelectedMediaFile] = useState<MediaFile | null>(null);
    const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);
    const [showMediaSelection, setShowMediaSelection] = useState(false);
    const [addingExistingMedia, setAddingExistingMedia] = useState(false);
    const config = useConfig();

    // Load media files when modal opens
    useEffect(() => {
        if (show && streamId) {
            loadMediaFiles();
        }
    }, [show, streamId]);

    // Reset form when modal closes
    useEffect(() => {
        if (!show) {
            resetForm();
        }
    }, [show]);

    const updateMediaFileData = (files: MediaFileData[]) => {
        console.dir(files);
        // Map the MediaFileData array to MediaFile objects and set the state with the mapped values
        // Convert the MediaFileData array to MediaFile array using the map function
        const mappedFiles = files.map((file) => ({
            ID: file.id,
            FileName: file.file_name,
            FileSize: file.file_size,
            MediaType: file.media_type,
            FilePath: file.file_path,
            CreatedAt: file.created_at,
            UpdatedAt: file.updated_at,
            MimeType: file.mime_type,
        } as MediaFile))
        setMediaFiles(mappedFiles);
    };

    const loadMediaFiles = async () => {
        try {
            setLoading(true);
            setError('');
            const files = await fetchMediaFiles(streamId);
            updateMediaFileData(files.files);
        } catch (err) {
            setError('Failed to load media files');
            console.error('Error loading media files:', err);
        } finally {
            setLoading(false);
        }
    };


    const handleDeleteFile = async (fileId: string) => {
        try {
            await deleteMapMediaFile(streamId, fileId);
            toast.success('Media file unmapped successfully');
            setShowDeleteConfirm(null);
            await loadMediaFiles();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete media file';
            toast.error(errorMessage);
        }
    };

    const resetForm = () => {
        setShowDeleteConfirm(null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getMediaTypeIcon = (type: string) => {
        if (type.startsWith('video/')) return faVideo;
        if (type.startsWith('audio/')) return faMusic;
        return faFile;
    };

    const getMediaTypeBadge = (type: string) => {
        if (type.startsWith('video/')) return { color: 'bg-blue-100 text-blue-800', text: 'Video' };
        if (type.startsWith('audio/')) return { color: 'bg-green-100 text-green-800', text: 'Audio' };
        return { color: 'bg-gray-100 text-gray-800', text: 'File' };
    };

    const handlePreviewFile = (file: MediaFile) => {
        setSelectedMediaFile(file);
        setShowPreviewModal(true);
    };

    // New function to handle adding existing media files
    const handleAddExistingMedia = async (selectedFiles: MediaFile[]) => {
        if (selectedFiles.length === 0) return;

        setAddingExistingMedia(true);
        try {
            const session = await getSession();
            const token = session?.user?.backendToken;

            if (!token) {
                throw new Error('Authentication required');
            }

            // Add each selected file to the stream by mapping them to the stream
            for (const file of selectedFiles) {
                const apiUrl = config?.config?.apiUrl || 'http://localhost:8081';
                
                const response = await fetch(`${apiUrl}/api/streams/${streamId}/map`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ media_id: file.ID })
                });

                if (!response.ok) {
                    throw new Error(`Failed to map media file: ${response.statusText}`);
                }
            }

            toast.success(`${selectedFiles.length} media file(s) added to stream successfully`);
            setShowMediaSelection(false);
            await loadMediaFiles(); // Refresh the list
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add media files to stream';
            toast.error(errorMessage);
            console.error('Error adding existing media files:', err);
        } finally {
            setAddingExistingMedia(false);
        }
    };

    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Handle refresh when needed
    useEffect(() => {
        if (refreshTrigger > 0) {
            loadMediaFiles();
        }
    }, [refreshTrigger]);

    const handleUploadSuccess = useCallback((uploadedFile: any) => {
        console.log('Upload successful:', uploadedFile);
        toast.success('Media file uploaded successfully');
        // Trigger a refresh by updating the refreshTrigger
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const handleUploadProgress = useCallback((progress: number) => {
        console.log('Upload progress:', progress);
        setUploading(progress < 100);
    }, []);

    const handleUploadError = useCallback((error: Error) => {
        console.error('Upload error:', error);
        toast.error(`Upload failed: ${error.message}`);
        setUploading(false);
    }, []);

    const handleAllUploadsComplete = useCallback(() => {
        console.log('All uploads completed');
        setUploading(false);
        // Trigger a refresh by updating the refreshTrigger
        setRefreshTrigger(prev => prev + 1);
    }, []);

    if (!show) return null;

    return (
        <>
            {/* Main Modal */}
            <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

                    <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                        {/* Header */}
                        <div className="bg-white px-6 py-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-gray-900">
                                    Media Files for {streamName}
                                </h3>
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
                                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2" />
                                            <div className="text-sm text-red-700">{error}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Current Media Files */}
                                <div className="mb-6">
                                    <h6 className="text-base font-medium text-gray-900 mb-3">Current Media Files</h6>
                                    {loading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                            <span>Loading media files...</span>
                                        </div>
                                    ) : mediaFiles.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No media files found for this stream.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {mediaFiles.map((file) => {
                                                const badge = getMediaTypeBadge(file.MediaType);
                                                return (
                                                    <div key={file.ID} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                                        <div className="flex items-center flex-1">
                                                            <FontAwesomeIcon 
                                                                icon={getMediaTypeIcon(file.MediaType)} 
                                                                className="text-gray-400 mr-3" 
                                                            />
                                                            <div className="flex-1">
                                                                <div className="font-medium text-gray-900">{file.FileName}</div>
                                                                <div className="text-sm text-gray-500">
                                                                    {formatFileSize(file.FileSize)} • {new Date(file.CreatedAt).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color} mr-3`}>
                                                                {badge.text}
                                                            </span>
                                                        </div>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => handlePreviewFile(file)}
                                                                className="text-blue-600 hover:text-blue-800"
                                                                title="Preview"
                                                            >
                                                                <FontAwesomeIcon icon={faEye} />
                                                            </button>
                                                            <button
                                                                onClick={() => setShowDeleteConfirm(file.ID)}
                                                                className="text-red-600 hover:text-red-800"
                                                                title="Delete"
                                                            >
                                                                <FontAwesomeIcon icon={faTrash} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Add Existing Media Section */}
                                <div className="mb-6">
                                    <h6 className="text-base font-medium text-gray-900 mb-3">Add Existing Media</h6>
                                    <button
                                        onClick={() => setShowMediaSelection(true)}
                                        disabled={addingExistingMedia}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                    >
                                        {addingExistingMedia ? (
                                            <>
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <FontAwesomeIcon icon={faFolderOpen} className="mr-2" />
                                                Add Existing Media
                                            </>
                                        )}
                                    </button>
                                    <div className="text-sm text-gray-500 mt-1">
                                        Select from your previously uploaded media files
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center mb-6">
                                    <div className="flex-grow border-t border-gray-300"></div>
                                    <span className="px-3 text-sm text-gray-500">OR</span>
                                    <div className="flex-grow border-t border-gray-300"></div>
                                </div>

                                {/* Replace Upload New Media File section with TusUploaderComp */}
                                <div>
                                    <h6 className="text-base font-medium text-gray-900 mb-3">Upload New Media Files</h6>
                                    <TusUploaderComp
                                        streamId={streamId}
                                        onSuccess={handleUploadSuccess}
                                        onProgress={handleUploadProgress}
                                        onError={handleUploadError}
                                        onAllUploadsComplete={handleAllUploadsComplete}
                                        hideMediaList={true}
                                        uploadOnly={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                            <div className="flex justify-end">
                                <button
                                    onClick={onHide}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Existing Media Selection Modal */}
            <MediaFileSelectionModal
                show={showMediaSelection}
                onHide={() => setShowMediaSelection(false)}
                onSelect={handleAddExistingMedia}
                title="Add Existing Media to Stream"
                selectedFileIds={selectedMediaFiles.map(file => file.ID)}
                allowMultiple={false}
                mediaTypeFilter="all"
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            {/* Header */}
                            <div className="bg-white px-6 py-4 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-gray-900">Unmap Media File</h3>
                                    <button
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="bg-white px-6 py-4">
                                <p className="text-gray-700">Are you sure you want to unmap this media file from the stream? This action cannot be undone.</p>
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => showDeleteConfirm && handleDeleteFile(showDeleteConfirm)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Player Preview Modal */}
            <PlayerPreviewModal
                show={showPreviewModal}
                onHide={() => {
                    setShowPreviewModal(false);
                    setSelectedMediaFile(null);
                }}
                mediaFile={selectedMediaFile}
                streamId={streamId}
            />
        </>
    );
};

export default MediaFileModal;