import React, { useState } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';

interface Platform {
  id: string;
  name: string;
  rtmpUrl: string;
  icon?: string;
  requiresStreamKey: boolean;
}

const STREAMING_PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube Live',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
    icon: 'bi-youtube',
    requiresStreamKey: true
  },
  {
    id: 'facebook',
    name: 'Facebook',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    icon: 'bi-facebook',
    requiresStreamKey: true
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    rtmpUrl: 'rtmp://push.tiktokcdn.com/live/',
    icon: 'bi-tiktok',
    requiresStreamKey: true
  },
  {
    id: 'shopee',
    name: 'Shopee',
    rtmpUrl: '',
    icon: 'bi-shop',
    requiresStreamKey: true
  },
  {
    id: 'twitch',
    name: 'Twitch',
    rtmpUrl: 'rtmp://jkt02.contribute.live-video.net/app/',
    icon: 'bi-twitch',
    requiresStreamKey: true
  },
  {
    id: 'kick',
    name: 'Kick.com',
    rtmpUrl: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app/',
    icon: 'bi-broadcast',
    requiresStreamKey: true
  },
  {
    id: 'custom',
    name: 'Custom RTMP',
    rtmpUrl: '',
    icon: 'bi-gear',
    requiresStreamKey: false
  }
];

interface PlatformSelectorProps {
  selectedPlatform?: string;
  customRtmpUrl?: string;
  streamKey?: string;
  onPlatformChange: (platform: Platform) => void;
  onCustomRtmpChange: (url: string) => void;
  onStreamKeyChange: (key: string) => void;
  onSave: () => void;
  isLoading?: boolean;
  showStreamKey?: boolean;
  onToggleStreamKeyVisibility?: () => void;
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  selectedPlatform = 'youtube',
  customRtmpUrl = '',
  streamKey = '',
  onPlatformChange,
  onCustomRtmpChange,
  onStreamKeyChange,
  onSave,
  isLoading = false,
  showStreamKey = false,
  onToggleStreamKeyVisibility
}) => {
  const [currentPlatform, setCurrentPlatform] = useState<Platform>(
    STREAMING_PLATFORMS.find(p => p.id === selectedPlatform) || STREAMING_PLATFORMS[0]
  );

  const handlePlatformSelect = (platform: Platform) => {
    setCurrentPlatform(platform);
    onPlatformChange(platform);
  };

  const isCustom = currentPlatform.id === 'custom' || currentPlatform.id == 'shopee';
  const finalRtmpUrl = isCustom ? customRtmpUrl : currentPlatform.rtmpUrl;

  return (
    <div className="platform-selector">
      {/* Platform Selection */}
      <div className="mb-3">
        <Form.Label className="small text-muted mb-2">Streaming Platform</Form.Label>
        <div className="row g-2">
          {STREAMING_PLATFORMS.map((platform) => (
            <div key={platform.id} className="col-6 col-md-4">
              <Button
                variant={currentPlatform.id === platform.id ? 'primary' : 'outline-secondary'}
                size="sm"
                className="w-100 d-flex align-items-center justify-content-center"
                onClick={() => handlePlatformSelect(platform)}
                style={{ minHeight: '40px' }}
              >
                {platform.icon && <i className={`${platform.icon} me-1`}></i>}
                <span className="small">{platform.name}</span>
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* RTMP URL Display/Input */}
      <div className="mb-3">
        <Form.Label className="small text-muted mb-1">
          RTMP URL
          {!isCustom && (
            <span className="badge bg-success ms-2 small">Auto-configured</span>
          )}
        </Form.Label>
        <InputGroup size="sm">
          <InputGroup.Text>
            <i className="bi bi-link-45deg"></i>
          </InputGroup.Text>
          <Form.Control
            type="text"
            value={finalRtmpUrl}
            onChange={(e) => onCustomRtmpChange(e.target.value)}
            placeholder={isCustom ? "Enter custom RTMP URL" : "Auto-configured"}
            readOnly={!isCustom}
            className={!isCustom ? 'bg-light' : ''}
          />
          <Button
            variant="outline-success"
            onClick={onSave}
            disabled={isLoading || (!isCustom && !finalRtmpUrl)}
            title="Save RTMP URL"
          >
            {isLoading ? (
              <div className="spinner-border spinner-border-sm" role="status"></div>
            ) : (
              <i className="bi bi-check-lg"></i>
            )}
          </Button>
        </InputGroup>
        {!isCustom && (
          <Form.Text className="text-muted">
            <i className="bi bi-info-circle me-1"></i>
            This URL is automatically configured for {currentPlatform.name}
          </Form.Text>
        )}
      </div>

      {/* Stream Key Input */}
      {currentPlatform.requiresStreamKey && (
        <div className="mb-3">
          <Form.Label className="small text-muted mb-1">Stream Key</Form.Label>
          <InputGroup size="sm">
            <InputGroup.Text>
              <i className="bi bi-key"></i>
            </InputGroup.Text>
            <Form.Control
              type={showStreamKey ? 'text' : 'password'}
              value={streamKey}
              onChange={(e) => onStreamKeyChange(e.target.value)}
              placeholder={`Enter your ${currentPlatform.name} stream key`}
            />
            {onToggleStreamKeyVisibility && (
              <Button
                variant="outline-secondary"
                onClick={onToggleStreamKeyVisibility}
                title={showStreamKey ? 'Hide stream key' : 'Show stream key'}
              >
                <i className={`bi ${showStreamKey ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </Button>
            )}
          </InputGroup>
          <Form.Text className="text-muted">
            <i className="bi bi-shield-lock me-1"></i>
            Get your stream key from your {currentPlatform.name} dashboard
          </Form.Text>
        </div>
      )}

      {/* Platform-specific Instructions */}
      {currentPlatform.id !== 'custom' && (
        <div className="alert alert-info py-2 px-3">
          <div className="small">
            <strong>How to get your {currentPlatform.name} stream key:</strong>
            <ul className="mb-0 mt-1 ps-3">
              {currentPlatform.id === 'youtube' && (
                <>
                  <li>Go to YouTube Studio → Create → Go Live</li>
                  <li>Copy the "Stream key" from the stream settings</li>
                </>
              )}
              {currentPlatform.id === 'facebook' && (
                <>
                  <li>Go to Facebook → Create → Live Video</li>
                  <li>Copy the "Stream Key" from the setup page</li>
                </>
              )}
              {currentPlatform.id === 'tiktok' && (
                <>
                  <li>Open TikTok app → Go Live → More options</li>
                  <li>Copy the "Server URL" stream key</li>
                </>
              )}
              {currentPlatform.id === 'twitch' && (
                <>
                  <li>Go to Twitch Creator Dashboard → Settings → Stream</li>
                  <li>Copy the "Primary Stream key"</li>
                </>
              )}
              {currentPlatform.id === 'kick' && (
                <>
                  <li>Go to Kick Dashboard → Settings → Stream</li>
                  <li>Copy the "Stream Key"</li>
                </>
              )}
              {currentPlatform.id === 'shopee' && (
                <>
                  <li>Go to Shopee Live Creator Center</li>
                  <li>Copy the "Stream Key" from live settings</li>
                </>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformSelector;
export { STREAMING_PLATFORMS, type Platform };