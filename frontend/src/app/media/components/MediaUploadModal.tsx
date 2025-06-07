import React, { useState, useRef, useCallback } from 'react';
import { Modal, Button, Card, ProgressBar, Alert, Spinner } from 'react-bootstrap';
import { Upload, X, CameraVideo, MusicNote, FileEarmark, ExclamationCircle } from 'react-bootstrap-icons';
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
    if (fileType === 'video') return <CameraVideo size={24} />;
    if (fileType === 'audio') return <MusicNote size={24} />;
    return <FileEarmark size={24} />;
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


  // const handleUpload = async () => {
  //   if (files.length === 0) {
  //     setError('No files selected');
  //     return;
  //   }

  //   setIsUploading(true);
  //   setError(null);
  //   setSuccess(null);
  //   setUploadProgress(0);

  //   const formData = new FormData();
  //   files.forEach(({ file }) => {
  //     formData.append('files', file);
  //   });

  //   try {
  //     const session = await getSession();
  //     if (!session) {
  //       setError('Session expired. Please login again.');
  //       return;
  //     }

  //     const xhr = new XMLHttpRequest();

  //     xhr.upload.addEventListener('progress', (e) => {
  //       if (e.lengthComputable) {
  //         const percentComplete = Math.round((e.loaded / e.total) * 100);
  //         setUploadProgress(percentComplete);
  //       }
  //     });

  //     xhr.onreadystatechange = function () {
  //       if (xhr.readyState === 4) {
  //         setIsUploading(false);

  //         if (xhr.status === 200) {
  //           try {
  //             const response = JSON.parse(xhr.responseText);
  //             setSuccess('Files uploaded successfully!');
  //             setFiles([]);
  //             toast.success('Media files uploaded successfully!');
  //             setTimeout(() => {
  //               onUploadComplete();
  //               handleClose();
  //             }, 1500);
  //           } catch (e) {
  //             setError('Error processing response');
  //           }
  //         } else {
  //           let errorMessage = 'Error uploading files';

  //           try {
  //             if (xhr.responseText) {
  //               const errorResponse = JSON.parse(xhr.responseText);
  //               if (errorResponse?.error) {
  //                 errorMessage = errorResponse.error;
  //               }
  //             }
  //           } catch (e) {
  //             // Ignore parse error
  //           }

  //           if (xhr.status === 413) {
  //             errorMessage = 'File size too large. Maximum 2GB per file.';
  //           } else if (xhr.status === 401) {
  //             errorMessage = 'Session expired. Please login again.';
  //           } else if (xhr.status === 0) {
  //             errorMessage = 'Cannot connect to server. Check your internet connection.';
  //           }

  //           setError(errorMessage);
  //           toast.error(errorMessage);
  //         }
  //       }
  //     };

  //     xhr.open('POST', `${config?.config?.apiUrl}/api/media/upload`, true);
  //     xhr.setRequestHeader('Authorization', `Bearer ${session?.user?.backendToken}`);
  //     xhr.send(formData);
  //   } catch (err) {
  //     setIsUploading(false);
  //     setError('An unexpected error occurred');
  //   }
  // };

  const handleUpload = async () => {
    if (files.length === 0) {
      if (selectedMediaFiles.length === 0) {
        setError('No files selected');
        return;
      } else {
        // Handle existing media files only
        try {
          setSuccess('Stream created! Redirecting...');
          setFiles([]);
          setUploadProgress(0);
          toast.success('Stream created! Redirecting...');
          setTimeout(() => {
            onUploadComplete();
            handleClose();
          })
        } catch (error) {
          setError('Error creating stream');
        }
        return;
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
  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setError(null);
      setSuccess(null);
      setUploadProgress(0);
      onHide();
    }
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

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop={isUploading ? 'static' : true}>
      <Modal.Header closeButton={!isUploading}>
        <Modal.Title>
          <i className="bi bi-cloud-upload me-2"></i>
          Upload Media Files
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <TusUploaderComp
          ref={tusUploaderRef}
          onSuccess={handleUploadSuccess}
          onProgress={setUploadProgress}
          onAllUploadsComplete={handleAllUploadsComplete} // New callback
          onUploadStart={handleUploadStart}
          onError={(error) => setError(error.message)}
          onFilesSelected={handleFilesFromUploader} // New callback
          hideMediaList={true}
          uploadOnly={true}
        />

        {files.length > 0 && (
          <div className="mb-3 mt-4">
            <h6 className="mb-2">Selected Files ({files.length})</h6>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {files.map(({ file, id }) => (
                <div
                  key={id}
                  className="d-flex align-items-center p-2 mb-2 border rounded bg-light"
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
                      e.stopPropagation();
                      removeFile(id);
                    }}
                    className="text-danger p-1"
                    disabled={isUploading}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-3 mt-2">
            <ProgressBar now={uploadProgress} animated striped />
            <p className="text-center text-muted small mt-4">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}

        {error && (
          <Alert variant="danger" className="mb-3 mt-2" dismissible onClose={() => setError(null)}>
            <Alert.Heading className="h6 mb-1">
              <ExclamationCircle className="me-2" />
              Error
            </Alert.Heading>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-3 mt-2">
            {success}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Cancel'}
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
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
              Uploading...
            </>
          ) : (
            <>
              <Upload className="me-2" size={16} />
              Upload {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Files'}
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}