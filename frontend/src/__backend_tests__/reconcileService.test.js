// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

process.env.OPENAI_API_KEY = 'test_key';

const require = createRequire(import.meta.url);

const openaiService = require('../../../EHR/src/services/openaiService');
const reconcileService = require('../../../EHR/src/services/reconcileService');

const { reconcileMedications } = reconcileService;

describe('Medication Reconciliation Service', () => {
  let callOpenAISpy;

  beforeEach(() => {
    callOpenAISpy = vi.spyOn(openaiService, 'callOpenAI');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correctly shaped reconciliation output', async () => {
    const mockResponse = {
      reconciled_medication: 'Metformin 500mg daily',
      confidence_score: 0.9,
      reasoning: 'Primary care matches pharmacy fill',
      recommended_actions: ['Update EHR'],
      clinical_safety_check: 'PASSED'
    };
    
    callOpenAISpy.mockResolvedValue(mockResponse);

    const body = {
      patient_context: { age: 67 },
      sources: [{ system: 'Hospital', medication: 'Metformin 500mg daily' }]
    };

    const result = await reconcileMedications(body);
    expect(result).toEqual(mockResponse);
  });

  it('confidence score is a number between 0 and 1', async () => {
    const mockResponse = {
      reconciled_medication: 'Metformin',
      confidence_score: 0.85,
      reasoning: 'Valid',
      recommended_actions: [],
      clinical_safety_check: 'PASSED'
    };
    
    callOpenAISpy.mockResolvedValue(mockResponse);

    const body = {
      patient_context: {},
      sources: [{ system: 'A', medication: 'Drug' }]
    };

    const result = await reconcileMedications(body);
    expect(result.confidence_score).toBeGreaterThanOrEqual(0.0);
    expect(result.confidence_score).toBeLessThanOrEqual(1.0);
  });

  it('all required output fields are present', async () => {
    const mockResponse = {
      reconciled_medication: 'Lisinopril 10mg',
      confidence_score: 0.5,
      reasoning: 'Reasoning given',
      recommended_actions: ['Double check dose'],
      clinical_safety_check: 'WARNING'
    };
    
    callOpenAISpy.mockResolvedValue(mockResponse);

    const result = await reconcileMedications({ patient_context: {}, sources: [{ system: 'A', medication: 'A' }] });
    
    expect(result).toHaveProperty('reconciled_medication');
    expect(result).toHaveProperty('confidence_score');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('recommended_actions');
    expect(result).toHaveProperty('clinical_safety_check');
  });

  it('handles behavior when sources array is empty', async () => {
    callOpenAISpy.mockResolvedValue({});
    
    const body = {
      patient_context: { age: 50 },
      sources: []
    };
    
    await reconcileMedications(body);
    
    const callArgs = callOpenAISpy.mock.calls[0][1];
    expect(callArgs).toContain('MEDICATION SOURCES (0 records):');
  });

  it('handles behavior when patient context is missing fields', async () => {
    callOpenAISpy.mockResolvedValue({});
    
    const body = {
      patient_context: {},
      sources: [{ system: 'A', medication: 'A' }]
    };
    
    await reconcileMedications(body);
    const callArgs = callOpenAISpy.mock.calls[0][1];
    expect(callArgs).toContain('Age: unknown');
  });
});
