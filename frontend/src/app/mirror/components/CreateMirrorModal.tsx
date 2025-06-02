import { useState } from 'react';
import { Modal, Form, Button, Spinner } from 'react-bootstrap';
import { Mirror } from '../types/mirror';
import { useSession } from 'next-auth/react';
import { addMirror } from '@/services/mirrorService';

interface CreateMirrorModalProps {
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

const CreateMirrorModal: React.FC<CreateMirrorModalProps> = ({ show, onHide, onSuccess }) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { data: session } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a Tiktok username/room id for the mirror');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await addMirror(name.trim());
      console.log(response);
      if (response.mirror == undefined || response.mirror == null) {
        setError(response.message);
        return;
      }
      onSuccess();
      onHide();
      setName('');
    } catch (err) {
      console.error('Error creating mirror:', err);
      setError(err instanceof Error ? err.message : 'Failed to create mirror');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Create New Mirror</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <div className="alert alert-danger">{error}</div>}
          <Form.Group className="mb-3">
            <Form.Label>Tiktok Room ID / Username</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Tiktok room ID / username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Creating...
              </>
            ) : (
              'Create Mirror'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CreateMirrorModal;
