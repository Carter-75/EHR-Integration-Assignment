import React, { useState } from 'react';
import { api } from '../services/api';
import { detectDuplicates } from '../utils/duplicateDetection';
import { calibrateConfidenceScore } from '../utils/calibration';
import { notifyWebhook } from '../services/webhook';
import ConfidenceGauge from '../components/ConfidenceGauge';

export default function MedicationReconciliation() {
  const [patientContext, setPatientContext] = useState({
    age: '67',
    conditions: 'Type 2 Diabetes, Hypertension',
    egfr: '45'
  });
  
  const [sources, setSources] = useState([
    { system: 'Hospital EHR', medication: 'Metformin 1000mg twice daily', last_updated: '2024-10-15', source_reliability: 'high' },
    { system: 'Primary Care', medication: 'Metformin 500mg twice daily', last_updated: '2025-01-20', source_reliability: 'high' }
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const [duplicateWarning, setDuplicateWarning] = useState([]);
  const [validationErrors, setValidationErrors] = useState('');
  const [decision, setDecision] = useState(null); // 'approved' | 'rejected' | null

  const handleSourceChange = (index, field, value) => {
    const updated = [...sources];
    updated[index][field] = value;
    setSources(updated);
  };

  const addSource = () => {
    setSources([...sources, { system: '', medication: '', last_updated: '', source_reliability: 'medium' }]);
  };

  const removeSource = (index) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!patientContext.age || !patientContext.conditions) {
      setValidationErrors('Patient context fields are required.');
      return false;
    }
    if (sources.length === 0) {
      setValidationErrors('At least one source is required.');
      return false;
    }
    for (let i = 0; i < sources.length; i++) {
      if (!sources[i].system || !sources[i].medication || !sources[i].last_updated) {
        setValidationErrors(`Source #${i + 1} is missing required fields (system, medication, date).`);
        return false;
      }
    }
    setValidationErrors('');
    return true;
  };

  const handleRun = async (e, ignoreDuplicates = false) => {
    e.preventDefault();
    if (!validate()) return;
    
    if (!ignoreDuplicates) {
      const dups = detectDuplicates(sources);
      if (dups.length > 0) {
        setDuplicateWarning(dups);
        return; // Halt and show warning
      }
    }
    
    setDuplicateWarning([]);
    setError(null);
    setResult(null);
    setDecision(null);
    setLoading(true);

    try {
      const payloadContext = {
        age: parseInt(patientContext.age, 10),
        conditions: patientContext.conditions.split(',').map(s=>s.trim()).filter(Boolean),
        recent_labs: { eGFR: parseInt(patientContext.egfr, 10) }
      };

      const rawResult = await api.reconcileMedication(payloadContext, sources);
      
      // Bonus: Calibrate Confidence Score
      const calibrated = calibrateConfidenceScore(sources, rawResult.reconciled_medication, payloadContext);
      
      setResult({
        ...rawResult,
        calibrated_confidence: calibrated.score,
        calibration_breakdown: calibrated.breakdown
      });
      
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (status) => {
    setDecision(status);
    const webhookUrl = localStorage.getItem('ehr_webhook_url');
    if (webhookUrl) {
      await notifyWebhook(webhookUrl, {
        type: 'reconciliation',
        result,
        decision: status
      });
    }
  };

  return (
    <div className="container">
      <h1 className="mb-4">Medication Reconciliation</h1>
      
      <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '350px' }}>
          <div className="card">
            <h2 className="mb-4">Patient Context</h2>
            <div className="flex gap-2">
              <input placeholder="Age" type="number" value={patientContext.age} onChange={e => setPatientContext({...patientContext, age: e.target.value})} />
              <input placeholder="eGFR Lab" type="number" value={patientContext.egfr} onChange={e => setPatientContext({...patientContext, egfr: e.target.value})} />
            </div>
            <input placeholder="Conditions (comma separated)" value={patientContext.conditions} onChange={e => setPatientContext({...patientContext, conditions: e.target.value})} />

            <h2 className="mt-4 mb-4">Medication Sources</h2>
            {sources.map((src, idx) => (
              <div key={idx} className="card" style={{ padding: '1rem', background: 'var(--bg-main)', marginBottom: '1rem' }}>
                <div className="flex justify-between items-center mb-2">
                  <strong>Source #{idx + 1}</strong>
                  <button type="button" className="btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => removeSource(idx)}>Remove</button>
                </div>
                <input placeholder="System (e.g. Hospital EHR)" value={src.system} onChange={e => handleSourceChange(idx, 'system', e.target.value)} />
                <input placeholder="Medication Details" value={src.medication} onChange={e => handleSourceChange(idx, 'medication', e.target.value)} />
                <div className="flex gap-2 mb-0">
                  <input placeholder="Date (YYYY-MM-DD)" value={src.last_updated} onChange={e => handleSourceChange(idx, 'last_updated', e.target.value)} style={{ marginBottom: 0 }} />
                  <select value={src.source_reliability} onChange={e => handleSourceChange(idx, 'source_reliability', e.target.value)} style={{ marginBottom: 0 }}>
                    <option value="high">High Reliability</option>
                    <option value="medium">Medium Reliability</option>
                    <option value="low">Low Reliability</option>
                  </select>
                </div>
              </div>
            ))}

            <button type="button" className="btn-outline w-full mb-4" onClick={addSource} style={{ width: '100%' }}>+ Add Source</button>

            {validationErrors && <div className="error-text mt-2 mb-2">{validationErrors}</div>}

            {duplicateWarning.length > 0 && (
              <div className="card bg-yellow mt-4 mb-4 text-white" style={{ background: 'var(--warning-color)', color: 'white' }}>
                <h4 style={{ color: 'white' }}>Duplicate Detection Warning</h4>
                <p>We found sources that appear to be duplicates describing the same medication. Would you like to proceed anyway?</p>
                <div className="mt-2 flex gap-4">
                  <button type="button" className="btn-outline" style={{ borderColor: 'white', color: 'white' }} onClick={(e) => handleRun(e, true)}>Submit Anyway</button>
                  <button type="button" className="btn-outline" style={{ borderColor: 'white', color: 'white' }} onClick={() => setDuplicateWarning([])}>Fix Sources</button>
                </div>
              </div>
            )}

            {error && <div className="card bg-red mb-4 mt-4 text-white" style={{ background: 'var(--danger-color)', color: 'white' }}>{error}</div>}

            <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={(e) => handleRun(e, false)} disabled={loading}>
              {loading ? 'Reconciling...' : 'Run Reconciliation'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '400px' }}>
          {result && (
            <div className={`card ${decision === 'approved' ? 'border-green' : decision === 'rejected' ? 'border-red' : ''}`} 
                 style={{ 
                   border: decision === 'approved' ? '2px solid var(--success-color)' : decision === 'rejected' ? '2px solid var(--danger-color)' : '1px solid var(--border-color)',
                   transition: 'all 0.3s'
                 }}>
                 
              {decision === 'approved' && <div className="badge bg-green mb-4">APPROVED</div>}
              {decision === 'rejected' && <div className="badge bg-red mb-4">REJECTED</div>}

              <div className="flex justify-between items-center mb-4">
                <h2 style={{ fontSize: '2rem', color: 'var(--primary-color)' }}>{result.reconciled_medication}</h2>
                <span className={`badge bg-${result.clinical_safety_check === 'PASSED' ? 'green' : 'red'}`} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
                  {result.clinical_safety_check}
                </span>
              </div>

              <ConfidenceGauge score={result.calibrated_confidence} breakdown={result.calibration_breakdown} />

              <div className="card mt-4" style={{ background: 'var(--bg-main)' }}>
                 <h3 className="mb-2">Reasoning</h3>
                 <p>{result.reasoning}</p>
              </div>

              {result.recommended_actions && result.recommended_actions.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2">Recommended Actions</h3>
                  <ul style={{ paddingLeft: '1.5rem', margin: 0 }}>
                    {result.recommended_actions.map((act, i) => (
                      <li key={i} className="mb-2">{act}</li>
                    ))}
                  </ul>
                </div>
              )}

              {decision === null && (
                <div className="flex gap-4 mt-6">
                  <button className="btn-success" style={{ flex: 1 }} onClick={() => handleDecision('approved')}>Approve Suggestion</button>
                  <button className="btn-danger" style={{ flex: 1 }} onClick={() => handleDecision('rejected')}>Reject Suggestion</button>
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
             <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
               <p className="text-gray">Submit the form to see the AI reconciliation result.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
