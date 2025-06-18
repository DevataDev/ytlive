'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
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
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onHide}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Delete {channel?.ChannelName || 'Channel'}?
              </h3>
              <button
                onClick={onHide}
                className="text-gray-400 hover:text-gray-600"
                disabled={deleting}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4">
            <p className="text-gray-700 mb-4">Are you sure you want to delete this channel? This action cannot be undone.</p>
            {channel && (
              <p className="mb-0 text-gray-600">
                <strong>Channel ID:</strong> <span className="font-mono text-sm">{channel.ID}</span>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
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
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {deleting && (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
              )}
              {deleting ? 'Deleting...' : 'Delete Channel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}