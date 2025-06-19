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
  faFileVideo 
} from '@fortawesome/free-solid-svg-icons';
import { getSession } from 'next-auth/react';
import { toast } from 'react-toastify';
import { useConfig } from '@/hooks/useConfig';
import { TusUploaderRef } from '@/components/TusUploaderComp';
import TusUploaderComp from '@/components/TusUploaderComp';

import MediaFileSelectionModal from '@/components/modals/MediaFileSelectionModal';
import { createStreamNew, CreateStreamNewData, CreateStreamNewResponse, MediaFile, createStreamNewUpload } from '@/services/streamService';

interface FilePreview {
  file: File
  id: string
}

export default function StreamNewPage() {
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [completedFiles, setCompletedFiles] = useState<Set<string>>(new Set());
  const [uploadedFileUrls, setUploadedFileUrls] = useState<{id: string, url: string}[]>([]);
  const [allUploadsComplete, setAllUploadsComplete] = useState(false);
  const [uploadsComplete, setUploadsComplete] = useState(false);
  const [hasProcessedUploads, setHasProcessedUploads] = useState(false);
  const [selectedMediaFiles, setSelectedMediaFiles] = useState<MediaFile[]>([]);
  const [showMediaSelection, setShowMediaSelection] = useState(false);

  const router = useRouter()

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Memoize the stream creation function to avoid recreation on every render
  const hasProcessedUploadsRef = useRef(false);
  const createStreamWithUploadedFiles = useCallback(async (): Promise<boolean> => {
    console.log('createStreamWithUploadedFiles called with files:', uploadedFileUrls);
    
    if (uploadedFileUrls.length === 0) {
      console.warn('No files available to create stream');
      setError('No files available to create stream');
      hasProcessedUploadsRef.current = false; // Reset flag to allow retry
      return false;
    }

    console.log('Uploaded file details:', uploadedFileUrls);
    
    // Use the tusFileId (file ID from tus upload) as the media file ID
    // The backend will handle looking up by either the ID or tusFileId
    const validFileIds = uploadedFileUrls
      .filter(file => file.id) // Only include files with an ID
      .map(file => file.id);   // Use the tusFileId as the media file ID
    
    if (validFileIds.length === 0) {
      console.warn('No valid media file IDs found in:', uploadedFileUrls);
      setError('No valid media files available. Please upload files again.');
      hasProcessedUploadsRef.current = false;
      return false;
    }
    
    console.log('Using media file IDs for stream creation:', validFileIds);
    
    console.log('Creating stream with media file IDs:', validFileIds);
    
    try {
      setLoading(true);
      setError('');
      
      // Create the stream with the uploaded files
      const streamData: CreateStreamNewData = {
        Name: `Stream ${formatDateTime(new Date())}`,
        Description: 'Stream created from uploaded files',
        MediaFileIds: validFileIds,
        IsActive: false, // Start inactive by default
      };
      
      console.log('Stream data to be created:', streamData);
      
      const response = await createStreamNewUpload(streamData);
      
      if (response.success && response.stream.id) {
        setSuccess('Stream created successfully!');
        
        // Navigate to the stream page after a short delay
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
      hasProcessedUploadsRef.current = false; // Reset flag on error to allow retry
      return false;
    } finally {
      setLoading(false);
    }
  }, [uploadedFileUrls, router]);

  // Handle successful file uploads
  const handleUploadSuccess = useCallback((uploadUrl: string, fileId: string) => {
    console.log('Upload success:', { uploadUrl, fileId });
    
    // Update completed files
    setCompletedFiles(prev => {
      const newCompleted = new Set(prev);
      newCompleted.add(fileId);
      return newCompleted;
    });
    
    // Add the file to uploadedFileUrls if not already present
    setUploadedFileUrls(prev => {
      if (prev.some(file => file.id === fileId)) {
        return prev;
      }
      return [...prev, { id: fileId, url: uploadUrl }];
    });
  }, []);
  
  // Effect to handle when all uploads are complete
  useEffect(() => {
    if (completedFiles.size > 0 && completedFiles.size === uploadingFiles.size) {
      setUploadsComplete(true);
      setAllUploadsComplete(true);
      
      // Small delay to ensure all state updates are processed
      const timer = setTimeout(() => {
        if (!hasProcessedUploadsRef.current) {
          hasProcessedUploadsRef.current = true;
          void createStreamWithUploadedFiles();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [completedFiles, uploadingFiles, createStreamWithUploadedFiles]);

  const handleUploadStart = useCallback((fileId: string) => {
    console.log('Upload started for file ID:', fileId);
    setUploadingFiles(prev => {
      const newUploading = new Set(prev);
      newUploading.add(fileId);
      console.log('Currently uploading files:', Array.from(newUploading));
      return newUploading;
    });
  }, []);

  // Handle the completion of uploads and create stream
  useEffect(() => {
    let isMounted = true;
    
    const finalizeUploads = async () => {
      if (!isMounted) return;
      
      try {
        console.log('Finalizing uploads with files:', uploadedFileUrls);
        
        // Only proceed if we have uploaded files
        if (uploadedFileUrls.length > 0) {
          console.log(`Creating stream with ${uploadedFileUrls.length} uploaded files...`);
          const success = await createStreamWithUploadedFiles();
          
          if (!isMounted) return;
          
          if (success) {
            console.log('Stream created successfully, updating state...');
            setAllUploadsComplete(true);
            
            // Clear the file input after successful stream creation
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            
            // Reset states after a delay to allow the success message to be seen
            const timer = setTimeout(() => {
              if (!isMounted) return;
              setUploadedFileUrls([]);
              setUploadingFiles(new Set());
              setCompletedFiles(new Set());
              setAllUploadsComplete(false);
              setUploadsComplete(false);
              hasProcessedUploadsRef.current = false;
            }, 3000);
            
            return () => clearTimeout(timer);
          } else {
            console.log('Stream creation was not successful');
            setUploadsComplete(false); // Allow retry
          }
        } else {
          console.error('No files were uploaded successfully');
          setError('No files were uploaded successfully. Please try again.');
          setUploadsComplete(false); // Allow retry
          setAllUploadsComplete(true);
          setIsUploading(false);
        }
      } catch (err) {
        console.error('Error finalizing uploads:', err);
        if (isMounted) {
          setError(`Failed to finalize uploads: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setUploadsComplete(false); // Allow retry on error
        }
      }
    };
    
    if (uploadsComplete && !allUploadsComplete) {
      console.log('All uploads complete, checking for files...');
      finalizeUploads();
    }
    
    return () => {
      isMounted = false;
    };
  }, [uploadsComplete, allUploadsComplete, uploadedFileUrls, createStreamWithUploadedFiles, setError, setIsUploading]);

  // Handle when all uploads are complete
  useEffect(() => {
    // Only process if we have files, they're all complete, and we haven't processed them yet
    if (files.length > 0 && 
        completedFiles.size === files.length && 
        !hasProcessedUploads && 
        !uploadsComplete) {
      console.log('All uploads completed, preparing to create stream...');
      setHasProcessedUploads(true);
      setUploadsComplete(true);
    }
  }, [completedFiles.size, files.length, hasProcessedUploads, uploadsComplete]);

  // Reset the processed state when new files are selected
  useEffect(() => {
    if (files.length > 0) {
      setHasProcessedUploads(false);
      setUploadsComplete(false);
      setAllUploadsComplete(false);
      setError(null);
      setSuccess(null);
    }
  }, [files.length]);

  const tusUploaderRef = useRef<TusUploaderRef>(null);



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
    setUploadedFileUrls([]);
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
          // Start the upload process
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

            <TusUploaderComp
              ref={tusUploaderRef}
              onSuccess={handleUploadSuccess}
              onUploadStart={handleUploadStart}
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
