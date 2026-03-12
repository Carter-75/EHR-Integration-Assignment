import { describe, it, expect } from 'vitest';
import { detectDuplicates } from './duplicateDetection';

describe('Duplicate Record Detection Module', () => {
  it('flags two identical medication entries from different sources', () => {
    const sources = [
      { system: 'Hospital', medication: 'Metformin 500mg' },
      { system: 'Clinic', medication: 'Metformin 500mg' }
    ];
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].length).toBe(2);
  });

  it('flags entries with same drug but different doses', () => {
    const sources = [
      { system: 'Hospital', medication: 'Lisinopril 10mg' },
      { system: 'Clinic', medication: 'Lisinopril 20mg' }
    ];
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].length).toBe(2);
  });

  it('flags entries with same drug and same dose but different systems', () => {
    const sources = [
      { system: 'System A', medication: 'Aspirin 81mg' },
      { system: 'System B', medication: 'Aspirin 81mg' }
    ];
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].length).toBe(2);
  });

  it('does not flag entries for completely different medications', () => {
    const sources = [
      { system: 'System A', medication: 'Aspirin 81mg' },
      { system: 'System B', medication: 'Lisinopril 10mg' },
      { system: 'System C', medication: 'Metformin 500mg' }
    ];
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(0);
  });

  it('returns no duplicates for a single source input', () => {
    const sources = [
      { system: 'System A', medication: 'Aspirin 81mg' }
    ];
    const duplicates = detectDuplicates(sources);
    expect(duplicates.length).toBe(0);
  });
});
