'use client';

import { Modal, Button } from 'react-bootstrap';
import { Channel } from '@/services/channelService';

interface DeleteChannelModalProps {
  show: boolean;
  channel: Channel | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteChannelModal({
  show,
  channel,
  deleting,
  onHide,
  onConfirm
}: DeleteChannelModalProps) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          Delete {channel?.ChannelName || 'Channel'}?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>Are you sure you want to delete this channel? This action cannot be undone.</p>
        {channel && (
          <p className="mb-0">
            <strong>Channel ID:</strong> <span className="font-monospace">{channel.ID}</span>
          </p>
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
          {deleting ? 'Deleting...' : 'Delete Channel'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}