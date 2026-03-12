import React, { useState, useEffect } from 'react';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import MedicationReconciliation from './pages/MedicationReconciliation';
import DataQuality from './pages/DataQuality';
import WebhookConfig from './pages/WebhookConfig';

function App() {
  const [hasKey, setHasKey] = useState(false);
  const [currentTab, setCurrentTab] = useState('reconcile');

  useEffect(() => {
    if (localStorage.getItem('ehr_api_key')) {
      setHasKey(true);
    }
  }, []);

  const handleKeySave = () => {
    setHasKey(true);
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
      {!hasKey && <ApiKeyPrompt onKeySave={handleKeySave} />}
      
      <header style={{ background: 'white', borderBottom: '1px solid var(--border-color)', top: 0, position: 'sticky', zIndex: 10 }}>
        <div className="container" style={{ padding: '0 2rem' }}>
          <div className="flex items-center justify-between">
            <h1 style={{ margin: 0, fontSize: '1.5rem', padding: '1rem 0' }}>EHR Clinic Dashboard</h1>
            <nav className="flex">
              <button style={navItemStyle('reconcile')} onClick={() => setCurrentTab('reconcile')}>Medication Reconciliation</button>
              <button style={navItemStyle('data')} onClick={() => setCurrentTab('data')}>Data Quality</button>
              <button style={navItemStyle('webhook')} onClick={() => setCurrentTab('webhook')}>Webhook Config</button>
              <button style={navItemStyle('logout')} onClick={() => { localStorage.removeItem('ehr_api_key'); setHasKey(false); }}>Reset API Key</button>
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
