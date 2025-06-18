import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faMusic, faTimes, faInbox } from '@fortawesome/free-solid-svg-icons';

interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  media_type: 'video' | 'audio';
  mime_type: string;
  duration?: number;
  resolution?: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
  streams: any[];
  stream_count: number;
  stream_names: string[];
}

interface Props {
  show: boolean;
  onHide: () => void;
  file: MediaFile | null;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds?: number) => string;
}

export default function MediaFileDetailsModal({ show, onHide, file, formatFileSize, formatDuration }: Props) {
  if (!show || !file) return null;

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
                  icon={file.media_type === 'video' ? faVideo : faMusic} 
                  className="mr-2 text-gray-600" 
                />
                Media File Details
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
          <div className="bg-white px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Information */}
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">File Information</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-700">File Name:</span>
                    <span className="text-right text-gray-900 max-w-xs break-words">{file.file_name}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-700">File Path:</span>
                    <span className="text-right text-gray-500 text-sm max-w-xs break-all">{file.file_path}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">File Size:</span>
                    <span className="text-gray-900">{formatFileSize(file.file_size)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Media Type:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      file.media_type === 'video' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {file.media_type.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">MIME Type:</span>
                    <span className="text-gray-900">{file.mime_type}</span>
                  </div>
                  {file.duration && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Duration:</span>
                      <span className="text-gray-900">{formatDuration(file.duration)}</span>
                    </div>
                  )}
                  {file.resolution && (
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Resolution:</span>
                      <span className="text-gray-900">{file.resolution}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Created:</span>
                    <span className="text-gray-900">{new Date(file.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Stream Usage */}
              <div>
                <h4 className="text-base font-medium text-gray-900 mb-4">Stream Usage</h4>
                {file.stream_count > 0 ? (
                  <div className="space-y-2">
                    {file.streams && file.streams.length > 0 ? (
                      // Display full stream objects if available
                      file.streams.map((stream, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                          <div>
                            <div className="font-medium text-gray-900">{stream.name}</div>
                            {stream.description && (
                              <div className="text-sm text-gray-500">{stream.description}</div>
                            )}
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {stream.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      // Fallback to display stream names if full objects not available
                      file.stream_names && file.stream_names.length > 0 ? (
                        file.stream_names.map((streamName, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                            <div className="font-medium text-gray-900">{streamName.trim()}</div>
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              Unknown
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <div className="text-gray-500">Stream information not available</div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FontAwesomeIcon icon={faInbox} className="text-4xl text-gray-300 mb-2" />
                    <p className="text-gray-500">This file is not used in any streams</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-end">
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
  );
}