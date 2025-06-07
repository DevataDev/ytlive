import { useState } from 'react';
import { Modal, Button, Form, Spinner, InputGroup } from 'react-bootstrap';

interface PasswordUpdateModalProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
  user: {
    id: string;
    username: string;
  } | null;
}

export default function PasswordUpdateModal({ show, onHide, onSubmit, user }: PasswordUpdateModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = (): boolean => {
    if (!newPassword) {
      setError('New password is required');
      return false;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      await onSubmit(newPassword);
      // Reset form on success
      setNewPassword('');
      setConfirmPassword('');
      onHide();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title>Update Password for {user?.username}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <Form.Group className="mb-3" controlId="newPassword">
            <Form.Label>New Password</Form.Label>
            <InputGroup>
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
              </Button>
            </InputGroup>
            <Form.Text className="text-muted">
              Password must be at least 6 characters long
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="confirmPassword">
            <Form.Label>Confirm New Password</Form.Label>
            <InputGroup>
              <Form.Control
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <Button
                variant="outline-secondary"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                type="button"
              >
                <i className={`bi bi-eye${showConfirmPassword ? '-slash' : ''}`}></i>
              </Button>
            </InputGroup>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
