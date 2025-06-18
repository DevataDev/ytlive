import React, { useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUpload, faTimes, faVideo, faMusic, faFile, faExclamationTriangle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useConfig } from '@/hooks/useConfig';

import { MediaFile } from '@/services/streamService'
import { useRouter } from 'next/navigation'

import TusUploaderComp from '@/components/TusUploaderComp';
import { TusUploaderRef } from '@/components/TusUploaderComp';

interface FilePreview {
  file: File;
  id: string;
}

interface MediaUploadModalProps {
  show: boolean;
  onHide: () => void;
  onUploadComplete: () => void;
}

export default function MediaUploadModal({ show, onHide, onUploadComplete }: MediaUploadModalProps) {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);

  const router = useRouter()

  // Add these state variables
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());
  const [allUploadsComplete, setAllUploadsComplete] = useState(false);

  const config = useConfig();

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    const fileType = file.type.split('/')[0];
    if (fileType === 'video') return faVideo;
    if (fileType === 'audio') return faMusic;
    return faFile;
  };

  const handleFiles = useCallback((newFiles: FileList) => {
    const fileArray = Array.from(newFiles).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9)
    }));
    setFiles(prev => [...prev, ...fileArray]);
    setError(null);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadSuccess = (uploadUrl: string, fileId: string) => {
    setCompletedFiles(prev => {
      const newCompleted = new Set(prev);
      newCompleted.add(fileId);
      
      // Don't redirect here - wait for all uploads to complete
      if (newCompleted.size < uploadingFiles.size) {
        setSuccess(`Uploaded ${newCompleted.size} of ${uploadingFiles.size} files...`);
      }
      
      return newCompleted;
    });
  };

  const handleAllUploadsComplete = () => {
    setAllUploadsComplete(true);
    setIsUploading(false);
    setUploadProgress(0);
    toast.success('All files uploaded successfully!');
    setSuccess(null);
    setError(null);
    onUploadComplete();
    handleClose();
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('No files selected');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setUploadingFiles(new Set(files.map(f => f.id)));
    setCompletedFiles(new Set());

    // Use TusUploaderComp to handle the upload
    if (tusUploaderRef.current) {
      try {
        tusUploaderRef.current.startUploads();
      } catch (error) {
        console.error('Upload failed:', error);
        setError(error instanceof Error ? error.message : 'Upload failed');
        setIsUploading(false);
      }
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    
    setFiles([]);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setUploadingFiles(new Set());
    setCompletedFiles(new Set());
    setAllUploadsComplete(false);
    onHide();
  };

  const handleUploadStart = (fileId: string) => {
    setUploadingFiles(prev => {
      const newUploading = new Set(prev);
      newUploading.add(fileId);
      return newUploading;
    });
  };

  const handleFilesFromUploader = (selectedFiles: File[]) => {
    const fileArray = selectedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9)
    }));
    setFiles(prev => [...prev, ...fileArray]);
  };
  const tusUploaderRef = useRef<TusUploaderRef>(null);

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
                <FontAwesomeIcon icon={faCloudUpload} className="mr-2 text-blue-600" />
                Upload Media Files
              </h3>
              {!isUploading && (
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4">
            <TusUploaderComp
              ref={tusUploaderRef}
              onSuccess={handleUploadSuccess}
              onProgress={setUploadProgress}
              onAllUploadsComplete={handleAllUploadsComplete}
              onUploadStart={handleUploadStart}
              onError={(error) => setError(error.message)}
              onFilesSelected={handleFilesFromUploader}
              hideMediaList={true}
              uploadOnly={true}
            />

            {files.length > 0 && (
              <div className="mb-4 mt-6">
                <h4 className="text-base font-medium text-gray-900 mb-3">
                  Selected Files ({files.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {files.map(({ file, id }) => (
                    <div
                      key={id}
                      className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50"
                    >
                      <div className="flex items-center justify-center bg-white rounded p-2 mr-3">
                        <FontAwesomeIcon icon={getFileIcon(file)} className="text-gray-600" size="lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{file.name}</div>
                        <div className="text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(id);
                        }}
                        disabled={isUploading}
                        className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mb-4 mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-center text-gray-500 text-sm mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">Error</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 mt-4 bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Cancel'}
            </button>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || isUploading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isUploading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCloudUpload} className="mr-2" />
                  Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Files'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}