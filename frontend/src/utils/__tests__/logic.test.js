import { describe, it, expect } from 'vitest';
import { getDataQualityColor, getSeverityBadgeColor } from '../thresholds';
import { calibrateConfidenceScore } from '../calibration';
import { detectDuplicates } from '../duplicateDetection';

describe('Threshold and Color Logic', () => {
  it('assigns correct colors for Data Quality thresholds', () => {
    // red below 50, yellow 50–74, green 75 and above
    expect(getDataQualityColor(49)).toBe('red');
    expect(getDataQualityColor(50)).toBe('yellow');
    expect(getDataQualityColor(74)).toBe('yellow');
    expect(getDataQualityColor(75)).toBe('green');
    expect(getDataQualityColor(100)).toBe('green');
  });

  it('assigns correct colors for Severity Badges', () => {
    // high in red, medium in yellow, low in green
    expect(getSeverityBadgeColor('High')).toBe('red');
    expect(getSeverityBadgeColor('high')).toBe('red');
    expect(getSeverityBadgeColor('MEDIUM')).toBe('yellow');
    expect(getSeverityBadgeColor('low')).toBe('green');
    expect(getSeverityBadgeColor('unknown')).toBe('gray');
  });
});

describe('Calibration Logic', () => {
  it('calculates the confidence score correctly with perfect sources', () => {
    const sources = [
      { medication: 'Metformin', last_updated: new Date().toISOString(), source_reliability: 'high' }
    ];
    const patientContext = { age: 67 };
    
    const { score, breakdown } = calibrateConfidenceScore(sources, 'Metformin', patientContext);
    
    expect(breakdown.recency.score).toBe(1.0);
    expect(breakdown.reliability.score).toBe(1.0);
    expect(breakdown.agreement.score).toBe(1.0);
    expect(breakdown.contextAlignment.score).toBe(0.8);

    // Expected: (1 * 0.3) + (1 * 0.3) + (1 * 0.2) + (0.8 * 0.2) = 0.3 + 0.3 + 0.2 + 0.16 = 0.96
    expect(score).toBe(0.96);
  });
});

describe('Duplicate Detection Logic', () => {
  it('finds duplicates when exact names match across sources', () => {
    const sources = [
      { medication: 'Metformin 500mg' },
      { medication: 'Metformin 1000mg' }, // Same root name
      { medication: 'Lisinopril 10mg' }
    ];
    
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toHaveLength(2);
    expect(duplicates[0][0].medication).toBe('Metformin 500mg');
    expect(duplicates[0][1].medication).toBe('Metformin 1000mg');
  });
});
