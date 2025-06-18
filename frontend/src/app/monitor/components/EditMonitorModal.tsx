import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';
import { Monitor, MonitorFormData } from '../types/monitor';
import { getInitialsAvatar } from '@/app/channels/utils/avatarUtils';

interface EditMonitorModalProps {
  show: boolean;
  onHide: () => void;
  monitor: Monitor;
  onSave: (id: string, data: Partial<MonitorFormData>) => Promise<void>;
}

export function EditMonitorModal({ show, onHide, monitor, onSave }: EditMonitorModalProps) {
  const [formData, setFormData] = useState<Partial<MonitorFormData>>({
    isActive: monitor.isActive,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (monitor) {
      setFormData({
        isActive: monitor.isActive,
      });
    }
  }, [monitor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await onSave(monitor.id, formData);
      onHide();
    } catch (err) {
      setError('Failed to update monitor. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!monitor || !show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Edit Monitor</h3>
          <button
            onClick={onHide}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="flex items-center mb-6">
              <div className="mr-4">
                <Image
                  src={getInitialsAvatar(monitor.displayName)}
                  alt={monitor.username}
                  width={64}
                  height={64}
                  className="rounded-full object-cover"
                />
              </div>
              <div>
                <h5 className="text-lg font-medium text-gray-900 mb-1">{monitor.displayName}</h5>
                <p className="text-gray-500 text-sm">@{monitor.username}</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="monitorId" className="block text-sm font-medium text-gray-700 mb-2">
                Monitor ID
              </label>
              <input
                type="text"
                id="monitorId"
                value={monitor.id}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 font-mono text-sm"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive ?? false}
                  onChange={handleChange}
                  disabled={loading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active monitoring
                </label>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {formData.isActive 
                  ? 'This monitor is active and checking for live streams.'
                  : 'This monitor is paused and not checking for live streams.'}
              </p>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <div>Created: {new Date(monitor.createdAt).toLocaleString()}</div>
              <div>Last updated: {new Date(monitor.updatedAt).toLocaleString()}</div>
              {monitor.lastChecked && (
                <div>Last checked: {new Date(monitor.lastChecked).toLocaleString()}</div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-end px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg space-x-3">
            <button
              type="button"
              onClick={onHide}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
