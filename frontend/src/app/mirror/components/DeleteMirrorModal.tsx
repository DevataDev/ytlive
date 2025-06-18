import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { MirrorItem } from '@/services/mirrorService';

interface DeleteMirrorModalProps {
  show: boolean;
  mirror: MirrorItem | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteMirrorModal({
  show,
  mirror,
  deleting,
  onHide,
  onConfirm
}: DeleteMirrorModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-red-600 flex items-center gap-2">
            <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5" />
            Delete {mirror?.DisplayName || 'Mirror'}?
          </h2>
          <button
            onClick={onHide}
            disabled={deleting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            Are you sure you want to delete this mirror? This action cannot be undone.
          </p>
          
          {mirror && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-gray-700">Display Name:</span>{' '}
                  <span className="font-mono text-gray-900">{mirror.DisplayName}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Title:</span>{' '}
                  <span className="text-gray-900">{mirror.Title}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Room ID:</span>{' '}
                  <span className="font-mono text-gray-900">{mirror.RoomId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Status:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    mirror.Status?.toLowerCase() === 'live' ? 'bg-green-100 text-green-800' : 
                    mirror.Status?.toLowerCase() === 'queued' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {mirror.Status || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-800">Warning:</p>
                <p className="text-yellow-700 text-sm">
                  The mirror will be stopped if currently running, and all associated data will be permanently removed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onHide}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deleting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Mirror'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}