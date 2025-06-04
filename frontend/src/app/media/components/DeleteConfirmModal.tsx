import { Modal, Button, Alert } from 'react-bootstrap';

interface MediaFile {
  id: string;
  file_name: string;
  stream_count: number;
}

interface Props {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  file: MediaFile | null;
  loading: boolean;
}

export default function DeleteConfirmModal({ show, onHide, onConfirm, file, loading }: Props) {
  if (!file) return null;

  const canDelete = file.stream_count === 0;

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-exclamation-triangle text-warning me-2"></i>
          Confirm Delete
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {canDelete ? (
          <>
            <p>Are you sure you want to delete this media file?</p>
            <div className="bg-light p-3 rounded">
              <strong>{file.file_name}</strong>
            </div>
            <Alert variant="warning" className="mt-3 mb-0">
              <i className="bi bi-exclamation-triangle me-2"></i>
              This action cannot be undone. The physical file will also be deleted from the server.
            </Alert>
          </>
        ) : (
          <>
            <p>This media file cannot be deleted because it is currently being used in {file.stream_count} stream{file.stream_count !== 1 ? 's' : ''}.</p>
            <div className="bg-light p-3 rounded">
              <strong>{file.file_name}</strong>
            </div>
            <Alert variant="info" className="mt-3 mb-0">
              <i className="bi bi-info-circle me-2"></i>
              Remove this file from all streams first before deleting it.
            </Alert>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        {canDelete && (
          <Button 
            variant="danger" 
            onClick={onConfirm} 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Deleting...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-2"></i>
                Delete File
              </>
            )}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}