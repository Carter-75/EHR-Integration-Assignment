'use strict';

/**
 * reconcileService.js
 *
 * Builds the system and user prompts for medication reconciliation and
 * delegates to openaiService. Source weighting order: recency > source
 * reliability > pharmacy fill data. Patient labs (e.g., eGFR) override
 * dosing when they contradict the source records.
 */

var openaiService = require('./openaiService');

var SYSTEM_PROMPT = [
    'You are a board-certified clinical pharmacist and clinical decision support specialist.',
    'Your task is to reconcile conflicting medication records from multiple healthcare systems.',
    '',
    'Weighting rules you MUST apply:',
    '  1. Recency — the most recently updated clinical record carries the most weight.',
    '  2. Source reliability — "high" reliability outweighs "medium" or "low" when dates are close.',
    '  3. Pharmacy fill data — useful corroboration but secondary to clinical encounters.',
    '  4. Patient context — always apply clinical safety reasoning (e.g., renal dosing for low eGFR,',
    '     age-appropriate dosing). Flag any dose that is contraindicated given the patient\'s labs.',
    '',
    'Output requirements:',
    '  - Respond ONLY with a single valid JSON object. No markdown fences, no preamble, no explanation outside the JSON.',
    '  - Use exactly this schema:',
    '    {',
    '      "reconciled_medication": "<drug name, dose, frequency>",',
    '      "confidence_score": <float 0.0–1.0>,',
    '      "reasoning": "<full clinical rationale as a single string>",',
    '      "recommended_actions": ["<action 1>", "<action 2>", ...],',
    '      "clinical_safety_check": "<PASSED | WARNING | FAILED>"',
    '    }',
    '  - confidence_score: 0.9–1.0 strong agreement; 0.7–0.89 moderate; below 0.7 low confidence.',
    '  - clinical_safety_check: PASSED = safe to administer; WARNING = monitor closely; FAILED = do not administer.',
].join('\n');

function buildUserPrompt(body) {
    var ctx = body.patient_context || {};
    var labs = ctx.recent_labs ? JSON.stringify(ctx.recent_labs) : 'none provided';
    var conditions = Array.isArray(ctx.conditions) ? ctx.conditions.join(', ') : 'none provided';

    var patientSection = [
        'PATIENT CONTEXT:',
        '  Age: ' + (ctx.age || 'unknown'),
        '  Conditions: ' + conditions,
        '  Recent Labs: ' + labs,
    ].join('\n');

    var sourcesSection = 'MEDICATION SOURCES (' + body.sources.length + ' records):';
    body.sources.forEach(function (src, i) {
        var dateField = src.last_updated
            ? 'Last Updated: ' + src.last_updated
            : 'Last Filled: ' + (src.last_filled || 'unknown');

        sourcesSection += [
            '',
            '  Source ' + (i + 1) + ':',
            '    System: ' + src.system,
            '    Medication: ' + src.medication,
            '    ' + dateField,
            '    Reliability: ' + (src.source_reliability || 'unknown'),
        ].join('\n');
    });

    var task = [
        '',
        'TASK:',
        'Reconcile the medication records above. Apply clinical reasoning using the patient\'s',
        'labs (especially eGFR for renal dosing), conditions, source recency, and reliability.',
        'Return your answer as a single JSON object matching the schema in your system instructions.',
        'Today\'s date: ' + new Date().toISOString().split('T')[0],
    ].join('\n');

    return [patientSection, sourcesSection, task].join('\n\n');
}

/**
 * @param {Object} body  Validated request body { patient_context, sources }
 * @param {string} [apiKey]
 * @returns {Promise<Object>}
 */
async function reconcileMedications(body, apiKey) {
    var userPrompt = buildUserPrompt(body);
    return openaiService.callOpenAI(SYSTEM_PROMPT, userPrompt, apiKey);
}

module.exports = { reconcileMedications: reconcileMedications };
