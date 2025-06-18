'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faEye, faEyeSlash, faPencil, faTrash, faKey, faSpinner, faExclamationTriangle, faSearch } from '@fortawesome/free-solid-svg-icons';
import { userService, type User, type UserListResponse } from '@/services/userService';
import { toast } from 'react-toastify';
import UserForm from './components/UserForm';
import PasswordUpdateModal from './components/PasswordUpdateModal';
import DeleteUserModal from './components/DeleteUserModal';

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
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      await userService.deleteUser(userToDelete.id);
      toast.success('User deleted successfully');
      setUserToDelete(null);
      fetchUsers(pagination.page, searchTerm);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
  };

  // Toggle user active status
  const toggleUserStatus = async (user: User) => {
    try {
      await userService.toggleUserStatus(user.id, !user.is_active);
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'} successfully`);
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

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                Add User
              </button>
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="mt-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  <FontAwesomeIcon icon={faSearch} />
                </button>
              </div>
            </form>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2 mt-0.5" />
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-blue-500" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {user.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.is_admin ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  User
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.is_active ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => toggleUserStatus(user)}
                                  title={user.is_active ? 'Deactivate' : 'Activate'}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <FontAwesomeIcon icon={user.is_active ? faEyeSlash : faEye} />
                                </button>
                                <button
                                  onClick={() => setEditingUser(user)}
                                  title="Edit"
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  <FontAwesomeIcon icon={faPencil} />
                                </button>
                                <button
                                  onClick={() => setPasswordUpdateUser(user)}
                                  title="Change Password"
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <FontAwesomeIcon icon={faKey} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(user)}
                                  title="Delete"
                                  disabled={user.id === session?.user?.id}
                                  className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination.totalPages > 1 && (
                  <div className="mt-6 flex justify-center">
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          disabled={pagination.page === pageNum}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pagination.page === pageNum
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          } ${pageNum === 1 ? 'rounded-l-md' : ''} ${
                            pageNum === pagination.totalPages ? 'rounded-r-md' : ''
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

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

        {/* Delete User Modal */}
        <DeleteUserModal
          show={!!userToDelete}
          user={userToDelete}
          deleting={deleting}
          onHide={() => setUserToDelete(null)}
          onConfirm={handleDeleteUser}
        />
      </div>
    </div>
  );
}
