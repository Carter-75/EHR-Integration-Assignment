import { describe, it, expect } from 'vitest';
import { calibrateConfidenceScore } from './calibration';

describe('Confidence Score Calibration Module', () => {
  it('increases score with higher source reliability', () => {
    // Both same recency, but one high vs low
    const resultHigh = calibrateConfidenceScore(
      [{ medication: 'Drug A', source_reliability: 'high', last_updated: new Date().toISOString() }],
      'Drug A',
      {}
    );
    const resultLow = calibrateConfidenceScore(
      [{ medication: 'Drug A', source_reliability: 'low', last_updated: new Date().toISOString() }],
      'Drug A',
      {}
    );
    
    expect(resultHigh.score).toBeGreaterThan(resultLow.score);
  });

  it('increases score with more recent source dates', () => {
    const today = new Date();
    const oldDate = new Date();
    oldDate.setFullYear(today.getFullYear() - 1); // 1 year ago

    const resultRecent = calibrateConfidenceScore(
      [{ medication: 'Drug B', source_reliability: 'high', last_updated: today.toISOString() }],
      'Drug B',
      {}
    );
    const resultOld = calibrateConfidenceScore(
      [{ medication: 'Drug B', source_reliability: 'high', last_updated: oldDate.toISOString() }],
      'Drug B',
      {}
    );

    expect(resultRecent.score).toBeGreaterThan(resultOld.score);
  });

  it('increases score when sources agree with each other', () => {
    const resultAgree = calibrateConfidenceScore(
      [
        { medication: 'Metformin 500mg' },
        { medication: 'Metformin 500mg' }
      ],
      'Metformin 500mg',
      {}
    );
    const resultMixed = calibrateConfidenceScore(
      [
        { medication: 'Metformin 500mg' },
        { medication: 'Lisinopril 10mg' }
      ],
      'Metformin 500mg',
      {}
    );

    expect(resultAgree.score).toBeGreaterThan(resultMixed.score);
  });

  it('decreases score when sources conflict (disagree)', () => {
    const resultDisagree = calibrateConfidenceScore(
      [
        { medication: 'Lisinopril 10mg' },
        { medication: 'Aspirin 81mg' }
      ],
      'Metformin 500mg', // Disagrees with all sources
      {}
    );
    const resultAgree = calibrateConfidenceScore(
      [
        { medication: 'Metformin 500mg' },
        { medication: 'Metformin 500mg' }
      ],
      'Metformin 500mg',
      {}
    );

    expect(resultDisagree.score).toBeLessThan(resultAgree.score);
  });

  it('clamps output always between 0 and 1', () => {
    // Best case scenario
    const bestCase = calibrateConfidenceScore(
      [
        { medication: 'Max', source_reliability: 'high', last_updated: new Date().toISOString() },
        { medication: 'Max', source_reliability: 'high', last_updated: new Date().toISOString() }
      ],
      'Max',
      {}
    );
    
    // Worst case empty scenario
    const worstCase = calibrateConfidenceScore([], 'Nothing', {});
    
    expect(bestCase.score).toBeLessThanOrEqual(1.0);
    expect(bestCase.score).toBeGreaterThanOrEqual(0.0);
    expect(worstCase.score).toBeLessThanOrEqual(1.0);
    expect(worstCase.score).toBeGreaterThanOrEqual(0.0);
  });
});
