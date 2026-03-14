'use strict';

var express = require('express');
var router = express.Router();

var dataQualityService = require('../services/dataQualityService');
var DataQualityResult = require('../models/DataQualityResult');
var openaiService = require('../services/openaiService');

/**
 * POST /api/validate/data-quality
 *
 * Accepts a patient record and returns a data quality score (0–100)
 * with a breakdown by dimension and a list of detected issues,
 * powered by OpenAI. The result is persisted to MongoDB.
 */
router.post('/api/validate/data-quality', async function (req, res, next) {
    var body = req.body;
    
    var apiKey = '';
    var authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
    }

    if (!body || typeof body !== 'object') {
        return res.status(400).json({ message: 'Request body must be a JSON object.', error: {} });
    }
    if (!body.demographics || typeof body.demographics !== 'object') {
        return res.status(400).json({ message: 'demographics is required and must be an object.', error: {} });
    }

    try {
        var result = await dataQualityService.assessDataQuality(body, apiKey);

        var schemaError = openaiService.validateDataQualityResult(result);
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
            patient_record: body,
            overall_score: result.overall_score,
            breakdown: result.breakdown,
            issues_detected: result.issues_detected || [],
            createdAt: now,
            updatedAt: now
        };

        try {
            DataQualityResult.push(record);
        } catch (saveErr) {
            console.error(
                '[In-Memory Store] Failed to persist DataQualityResult.' +
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
