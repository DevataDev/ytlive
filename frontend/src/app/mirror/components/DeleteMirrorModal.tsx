import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { MirrorItem } from '@/services/mirrorService';

interface DeleteMirrorModalProps {
  show: boolean;
  mirror: MirrorItem | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteMirrorModal({
  show,
  mirror,
  deleting,
  onHide,
  onConfirm
}: DeleteMirrorModalProps) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Delete {mirror?.DisplayName || 'Mirror'}?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Are you sure you want to delete this mirror? This action cannot be undone.</p>
        {mirror && (
          <div>
            <p className="mb-1">
              <strong>Display Name:</strong> <span className="font-monospace">{mirror.DisplayName}</span>
            </p>
            <p className="mb-1">
              <strong>Title:</strong> {mirror.Title}
            </p>
            <p className="mb-1">
              <strong>Room ID:</strong> <span className="font-monospace">{mirror.RoomId}</span>
            </p>
            <p className="mb-0">
              <strong>Status:</strong> 
              <span className={`badge ms-2 ${
                mirror.Status?.toLowerCase() === 'live' ? 'bg-success' : 
                mirror.Status?.toLowerCase() === 'queued' ? 'bg-warning' : 'bg-secondary'
              }`}>
                {mirror.Status || 'Unknown'}
              </span>
            </p>
          </div>
        )}
        <div className="alert alert-warning mt-3 mb-0">
          <i className="bi bi-exclamation-triangle me-2"></i>
          <strong>Warning:</strong> The mirror will be stopped if currently running, and all associated data will be permanently removed.
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={deleting}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={deleting}>
          {deleting && (
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          )}
          {deleting ? 'Deleting...' : 'Delete Mirror'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}