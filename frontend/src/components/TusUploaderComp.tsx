// Add forwardRef and useImperativeHandle
import React, { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { getSession } from 'next-auth/react';
import * as tus from 'tus-js-client';
import { ulid } from 'ulid';
import { flushSync } from 'react-dom';
import { toast } from 'react-toastify';

// Add interface for ref methods
export interface TusUploaderRef {
  startUploads: () => void;
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

    if (!e.target.files || e.target.files.length === 0) return;

    const { valid, invalid, errors } = validateFiles(e.target.files);

    setValidationErrors(errors);

    if (valid.length > 0) {
      handleFiles(valid);
    } else {
      onError(new Error('Invalid file type or size'));
    }
    // setFiles(selectedFiles);

    // if (e.target.files && e.target.files.length > 0) {
    //   handleFiles(Array.from(e.target.files));
    // }
  };

  const handleFiles = (selectedFiles: File[]) => {
    flushSync(() => {
      setFiles(selectedFiles);
    });

    // Defer the parent notification to avoid state updates during render
    if (onFilesSelected) {
      setTimeout(() => {
        onFilesSelected(selectedFiles);
      }, 0);
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
    };


    const session = await getSession();
    if (!session) {
      onError(new Error('Session expired. Please login again.'));
      return;
    }

    const uploadStreamId = streamId || ulid();
    const uploadIds = new Set<string>();

    files.forEach((file, index) => {
      const fileId = `${file.name}_${index}_${Date.now()}`;
      uploadIds.add(fileId);

      if (onUploadStart) {
        onUploadStart(fileId);
      }

      const upload = new tus.Upload(file, {
        endpoint: `${config?.config?.apiUrl}/files/`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 50 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: file.type,
          userId: session.user?.id as string,
          streamId: uploadStreamId,
          mediaType: mediaType,
          uploadOnly: uploadOnly ? 'true' : 'false'
        },
        headers: {
          'Authorization': `Bearer ${session?.user?.backendToken}`
        },
        onError: function (error) {
          setActiveUploads(prev => {
            const newActive = new Set(prev);
            newActive.delete(fileId);
            return newActive;
          });
          onError(error);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100);
          onProgress(percentage);
        },
        onSuccess: function () {
          setCompletedUploads(prev => {
            const newCompleted = new Set(prev);
            newCompleted.add(fileId);

            // Check if all uploads are complete
            if (newCompleted.size === uploadIds.size) {
              if (onAllUploadsComplete) {
                onAllUploadsComplete();
              }
            }

            return newCompleted;
          });

          setActiveUploads(prev => {
            const newActive = new Set(prev);
            newActive.delete(fileId);
            return newActive;
          });

          onSuccess(upload.url ?? '', fileId);
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

  // Expose startUploads method to parent
  useImperativeHandle(ref, () => ({
    startUploads
  }));

  return (
    <div>
      <div
        className={`border border-2 rounded p-5 text-center ${isDragging ? 'border-primary bg-light' : 'border-secondary border-opacity-25'}`}
        style={{
          borderStyle: 'dashed',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <h5 className="mb-2">Drag and drop files here</h5>
        <p className="text-muted mb-3">or</p>
        <button className="btn btn-outline-primary">Browse Files</button>
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