import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTrash, faSpinner, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons';

interface MediaFile {
  id: string;
  file_name: string;
  stream_count: number;
}

interface Props {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void;
  file: MediaFile | null;
  loading: boolean;
}

export default function DeleteConfirmModal({ show, onHide, onConfirm, file, loading }: Props) {
  if (!file || !show) return null;

  const canDelete = file.stream_count === 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onHide}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500 mr-2" />
                Confirm Delete
              </h3>
              <button
                onClick={onHide}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4">
            {canDelete ? (
              <>
                <p className="text-gray-700 mb-4">Are you sure you want to delete this media file?</p>
                <div className="bg-gray-50 p-3 rounded-md mb-4">
                  <strong className="text-gray-900">{file.file_name}</strong>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="flex">
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-400 mr-2 mt-0.5" />
                    <span className="text-yellow-700 text-sm">
                      This action cannot be undone. The physical file will also be deleted from the server.
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-700 mb-4">
                  This media file cannot be deleted because it is currently being used in {file.stream_count} stream{file.stream_count !== 1 ? 's' : ''}.
                </p>
                <div className="bg-gray-50 p-3 rounded-md mb-4">
                  <strong className="text-gray-900">{file.file_name}</strong>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-blue-400 mr-2 mt-0.5" />
                    <span className="text-blue-700 text-sm">
                      Remove this file from all streams first before deleting it.
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              onClick={onHide}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {canDelete && (
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                    Delete File
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}