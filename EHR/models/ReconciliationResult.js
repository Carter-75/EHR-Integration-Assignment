'use strict';

/**
 * ReconciliationResult.js
 *
 * Mongoose model for persisting medication reconciliation results.
 * Stores the original request alongside the AI-generated output so
 * results are auditable and can be retrieved without re-calling OpenAI.
 */

var mongoose = require('mongoose');

var ReconciliationResultSchema = new mongoose.Schema(
    {
        patient_context: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        sources: {
            type: [mongoose.Schema.Types.Mixed],
            required: true
        },

        reconciled_medication: {
            type: String,
            required: true
        },
        confidence_score: {
            type: Number,
            required: true,
            min: 0,
            max: 1
        },
        reasoning: {
            type: String,
            required: true
        },
        recommended_actions: {
            type: [String],
            default: []
        },
        clinical_safety_check: {
            type: String,
            enum: ['PASSED', 'WARNING', 'FAILED'],
            required: true
        }
    },
    {
        timestamps: true  // createdAt / updatedAt auto-managed
    }
);

module.exports = mongoose.model('ReconciliationResult', ReconciliationResultSchema);
