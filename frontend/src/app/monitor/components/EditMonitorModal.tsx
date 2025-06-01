import { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert, Image } from 'react-bootstrap';
import { Monitor, MonitorFormData } from '../types/monitor';

interface EditMonitorModalProps {
  show: boolean;
  onHide: () => void;
  monitor: Monitor;
  onSave: (id: string, data: Partial<MonitorFormData>) => Promise<void>;
}

export function EditMonitorModal({ show, onHide, monitor, onSave }: EditMonitorModalProps) {
  const [formData, setFormData] = useState<Partial<MonitorFormData>>({
    isActive: monitor.isActive,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (monitor) {
      setFormData({
        isActive: monitor.isActive,
      });
    }
  }, [monitor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await onSave(monitor.id, formData);
      onHide();
    } catch (err) {
      setError('Failed to update monitor. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!monitor) return null;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit Monitor</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="d-flex align-items-center mb-4">
            <div className="me-3">
              <Image
                src={monitor.avatar || '/default-avatar.png'}
                alt={monitor.username}
                width={64}
                height={64}
                className="rounded-circle"
                style={{ objectFit: 'cover' }}
              />
            </div>
            <div>
              <h5 className="mb-1">{monitor.displayName}</h5>
              <p className="text-muted mb-0">@{monitor.username}</p>
            </div>
          </div>

          <Form.Group className="mb-3">
            <Form.Label>Monitor ID</Form.Label>
            <Form.Control
              type="text"
              value={monitor.id}
              disabled
              className="font-monospace"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Check
              type="switch"
              id="isActive"
              name="isActive"
              label="Active monitoring"
              checked={formData.isActive ?? false}
              onChange={handleChange}
              disabled={loading}
            />
            <Form.Text className="text-muted d-block">
              {formData.isActive 
                ? 'This monitor is active and checking for live streams.'
                : 'This monitor is paused and not checking for live streams.'}
            </Form.Text>
          </Form.Group>

          <div className="small text-muted">
            <div>Created: {new Date(monitor.createdAt).toLocaleString()}</div>
            <div>Last updated: {new Date(monitor.updatedAt).toLocaleString()}</div>
            {monitor.lastChecked && (
              <div>Last checked: {new Date(monitor.lastChecked).toLocaleString()}</div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner as="span" size="sm" animation="border" className="me-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
