'use strict';

/**
 * DataQualityResult.js
 *
 * Mongoose model for persisting data quality assessment results.
 * Stores the original patient record alongside the AI-generated scores
 * and issues for audit trail purposes.
 */

var mongoose = require('mongoose');

var IssueSchema = new mongoose.Schema(
    {
        field: { type: String, required: true },
        issue: { type: String, required: true },
        severity: { type: String, enum: ['high', 'medium', 'low'], required: true }
    },
    { _id: false }
);

var DataQualityResultSchema = new mongoose.Schema(
    {
        patient_record: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },

        overall_score: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        breakdown: {
            completeness: { type: Number, required: true },
            accuracy: { type: Number, required: true },
            timeliness: { type: Number, required: true },
            clinical_plausibility: { type: Number, required: true }
        },
        issues_detected: {
            type: [IssueSchema],
            default: []
        }
    },
    {
        timestamps: true  // createdAt / updatedAt auto-managed
    }
);

module.exports = mongoose.model('DataQualityResult', DataQualityResultSchema);
