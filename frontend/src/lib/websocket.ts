import { getSession } from 'next-auth/react';
import { configService } from './config';

type WebSocketMessage = {
  type: string;
  data: any;
};

type WebSocketCallbacks = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage: (data: any) => void;
};

export class DashboardWebSocket {
  private socket: WebSocket | null = null;
  private callbacks: WebSocketCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private shouldReconnect = true;
  private wsUrl: string;
  private apiUrl: string;

  constructor(callbacks: WebSocketCallbacks, apiUrl: string) {
    this.callbacks = callbacks;
    this.wsUrl = `${configService.getConfigSync()?.apiUrl}/ws`;
    this.apiUrl = apiUrl;
  }

  async connect() {
    try {
      const session = await getSession();
      const token = session?.user?.backendToken;
      
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      const config = await configService.getConfig();

      let baseUrl = config.apiUrl || process.env.NEXT_PUBLIC_API_URL  || process.env.API_URL 
    
      if (!baseUrl && baseUrl?.startsWith('http')) {
        // Convert http:// or https:// to ws:// or wss://
        baseUrl = baseUrl
          .replace(/^http(s?):/, 'ws$1:')
          .replace(/\/+$/, ''); // Remove trailing slashes
      }
      
      // Default to localhost if no URL is provided
      this.wsUrl = `${baseUrl || 'ws://localhost:8080'}/ws`;
      
      console.log('WebSocket URL:', this.wsUrl);

      // Create WebSocket URL with token
      const url = new URL(this.wsUrl);
      
      // Add token as query parameter
      url.searchParams.append('token', token);
      
      console.log('Connecting to WebSocket:', url.toString());
      
      // Create WebSocket connection
      this.socket = new WebSocket(url.toString());
      
      // Set binary type to arraybuffer for better performance
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log('WebSocket connected to', this.wsUrl);
        this.reconnectAttempts = 0;
        if (this.callbacks.onOpen) {
          this.callbacks.onOpen();
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.callbacks.onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.callbacks.onClose) {
          this.callbacks.onClose();
        }
        this.reconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      this.reconnect();
    }
  }

  private reconnect() {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  close() {
    this.shouldReconnect = false;
    if (this.socket) {
      this.socket.close();
    }
  }
}

export default DashboardWebSocket;
