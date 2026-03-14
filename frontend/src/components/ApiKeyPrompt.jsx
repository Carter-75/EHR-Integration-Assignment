import React, { useState } from 'react';

export default function ApiKeyPrompt({ onKeySave, onCancel, showCancel = false }) {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem('ehr_api_key', apiKey.trim());
      onKeySave(apiKey.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%' }}>
        <h2>API Configuration Required</h2>
        <p className="text-gray mb-4">
          Please enter your OpenAI API key to access the EHR functionality. This key is stored securely in your browser's local storage and is not saved on the server.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            required
          />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {showCancel && (
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ width: '100%', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                onClick={onCancel}
              >
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Save Key & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
