import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faGear, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { Stream, setStreamSchedule, setStreamDuration, setStreamLoopCount, startStream } from '@/services/streamService';

export interface StreamSettingsModalProps {
  show: boolean;
  onHide: () => void;
  stream: Stream | null;
  onStreamUpdate: () => void;
}

type StreamMode = 'LIVE' | 'SCHEDULER' | 'DURATION' | 'LOOPCOUNT';

const StreamSettingsModal: React.FC<StreamSettingsModalProps> = ({
  show,
  onHide,
  stream,
  onStreamUpdate
}) => {
  const [mode, setMode] = useState<StreamMode>('LIVE');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState(0);
  const [loopCount, setLoopCount] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper function to convert date to datetime-local format
  const toDatetimeLocal = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Initialize form when modal opens or stream changes
  useEffect(() => {
    if (show && stream) {
      resetForm();
      populateFormFromStream();
    }
  }, [show, stream]);

  const resetForm = () => {
    setMode('LIVE');
    setStartTime('');
    setEndTime('');
    setDuration(0);
    setLoopCount(-1);
    setError('');
  };

  const populateFormFromStream = () => {
    if (!stream) return;

    // Set start and end times if available
    if (stream.scheduledStartAt) {
      setStartTime(toDatetimeLocal(stream.scheduledStartAt));
    }
    if (stream.scheduledEndAt) {
      setEndTime(toDatetimeLocal(stream.scheduledEndAt));
    }

    // Calculate duration if only end time is set (no start time)
    if (!stream.scheduledStartAt && stream.scheduledEndAt) {
      const scheduleAt = stream.scheduledAt ? new Date(stream.scheduledAt) : new Date();
      const scheduleEndAt = new Date(stream.scheduledEndAt);
      const gapHours = (scheduleEndAt.getTime() - scheduleAt.getTime()) / (1000 * 60 * 60);
      setDuration(Math.round(gapHours));
    }

    // Set loop count
    if (stream.loopCount !== undefined && stream.loopCount !== null) {
      setLoopCount(stream.loopCount);
    }

    // Determine mode based on stream settings
    if (stream.scheduledStartAt) {
      setMode('SCHEDULER');
    } else if (stream.scheduledEndAt && !stream.scheduledStartAt && 
               stream.loopCount !== undefined && stream.loopCount !== null && stream.loopCount < 0) {
      setMode('DURATION');
    } else if (stream.loopCount !== undefined && stream.loopCount !== null && stream.loopCount > 0) {
      setMode('LOOPCOUNT');
    } else {
      setMode('LIVE');
    }
  };

  const handleSave = async () => {
    if (!stream) return;

    try {
      setLoading(true);
      setError('');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      switch (mode) {
        case 'LIVE':
          await setStreamSchedule(stream.id, {
            ScheduledAt: null,
            StoppedAt: null,
            Timezone: timezone
          });
          toast.success('Stream mode set to live');
          break;

        case 'SCHEDULER':
          if (!startTime) {
            setError('Please set start time.');
            return;
          }
          
          const startDate = new Date(startTime);
          const now = new Date();
          
          if (startDate < now) {
            setError('Start time cannot be earlier than current time.');
            return;
          }
          
          if (endTime) {
            const endDate = new Date(endTime);
            if (endDate <= startDate) {
              setError('End time must be after start time.');
              return;
            }
            
            await setStreamSchedule(stream.id, {
              ScheduledAt: startDate.toISOString(),
              StoppedAt: endDate.toISOString(),
              Timezone: timezone
            });
            toast.success('Stream schedule set successfully');
          } else {
            await setStreamSchedule(stream.id, {
              ScheduledAt: startDate.toISOString(),
              StoppedAt: null,
              Timezone: timezone
            });
            toast.success('Stream start time set successfully');
          }
          break;

        case 'DURATION':
          if (duration <= 0 || duration > 24) {
            setError('Duration must be between 1 and 24 hours.');
            return;
          }
          
          if (startTime) {
            const startDate = new Date(startTime);
            const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
            
            await setStreamSchedule(stream.id, {
              ScheduledAt: startDate.toISOString(),
              StoppedAt: endDate.toISOString(),
              Timezone: timezone
            });
            toast.success('Stream schedule with duration set successfully');
          } else {
            await setStreamDuration(stream.id, { DurationHours: duration });
            toast.success('Stream duration set successfully');
            // Auto-start the stream for duration mode
            await startStream(stream.id);
          }
          break;

        case 'LOOPCOUNT':
          const validLoopCount = loopCount < -1 ? -1 : loopCount;
          await setStreamLoopCount(stream.id, { LoopCount: validLoopCount });
          toast.success('Stream loop count set successfully');
          break;
      }

      onStreamUpdate();
      onHide();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderModeFields = () => {
    switch (mode) {
      case 'SCHEDULER':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </>
        );
      
      case 'DURATION':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours, 0-24)</label>
            <input
              type="number"
              min="0"
              max="24"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );
      
      case 'LOOPCOUNT':
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Loop Count</label>
            <input
              type="number"
              min="-1"
              value={loopCount}
              onChange={(e) => setLoopCount(parseInt(e.target.value) || -1)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              -1 means infinite loop. Minimum value is -1.
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

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
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FontAwesomeIcon icon={faGear} className="mr-2" />
                Stream Settings
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
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="flex">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2" />
                  <div className="text-sm text-red-700">{error}</div>
                  <button
                    onClick={() => setError('')}
                    className="ml-auto text-red-400 hover:text-red-600"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              </div>
            )}
            
            <form>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as StreamMode)}
                  disabled={loading}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="LIVE">LIVE</option>
                  <option value="SCHEDULER">SCHEDULER</option>
                  <option value="DURATION">DURATION</option>
                  <option value="LOOPCOUNT">LOOPCOUNT</option>
                </select>
              </div>
              
              {renderModeFields()}
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <button 
                onClick={onHide}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamSettingsModal;