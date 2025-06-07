import { Modal, Button } from 'react-bootstrap';
import { Monitor } from '../types/monitor';

interface DeleteMonitorModalProps {
  show: boolean;
  monitor: Monitor | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteMonitorModal({
  show,
  monitor,
  deleting,
  onHide,
  onConfirm
}: DeleteMonitorModalProps) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Delete {monitor?.displayName || 'Monitor'}?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Are you sure you want to delete this monitor? This action cannot be undone.</p>
        {monitor && (
          <div>
            <p className="mb-1">
              <strong>Username:</strong> <span className="font-monospace">@{monitor.username}</span>
            </p>
            <p className="mb-0">
              <strong>Display Name:</strong> {monitor.displayName}
            </p>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          {deleting && (
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          )}
          {deleting ? 'Deleting...' : 'Delete Monitor'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}