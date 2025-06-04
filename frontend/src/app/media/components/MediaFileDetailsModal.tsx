import { Modal, Button, Row, Col, Badge, ListGroup } from 'react-bootstrap';

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
  if (!file) return null;

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className={`bi ${file.media_type === 'video' ? 'bi-camera-video' : 'bi-music-note'} me-2`}></i>
          Media File Details
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          <Col md={6}>
            <h6>File Information</h6>
            <ListGroup variant="flush">
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>File Name:</strong>
                <span className="text-end" style={{maxWidth: '60%', wordBreak: 'break-word'}}>{file.file_name}</span>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>File Path:</strong>
                <small className="text-muted text-end" style={{maxWidth: '60%', wordBreak: 'break-all', overflowWrap: 'anywhere'}}>{file.file_path}</small>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>File Size:</strong>
                <span>{formatFileSize(file.file_size)}</span>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>Media Type:</strong>
                <Badge bg={file.media_type === 'video' ? 'primary' : 'success'}>
                  {file.media_type.toUpperCase()}
                </Badge>
              </ListGroup.Item>
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>MIME Type:</strong>
                <span>{file.mime_type}</span>
              </ListGroup.Item>
              {file.duration && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <strong>Duration:</strong>
                  <span>{formatDuration(file.duration)}</span>
                </ListGroup.Item>
              )}
              {file.resolution && (
                <ListGroup.Item className="d-flex justify-content-between">
                  <strong>Resolution:</strong>
                  <span>{file.resolution}</span>
                </ListGroup.Item>
              )}
              <ListGroup.Item className="d-flex justify-content-between">
                <strong>Created:</strong>
                <span>{new Date(file.created_at).toLocaleString()}</span>
              </ListGroup.Item>
            </ListGroup>
          </Col>
          <Col md={6}>
            <h6>Stream Usage</h6>
            {file.stream_count > 0 ? (
              <ListGroup>
                {file.streams && file.streams.length > 0 ? (
                  // Display full stream objects if available
                  file.streams.map((stream, index) => (
                    <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{stream.name}</strong>
                        {stream.description && (
                          <div>
                            <small className="text-muted">{stream.description}</small>
                          </div>
                        )}
                      </div>
                      <Badge bg="info">{stream.status}</Badge>
                    </ListGroup.Item>
                  ))
                ) : (
                  // Fallback to display stream names if full objects not available
                  file.stream_names && file.stream_names.length > 0 ? (
                    file.stream_names.map((streamName, index) => (
                      <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{streamName.trim()}</strong>
                        </div>
                        <Badge bg="secondary">Unknown</Badge>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item>
                      <div className="text-muted">Stream information not available</div>
                    </ListGroup.Item>
                  )
                )}
              </ListGroup>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-inbox display-6 text-muted d-block mb-2"></i>
                <p className="text-muted mb-0">This file is not used in any streams</p>
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}