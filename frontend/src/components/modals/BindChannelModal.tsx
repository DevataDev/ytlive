'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { Channel, LiveStream, BindChannelModalProps } from '@/types/bindChannel';
import { fetchListYoutubeChannels, fetchChannelStreamKeys } from '@/services/channelService';

const BindChannelModal: React.FC<BindChannelModalProps> = ({
  show,
  onHide,
  onBind,
  fetchChannels,
  fetchStreams,
  title = 'Bind Channel to Stream',
  streamName = '',
  loading = false,
  error: propError = '',
}) => {   
  const [channels, setChannels] = useState<Channel[]>([]);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [selectedStreamKey, setSelectedStreamKey] = useState<string>('');
  const [isLoadingChannels, setIsLoadingChannels] = useState<boolean>(false);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string>('');
  const [isBinding, setIsBinding] = useState<boolean>(false);
  const [streamKey, setStreamKey] = useState<string>('');
  
  // Use the error prop if provided, otherwise use local error state
  const error = propError || localError;

  // Reset form when modal is shown/hidden
  useEffect(() => {
    if (show) {
      loadChannels();
    } else {
      resetForm();
    }
  }, [show]);

  const loadStreams = useCallback(async (channelId: string) => {
    try {
      setIsLoadingStreams(true);
      setLocalError('');
      const data = await fetchChannelStreamKeys(channelId);
      updateChannelStreamKeys(data.streams);
    } catch (err) {
      console.error('Failed to load streams:', err);
      setLocalError('Failed to load streams. Please try again.');
    } finally {
      setIsLoadingStreams(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setIsLoadingChannels(true);
      setLocalError('');
      const response = await fetchListYoutubeChannels();
      setChannels(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Failed to load channels:', err);
      setLocalError('Failed to load channels. Please try again.');
    } finally {
      setIsLoadingChannels(false);
    }
  }, []);

  const updateChannelStreamKeys = useCallback((streamKeys: any[]) => {
    const liveStreams: LiveStream[] = [];
    
    // Add a custom stream key option
    liveStreams.push({
      stream_key: 'custom',
      title: 'Use custom stream key',
      id: 'custom'
    });
    
    // Add the fetched stream keys
    const validStreams = streamKeys
      .filter(streamKey => streamKey.title && streamKey.stream_key)
      .map(streamKey => ({
        stream_key: streamKey.stream_key,
        title: streamKey.title,
        id: streamKey.id
      }));
    
    setStreams([...liveStreams, ...validStreams]);
  }, []);

  // Handle channel selection change
  const handleChannelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const channelId = e.target.value;
    setSelectedChannelId(channelId);
    setSelectedStreamKey('');
    setLocalError('');
    if (channelId) {
      loadStreams(channelId);
    } else {
      setStreams([]);
    }
  }, [loadStreams]);

  // Handle stream selection change
  const handleStreamChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedKey = e.target.value;
    setSelectedStreamKey(selectedKey);
    setLocalError('');
    
    // If custom stream key is selected, clear any selected stream
    if (selectedKey === 'custom') {
      setStreamKey('');
    }
  }, []);
  
  // Memoize the form validation
  const isFormValid = useMemo(() => {
    return !!selectedChannelId && (
      (!!selectedStreamKey && selectedStreamKey !== 'custom') || 
      (selectedStreamKey === 'custom' && !!streamKey.trim())
    );
  }, [selectedChannelId, selectedStreamKey, streamKey]);
  
  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) {
      setLocalError('Please fill in all required fields');
      return;
    }

    try {
      setIsBinding(true);
      setLocalError('');
      
      // Get the final stream key to use
      let finalStreamKey = '';
      
      if (selectedStreamKey === 'custom') {
        // Use the custom stream key
        finalStreamKey = streamKey.trim();
      } else {
        // Find the selected stream to get its key
        const selectedStream = streams.find(s => s.stream_key === selectedStreamKey);
        if (!selectedStream) {
          throw new Error('Selected stream not found');
        }
        finalStreamKey = selectedStream.stream_key;
      }
      
      if (!finalStreamKey) {
        throw new Error('No stream key provided');
      }
      
      await onBind(selectedChannelId, finalStreamKey);
      onHide();
    } catch (err) {
      console.error('Failed to bind channel:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to bind channel');
      throw err;
    } finally {
      setIsBinding(false);
    }
  }, [isFormValid, selectedChannelId, selectedStreamKey, streamKey, streams, onBind, onHide]);

  const resetForm = useCallback(() => {
    setSelectedChannelId('');
    setSelectedStreamKey('');
    setStreamKey('');
    setLocalError('');
  }, []);

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title className="d-flex align-items-center">
          <i className="bi bi-link-45deg me-2"></i>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {streamName && (
          <div className="mb-4">
            <h5 className="mb-0">
              <i className="bi bi-cast me-2"></i>
              <span className="text-primary">{streamName}</span>
            </h5>
          </div>
        )}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-4">
            <Form.Label className="fw-medium">YouTube Channel</Form.Label>
            <div className="input-group">
              <span className="input-group-text bg-light">
                {isLoadingChannels ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <i className="bi bi-collection-play"></i>
                )}
              </span>
              <Form.Select 
                value={selectedChannelId} 
                onChange={handleChannelChange}
                disabled={isLoadingChannels || loading}
                required
              >
                <option value="">Select a channel</option>
                {channels.map((channel) => (
                  <option key={channel.ID} value={channel.ID}>
                    {channel.ChannelName}
                  </option>
                ))}
              </Form.Select>
            </div>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="fw-medium">Stream Key</Form.Label>
            <div className="input-group">
              <span className="input-group-text bg-light">
                {isLoadingStreams ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <i className="bi bi-key"></i>
                )}
              </span>
              <Form.Select 
                value={selectedStreamKey} 
                onChange={handleStreamChange}
                disabled={!selectedChannelId || isLoadingStreams || loading}
                required
              >
                <option value="">Select a stream key</option>
                {streams.map((stream) => (
                  <option key={stream.id} value={stream.stream_key}>
                    {stream.title}
                  </option>
                ))}
              </Form.Select>
            </div>
            <Form.Text className="text-muted">
              {selectedStreamKey === 'custom' ? 'Enter your custom stream key' : 'Select a stream key from the list'}
            </Form.Text>
          </Form.Group>

          {selectedStreamKey === 'custom' && (
            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">Custom Stream Key</Form.Label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-key-fill"></i>
                </span>
                <Form.Control
                  type="text"
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  placeholder="Enter custom stream key"
                  disabled={loading}
                  required
                />
              </div>
            </Form.Group>
          )}

          {error && (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer className="bg-light">
        <Button 
          variant="outline-secondary" 
          onClick={onHide}
          disabled={loading || isBinding}
          className="d-flex align-items-center"
        >
          <i className="bi bi-x-circle me-1"></i>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid || loading || isBinding}
          className="d-flex align-items-center"
        >
          {isBinding ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-2" />
              Binding...
            </>
          ) : (
            <>
              <i className="bi bi-link-45deg me-1"></i>
              Bind Channel
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BindChannelModal;
