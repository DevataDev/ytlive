import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes, faCircle, faExclamationTriangle, faInfoCircle, faTrash, faSync, faBroadcastTower, faRepeat } from '@fortawesome/free-solid-svg-icons';
import { getSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useConfig } from '@/hooks/useConfig';

interface FfmpegLogsModalProps {
  show: boolean;
  onHide: () => void;
  itemId: string;
  itemType: 'stream' | 'mirror';
  title?: string;
}

interface LogsResponse {
  logs: string[];
}

const FfmpegLogsModal: React.FC<FfmpegLogsModalProps> = ({
  show,
  onHide,
  itemId,
  itemType,
  title = 'FFmpeg Logs'
}) => {
  const [logs, setLogs] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const logsContentRef = useRef<HTMLPreElement>(null);
  const config = useConfig();

  const scrollToBottom = () => {
    if (logsContentRef.current) {
      logsContentRef.current.scrollTop = logsContentRef.current.scrollHeight;
    }
  };

  const connectWebSocket = async () => {
    if (!itemId || !show) return;

    setIsLoading(true);
    setError(null);

    // Close existing connection
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    const session = await getSession();
    const token = session?.user?.backendToken;
    
    if (!token) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const apiUrl = config?.config?.apiUrl ?? 'http://localhost:8081';
    const wsHost = apiUrl?.replace(/^https?/, protocol);
    const wsUrl = `${wsHost}/ws/ffmpeg-logs/${itemType}/${itemId}?token=${encodeURIComponent(token)}`;

    console.log('Connecting to Logs WebSocket:', wsUrl);
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('FFmpeg logs WebSocket connected');
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
        setLogs('');
      };

      socket.onmessage = (event) => {
        setLogs(prevLogs => prevLogs + event.data + '\n');
        setTimeout(scrollToBottom, 0);
      };

      socket.onerror = () => {
        console.error('FFmpeg logs WebSocket error, falling back to HTTP');
        setIsConnected(false);
        setIsLoading(false);
        fallbackToHttp();
      };

      socket.onclose = () => {
        console.log('FFmpeg logs WebSocket disconnected');
        setIsConnected(false);
        setIsLoading(false);
        socketRef.current = null;
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsLoading(false);
      fallbackToHttp();
    }
  };

  const fallbackToHttp = async () => {
    setIsLoading(true);
    const session = await getSession();
    const token = session?.user?.backendToken;
    
    if (!token) {
      setError('Authentication required.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get<LogsResponse>(`/api/${itemType}s/${itemId}/logs`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response) {
        try {
            const text = response.logs.join('\n');
            setLogs(text);
            setError(null);
            setTimeout(scrollToBottom, 0);
        } catch (error) {
          console.error('Failed to parse logs:', error);
          setError('Failed to load logs.');
        }
      } else {
        setError('Failed to load logs.');
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setError('Failed to load logs.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsLoading(false);
    setError(null);
    onHide();
  };

  const handleReconnect = () => {
    setLogs('');
    connectWebSocket();
  };

  const clearLogs = () => {
    setLogs('');
  };

  useEffect(() => {
    if (show && itemId) {
      connectWebSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [show, itemId, itemType]);

  useEffect(() => {
    if (logs) {
      scrollToBottom();
    }
  }, [logs]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
          <span>Loading logs...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center" role="alert">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-400 mr-2" />
          {error}
        </div>
      );
    }

    return (
      <pre
        ref={logsContentRef}
        className="logs-content"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          color: '#e8e8e8',
          padding: '1.25rem',
          borderRadius: '12px',
          minHeight: '300px',
          maxHeight: '500px',
          margin: 0,
          fontSize: '0.8rem',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          border: '1px solid #404040',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#666 #333'
        }}
      >
        {logs || (
          <span style={{ color: '#888', fontStyle: 'italic' }}>
            No logs available. Logs will appear here when the {itemType} starts processing.
          </span>
        )}
      </pre>
    );
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FontAwesomeIcon 
                  icon={itemType === 'stream' ? faBroadcastTower : faRepeat} 
                  className="mr-2" 
                />
                {title}
                <div className="ml-3">
                  {isConnected ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <FontAwesomeIcon icon={faCircle} className="mr-1 text-xs" />
                      Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <FontAwesomeIcon icon={faCircle} className="mr-1 text-xs" />
                      Offline
                    </span>
                  )}
                </div>
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          </div>
          
          {/* Body */}
          <div className="bg-white">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <small className="text-gray-500 mr-3 flex items-center">
                    <FontAwesomeIcon icon={faInfoCircle} className="mr-1" />
                    Real-time FFmpeg output for {itemType} ID: <code className="ml-1 bg-gray-100 px-1 rounded">{itemId}</code>
                  </small>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={clearLogs}
                    disabled={!logs}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FontAwesomeIcon icon={faTrash} className="mr-1" />
                    Clear
                  </button>
                  <button 
                    onClick={handleReconnect}
                    disabled={isLoading}
                    className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-1" />
                    ) : (
                      <FontAwesomeIcon icon={faSync} className="mr-1" />
                    )}
                    Reconnect
                  </button>
                </div>
              </div>
              
              {renderContent()}
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <small className="text-gray-500">
                {logs.split('\n').length - 1} lines
              </small>
              <div>
                <button 
                  onClick={handleClose}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FontAwesomeIcon icon={faTimes} className="mr-1" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FfmpegLogsModal;