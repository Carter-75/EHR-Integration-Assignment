'use strict';

var express = require('express');
var router = express.Router();

var reconcileService = require('../services/reconcileService');
var ReconciliationResult = require('../models/ReconciliationResult');
var openaiService = require('../services/openaiService');

/**
 * POST /api/reconcile/medication
 *
 * Accepts conflicting medication records from multiple sources and returns
 * a reconciled medication with confidence score and clinical reasoning,
 * powered by OpenAI. 
 */
router.post('/api/reconcile/medication', async function (req, res, next) {
    var body = req.body;

    if (!body || typeof body !== 'object') {
        return res.status(400).json({ message: 'Request body must be a JSON object.', error: {} });
    }
    if (!Array.isArray(body.sources) || body.sources.length === 0) {
        return res.status(400).json({ message: 'sources must be a non-empty array.', error: {} });
    }
    if (!body.patient_context || typeof body.patient_context !== 'object') {
        return res.status(400).json({ message: 'patient_context must be an object.', error: {} });
    }

    try {
        var result = await reconcileService.reconcileMedications(body);

        var schemaError = openaiService.validateReconciliationResult(result);
        if (schemaError) {
            var validationErr = new Error(schemaError);
            validationErr.status = 502;
            return next(validationErr);
        }

        // The save has its own try/catch so a DB failure doesn't swallow the AI result.
        // If the save fails, the error is logged and a warning field is added to the
        // response — the client always receives the computed clinical data.
        var responsePayload = JSON.parse(JSON.stringify(result));

        var now = new Date();
        var record = {
            patient_context: body.patient_context,
            sources: body.sources,
            reconciled_medication: result.reconciled_medication,
            confidence_score: result.confidence_score,
            reasoning: result.reasoning,
            recommended_actions: result.recommended_actions || [],
            clinical_safety_check: result.clinical_safety_check,
            createdAt: now,
            updatedAt: now
        };

        try {
            ReconciliationResult.push(record);
        } catch (saveErr) {
            console.error(
                '[In-Memory Store] Failed to persist ReconciliationResult.' +
                ' Message: ' + saveErr.message
            );
            responsePayload.warning = 'Result could not be persisted to database. Please save this response manually.';
        }

        return res.status(200).json(responsePayload);

    } catch (err) {
        return next(err);
    }
});

module.exports = router;
