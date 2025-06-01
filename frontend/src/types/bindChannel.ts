export interface Channel {
  ID: string;
  ChannelName: string;
  // Add other channel properties as needed
}

export interface LiveStream {
  stream_key: string;
  title: string;
  id?: string;
  // Add other stream properties as needed
}

export interface BindChannelModalProps {
  show: boolean;
  onHide: () => void;
  onBind: (channelId: string, streamKey: string) => Promise<void>;
  fetchChannels: () => Promise<Channel[]>;
  fetchStreams: (channelId: string) => Promise<LiveStream[]>;
  title?: string;
  streamName?: string;
  loading?: boolean;
  error?: string;
}
