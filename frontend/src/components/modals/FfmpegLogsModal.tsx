import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Spinner, Badge } from 'react-bootstrap';
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

    const config = await useConfig();

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
    setLogs('');
    onHide();
  };

  const handleReconnect = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
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
    scrollToBottom();
  }, [logs]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '200px' }}>
          <Spinner animation="border" variant="primary" className="me-2" />
          <span>Loading logs...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
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

  return (
    <Modal 
      show={show} 
      onHide={handleClose} 
      size="xl"
      centered
      backdrop="static"
    >
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="d-flex align-items-center">
          <i className={`bi bi-${itemType === 'stream' ? 'broadcast' : 'arrow-repeat'} me-2`}></i>
          {title}
          <div className="ms-3">
            {isConnected ? (
              <Badge bg="success" className="d-flex align-items-center">
                <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.6rem' }}></i>
                Live
              </Badge>
            ) : (
              <Badge bg="secondary" className="d-flex align-items-center">
                <i className="bi bi-circle me-1" style={{ fontSize: '0.6rem' }}></i>
                Offline
              </Badge>
            )}
          </div>
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="p-0">
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center">
              <small className="text-muted me-3">
                <i className="bi bi-info-circle me-1"></i>
                Real-time FFmpeg output for {itemType} ID: <code>{itemId}</code>
              </small>
            </div>
            <div className="d-flex gap-2">
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={clearLogs}
                disabled={!logs}
              >
                <i className="bi bi-trash3"></i> Clear
              </Button>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={handleReconnect}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Spinner animation="border" size="sm" className="me-1" />
                ) : (
                  <i className="bi bi-arrow-clockwise me-1"></i>
                )}
                Reconnect
              </Button>
            </div>
          </div>
          
          {renderContent()}
        </div>
      </Modal.Body>
      
      <Modal.Footer className="border-top">
        <div className="d-flex justify-content-between align-items-center w-100">
          <small className="text-muted">
            {logs.split('\n').length - 1} lines
          </small>
          <div>
            <Button variant="secondary" onClick={handleClose}>
              <i className="bi bi-x-lg me-1"></i>
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default FfmpegLogsModal;