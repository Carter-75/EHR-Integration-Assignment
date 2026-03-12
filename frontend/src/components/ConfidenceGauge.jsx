import React from 'react';

export default function ConfidenceGauge({ score, breakdown }) {
  const percentage = Math.round(score * 100);
  
  // Color thresholds
  let colorClass = 'text-green';
  let bgClass = 'bg-green';
  if (percentage < 50) {
    colorClass = 'text-red';
    bgClass = 'bg-red';
  } else if (percentage < 70) {
    colorClass = 'text-yellow';
    bgClass = 'bg-yellow';
  }

  return (
    <div className="card">
      <h3 className="mb-2">Confidence Score</h3>
      <div className="flex items-center gap-4 mb-4">
        <div style={{ flex: 1, backgroundColor: 'var(--border-color)', height: '24px', borderRadius: '12px', overflow: 'hidden' }}>
          <div className={`${bgClass}`} style={{ width: `${percentage}%`, height: '100%', transition: 'width 0.5s ease-out' }} />
        </div>
        <div className={`font-bold ${colorClass}`} style={{ fontSize: '1.25rem', minWidth: '60px', textAlign: 'right' }}>
          {percentage}%
        </div>
      </div>
      
      {breakdown && (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>View Calibration Breakdown</summary>
            <div className="mt-2" style={{ paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
              {Object.entries(breakdown).map(([key, data]) => (
                <div key={key} className="flex justify-between mb-2">
                  <span>{data.description} (Weight: {data.weight * 100}%)</span>
                  <strong>{Math.round(data.score * 100)}% Match</strong>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
