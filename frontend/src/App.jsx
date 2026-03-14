import React, { useState, useEffect } from 'react';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import MedicationReconciliation from './pages/MedicationReconciliation';
import DataQuality from './pages/DataQuality';
import WebhookConfig from './pages/WebhookConfig';

function App() {
  const [hasKey, setHasKey] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentTab, setCurrentTab] = useState('reconcile');

  useEffect(() => {
    const checkKey = () => {
      if (import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('ehr_api_key')) {
        setHasKey(true);
      } else {
        setShowPrompt(true);
      }
    };

    checkKey();

    const handleUnauthorized = () => {
      localStorage.removeItem('ehr_api_key');
      setHasKey(false);
      setShowPrompt(true);
    };

    window.addEventListener('ehr_api_unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('ehr_api_unauthorized', handleUnauthorized);
    };
  }, []);

  const handleKeySave = () => {
    setHasKey(true);
    setShowPrompt(false);
  };

  const handleResetRequest = () => {
    setShowPrompt(true);
  };

  const handleCancelPrompt = () => {
    setShowPrompt(false);
  };

  const navItemStyle = (tabId) => ({
    padding: '1rem 1.5rem',
    cursor: 'pointer',
    borderBottom: currentTab === tabId ? '3px solid var(--primary-color)' : '3px solid transparent',
    color: currentTab === tabId ? 'var(--primary-color)' : 'var(--text-muted)',
    fontWeight: currentTab === tabId ? 600 : 400,
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '3px',
    borderBottomStyle: 'solid',
    borderBottomColor: currentTab === tabId ? 'var(--primary-color)' : 'transparent',
  });

  return (
    <>
      {showPrompt && (
        <ApiKeyPrompt 
          onKeySave={handleKeySave} 
          onCancel={handleCancelPrompt} 
          showCancel={hasKey} // Only show cancel if they already have a working key
        />
      )}
      
      <header style={{ background: 'white', borderBottom: '1px solid var(--border-color)', top: 0, position: 'sticky', zIndex: 10 }}>
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="flex items-center justify-between">
            <h1 style={{ margin: 0, fontSize: '1.5rem', padding: '1rem 0' }}>EHR Clinic Dashboard</h1>
            <nav className="flex">
              <button style={navItemStyle('reconcile')} onClick={() => setCurrentTab('reconcile')}>Medication Reconciliation</button>
              <button style={navItemStyle('data')} onClick={() => setCurrentTab('data')}>Data Quality</button>
              <button style={{...navItemStyle('webhook'), marginRight: 'auto'}} onClick={() => setCurrentTab('webhook')}>Webhook Config</button>
              <button style={navItemStyle('reset')} onClick={handleResetRequest}>Update API Key</button>
            </nav>
          </div>
        </div>
      </header>

      <main>
        {currentTab === 'reconcile' && <MedicationReconciliation />}
        {currentTab === 'data' && <DataQuality />}
        {currentTab === 'webhook' && <WebhookConfig />}
      </main>
    </>
  );
}

export default App;
