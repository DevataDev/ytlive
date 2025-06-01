'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Form, Button, Alert, Card, Row, Col, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '@/hooks/useAuth';

interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  newStreams: boolean;
  streamUpdates: boolean;
  newsletter: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showOnlineStatus: boolean;
  allowDirectMessages: 'everyone' | 'friends' | 'none';
  searchEngineIndexing: boolean;
}

interface ThemeSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  reduceAnimations: boolean;
  highContrast: boolean;
}

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('notifications');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    newStreams: true,
    streamUpdates: true,
    newsletter: true,
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    profileVisibility: 'public',
    showOnlineStatus: true,
    allowDirectMessages: 'everyone',
    searchEngineIndexing: true,
  });

  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    theme: 'system',
    fontSize: 'medium',
    reduceAnimations: false,
    highContrast: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push('/auth/login?callbackUrl=/settings');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  // Load user settings
  useEffect(() => {
    if (isAuthenticated && user) {
      // In a real app, you would fetch these from your API
      // This is just a mock implementation
      const loadSettings = async () => {
        try {
          setIsLoading(true);
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // In a real app, you would do something like:
          // const response = await fetch('/api/settings');
          // const data = await response.json();
          // setNotificationSettings(data.notificationSettings);
          // setPrivacySettings(data.privacySettings);
          // setThemeSettings(data.themeSettings);
          
        } catch (err) {
          console.error('Failed to load settings:', err);
          setError('Failed to load settings. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadSettings();
    }
  }, [isAuthenticated, user]);

  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotificationSettings(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handlePrivacyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setPrivacySettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    setThemeSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const saveSettings = async (settingsType: 'notifications' | 'privacy' | 'theme') => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // In a real app, you would send this to your API
      // This is just a mock implementation
      let endpoint = '';
      let data = {};

      switch (settingsType) {
        case 'notifications':
          endpoint = '/api/settings/notifications';
          data = notificationSettings;
          break;
        case 'privacy':
          endpoint = '/api/settings/privacy';
          data = privacySettings;
          break;
        case 'theme':
          endpoint = '/api/settings/theme';
          data = themeSettings;
          break;
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, you would do something like:
      // const response = await fetch(endpoint, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
      // if (!response.ok) throw new Error('Failed to save settings');
      
      setSuccess(`${settingsType.charAt(0).toUpperCase() + settingsType.slice(1)} settings saved successfully!`);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(`Failed to save ${settingsType} settings. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || !user) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your settings...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col lg={10} xl={8}>
          <h1 className="h2 mb-4">Settings</h1>
          
          {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
          {success && <Alert variant="success" className="mb-4">{success}</Alert>}
          
          <Card className="shadow-sm mb-4">
            <Card.Body className="p-0">
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k || 'notifications')}
                className="border-bottom-0 px-4 pt-3"
                id="settings-tabs"
              >
                <Tab eventKey="notifications" title="Notifications" className="p-4">
                  <h2 className="h5 mb-4">Notification Settings</h2>
                  <Form>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Email Notifications</Form.Label>
                      <Form.Check
                        type="switch"
                        id="emailNotifications"
                        name="emailNotifications"
                        label="Enable email notifications"
                        checked={notificationSettings.emailNotifications}
                        onChange={handleNotificationChange}
                        className="mb-3"
                      />
                      
                      <Form.Check
                        type="switch"
                        id="newStreams"
                        name="newStreams"
                        label="New streams from followed channels"
                        checked={notificationSettings.newStreams}
                        onChange={handleNotificationChange}
                        disabled={!notificationSettings.emailNotifications}
                        className="ms-4 mb-2"
                      />
                      
                      <Form.Check
                        type="switch"
                        id="streamUpdates"
                        name="streamUpdates"
                        label="Stream updates and announcements"
                        checked={notificationSettings.streamUpdates}
                        onChange={handleNotificationChange}
                        disabled={!notificationSettings.emailNotifications}
                        className="ms-4 mb-2"
                      />
                      
                      <Form.Check
                        type="switch"
                        id="newsletter"
                        name="newsletter"
                        label="Newsletter and promotions"
                        checked={notificationSettings.newsletter}
                        onChange={handleNotificationChange}
                        disabled={!notificationSettings.emailNotifications}
                        className="ms-4 mb-2"
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Push Notifications</Form.Label>
                      <Form.Check
                        type="switch"
                        id="pushNotifications"
                        name="pushNotifications"
                        label="Enable push notifications"
                        checked={notificationSettings.pushNotifications}
                        onChange={handleNotificationChange}
                      />
                    </Form.Group>
                    
                    <div className="d-flex justify-content-end">
                      <Button 
                        variant="primary" 
                        onClick={() => saveSettings('notifications')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Saving...' : 'Save Notification Settings'}
                      </Button>
                    </div>
                  </Form>
                </Tab>
                
                <Tab eventKey="privacy" title="Privacy" className="p-4">
                  <h2 className="h5 mb-4">Privacy Settings</h2>
                  <Form>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Profile Visibility</Form.Label>
                      <Form.Select 
                        name="profileVisibility"
                        value={privacySettings.profileVisibility}
                        onChange={handlePrivacyChange}
                        className="mb-3"
                      >
                        <option value="public">Public - Anyone can see my profile</option>
                        <option value="friends">Friends - Only my friends can see my profile</option>
                        <option value="private">Private - Only I can see my profile</option>
                      </Form.Select>
                      
                      <Form.Text className="text-muted">
                        {privacySettings.profileVisibility === 'public' 
                          ? 'Your profile is visible to everyone.'
                          : privacySettings.profileVisibility === 'friends'
                            ? 'Only your friends can see your profile.'
                            : 'Your profile is private and only visible to you.'}
                      </Form.Text>
                    </Form.Group>
                    
                    <Form.Group className="mb-4">
                      <Form.Check
                        type="switch"
                        id="showOnlineStatus"
                        name="showOnlineStatus"
                        label="Show when I'm online"
                        checked={privacySettings.showOnlineStatus}
                        onChange={handlePrivacyChange}
                        className="mb-3"
                      />
                      
                      <Form.Label className="fw-bold d-block mt-4 mb-2">Who can send you direct messages?</Form.Label>
                      <Form.Select 
                        name="allowDirectMessages"
                        value={privacySettings.allowDirectMessages}
                        onChange={handlePrivacyChange}
                        className="mb-3"
                      >
                        <option value="everyone">Everyone</option>
                        <option value="friends">Friends Only</option>
                        <option value="none">No One</option>
                      </Form.Select>
                      
                      <Form.Check
                        type="switch"
                        id="searchEngineIndexing"
                        name="searchEngineIndexing"
                        label="Allow search engines to index my profile"
                        checked={privacySettings.searchEngineIndexing}
                        onChange={handlePrivacyChange}
                      />
                    </Form.Group>
                    
                    <div className="d-flex justify-content-end">
                      <Button 
                        variant="primary" 
                        onClick={() => saveSettings('privacy')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Saving...' : 'Save Privacy Settings'}
                      </Button>
                    </div>
                  </Form>
                </Tab>
                
                <Tab eventKey="appearance" title="Appearance" className="p-4">
                  <h2 className="h5 mb-4">Appearance Settings</h2>
                  <Form>
                    <Form.Group className="mb-4">
                      <Form.Label className="fw-bold">Theme</Form.Label>
                      <Form.Select 
                        name="theme"
                        value={themeSettings.theme}
                        onChange={handleThemeChange}
                        className="mb-3"
                      >
                        <option value="system">System Default</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </Form.Select>
                      
                      <Form.Label className="fw-bold d-block mt-4 mb-2">Font Size</Form.Label>
                      <div className="btn-group w-100 mb-4" role="group">
                        {['small', 'medium', 'large'].map((size) => (
                          <React.Fragment key={size}>
                            <input
                              type="radio"
                              className="btn-check"
                              name="fontSize"
                              id={`fontSize${size}`}
                              autoComplete="off"
                              checked={themeSettings.fontSize === size}
                              onChange={() => setThemeSettings(prev => ({
                                ...prev,
                                fontSize: size as 'small' | 'medium' | 'large',
                              }))}
                            />
                            <label 
                              className={`btn btn-outline-primary text-capitalize ${themeSettings.fontSize === size ? 'active' : ''}`} 
                              htmlFor={`fontSize${size}`}
                            >
                              {size}
                            </label>
                          </React.Fragment>
                        ))}
                      </div>
                      
                      <Form.Check
                        type="switch"
                        id="reduceAnimations"
                        name="reduceAnimations"
                        label="Reduce animations and motion"
                        checked={themeSettings.reduceAnimations}
                        onChange={handleThemeChange}
                        className="mb-3"
                      />
                      
                      <Form.Check
                        type="switch"
                        id="highContrast"
                        name="highContrast"
                        label="High contrast mode"
                        checked={themeSettings.highContrast}
                        onChange={handleThemeChange}
                      />
                    </Form.Group>
                    
                    <div className="d-flex justify-content-end">
                      <Button 
                        variant="primary" 
                        onClick={() => saveSettings('theme')}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Saving...' : 'Save Appearance Settings'}
                      </Button>
                    </div>
                  </Form>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
          
          <Card className="border-danger shadow-sm">
            <Card.Body className="p-4">
              <h2 className="h5 text-danger mb-4">Danger Zone</h2>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h3 className="h6 mb-1">Delete Account</h3>
                  <p className="text-muted mb-0">Permanently delete your account and all associated data.</p>
                </div>
                <Button variant="outline-danger" size="sm">
                  Delete Account
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
