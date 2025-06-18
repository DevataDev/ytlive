import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faVideo, faMusic, faFile, faExclamationTriangle, faHdd, faCalendar, faDownload } from '@fortawesome/free-solid-svg-icons';
import { MediaFile } from '@/services/streamService';
import { getMediaPreview } from '@/services/mediaFileService';
import { useConfig } from '@/hooks/useConfig';

export interface PlayerPreviewModalProps {
    show: boolean;
    onHide: () => void;
    mediaFile: MediaFile | null;
    streamId: string;
}

const PlayerPreviewModal: React.FC<PlayerPreviewModalProps> = ({
    show,
    onHide,
    mediaFile,
    streamId
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');

    const config = useConfig();

    useEffect(() => {
        if (show && mediaFile && streamId) {
            setLoading(true);
            setError('');
            const apiUrl = config?.config?.apiUrl || process.env.API_URL || '';
            const url = getMediaPreview(apiUrl, streamId, mediaFile.ID);
            setPreviewUrl(url);
            setLoading(false);
        } else {
            setPreviewUrl('');
            setLoading(true);
            setError('');
        }
    }, [show, mediaFile, streamId]);

    const handleMediaLoad = () => {
        setLoading(false);
        setError('');
    };

    const handleMediaError = () => {
        setLoading(false);
        setError('Failed to load media file. The file may be corrupted or not accessible.');
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
            case 'video': return faVideo;
            case 'audio': return faMusic;
            case 'image': return faFile;
            default: return faFile;
        }
    };

    const renderMediaPlayer = () => {
        if (!mediaFile || !previewUrl) return null;

        switch (mediaFile.MediaType) {
            case 'video':
                return (
                    <div className="relative">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-white text-2xl" />
                            </div>
                        )}
                        <video
                            controls
                            className="w-full max-h-96 bg-black"
                            onLoadedData={handleMediaLoad}
                            onError={handleMediaError}
                            preload="metadata"
                        >
                            <source src={previewUrl} type={mediaFile.MimeType} />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                );

            case 'audio':
                return (
                    <div className="p-8 bg-gray-900 text-white text-center">
                        <FontAwesomeIcon icon={faMusic} className="text-6xl mb-4 text-blue-400" />
                        <h4 className="text-lg font-medium mb-4">{mediaFile.FileName}</h4>
                        {loading && (
                            <div className="mb-4">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                Loading...
                            </div>
                        )}
                        <audio
                            controls
                            className="w-full max-w-md mx-auto"
                            style={{ display: loading ? 'none' : 'block' }}
                            onLoadedData={handleMediaLoad}
                            onError={handleMediaError}
                            preload="metadata"
                        >
                            <source src={previewUrl} type={mediaFile.MimeType} />
                            Your browser does not support the audio tag.
                        </audio>
                    </div>
                );

            case 'image':
                return (
                    <div className="relative">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl" />
                            </div>
                        )}
                        <img
                            src={previewUrl}
                            alt={mediaFile.FileName}
                            className="w-full max-h-96 object-contain"
                            style={{ display: loading ? 'none' : 'block' }}
                            onLoad={handleMediaLoad}
                            onError={handleMediaError}
                        />
                    </div>
                );

            default:
                return (
                    <div className="text-center py-8">
                        <FontAwesomeIcon icon={faFile} className="text-6xl text-gray-400 mb-4" />
                        <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            Download File
                        </a>
                    </div>
                );
        }
    };

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
                            <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                <FontAwesomeIcon 
                                    icon={getMediaTypeIcon(mediaFile?.MediaType || '')} 
                                    className="mr-2" 
                                />
                                {mediaFile?.FileName || 'Media Preview'}
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
                    <div className="bg-white">
                        {error ? (
                            <div className="p-6">
                                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                    <div className="flex">
                                        <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2" />
                                        <div className="text-sm text-red-700">{error}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            renderMediaPlayer()
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                                {mediaFile && (
                                    <div className="flex flex-wrap gap-4">
                                        <span className="flex items-center">
                                            <FontAwesomeIcon icon={faHdd} className="mr-1" />
                                            {formatFileSize(mediaFile.FileSize)}
                                        </span>
                                        <span className="flex items-center">
                                            <FontAwesomeIcon icon={faCalendar} className="mr-1" />
                                            {new Date(mediaFile.CreatedAt).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center">
                                            <FontAwesomeIcon icon={faFile} className="mr-1" />
                                            {mediaFile.MimeType}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div>
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
        </div>
    );
};

export default PlayerPreviewModal;