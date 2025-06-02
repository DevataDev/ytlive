import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
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
    if (stream.ScheduledStartAt) {
      setStartTime(toDatetimeLocal(stream.ScheduledStartAt));
    }
    if (stream.ScheduledEndAt) {
      setEndTime(toDatetimeLocal(stream.ScheduledEndAt));
    }

    // Calculate duration if only end time is set (no start time)
    if (!stream.ScheduledStartAt && stream.ScheduledEndAt) {
      const scheduleAt = stream.ScheduledAt ? new Date(stream.ScheduledAt) : new Date();
      const scheduleEndAt = new Date(stream.ScheduledEndAt);
      const gapHours = (scheduleEndAt.getTime() - scheduleAt.getTime()) / (1000 * 60 * 60);
      setDuration(Math.round(gapHours));
    }

    // Set loop count
    if (stream.LoopCount !== undefined && stream.LoopCount !== null) {
      setLoopCount(stream.LoopCount);
    }

    // Determine mode based on stream settings
    if (stream.ScheduledStartAt) {
      setMode('SCHEDULER');
    } else if (stream.ScheduledEndAt && !stream.ScheduledStartAt && 
               stream.LoopCount !== undefined && stream.LoopCount !== null && stream.LoopCount < 0) {
      setMode('DURATION');
    } else if (stream.LoopCount !== undefined && stream.LoopCount !== null && stream.LoopCount > 0) {
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
          await setStreamSchedule(stream.ID, {
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
          }
          
          await setStreamSchedule(stream.ID, {
            ScheduledAt: startTime,
            StoppedAt: endTime || null,
            Timezone: timezone
          });
          toast.success('Stream schedule set successfully');
          break;

        case 'DURATION':
          if (duration < 0 || duration > 24) {
            setError('Duration must be 0-24 hours.');
            return;
          }
          
          if (duration === 0) {
            await setStreamSchedule(stream.ID, {
              ScheduledAt: null,
              StoppedAt: null,
              Timezone: timezone
            });
            toast.success('Stream mode set to live');
          } else {
            await setStreamDuration(stream.ID, { DurationHours: duration });
            toast.success('Stream duration set successfully');
            // Auto-start the stream for duration mode
            await startStream(stream.ID);
          }
          break;

        case 'LOOPCOUNT':
          const validLoopCount = loopCount < -1 ? -1 : loopCount;
          await setStreamLoopCount(stream.ID, { LoopCount: validLoopCount });
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
            <Form.Group className="mb-3">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Form.Group>
          </>
        );
      
      case 'DURATION':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Duration (hours, 0-24)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              max="24"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
            />
          </Form.Group>
        );
      
      case 'LOOPCOUNT':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Loop Count</Form.Label>
            <Form.Control
              type="number"
              min="-1"
              value={loopCount}
              onChange={(e) => setLoopCount(parseInt(e.target.value) || -1)}
            />
            <Form.Text className="text-muted">
              -1 means infinite loop. Minimum value is -1.
            </Form.Text>
          </Form.Group>
        );
      
      default:
        return null;
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-gear me-2"></i>
          Stream Settings
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Mode</Form.Label>
            <Form.Select
              value={mode}
              onChange={(e) => setMode(e.target.value as StreamMode)}
              disabled={loading}
            >
              <option value="LIVE">LIVE</option>
              <option value="SCHEDULER">SCHEDULER</option>
              <option value="DURATION">DURATION</option>
              <option value="LOOPCOUNT">LOOPCOUNT</option>
            </Form.Select>
          </Form.Group>
          
          {renderModeFields()}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StreamSettingsModal;