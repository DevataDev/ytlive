'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
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
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-red-600 flex items-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                Delete {user?.username || 'User'}?
              </h3>
              <button
                onClick={onHide}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4">
            <p className="text-gray-700 mb-4">Are you sure you want to delete this user? This action cannot be undone.</p>
            {user && (
              <div className="mb-4">
                <p className="mb-2">
                  <strong className="text-gray-900">Username:</strong> 
                  <span className="font-mono ml-2 text-gray-700">{user.username}</span>
                </p>
                <p className="mb-2">
                  <strong className="text-gray-900">Email:</strong> 
                  <span className="ml-2 text-gray-700">{user.email}</span>
                </p>
                <p className="mb-0">
                  <strong className="text-gray-900">Status:</strong>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ml-2 ${
                    user.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
            )}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-400 mr-2 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <strong>Warning:</strong> All user data and associated content will be permanently removed.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button 
                onClick={onHide}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={onConfirm}
                disabled={deleting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && (
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                )}
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}