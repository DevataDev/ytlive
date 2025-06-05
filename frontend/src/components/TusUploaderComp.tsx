import React, { useState, useRef } from 'react';
import * as tus from 'tus-js-client';
import { getSession } from 'next-auth/react';
import { useConfig } from '../hooks/useConfig';

interface TusUploaderProps {
  onSuccess: (uploadUrl: string, fileId: string) => void;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
  streamId?: string;
  mediaType?: string;
}

export default function TusUploaderComp({ 
  onSuccess, 
  onProgress, 
  onError,
  streamId,
  mediaType = 'video'
}: TusUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
    uploadFiles(selectedFiles);
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    const session = await getSession();
    if (!session) {
      onError(new Error('Session expired. Please login again.'));
      return;
    }
  
    // Generate a single streamId for all files if not provided
    const uploadStreamId = streamId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
    filesToUpload.forEach(file => {
      const upload = new tus.Upload(file, {
        endpoint: `${config?.config?.apiUrl}/files/`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        chunkSize: 50 * 1024 * 1024, // 50MB chunks
        metadata: {
          filename: file.name,
          filetype: file.type,
          userId: session.user?.id as string,
          streamId: uploadStreamId, // Use the same streamId for all files
          mediaType: mediaType
        },
        headers: {
          'Authorization': `Bearer ${session?.user?.backendToken}`
        },
        onError: function(error) {
          onError(error);
        },
        onProgress: function(bytesUploaded, bytesTotal) {
          const percentage = ((bytesUploaded / bytesTotal) * 100);
          onProgress(percentage);
        },
        onSuccess: function() {
          onSuccess(upload.url ?? '', (upload.url ?? "").split('/').pop() || '');
        }
      });

      // Check if there are any previous uploads to continue
      upload.findPreviousUploads().then(function(previousUploads) {
        // Found previous uploads so we select the first one
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }

        // Start the upload
        upload.start();
      });
    });
  };

  return (
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
  );
}