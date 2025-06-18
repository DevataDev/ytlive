import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Monitor } from '../types/monitor';

interface DeleteMonitorModalProps {
  show: boolean;
  monitor: Monitor | null;
  deleting: boolean;
  onHide: () => void;
  onConfirm: () => void;
}

export default function DeleteMonitorModal({
  show,
  monitor,
  deleting,
  onHide,
  onConfirm
}: DeleteMonitorModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Delete {monitor?.displayName || 'Monitor'}?
          </h3>
          <button
            onClick={onHide}
            disabled={deleting}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete this monitor? This action cannot be undone.
          </p>
          {monitor && (
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm mb-2">
                <span className="font-medium text-gray-700">Username:</span>{' '}
                <span className="font-mono text-gray-900">@{monitor.username}</span>
              </p>
              <p className="text-sm mb-0">
                <span className="font-medium text-gray-700">Display Name:</span>{' '}
                <span className="text-gray-900">{monitor.displayName}</span>
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg space-x-3">
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
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting && (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
            )}
            {deleting ? 'Deleting...' : 'Delete Monitor'}
          </button>
        </div>
      </div>
    </div>
  );
}