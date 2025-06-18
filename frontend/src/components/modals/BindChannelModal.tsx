'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faPlay, faKey, faTimes, faLink, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
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

  const resetForm = useCallback(() => {
    setSelectedChannelId('');
    setSelectedStreamKey('');
    setStreamKey('');
    setLocalError('');
    setIsBinding(false);
    setChannels([]);
    setStreams([]);
  }, []);

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
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!isFormValid) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    try {
      setIsBinding(true);
      setLocalError('');
      
      const finalStreamKey = selectedStreamKey === 'custom' ? streamKey : selectedStreamKey;
      
      await onBind(selectedChannelId, finalStreamKey);
      onHide();
    } catch (err) {
      console.error('Failed to bind channel:', err);
      setLocalError('Failed to bind channel. Please try again.');
    } finally {
      setIsBinding(false);
    }
  }, [isFormValid, selectedChannelId, selectedStreamKey, streamKey, onBind, onHide]);

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
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <button
                onClick={onHide}
                className="text-gray-400 hover:text-gray-600"
                disabled={loading || isBinding}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            {streamName && (
              <p className="mt-2 text-sm text-gray-600">
                Stream: <span className="font-medium">{streamName}</span>
              </p>
            )}
          </div>

          {/* Body */}
          <div className="bg-white px-6 py-4">
            {(isLoadingChannels && channels.length === 0) ? (
              <div className="flex items-center justify-center py-8">
                <FontAwesomeIcon icon={faSpinner} className="text-xl text-gray-400 animate-spin mr-2" />
                <span className="text-gray-600">Loading channels...</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube Channel
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {isLoadingChannels ? (
                        <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faPlay} className="text-gray-400" />
                      )}
                    </div>
                    <select
                      value={selectedChannelId}
                      onChange={handleChannelChange}
                      disabled={isLoadingChannels || loading}
                      required
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a channel</option>
                      {channels.map((channel) => (
                        <option key={channel.ID} value={channel.ID}>
                          {channel.ChannelName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stream Key
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {isLoadingStreams ? (
                        <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin" />
                      ) : (
                        <FontAwesomeIcon icon={faKey} className="text-gray-400" />
                      )}
                    </div>
                    <select
                      value={selectedStreamKey}
                      onChange={handleStreamChange}
                      disabled={!selectedChannelId || isLoadingStreams || loading}
                      required
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a stream key</option>
                      {streams.map((stream) => (
                        <option key={stream.id} value={stream.stream_key}>
                          {stream.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedStreamKey === 'custom' ? 'Enter your custom stream key' : 'Select a stream key from the list'}
                  </p>
                </div>

                {selectedStreamKey === 'custom' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Stream Key
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FontAwesomeIcon icon={faKey} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={streamKey}
                        onChange={(e) => setStreamKey(e.target.value)}
                        placeholder="Enter custom stream key"
                        disabled={loading}
                        required
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2 mt-0.5" />
                      <span className="text-red-700 text-sm">{error}</span>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <button
              onClick={onHide}
              disabled={loading || isBinding}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <FontAwesomeIcon icon={faTimes} className="mr-1" />
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid || loading || isBinding}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isBinding ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                  Binding...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faLink} className="mr-1" />
                  Bind Channel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BindChannelModal;
