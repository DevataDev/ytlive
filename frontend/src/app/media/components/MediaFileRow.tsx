import { Badge, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

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
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds?: number) => string;
}

export default function MediaFileRow({ file, onViewDetails, onDelete, formatFileSize, formatDuration }: Props) {
  const getMediaTypeIcon = (type: string) => {
    return type === 'video' ? 'bi-camera-video' : 'bi-music-note';
  };

  const getMediaTypeBadge = (type: string) => {
    return type === 'video' ? 'primary' : 'success';
  };

  return (
    <tr>
      <td>
        <div className="d-flex align-items-center">
          <i className={`bi ${getMediaTypeIcon(file.media_type)} me-2 text-muted`}></i>
          <div>
            <div className="fw-medium">{file.file_name}</div>
          </div>
        </div>
      </td>
      <td>
        <Badge bg={getMediaTypeBadge(file.media_type)}>
          {file.media_type.toUpperCase()}
        </Badge>
      </td>
      <td>{formatFileSize(file.file_size)}</td>
      <td>{formatDuration(file.duration)}</td>
      <td>
        {file.stream_count > 0 ? (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip>
                Used in: {file.stream_names?.join(', ')}
              </Tooltip>
            }
          >
            <Badge bg="info" style={{ cursor: 'pointer' }}>
              {file.stream_count} stream{file.stream_count !== 1 ? 's' : ''}
            </Badge>
          </OverlayTrigger>
        ) : (
          <Badge bg="secondary">Unused</Badge>
        )}
      </td>
      <td>
        <small className="text-muted">
          {new Date(file.created_at).toLocaleDateString()}
        </small>
      </td>
      <td>
        <div className="d-flex gap-1">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => onViewDetails(file)}
          >
            <i className="bi bi-eye"></i>
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => onDelete(file)}
            disabled={file.stream_count > 0}
          >
            <i className="bi bi-trash"></i>
          </Button>
        </div>
      </td>
    </tr>
  );
}