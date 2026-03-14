'use strict';

/**
 * dataQualityService.js
 *
 * Builds the system and user prompts for data quality assessment and
 * delegates to openaiService. The scoring rubric and severity definitions
 * live inside the system prompt (not in code) so the model has explicit
 * grounding rather than relying on its training data for clinical norms.
 */

var openaiService = require('./openaiService');

var SYSTEM_PROMPT = [
    'You are a clinical informaticist and health data quality auditor with expertise in',
    'EHR data standards, clinical plausibility, and healthcare data governance.',
    '',
    'Your task is to assess the quality of a patient health record across four dimensions:',
    '',
    '  1. completeness (0–100):',
    '     Score based on presence of: demographics (name, dob, gender), medications list,',
    '     allergies (empty list = likely incomplete, score accordingly), conditions, vital signs.',
    '     Each missing or empty-but-expected field deducts points proportionally.',
    '',
    '  2. accuracy (0–100):',
    '     Score based on physiological plausibility of values. Flag impossible vital signs',
    '     (e.g., BP > 300 systolic, HR < 20 or > 300, temp outside 32–43°C).',
    '     Also flag obvious demographic errors (e.g., future DOB, age > 130).',
    '',
    '  3. timeliness (0–100):',
    '     Score based on how recently the record was updated relative to today\'s date.',
    '     0–30 days old = 90–100; 31–90 days = 70–89; 91–180 days = 50–69;',
    '     181–365 days = 30–49; over 1 year = 0–29.',
    '',
    '  4. clinical_plausibility (0–100):',
    '     Score based on drug-disease appropriateness, drug-drug interactions (major only),',
    '     and overall clinical coherence of the record.',
    '',
    'overall_score: weighted average — completeness 25%, accuracy 25%, timeliness 25%, clinical_plausibility 25%.',
    '',
    'For each issue detected, assign a severity:',
    '  "high"   — patient safety risk (implausible vitals, dangerous drug combination)',
    '  "medium" — data quality gap that could affect care decisions (stale data, empty allergy list)',
    '  "low"    — minor gap (cosmetic or low-impact missing field)',
    '',
    'Output requirements:',
    '  - Respond ONLY with a single valid JSON object. No markdown fences, no preamble.',
    '  - Use exactly this schema:',
    '    {',
    '      "overall_score": <integer 0–100>,',
    '      "breakdown": {',
    '        "completeness": <integer 0–100>,',
    '        "accuracy": <integer 0–100>,',
    '        "timeliness": <integer 0–100>,',
    '        "clinical_plausibility": <integer 0–100>',
    '      },',
    '      "issues_detected": [',
    '        { "field": "<field path>", "issue": "<human-readable description>", "severity": "<high|medium|low>" }',
    '      ]',
    '    }',
    '  - If no issues are found, "issues_detected" should be an empty array.',
].join('\n');

function buildUserPrompt(body) {
    var demographics = body.demographics
        ? JSON.stringify(body.demographics, null, 2)
        : 'Not provided';

    var medications = Array.isArray(body.medications)
        ? body.medications.join(', ') || 'None listed'
        : 'Not provided';

    var allergies = Array.isArray(body.allergies)
        ? (body.allergies.length > 0 ? body.allergies.join(', ') : 'Empty list (no allergies documented)')
        : 'Not provided';

    var conditions = Array.isArray(body.conditions)
        ? body.conditions.join(', ') || 'None listed'
        : 'Not provided';

    var vitalSigns = body.vital_signs
        ? JSON.stringify(body.vital_signs, null, 2)
        : 'Not provided';

    var lastUpdated = body.last_updated || 'Not provided';

    var task = [
        'TASK:',
        'Assess the data quality of the patient record above. Apply the scoring rubric from',
        'your system instructions. Be precise — cite exact field paths (e.g., "vital_signs.blood_pressure")',
        'for each issue. Return your answer as a single JSON object matching the schema.',
        'Today\'s date (use for timeliness calculation): ' + new Date().toISOString().split('T')[0],
    ].join('\n');

    return [
        'PATIENT RECORD TO ASSESS:',
        '',
        'Demographics:',
        demographics,
        '',
        'Medications: ' + medications,
        'Allergies: ' + allergies,
        'Conditions: ' + conditions,
        '',
        'Vital Signs:',
        vitalSigns,
        '',
        'Last Updated: ' + lastUpdated,
        '',
        task,
    ].join('\n');
}

/**
 * @param {Object} body  Validated request body (patient record fields)
 * @param {string} [apiKey]
 * @returns {Promise<Object>}
 */
async function assessDataQuality(body, apiKey) {
    var userPrompt = buildUserPrompt(body);
    return openaiService.callOpenAI(SYSTEM_PROMPT, userPrompt, apiKey);
}

module.exports = { assessDataQuality: assessDataQuality };
