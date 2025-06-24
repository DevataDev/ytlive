// Add forwardRef and useImperativeHandle
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { getSession } from 'next-auth/react';
import * as tus from 'tus-js-client';
import type { DetailedError } from 'tus-js-client';
import { ulid } from 'ulid';
import { flushSync } from 'react-dom';
import { toast } from 'react-toastify';

// Add interface for ref methods
export interface TusUploaderRef {
  startUploads: () => void;
  reset: () => void;
}

interface TusUploaderProps {
  onSuccess: (uploadUrl: string, fileId: string) => void;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
  onUploadStart?: (fileId: string) => void;
  onAllUploadsComplete?: () => void; // New callback for when all uploads finish
  onFilesSelected?: (selectedFiles: File[]) => void; // New callback for when files are selected
  hideMediaList?: boolean;
  streamId?: string;
  mediaType?: string;
  uploadOnly?: boolean;
  allowedExtensions?: string[];
}

const TusUploaderComp = forwardRef<TusUploaderRef, TusUploaderProps>(({
  onSuccess,
  onProgress,
  onError,
  onUploadStart,
  onAllUploadsComplete,
  streamId,
  mediaType = 'detect',
  onFilesSelected,
  hideMediaList = false,
  uploadOnly = false,
  allowedExtensions = ['.mp4', '.mkv', '.mp3', '.wav']
}, ref) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [completedUploads, setCompletedUploads] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileProgress, setFileProgress] = useState<Map<string, number>>(new Map());
  const config = useConfig();

  const validateFileExtension = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    return allowedExtensions.some(ext => fileName.endsWith(ext.toLowerCase()));
  };

  const validateFileSize = (file: File, maxSizeMB: number = 2000): boolean => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  };

  const validateFiles = (files: FileList): { valid: File[], invalid: File[], errors: string[] } => {
    const valid: File[] = [];
    const invalid: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (!validateFileExtension(file)) {
        invalid.push(file);
        errors.push(`${file.name}: Invalid file type`);
      } else if (!validateFileSize(file)) {
        invalid.push(file);
        errors.push(`${file.name}: File too large (max 500MB)`);
      } else {
        valid.push(file);
      }
    });

    return { valid, invalid, errors };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const { valid, invalid, errors } = validateFiles(e.dataTransfer.files);

    setValidationErrors(errors);

    if (valid.length > 0) {
      handleFiles(valid);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    
    if (!e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      return;
    }

    const { valid, invalid, errors } = validateFiles(e.target.files);

    setValidationErrors(errors);

    if (valid.length > 0) {
      handleFiles(valid);
    } else {
      onError(new Error('Invalid file type or size'));
    }
    
    // Reset the input value to allow selecting the same file again
    e.target.value = '';
  };

  const handleFiles = (selectedFiles: File[]) => {
    // Update the local state immediately for UI
    setFiles(selectedFiles);
    
    // Notify parent component in the next tick to avoid state updates during render
    if (onFilesSelected) {
      Promise.resolve().then(() => {
        onFilesSelected(selectedFiles);
      });
    }
  };

  useEffect(() => {
    if (files.length > 0) {
      // Only auto-upload if parent doesn't want to manage files
      if (!onFilesSelected) {
        console.log('Auto-uploading files...');
        toast.info('Start uploading files ... please wait....');
        setTimeout(() => {
          startUploads();
        }, 500);
      }
    }
  }, [files])


  const startUploads = async () => {
    console.log('Starting uploads...' + files.length);
    if (files.length === 0) {
      onError(new Error('No files selected'));
      return;
    }
    
    // Clear any previous errors
    setValidationErrors([]);

    const session = await getSession();
    if (!session) {
      onError(new Error('Session expired. Please login again.'));
      return;
    }

    // Generate a unique upload session ID
    const uploadSessionId = ulid();
    const uploadIds = new Set<string>();

    // Process each file for upload
    files.forEach((file, index) => {
      // Create a unique ID for this file upload
      const fileId = `${uploadSessionId}_${index}`;
      uploadIds.add(fileId);

      // Notify parent component that upload is starting
      if (onUploadStart) {
        onUploadStart(fileId);
      }

      console.log(`Starting upload for file: ${file.name} (${fileId})`);

      // Configure the tus upload
      const upload = new tus.Upload(file, {
        endpoint: `${config?.config?.apiUrl}/files/`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 50 * 1024 * 1024, // 50MB chunks
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: file.name,
          filetype: file.type,
          userId: session.user?.id as string,
          streamId: streamId || '',
          mediaType: mediaType,
          uploadOnly: 'true',
          tusFileId: fileId,
          uploadSessionId: uploadSessionId // Add upload session ID for grouping
        },
        headers: {
          'Authorization': `Bearer ${session?.user?.backendToken}`,
          'Upload-Metadata': `filename ${btoa(encodeURIComponent(file.name))},filetype ${btoa(file.type)}`
        },
        onError: function (error: Error | DetailedError) {
          console.error(`Upload failed for ${file.name}:`, error);
          
          // Update active uploads state
          setActiveUploads(prev => {
            const newActive = new Set(prev);
            newActive.delete(fileId);
            return newActive;
          });
          
          // Remove this file from progress tracking since it failed
          setFileProgress(prev => {
            const newProgress = new Map(prev);
            newProgress.delete(fileId);
            
            // Recalculate overall progress without the failed file
            let totalProgress = 0;
            let fileCount = 0;
            
            uploadIds.forEach(id => {
               if (newProgress.has(id)) {
                 const fileProgress = newProgress.get(id) || 0;
                 totalProgress += fileProgress;
                 fileCount++;
               }
             });
             
             const overallProgress = fileCount > 0 ? totalProgress / fileCount : 0;
             
             // Defer the progress callback to avoid setState during render
             setTimeout(() => {
               onProgress(overallProgress);
             }, 0);
            
            return newProgress;
          });
          
          // Create a more user-friendly error message
          let errorMessage = `Failed to upload ${file.name}: `;
          
          // Check if this is a DetailedError with status code
          if ('originalRequest' in error && error.originalRequest) {
            // Handle HTTP errors
            const status = 'status' in error ? error.status : 0;
            if (status === 413) {
              errorMessage += 'File is too large';
            } else if (status === 401 || status === 403) {
              errorMessage += 'Authentication failed. Please log in again.';
            } else {
              errorMessage += `Server error (${status})`;
            }
          } else if (error.message) {
            // Handle other errors
            errorMessage += error.message;
          } else {
            errorMessage += 'Unknown error occurred';
          }
          
          onError(new Error(errorMessage));
          
          // Check if all uploads have failed
          setCompletedUploads(prev => {
            const newCompleted = new Set(prev);
            newCompleted.add(fileId);
            
            return newCompleted;
          });
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100);
          
          // Update progress for this specific file
          setFileProgress(prev => {
            const newProgress = new Map(prev);
            newProgress.set(fileId, percentage);
            
            // Calculate overall progress across all files
            let totalProgress = 0;
            let fileCount = 0;
            
            // Include progress from all files being uploaded
            uploadIds.forEach(id => {
              const fileProgress = newProgress.get(id) || 0;
              totalProgress += fileProgress;
              fileCount++;
            });
            
            const overallProgress = fileCount > 0 ? totalProgress / fileCount : 0;
            
            // Defer the progress callback to avoid setState during render
            setTimeout(() => {
              onProgress(overallProgress);
            }, 0);
            
            return newProgress;
          });
        },
        onSuccess: function () {
          // The fileId was generated at the start of the upload
          const fileId = `${uploadSessionId}_${files.indexOf(file)}`;
          
          if (!fileId) {
            console.error('Could not find upload ID for file:', file.name);
            return;
          }
          
          // The actual file URL will be constructed from the tus endpoint and file ID
          const fileUrl = `${config?.config?.apiUrl}/files/${fileId}`;
          
          console.log('Upload completed:', { fileId, fileUrl, fileName: file.name });
          
          // Update active uploads state
          setActiveUploads(prev => {
            const newActive = new Set(prev);
            newActive.delete(fileId);
            return newActive;
          });
          
          // Mark this file as 100% complete in progress tracking
          setFileProgress(prev => {
            const newProgress = new Map(prev);
            newProgress.set(fileId, 100);
            return newProgress;
          });
          
          // Update completed uploads state first
          setCompletedUploads(prev => {
            const newCompleted = new Set(prev);
            newCompleted.add(fileId);
            
            // Use setTimeout to defer the success callbacks to the next tick
            // This avoids state updates during render
            setTimeout(() => {
              // Call the success callback with the file URL and upload ID
              onSuccess(fileUrl, fileId);
              
              // Check if all uploads are complete after state update
              if (newCompleted.size === uploadIds.size && onAllUploadsComplete) {
                // Use a flag to prevent multiple calls
                const allUploadsCompleteKey = `allComplete_${uploadSessionId}`;
                if (!(window as any)[allUploadsCompleteKey]) {
                  (window as any)[allUploadsCompleteKey] = true;
                  onAllUploadsComplete();
                  // Clean up the flag after a short delay
                  setTimeout(() => {
                    delete (window as any)[allUploadsCompleteKey];
                  }, 1000);
                }
              }
            }, 0);
            
            return newCompleted;
          });
        }
      });

      setActiveUploads(prev => {
        const newActive = new Set(prev);
        newActive.add(fileId);
        return newActive;
      });

      upload.findPreviousUploads().then(function (previousUploads) {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const resetComponent = () => {
    setFiles([]);
    setSelectedFiles([]);
    setActiveUploads(new Set());
    setCompletedUploads(new Set());
    setFileProgress(new Map());
    setValidationErrors([]);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    startUploads,
    reset: resetComponent
  }));

  return (
    <div>
      <div
        className={`border border-2 rounded p-5 text-center ${isDragging ? 'border-primary bg-light' : 'border-secondary border-opacity-25'}`}
        style={{
          borderStyle: 'dashed',
          transition: 'all 0.3s ease'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <h5 className="mb-2">Drag and drop files here</h5>
        <p className="text-muted mb-3">or</p>
        <button 
          className="btn btn-outline-primary"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="d-none"
          accept="video/*,audio/*"
        />
      </div>
      {validationErrors.length > 0 && (
        <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-semibold">Validation Errors:</p>
          <ul className="list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {/* File list */}
      {!hideMediaList && files.length > 0 && (
        <div className="mt-4">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded mb-2">
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}

          <button
            onClick={startUploads}
            disabled={activeUploads.size > 0}
            className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {activeUploads.size > 0 ? `Uploading ${completedUploads.size}/${files.length} files...` : `Upload ${files.length} Files`}
          </button>
        </div>
      )}
    </div>
  );
});

export default TusUploaderComp;