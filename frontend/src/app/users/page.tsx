'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Container, Row, Col, Card, Button, Spinner, Alert } from 'react-bootstrap';
import { FaPlus, FaEye, FaEyeSlash, FaEdit, FaTrash, FaKey } from 'react-icons/fa';
import { userService, type User, type UserListResponse } from '@/services/userService';
import { toast } from 'react-toastify';
import UserForm from './components/UserForm';
import PasswordUpdateModal from './components/PasswordUpdateModal';

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUpdateUser, setPasswordUpdateUser] = useState<User | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Check if user is admin
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !session?.user?.isAdmin) {
      router.push('/dashboard');
      toast.error('You do not have permission to access this page.');
    }
  }, [status, session, router]);

  // Fetch users
  const fetchUsers = async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      const data = await userService.getUsers(page, pagination.limit, search);
      setUsers(data.users);
      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
      toast.error(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (session?.user?.isAdmin) {
      fetchUsers();
    }
  }, [session]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchUsers(newPage, searchTerm);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers(1, searchTerm);
  };

  // Handle create user
  const handleCreateUser = async (userData: any) => {
    try {
      await userService.createUser(userData);
      toast.success('User created successfully');
      setShowAddModal(false);
      fetchUsers(pagination.page, searchTerm);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    }
  };

  // Handle update user
  const handleUpdateUser = async (userId: string, userData: any) => {
    try {
      await userService.updateUser(userId, userData);
      toast.success('User updated successfully');
      setEditingUser(null);
      fetchUsers(pagination.page, searchTerm);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
  };

  // Handle delete user
  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await userService.deleteUser(userId);
        toast.success('User deleted successfully');
        fetchUsers(pagination.page, searchTerm);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete user');
      }
    }
  };

  // Toggle user active status
  const toggleUserStatus = async (user: User) => {
    try {
      await userService.toggleUserStatus(user.id, !user.is_active);
      toast.success(`User ${!user.is_active ? 'activated' : 'deactivated'} successfully`);
      fetchUsers(pagination.page, searchTerm);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user status');
    }
  };

  // Handle password update
  const handlePasswordUpdate = async (newPassword: string) => {
    if (!passwordUpdateUser) return;
    
    try {
      await userService.updateUserPassword(passwordUpdateUser.id, newPassword);
      toast.success('Password updated successfully');
      setPasswordUpdateUser(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <div className="container-xxl">
        <Card className="shadow-sm mb-4">
          <Card.Body className="p-4">
            <Row className="align-items-center mb-4">
              <Col md={6} className="mb-3 mb-md-0">
                <h5 className="mb-0">
                  <i className="bi bi-people text-primary me-2"></i>
                  User Management
                </h5>
              </Col>
              <Col md={6} className="text-md-end">
                <Button
                  variant="primary"
                  onClick={() => setShowAddModal(true)}
                  className="d-inline-flex align-items-center"
                >
                  <FaPlus className="me-2" />
                  Add User
                </Button>
              </Col>
            </Row>

            <form onSubmit={handleSearch} className="mb-4">
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button type="submit" variant="outline-secondary">
                  Search
                </Button>
              </div>
            </form>

            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Admin</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center">
                        {loading ? 'Loading...' : 'No users found'}
                      </td>
                    </tr>
                  ) : (
                    users?.map((user) => (
                      <tr key={user.id}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>
                          {user.is_admin ? (
                            <span className="badge bg-success">Yes</span>
                          ) : (
                            <span className="badge bg-secondary">No</span>
                          )}
                        </td>
                        <td>
                          {user.is_active ? (
                            <span className="badge bg-success">Active</span>
                          ) : (
                            <span className="badge bg-danger">Inactive</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-group" role="group">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="me-2"
                              onClick={() => toggleUserStatus(user)}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? <FaEyeSlash /> : <FaEye />}
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-2"
                              onClick={() => setEditingUser(user)}
                              title="Edit"
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              variant="outline-info"
                              size="sm"
                              className="me-2"
                              onClick={() => setPasswordUpdateUser(user)}
                              title="Change Password"
                            >
                              <FaKey />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                              title="Delete"
                              disabled={user.id === session?.user?.id}
                            >
                              <FaTrash />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <nav className="mt-4">
                <ul className="pagination justify-content-center">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(pageNum)}
                        disabled={pagination.page === pageNum}
                      >
                        {pageNum}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </Card.Body>
        </Card>

        {/* Add/Edit User Modal */}
        <UserForm
          show={showAddModal || !!editingUser}
          onHide={() => {
            setShowAddModal(false);
            setEditingUser(null);
          }}
          onSubmit={editingUser ? 
            (data) => handleUpdateUser(editingUser.id, data) : 
            handleCreateUser}
          user={editingUser}
        />

        {/* Password Update Modal */}
        <PasswordUpdateModal
          show={!!passwordUpdateUser}
          onHide={() => setPasswordUpdateUser(null)}
          onSubmit={handlePasswordUpdate}
          user={passwordUpdateUser}
        />
      </div>
    </Container>
  );
}
