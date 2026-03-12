// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

process.env.OPENAI_API_KEY = 'test_key';

const require = createRequire(import.meta.url);

// Native CJS require so they share the exact Node cache
const openaiService = require('../../../EHR/src/services/openaiService');
const dataQualityService = require('../../../EHR/src/services/dataQualityService');

const { assessDataQuality } = dataQualityService;

describe('Data Quality Assessment Service', () => {
  let callOpenAISpy;

  beforeEach(() => {
    callOpenAISpy = vi.spyOn(openaiService, 'callOpenAI');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('overall score is a number between 0 and 100', async () => {
    const mockReponse = {
      overall_score: 85,
      breakdown: { completeness: 80, accuracy: 90, timeliness: 100, clinical_plausibility: 70 },
      issues_detected: []
    };
    
    callOpenAISpy.mockResolvedValue(mockReponse);
    
    const body = { demographics: { name: 'John', dob: '1980' } };
    const result = await assessDataQuality(body);

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
  });

  it('breakdown contains all four required dimensions', async () => {
    const mockReponse = {
      overall_score: 85,
      breakdown: { completeness: 80, accuracy: 90, timeliness: 100, clinical_plausibility: 70 },
      issues_detected: []
    };
    
    callOpenAISpy.mockResolvedValue(mockReponse);
    
    const result = await assessDataQuality({});
    
    expect(result.breakdown).toHaveProperty('completeness');
    expect(result.breakdown).toHaveProperty('accuracy');
    expect(result.breakdown).toHaveProperty('timeliness');
    expect(result.breakdown).toHaveProperty('clinical_plausibility');
  });

  it('implausible vital signs are flagged as high severity', async () => {
    const mockReponse = {
      overall_score: 50,
      breakdown: { completeness: 80, accuracy: 0, timeliness: 100, clinical_plausibility: 70 },
      issues_detected: [
        { field: 'vital_signs.blood_pressure', issue: 'Implausible', severity: 'high' }
      ]
    };
    callOpenAISpy.mockResolvedValue(mockReponse);
    
    const body = { vital_signs: { blood_pressure: '300/30' } };
    const result = await assessDataQuality(body);
    
    const pbIssue = result.issues_detected.find(i => i.field.includes('vital_signs'));
    expect(pbIssue.severity).toBe('high');
  });

  it('empty allergies array triggers a medium severity issue', async () => {
    const mockReponse = {
      overall_score: 75,
      breakdown: { completeness: 50, accuracy: 100, timeliness: 100, clinical_plausibility: 100 },
      issues_detected: [
        { field: 'allergies', issue: 'Empty list', severity: 'medium' }
      ]
    };
    callOpenAISpy.mockResolvedValue(mockReponse);
    
    const result = await assessDataQuality({ allergies: [] });
    
    const issue = result.issues_detected.find(i => i.field === 'allergies');
    expect(issue.severity).toBe('medium');
    
    const callArgs = callOpenAISpy.mock.calls[0][1];
    expect(callArgs).toContain('Empty list (no allergies documented)');
  });

  it('stale last_updated date triggers a timeliness issue', async () => {
    const mockReponse = {
      overall_score: 75,
      breakdown: { completeness: 100, accuracy: 100, timeliness: 20, clinical_plausibility: 100 },
      issues_detected: [
        { field: 'last_updated', issue: 'Stale date', severity: 'medium' }
      ]
    };
    callOpenAISpy.mockResolvedValue(mockReponse);
    
    const oldDate = '2020-01-01';
    const result = await assessDataQuality({ last_updated: oldDate });
    
    const callArgs = callOpenAISpy.mock.calls[0][1];
    expect(callArgs).toContain(`Last Updated: ${oldDate}`);
    
    expect(result.issues_detected[0].field).toBe('last_updated');
  });
});
