// Add forwardRef and useImperativeHandle
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { getSession } from 'next-auth/react';
import * as tus from 'tus-js-client';
import { ulid } from 'ulid';

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
}

const TusUploaderComp = forwardRef<TusUploaderRef, TusUploaderProps>(({ 
  onSuccess, 
  onProgress, 
  onError,
  onUploadStart,
  onAllUploadsComplete,
  streamId,
  mediaType = 'video',
  onFilesSelected,
  hideMediaList = false,
  uploadOnly = false,
}, ref) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [completedUploads, setCompletedUploads] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = useConfig();

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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    
    // Notify parent component about file selection
    if (onFilesSelected) {
      onFilesSelected(selectedFiles);
    }
    
    // Only auto-upload if parent doesn't want to manage files
    if (!onFilesSelected) {
      startUploads();
    }
  };


  const startUploads = async () => {
    if (files.length === 0) return;
    
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
          uploadOnly: uploadOnly? 'true' : 'false'
        },
        headers: {
          'Authorization': `Bearer ${session?.user?.backendToken}`
        },
        onError: function(error) {
          setActiveUploads(prev => {
            const newActive = new Set(prev);
            newActive.delete(fileId);
            return newActive;
          });
          onError(error);
        },
        onProgress: function(bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100);
          onProgress(percentage);
        },
        onSuccess: function() {
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

      upload.findPreviousUploads().then(function(previousUploads) {
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
    {/* File list */}
    { !hideMediaList && files.length > 0 && (
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