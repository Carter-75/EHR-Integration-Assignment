import React, { useState, useEffect } from 'react';

export default function WebhookConfig() {
  const [url, setUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ehr_webhook_url');
    if (saved) setUrl(saved);
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    try {
      if (url.trim()) {
        new URL(url.trim()); // validates it is a URL
      }
      localStorage.setItem('ehr_webhook_url', url.trim());
      setStatusMsg('Webhook URL saved successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setStatusMsg('Invalid URL format.');
    }
  };

  const handleClear = () => {
    localStorage.removeItem('ehr_webhook_url');
    setUrl('');
    setStatusMsg('Webhook cleared.');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <div className="container">
      <h1 className="mb-4">Webhook Configuration</h1>
      <div className="card" style={{ maxWidth: '600px' }}>
        <p className="mb-4 text-gray">
          Register a webhook URL to receive real-time updates when an AI result is approved or rejected by a clinician.
        </p>

        <form onSubmit={handleSave}>
          <label className="font-bold mb-2 block" style={{ display: 'block', marginBottom: '0.5rem' }}>Webhook Endpoint URL</label>
          <input 
            type="url" 
            placeholder="https://your-service.com/webhook" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          
          <div className="flex gap-4 mt-4">
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Save Configuration</button>
            <button type="button" className="btn-outline" onClick={handleClear} style={{ flex: 1 }}>Clear Webhook</button>
          </div>

          {statusMsg && (
            <div className={`mt-4 p-2 text-center rounded ${statusMsg.includes('Invalid') ? 'text-red bg-red' : 'text-green bg-green'}`} 
                 style={{ 
                   color: statusMsg.includes('Invalid') ? 'var(--danger-color)' : 'var(--success-color)',
                   background: statusMsg.includes('Invalid') ? 'var(--danger-bg)' : 'var(--success-bg)',
                   borderRadius: 'var(--radius-md)'
                 }}>
              {statusMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
