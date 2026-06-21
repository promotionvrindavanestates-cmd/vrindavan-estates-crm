import React, { useState } from 'react';
import { api, setAuthToken, getBaseUrl, setBackendUrl } from '../utils/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(getBaseUrl());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.login(username, password);
      setAuthToken(data.token);
      onLoginSuccess(data.user, data.isCloud);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setBackendUrl(serverUrl);
    alert(`Backend Server URL configured to: ${serverUrl || 'Default Proxy/Emulator URL'}`);
    setShowSettings(false);
  };

  return (
    <div class="login-container">
      <div class="login-bg-decor"></div>
      <div class="login-bg-decor2"></div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="/favicon-192x192.png" alt="VE Logo" class="login-logo-img" />
          </div>
          <h2>VRINDAVAN ESTATES</h2>
          <p class="login-welcome">VRINDAVAN ESTATES CRM</p>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-hot-bg)',
            color: 'var(--color-hot)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '13px',
            border: '1px solid rgba(255, 94, 94, 0.2)',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div class="form-group" style={{ marginBottom: '16px' }}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              class="form-control"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div class="form-group" style={{ marginBottom: '24px' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              class="form-control"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        {/* Server Settings Panel */}
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
          <button 
            type="button" 
            class="btn btn-secondary" 
            style={{ width: '100%', padding: '8px', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ {showSettings ? 'Hide Server Settings' : 'Configure Server URL'}
          </button>
          
          {showSettings && (
            <form onSubmit={handleSaveSettings} style={{ marginTop: '12px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div class="form-group" style={{ marginBottom: '10px' }}>
                <label htmlFor="server-url" style={{ fontSize: '11px', color: 'var(--primary)' }}>Backend Server API URL</label>
                <input
                  id="server-url"
                  type="text"
                  class="form-control"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                  placeholder="e.g. http://192.168.1.100:5000"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
              </div>
              <button type="submit" class="btn btn-primary" style={{ width: '100%', padding: '6px', fontSize: '12px' }}>
                Save Server Config
              </button>
            </form>
          )}
        </div>

        <div style={{ 
          marginTop: '24px', 
          textAlign: 'center', 
          fontSize: '12px', 
          color: 'var(--text-muted)' 
        }}>
          <p style={{ marginBottom: '4px' }}>Demo accounts:</p>
          <p>Admin: <strong style={{ color: 'var(--primary)' }}>admin</strong> / <strong style={{ color: 'var(--primary)' }}>admin123</strong></p>
          <p>Employee: <strong style={{ color: 'var(--primary)' }}>employee</strong> / <strong style={{ color: 'var(--primary)' }}>employee123</strong></p>
        </div>
      </div>
    </div>
  );
}
