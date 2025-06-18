import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faYoutube,
  faFacebook,
  faTiktok,
  faTwitch
} from '@fortawesome/free-brands-svg-icons';
import {
  faLink,
  faKey,
  faEye,
  faEyeSlash,
  faCheck,
  faInfoCircle,
  faShieldAlt,
  faGear,
  faBroadcastTower,
  faStore,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';

interface Platform {
  id: string;
  name: string;
  rtmpUrl: string;
  icon?: string;
  requiresStreamKey: boolean;
  isDynamicRtmpUrl?: boolean;
}

const STREAMING_PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube Live',
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2/',
    icon: 'youtube',
    requiresStreamKey: true,
    isDynamicRtmpUrl: false
  },
  {
    id: 'facebook',
    name: 'Facebook',
    rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    icon: 'facebook',
    requiresStreamKey: true,
    isDynamicRtmpUrl: false
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    rtmpUrl: '',
    icon: 'tiktok',
    requiresStreamKey: true,
    isDynamicRtmpUrl: true
  },
  {
    id: 'shopee',
    name: 'Shopee',
    rtmpUrl: '',
    icon: 'store',
    requiresStreamKey: true,
    isDynamicRtmpUrl: true
  },
  {
    id: 'twitch',
    name: 'Twitch',
    rtmpUrl: 'rtmp://jkt02.contribute.live-video.net/app/',
    icon: 'twitch',
    requiresStreamKey: true,
    isDynamicRtmpUrl: false
  },
  {
    id: 'kick',
    name: 'Kick.com',
    rtmpUrl: 'rtmps://fa723fc1b171.global-contribute.live-video.net/app/',
    icon: 'broadcast',
    requiresStreamKey: true,
    isDynamicRtmpUrl: false
  },
  {
    id: 'custom',
    name: 'Custom RTMP',
    rtmpUrl: '',
    icon: 'gear',
    requiresStreamKey: false,
    isDynamicRtmpUrl: true
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

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'youtube': return faYoutube;
      case 'facebook': return faFacebook;
      case 'tiktok': return faTiktok;
      case 'twitch': return faTwitch;
      case 'store': return faStore;
      case 'broadcast': return faBroadcastTower;
      case 'gear': return faGear;
      default: return faBroadcastTower;
    }
  };

  const isCustom = currentPlatform.id === 'custom' || currentPlatform.id == 'shopee' || currentPlatform.isDynamicRtmpUrl == true;
  const finalRtmpUrl = isCustom ? customRtmpUrl : currentPlatform.rtmpUrl;

  return (
    <div className="platform-selector">
      {/* Platform Selection */}
      <div className="mb-4">
        <label className="block text-sm text-gray-600 mb-2">Streaming Platform</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {STREAMING_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              className={`
                flex items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 min-h-[50px]
                ${currentPlatform.id === platform.id 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              onClick={() => handlePlatformSelect(platform)}
            >
              {platform.icon && (
                <FontAwesomeIcon 
                  icon={getIcon(platform.icon)} 
                  className="mr-2 text-lg" 
                />
              )}
              <span className="text-sm font-medium">{platform.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* RTMP URL Display/Input */}
      <div className="mb-4">
        <div className="flex items-center mb-2">
          <label className="text-sm text-gray-600">RTMP URL</label>
          {!isCustom && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Auto-configured
            </span>
          )}
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden">
          <div className="flex items-center justify-center px-3 bg-gray-50 border-r border-gray-300">
            <FontAwesomeIcon icon={faLink} className="text-gray-500" />
          </div>
          <input
            type="text"
            value={finalRtmpUrl}
            onChange={(e) => onCustomRtmpChange(e.target.value)}
            placeholder={isCustom ? "Enter custom RTMP URL" : "Auto-configured"}
            readOnly={!isCustom}
            className={`
              flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
              ${!isCustom ? 'bg-gray-50 text-gray-600' : 'bg-white'}
            `}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={isLoading || (!isCustom && !finalRtmpUrl)}
            className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            title="Save RTMP URL"
          >
            {isLoading ? (
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            ) : (
              <FontAwesomeIcon icon={faCheck} />
            )}
          </button>
        </div>
        {!isCustom && (
          <p className="mt-2 text-sm text-gray-500 flex items-center">
            <FontAwesomeIcon icon={faInfoCircle} className="mr-1" />
            This URL is automatically configured for {currentPlatform.name}
          </p>
        )}
      </div>

      {/* Stream Key Input */}
      {currentPlatform.requiresStreamKey && (
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Stream Key</label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <div className="flex items-center justify-center px-3 bg-gray-50 border-r border-gray-300">
              <FontAwesomeIcon icon={faKey} className="text-gray-500" />
            </div>
            <input
              type={showStreamKey ? 'text' : 'password'}
              value={streamKey}
              onChange={(e) => onStreamKeyChange(e.target.value)}
              placeholder={`Enter your ${currentPlatform.name} stream key`}
              className="flex-1 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {onToggleStreamKeyVisibility && (
              <button
                type="button"
                onClick={onToggleStreamKeyVisibility}
                className="px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title={showStreamKey ? 'Hide stream key' : 'Show stream key'}
              >
                <FontAwesomeIcon icon={showStreamKey ? faEyeSlash : faEye} />
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500 flex items-center">
            <FontAwesomeIcon icon={faShieldAlt} className="mr-1" />
            Get your stream key from your {currentPlatform.name} dashboard
          </p>
        </div>
      )}

      {/* Platform-specific Instructions */}
      {currentPlatform.id !== 'custom' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm">
            <p className="font-semibold text-blue-800 mb-2">
              How to get your {currentPlatform.name} stream key:
            </p>
            <ul className="text-blue-700 space-y-1 pl-4">
              {currentPlatform.id === 'youtube' && (
                <>
                  <li>• Go to YouTube Studio → Create → Go Live</li>
                  <li>• Copy the "Stream key" from the stream settings</li>
                </>
              )}
              {currentPlatform.id === 'facebook' && (
                <>
                  <li>• Go to Facebook → Create → Live Video</li>
                  <li>• Copy the "Stream Key" from the setup page</li>
                </>
              )}
              {currentPlatform.id === 'tiktok' && (
                <>
                  <li>• Open TikTok app → Go Live → More options</li>
                  <li>• Copy the "Server URL" stream key</li>
                </>
              )}
              {currentPlatform.id === 'twitch' && (
                <>
                  <li>• Go to Twitch Creator Dashboard → Settings → Stream</li>
                  <li>• Copy the "Primary Stream key"</li>
                </>
              )}
              {currentPlatform.id === 'kick' && (
                <>
                  <li>• Go to Kick Dashboard → Settings → Stream</li>
                  <li>• Copy the "Stream Key"</li>
                </>
              )}
              {currentPlatform.id === 'shopee' && (
                <>
                  <li>• Go to Shopee Live Creator Center</li>
                  <li>• Copy the "Stream Key" from live settings</li>
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