import { useState } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { MonitorFormData } from '../types/monitor';

interface AddMonitorModalProps {
  show: boolean;
  onHide: () => void;
  onSave: (data: MonitorFormData) => Promise<void>;
}

export function AddMonitorModal({ show, onHide, onSave }: AddMonitorModalProps) {
  const [formData, setFormData] = useState<MonitorFormData>({
    username: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(formData);
      setFormData({ username: '', isActive: true });
    } catch (err) {
      setError('Failed to add monitor. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Add New Monitor</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form.Group className="mb-3">
            <Form.Label>TikTok Username</Form.Label>
            <div className="input-group">
              <span className="input-group-text">@</span>
              <Form.Control
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="username"
                disabled={loading}
                required
              />
            </div>
            <Form.Text className="text-muted">
              Enter the TikTok username without the @ symbol
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="isActive"
              name="isActive"
              label="Active monitoring"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={loading}
            />
            <Form.Text className="text-muted d-block">
              {formData.isActive 
                ? 'This monitor will be active and checking for live streams.'
                : 'This monitor will be paused and not check for live streams.'}
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner as="span" size="sm" animation="border" className="me-2" />
                Adding...
              </>
            ) : (
              'Add Monitor'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
