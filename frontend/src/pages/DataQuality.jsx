import React, { useState } from 'react';
import { api } from '../services/api';
import { getDataQualityColor, getSeverityBadgeColor } from '../utils/thresholds';

export default function DataQuality() {
  const [formData, setFormData] = useState({
    name: 'John Doe',
    dob: '1955-03-15',
    gender: 'M',
    medications: 'Metformin 500mg, Lisinopril 10mg',
    allergies: '',
    conditions: 'Type 2 Diabetes',
    blood_pressure: '340/180',
    heart_rate: '72',
    last_updated: '2024-06-15'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required.';
    if (!formData.dob.trim()) errs.dob = 'DOB is required.';
    if (!formData.gender.trim()) errs.gender = 'Gender is required.';
    
    // Check Date format roughly
    if (formData.dob && isNaN(Date.parse(formData.dob))) errs.dob = 'Invalid Date Format (YYYY-MM-DD expected).';
    if (formData.last_updated && isNaN(Date.parse(formData.last_updated))) errs.last_updated = 'Invalid Date Format.';

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!validate()) return;

    setLoading(true);
    
    // Construct payload shape matching backend
    const payload = {
      demographics: { name: formData.name, dob: formData.dob, gender: formData.gender },
      medications: formData.medications.split(',').map(s => s.trim()).filter(Boolean),
      allergies: formData.allergies.split(',').map(s => s.trim()).filter(Boolean),
      conditions: formData.conditions.split(',').map(s => s.trim()).filter(Boolean),
      vital_signs: {
        blood_pressure: formData.blood_pressure,
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate, 10) : undefined
      },
      last_updated: formData.last_updated
    };

    try {
      const data = await api.validateDataQuality(payload);
      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const renderScoreIndicator = (label, score) => {
    const color = getDataQualityColor(score);
    return (
      <div style={{ flex: 1, minWidth: '150px' }} className="card mb-0">
        <h4 className="text-gray">{label}</h4>
        <div className={`font-bold mt-2 text-${color}`} style={{ fontSize: '1.5rem' }}>
          {score}/100
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <h1 className="mb-4">Data Quality Assessment</h1>
      
      <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div className="card">
            <h2 className="mb-4">Patient Record</h2>
            <form onSubmit={handleRun}>
              <h3>Demographics</h3>
              <input placeholder="Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              {validationErrors.name && <span className="error-text">{validationErrors.name}</span>}
              
              <div className="flex gap-2">
                <div style={{flex: 1}}>
                  <input placeholder="DOB (YYYY-MM-DD)" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                  {validationErrors.dob && <span className="error-text">{validationErrors.dob}</span>}
                </div>
                <div style={{flex: 1}}>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                    <option value="">Select Gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {validationErrors.gender && <span className="error-text">{validationErrors.gender}</span>}
                </div>
              </div>

              <h3 className="mt-4">Clinical Data (Comma Separated)</h3>
              <input placeholder="Medications" value={formData.medications} onChange={e => setFormData({...formData, medications: e.target.value})} />
              <input placeholder="Allergies" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
              <input placeholder="Conditions" value={formData.conditions} onChange={e => setFormData({...formData, conditions: e.target.value})} />

              <h3 className="mt-4">Vital Signs & Metadata</h3>
              <div className="flex gap-2">
                 <input placeholder="Blood Pressure (e.g. 120/80)" value={formData.blood_pressure} onChange={e => setFormData({...formData, blood_pressure: e.target.value})} />
                 <input type="number" placeholder="Heart Rate" value={formData.heart_rate} onChange={e => setFormData({...formData, heart_rate: e.target.value})} />
              </div>

              <input placeholder="Last Updated (YYYY-MM-DD)" value={formData.last_updated} onChange={e => setFormData({...formData, last_updated: e.target.value})} />
              {validationErrors.last_updated && <span className="error-text">{validationErrors.last_updated}</span>}

              {error && <div className="card bg-red mb-4 mt-4 text-white" style={{ background: 'var(--danger-color)', color: 'white' }}>{error}</div>}

              <button type="submit" className="btn-primary mt-4" disabled={loading}>
                {loading ? 'Assessing Quality...' : 'Run Assessment'}
              </button>
            </form>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: '400px' }}>
          {result && (
            <>
              <div className="card">
                <h2>Assessment Results</h2>
                <div className="flex gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
                  {renderScoreIndicator('Overall Score', result.overall_score)}
                  {renderScoreIndicator('Accuracy', result.breakdown.accuracy)}
                  {renderScoreIndicator('Completeness', result.breakdown.completeness)}
                  {renderScoreIndicator('Timeliness', result.breakdown.timeliness)}
                  {renderScoreIndicator('Clinical Plausibility', result.breakdown.clinical_plausibility)}
                </div>
              </div>

              {result.issues_detected && result.issues_detected.length > 0 && (
                <div className="card">
                  <h3 className="mb-4">Issues Detected ({result.issues_detected.length})</h3>
                  {result.issues_detected.map((issue, idx) => (
                    <div key={idx} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <strong>Field: {issue.field}</strong>
                        <span className={`badge bg-${getSeverityBadgeColor(issue.severity)}`}>
                          {issue.severity} Severity
                        </span>
                      </div>
                      <p className="text-gray">{issue.issue}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!result && !loading && (
             <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
               <p className="text-gray">Submit the form to see AI assessment results.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
