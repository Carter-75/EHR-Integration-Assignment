'use strict';

var OpenAI = require('openai');

// The client is initialised once on first call rather than at module load.
// bin/www already guards against a missing key at startup, but this keeps
// the module safe to require in test contexts where the server isn't booting.
var _client = null;

function getClient(apiKey) {
    var keyToUse = apiKey || process.env.OPENAI_API_KEY;
    if (!keyToUse) {
        throw new Error('OpenAI API key was not provided in the request Authorization header.');
    }
    
    // Always create a new client if an explicit key is passed, 
    // otherwise reuse the singleton created from env var
    if (apiKey) {
        return new OpenAI({ apiKey: apiKey });
    }
    
    if (!_client) {
        _client = new OpenAI({ apiKey: keyToUse });
    }
    return _client;
}

/**
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Single chat completion attempt. Throws on any API or network error.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} [apiKey]
 * @returns {Promise<string>} Raw response content string
 */
async function attemptCall(systemPrompt, userPrompt, apiKey) {
    var client = getClient(apiKey);

    var response = await client.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        // Low temperature keeps clinical reasoning stable across repeated calls.
        temperature: 0.2
    });

    return response.choices[0].message.content;
}

/**
 * Call the OpenAI chat completions API and return a parsed JSON object.
 *
 * Rate-limit policy: up to 3 retries with exponential backoff (1 s → 2 s → 4 s).
 * Bad-JSON policy: retry the call once; if still unparseable, throw 502.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} [apiKey]
 * @returns {Promise<Object>}
 */
async function callOpenAI(systemPrompt, userPrompt, apiKey) {
    var maxRetries = 3;
    var attempt = 0;
    var raw;

    while (attempt <= maxRetries) {
        try {
            raw = await attemptCall(systemPrompt, userPrompt, apiKey);
            break;
        } catch (err) {
            var status = err.status || (err.response && err.response.status);

            if (status === 429 && attempt < maxRetries) {
                var delay = Math.pow(2, attempt) * 1000;
                console.warn('[OpenAI] Rate limited (429). Retrying in ' + delay + 'ms... (attempt ' + (attempt + 1) + '/' + maxRetries + ')');
                await sleep(delay);
                attempt++;
                continue;
            }

            var serviceErr = new Error('OpenAI API call failed: ' + (err.message || 'Unknown error'));
            serviceErr.status = attempt >= maxRetries ? 503 : (status || 500);
            throw serviceErr;
        }
    }

    // json_object response_format guarantees valid JSON from the API, but guard
    // against any edge case where the content is empty or malformed.
    try {
        return JSON.parse(raw);
    } catch (_parseErr) {
        console.warn('[OpenAI] Response was not valid JSON. Retrying once...');

        try {
            raw = await attemptCall(systemPrompt, userPrompt, apiKey);
        } catch (retryCallErr) {
            var retryCallError = new Error('OpenAI API call failed on JSON-retry attempt: ' + (retryCallErr.message || 'Unknown error'));
            retryCallError.status = retryCallErr.status || 502;
            throw retryCallError;
        }

        try {
            return JSON.parse(raw);
        } catch (_parseErr2) {
            var parseError = new Error('OpenAI returned invalid JSON after retry.');
            parseError.status = 502;
            throw parseError;
        }
    }
}

/**
 * Validate a medication reconciliation response from OpenAI.
 *
 * Returns null if valid. Returns a string listing each failing field if not.
 * Called before any DB save so Mongoose never receives an incomplete document.
 *
 * @param {Object} result
 * @returns {string|null}
 */
function validateReconciliationResult(result) {
    var problems = [];

    if (typeof result.reconciled_medication !== 'string' || result.reconciled_medication.trim() === '') {
        problems.push('reconciled_medication (must be a non-empty string)');
    }
    if (typeof result.confidence_score !== 'number' || result.confidence_score < 0 || result.confidence_score > 1) {
        problems.push('confidence_score (must be a number between 0 and 1)');
    }
    if (typeof result.reasoning !== 'string' || result.reasoning.trim() === '') {
        problems.push('reasoning (must be a non-empty string)');
    }
    if (!Array.isArray(result.recommended_actions) || result.recommended_actions.length === 0) {
        problems.push('recommended_actions (must be an array with at least one item)');
    }
    if (typeof result.clinical_safety_check !== 'string' || result.clinical_safety_check.trim() === '') {
        problems.push('clinical_safety_check (must be a non-empty string)');
    }

    return problems.length > 0
        ? 'OpenAI response was missing or malformed fields: ' + problems.join('; ')
        : null;
}

/**
 * Validate a data quality assessment response from OpenAI.
 *
 * Returns null if valid. Returns a string listing each failing field if not.
 * Called before any DB save so Mongoose never receives an incomplete document.
 *
 * @param {Object} result
 * @returns {string|null}
 */
function validateDataQualityResult(result) {
    var problems = [];

    if (typeof result.overall_score !== 'number' || result.overall_score < 0 || result.overall_score > 100) {
        problems.push('overall_score (must be a number between 0 and 100)');
    }

    if (!result.breakdown || typeof result.breakdown !== 'object') {
        problems.push('breakdown (must be an object)');
    } else {
        var dims = ['completeness', 'accuracy', 'timeliness', 'clinical_plausibility'];
        dims.forEach(function (dim) {
            if (typeof result.breakdown[dim] !== 'number') {
                problems.push('breakdown.' + dim + ' (must be a number)');
            }
        });
    }

    if (!Array.isArray(result.issues_detected)) {
        problems.push('issues_detected (must be an array)');
    }

    return problems.length > 0
        ? 'OpenAI response was missing or malformed fields: ' + problems.join('; ')
        : null;
}

module.exports = {
    callOpenAI: callOpenAI,
    validateReconciliationResult: validateReconciliationResult,
    validateDataQualityResult: validateDataQualityResult
};
