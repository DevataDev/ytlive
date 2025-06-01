import { useState, useEffect } from 'react';
import { Modal, Form, Button, Spinner, Row, Col } from 'react-bootstrap';

interface UserFormProps {
  show: boolean;
  onHide: () => void;
  onSubmit: (data: {
    username: string;
    email: string;
    password?: string;
    isAdmin: boolean;
  }) => Promise<void>;
  user?: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  } | null;
}

export default function UserForm({ show, onHide, onSubmit, user }: UserFormProps) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    isAdmin: false,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Initialize form when user data is provided (edit mode)
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Don't pre-fill password for security
        isAdmin: user.isAdmin,
      });
    } else {
      // Reset form for new user
      setFormData({
        username: '',
        email: '',
        password: '',
        isAdmin: false,
      });
    }
    setErrors({});
  }, [user]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    // Only validate password for new users or when changing password
    if (!user && !formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      // Only include password if it's a new user or if it's being changed
      const submitData = { ...formData };
      if (user && !submitData.password) {
        delete submitData.password;
      }
      
      await onSubmit(submitData);
      onHide();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>{user ? 'Edit User' : 'Add New User'}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3" controlId="username">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              isInvalid={!!errors.username}
              placeholder="Enter username"
            />
            <Form.Control.Feedback type="invalid">
              {errors.username}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              isInvalid={!!errors.email}
              placeholder="Enter email"
            />
            <Form.Control.Feedback type="invalid">
              {errors.email}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>
              {user ? 'New Password (leave blank to keep current)' : 'Password'}
            </Form.Label>
            <div className="input-group">
              <Form.Control
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                isInvalid={!!errors.password}
                placeholder={user ? 'Enter new password' : 'Enter password'}
              />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
              </Button>
              <Form.Control.Feedback type="invalid">
                {errors.password}
              </Form.Control.Feedback>
            </div>
          </Form.Group>

          <Form.Group className="mb-3" controlId="isAdmin">
            <Form.Check
              type="checkbox"
              name="isAdmin"
              label="Administrator"
              checked={formData.isAdmin}
              onChange={handleChange}
            />
            <Form.Text className="text-muted">
              Administrators have full access to the system.
            </Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
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
                {user ? 'Updating...' : 'Creating...'}
              </>
            ) : user ? (
              'Update User'
            ) : (
              'Create User'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
