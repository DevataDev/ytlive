'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Form, ProgressBar, Alert, Spinner } from 'react-bootstrap'
import { Upload, X, CameraVideo, MusicNote, FileEarmark, ExclamationCircle } from 'react-bootstrap-icons'
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
    if (fileType === 'video') return <CameraVideo size={24} />
    if (fileType === 'audio') return <MusicNote size={24} />
    return <FileEarmark size={24} />
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
    setSuccess('All files uploaded successfully!');
  };

  const handleFilesFromUploader = (selectedFiles: File[]) => {
    const fileArray = selectedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9)
    }));
    setFiles(prev => [...prev, ...fileArray]);
  };


  const tusUploaderRef = useRef<TusUploaderRef>(null);

  const handleUpload = async () => {
    if (files.length === 0) {
      if (selectedMediaFiles.length === 0) {
        setError('No files selected');
        return;
      } else {
        // Create the stream with the selected media files
        const session = await getSession();
        if (!session) {
          setError('Session expired. Please login again.');
          return;
        }
      }
    }

    // For new file uploads, use TusUploaderComp
    setIsUploading(true);
    setError(null);
    setSuccess(null);
    
    // Reset upload tracking
    setUploadingFiles(new Set());
    setCompletedFiles(new Set());
    setAllUploadsComplete(false);
    
    // Start tus uploads
    if (tusUploaderRef.current) {
      tusUploaderRef.current.startUploads();
    }
  };

  return (
    <div className="container-xxl py-4">
      <div className="mx-auto" style={{ maxWidth: '800px' }}>
        <h1 className="h3 mb-4">Upload New Stream</h1>

        <Card>
          <Card.Body className="p-4">
          <TusUploaderComp
                ref={tusUploaderRef}
                onSuccess={handleUploadSuccess}
                onAllUploadsComplete={handleAllUploadsComplete}
                onProgress={setUploadProgress}
                onUploadStart={handleUploadStart}
                onError={(error) => setError(error.message)}
                onFilesSelected={handleFilesFromUploader} // New callback
                hideMediaList={true} 
                uploadOnly={false}
              />

            {files.length > 0 && (
              <div className="mt-4">
                {files.map(({ file, id }) => (
                  <div
                    key={id}
                    className="d-flex align-items-center p-3 mb-2 border rounded bg-light"
                  >
                    <div className="d-flex align-items-center justify-content-center bg-white rounded p-2 me-3">
                      {getFileIcon(file)}
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="text-truncate fw-medium">{file.name}</div>
                      <small className="text-muted">
                        {formatFileSize(file.size)}
                      </small>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(id)
                      }}
                      className="text-danger p-1"
                    >
                      <X size={20} />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <ProgressBar now={uploadProgress} animated striped />
                <p className="text-center text-muted small mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {error && (
              <Alert variant="danger" className="mt-4" dismissible onClose={() => setError(null)}>
                <Alert.Heading className="h6 mb-1">
                  <ExclamationCircle className="me-2" />
                  Error
                </Alert.Heading>
                {error}
              </Alert>
            )}

            {success && (
              <Alert variant="success" className="mt-4">
                {success}
              </Alert>
            )}

            <div className="mt-4 d-flex justify-content-end gap-2">
              <Button
                variant="outline-primary"
                onClick={() => setShowMediaSelection(true)}
              >
                <i className="bi bi-file-earmark-play me-2"></i>
                Select Existing Media Files ({selectedMediaFiles.length})
              </Button>

              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={(files.length === 0 && selectedMediaFiles.length === 0) || isUploading}
                className="px-4"
              >
                {isUploading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="me-2" />
                    {selectedMediaFiles.length > 0 && files.length === 0
                      ? `Create Stream (${selectedMediaFiles.length} file${selectedMediaFiles.length > 1 ? 's' : ''})`
                      : `Upload ${files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : ''}`
                    }
                  </>
                )}
              </Button>
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
          </Card.Body>
        </Card>
      </div>
    </div>
  )
}

