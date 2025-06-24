import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faMusic, faEye, faTrash, faEdit } from '@fortawesome/free-solid-svg-icons';

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
  file: MediaFile;
  onViewDetails: (file: MediaFile) => void;
  onDelete: (file: MediaFile) => void;
  onRename: (file: MediaFile) => void;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds?: number) => string;
}

export default function MediaFileRow({ file, onViewDetails, onDelete, onRename, formatFileSize, formatDuration }: Props) {
  const getMediaTypeIcon = (type: string) => {
    return type === 'video' ? faVideo : faMusic;
  };

  const getMediaTypeBadgeColor = (type: string) => {
    return type === 'video' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <FontAwesomeIcon icon={getMediaTypeIcon(file.media_type)} className="mr-2 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900">{file.file_name}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMediaTypeBadgeColor(file.media_type)}`}>
          {file.media_type.toUpperCase()}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatFileSize(file.file_size)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDuration(file.duration)}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        {file.stream_count > 0 ? (
          <span 
            className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full cursor-pointer"
            title={`Used in: ${file.stream_names?.join(', ')}`}
          >
            {file.stream_count} stream{file.stream_count !== 1 ? 's' : ''}
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Unused</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(file.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          <button
            className="text-blue-600 hover:text-blue-900 p-1"
            onClick={() => onViewDetails(file)}
            title="View details"
          >
            <FontAwesomeIcon icon={faEye} />
          </button>
          <button
            className="text-yellow-600 hover:text-yellow-900 p-1"
            onClick={() => onRename(file)}
            title="Rename file"
          >
            <FontAwesomeIcon icon={faEdit} />
          </button>
          <button
            className={`p-1 ${file.stream_count > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
            onClick={() => onDelete(file)}
            disabled={file.stream_count > 0}
            title="Delete file"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </td>
    </tr>
  );
}