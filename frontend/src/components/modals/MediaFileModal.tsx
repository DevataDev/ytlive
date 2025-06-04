import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { MediaFile, MediaFileData } from '@/services/streamService';
import { fetchMediaFiles, uploadMediaFile, deleteMapMediaFile, getMediaPreview, MediaFileUploadData } from '@/services/mediaFileService';
import PlayerPreviewModal from './PlayerPreviewModal';
import MediaFileSelectionModal from './MediaFileSelectionModal';
import { getSession } from 'next-auth/react';

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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedMediaFile, setSelectedMediaFile] = useState<MediaFile | null>(null);
    const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);

    // New state for existing media selection
    const [showMediaSelection, setShowMediaSelection] = useState(false);
    const [addingExistingMedia, setAddingExistingMedia] = useState(false);

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

    const handleFileUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select a file to upload');
            return;
        }

        try {
            setUploading(true);
            setError('');

            const uploadData: MediaFileUploadData = {
                file: selectedFile,
                mediaType
            };

            await uploadMediaFile(streamId, uploadData);
            toast.success('Media file uploaded successfully');
            resetForm();
            await loadMediaFiles();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload media file';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setUploading(false);
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
        setSelectedFile(null);
        setMediaType('video');
        setError('');
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
        switch (type) {
            case 'video': return 'bi-camera-video';
            case 'audio': return 'bi-music-note';
            default: return 'bi-file-earmark';
        }
    };

    const getMediaTypeBadge = (type: string) => {
        switch (type) {
            case 'video': return <Badge bg="primary">Video</Badge>;
            case 'audio': return <Badge bg="success">Audio</Badge>;
            default: return <Badge bg="secondary">File</Badge>;
        }
    };

    const handlePreviewFile = (file: MediaFile) => {
        setSelectedMediaFile(file);
        setShowPreviewModal(true);
    };

    // New function to handle adding existing media files
    const handleAddExistingMedia = async (selectedFiles: MediaFile[]) => {
        console.log('handleAddExistingMedia called with:', selectedFiles);

        if (selectedFiles.length === 0) {
            console.log('No files selected, closing modal');
            setShowMediaSelection(false);
            return;
        }

        console.log('Starting to add existing media files...');
        setAddingExistingMedia(true);
        try {

            const session = await getSession();
            // Add the selected files to the current stream using the correct endpoint
            const promises = selectedFiles.map(file => {
                console.log('Making API call for file:', file.ID);
                return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/streams/${streamId}/map`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.user?.backendToken}`
                    },
                    body: JSON.stringify({ media_id: file.ID })
                });
            });

            console.log('Waiting for API calls to complete...');
            await Promise.all(promises);

            console.log('API calls completed successfully');
            toast.success(`Added ${selectedFiles.length} existing media file(s) to stream`);
            setShowMediaSelection(false);
            await loadMediaFiles(); // Refresh the media files list
        } catch (err) {
            console.error('Error adding existing media files:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to add existing media files';
            toast.error(errorMessage);
        } finally {
            setAddingExistingMedia(false);
        }
    };

    return (
        <>
            <Modal show={show} onHide={onHide} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <i className="bi bi-folder2-open me-2"></i>
                        Media File Management - {streamName}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && (
                        <Alert variant="danger" dismissible onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    {/* Current Media Files */}
                    <div className="mb-4">
                        <h6 className="mb-3">Current Media Files</h6>
                        {loading ? (
                            <div className="text-center py-3">
                                <Spinner animation="border" size="sm" className="me-2" />
                                Loading media files...
                            </div>
                        ) : mediaFiles.length === 0 ? (
                            <div className="text-center py-3 text-muted">
                                <i className="bi bi-folder2-open fs-1 d-block mb-2"></i>
                                No media files uploaded yet
                            </div>
                        ) : (
                            <ListGroup>
                                {mediaFiles.map((file) => (
                                    <ListGroup.Item key={file.ID} className="d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center">
                                            <i className={`bi ${getMediaTypeIcon(file.MediaType)} me-2`}></i>
                                            <div>
                                                <div className="fw-medium">{file.FileName}</div>
                                                <small className="text-muted">
                                                    {formatFileSize(file.FileSize)} • {new Date(file.CreatedAt).toLocaleDateString()}
                                                </small>
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            {getMediaTypeBadge(file.MediaType)}
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => handlePreviewFile(file)}
                                                title="Preview"
                                            >
                                                <i className="bi bi-eye"></i>
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => setShowDeleteConfirm(file.ID)}
                                                title="Delete"
                                            >
                                                <i className="bi bi-trash"></i>
                                            </Button>
                                        </div>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </div>

                    {/* Add Media Section */}
                    <div>
                        <h6 className="mb-3">Add Media Files</h6>

                        {/* Add Existing Media Button */}
                        <div className="mb-3">
                            <Button
                                variant="outline-primary"
                                onClick={() => setShowMediaSelection(true)}
                                disabled={addingExistingMedia}
                                className="me-2"
                            >
                                {addingExistingMedia ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-collection me-2"></i>
                                        Add Existing Media
                                    </>
                                )}
                            </Button>
                            <small className="text-muted">
                                Select from your previously uploaded media files
                            </small>
                        </div>

                        {/* Divider */}
                        <div className="d-flex align-items-center mb-3">
                            <hr className="flex-grow-1" />
                            <span className="px-3 text-muted small">OR</span>
                            <hr className="flex-grow-1" />
                        </div>

                        {/* Upload New Media File */}
                        <div>
                            <h6 className="mb-3">Upload New Media File</h6>
                            <Form onSubmit={handleFileUpload}>
                                <div className="row">
                                    <div className="col-md-4 mb-3">
                                        <Form.Label>Media Type</Form.Label>
                                        <Form.Select
                                            value={mediaType}
                                            onChange={(e) => setMediaType(e.target.value as 'video' | 'audio')}
                                            disabled={uploading}
                                        >
                                            <option value="video">Video</option>
                                            <option value="audio">Audio</option>
                                        </Form.Select>
                                    </div>
                                    <div className="col-md-8 mb-3">
                                        <Form.Label>Select File</Form.Label>
                                        <Form.Control
                                            type="file"
                                            onChange={(e) => {
                                                const target = e.target as HTMLInputElement;
                                                setSelectedFile(target.files?.[0] || null);
                                            }}
                                            accept={mediaType === 'video' ? '.mp4,.mkv' : mediaType === 'audio' ? '.wav,.mp3' : '.jpg,.jpeg,.png,.gif'}
                                            disabled={uploading}
                                        />
                                        <Form.Text className="text-muted">
                                            {mediaType === 'video' && 'Supported formats: MP4, MKV'}
                                            {mediaType === 'audio' && 'Supported formats: WAV, MP3'}
                                        </Form.Text>
                                    </div>
                                </div>
                                <div className="d-flex justify-content-end">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={!selectedFile || uploading}
                                    >
                                        {uploading ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-upload me-2"></i>
                                                Upload File
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={onHide}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>

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
            <Modal show={!!showDeleteConfirm} onHide={() => setShowDeleteConfirm(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Unmap Media File</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to unmap this media file from the stream? This action cannot be undone.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={() => showDeleteConfirm && handleDeleteFile(showDeleteConfirm)}
                    >
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>

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