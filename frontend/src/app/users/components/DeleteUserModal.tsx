'use client';

import { Modal, Button } from 'react-bootstrap';
import { User } from '@/services/userService';

interface DeleteUserModalProps {
  show: boolean;
  user: User | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteUserModal({
  show,
  user,
  deleting,
  onHide,
  onConfirm
}: DeleteUserModalProps) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Delete {user?.username || 'User'}?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Are you sure you want to delete this user? This action cannot be undone.</p>
        {user && (
          <div>
            <p className="mb-1">
              <strong>Username:</strong> <span className="font-monospace">{user.username}</span>
            </p>
            <p className="mb-1">
              <strong>Email:</strong> {user.email}
            </p>
            <p className="mb-0">
              <strong>Status:</strong> 
              <span className={`badge ms-2 ${user.is_active ? 'bg-success' : 'bg-danger'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        )}
        <div className="alert alert-warning mt-3 mb-0">
          <i className="bi bi-exclamation-triangle me-2"></i>
          <strong>Warning:</strong> All user data and associated content will be permanently removed.
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
          {deleting ? 'Deleting...' : 'Delete User'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}