'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faTimes, faVideo, faMusic, faFile, faExclamationTriangle, faSpinner, faFileVideo } from '@fortawesome/free-solid-svg-icons'
import styles from './page.module.css'
import { getSession } from 'next-auth/react'
import { toast } from 'react-toastify';
import { useConfig } from '@/hooks/useConfig';
import { TusUploaderRef } from '@/components/TusUploaderComp'
import TusUploaderComp from '@/components/TusUploaderComp';

import MediaFileSelectionModal from '@/components/modals/MediaFileSelectionModal';
import { CreateStreamNewData, MediaFile, createStreamNew } from '@/services/streamService';

interface FilePreview {
  file: File
  id: string
}

export default function StreamNewPage() {
  const [files, setFiles] = useState<FilePreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const router = useRouter()
  // Add to your component state
  const [showMediaSelection, setShowMediaSelection] = useState(false);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);

  const config = useConfig();

  // Add handler for media file selection
  const handleMediaFileSelection = (files: MediaFile[]) => {
    setSelectedMediaFiles(files);
    toast.success(`${files.length} media file(s) selected`);
  };

  // Add handler to clear selection when modal is hidden without selection
  const handleModalHide = () => {
    setShowMediaSelection(false);
    // Don't reset selectedMediaFiles here - only reset when user explicitly clears
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    const fileType = file.type.split('/')[0]
    if (fileType === 'video') return <FontAwesomeIcon icon={faVideo} className="text-blue-500" />
    if (fileType === 'audio') return <FontAwesomeIcon icon={faMusic} className="text-green-500" />
    return <FontAwesomeIcon icon={faFile} className="text-gray-500" />
  }

  const handleFiles = useCallback((newFiles: FileList) => {
    const fileArray = Array.from(newFiles).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9)
    }))
    setFiles(prev => [...prev, ...fileArray])
    setError(null)
  }, [])

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  // Add these state variables
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());
  const [allUploadsComplete, setAllUploadsComplete] = useState(false);

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

  const handleUploadStart = (fileId: string) => {
    setUploadingFiles(prev => {
      const newUploading = new Set(prev);
      newUploading.add(fileId);
      return newUploading;
    });
  };

  const handleAllUploadsComplete = () => {
    setAllUploadsComplete(true);
    setIsUploading(false);
    
    // Redirect to streams page after successful upload
    setTimeout(() => {
      router.push('/stream');
    }, 2000);
  };

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tusUploaderRef = useRef<TusUploaderRef>(null);

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

  const handleUpload = async () => {
    if (files.length === 0 && selectedMediaFiles.length === 0) {
      setError('Please select files to upload or choose existing media files.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);
    setUploadingFiles(new Set());
    setCompletedFiles(new Set());
    setAllUploadsComplete(false);

    try {
      const session = await getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      if (selectedMediaFiles.length > 0 && files.length === 0) {
        // Create stream directly with existing media files
        const streamData: CreateStreamNewData = {
          Name: `Stream ${formatDateTime(new Date())}`,
          Description: `Stream created with ${selectedMediaFiles.length} media file(s)`,
          MediaFileIds: selectedMediaFiles.map(file => file.ID),
        };

        const result = await createStreamNew(streamData);
        
        setSuccess('Stream created successfully with selected media files!');
        setTimeout(() => {
          router.push('/stream');
        }, 2000);
      } else {
        // Upload new files first, then create stream
        if (tusUploaderRef.current) {
          tusUploaderRef.current.startUploads();
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Create New Stream</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload media files or select existing ones to create a new stream
            </p>
          </div>
          
          <div className="p-6">
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FontAwesomeIcon icon={faUpload} className="text-4xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload your media files
              </h3>
              <p className="text-gray-500 mb-4">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-sm text-gray-400">
                Supports video and audio files
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <TusUploaderComp
              ref={tusUploaderRef}
              onSuccess={handleUploadSuccess}
              onUploadStart={handleUploadStart}
              onAllUploadsComplete={handleAllUploadsComplete}
              onProgress={setUploadProgress}
              onError={(error) => setError(error.message)}
              onFilesSelected={(selectedFiles) => {
                const fileArray = selectedFiles.map(file => ({
                  file,
                  id: Math.random().toString(36).substr(2, 9)
                }))
                setFiles(prev => [...prev, ...fileArray])
              }}
              hideMediaList={true}
              uploadOnly={false}
            />

            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                {files.map(({ file, id }) => (
                  <div
                    key={id}
                    className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-center w-12 h-12 bg-white rounded-lg border border-gray-200 mr-4">
                      {getFileIcon(file)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(id)
                      }}
                      className="ml-4 text-red-500 hover:text-red-700 focus:outline-none"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-center text-gray-600 text-sm mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mr-2" />
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                <p className="mt-2 text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowMediaSelection(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FontAwesomeIcon icon={faFileVideo} className="mr-2" />
                Select Existing Media Files ({selectedMediaFiles.length})
              </button>

              <button
                onClick={handleUpload}
                disabled={(files.length === 0 && selectedMediaFiles.length === 0) || isUploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUpload} className="mr-2" />
                    {selectedMediaFiles.length > 0 && files.length === 0
                      ? `Create Stream (${selectedMediaFiles.length} file${selectedMediaFiles.length > 1 ? 's' : ''})`
                      : `Upload ${files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : ''}`
                    }
                  </>
                )}
              </button>
            </div>

            <MediaFileSelectionModal
              show={showMediaSelection}
              onHide={() => setShowMediaSelection(false)}
              onSelect={handleMediaFileSelection}
              selectedFileIds={selectedMediaFiles.map(file => file.ID)}
              title="Select Media Files for New Stream"
              allowMultiple={true}
              mediaTypeFilter="all"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
