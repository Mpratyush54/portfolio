const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    fullDescription: String,
    features: [String],
    tags: [String],
    imageUrl: String,
    gallery: [String],
    architecture: {
        title: String,
        steps: [{
            icon: String,
            label: String,
            description: String
        }]
    },
    techDetails: [{
        title: String,
        description: String,
        category: String,
        tags: [String]
    }],
    deployment: {
        type: String,
        platform: String,
        url: String,
        details: String,
        ciCd: String
    },
    link: String,
    repo: String,
    frontendRepo: String,
    backendRepo: String,
    category: { type: String, default: 'Web' },
    source: { type: String, enum: ['github', 'gitlab', 'manual'], default: 'manual' },
    sourceUrl: String,
    sourceId: String,
    lastSyncedAt: Date,
    featured: Boolean,
    languageStats: [{ name: String, percent: Number, color: String }],
    status: {
        phase: { type: String, enum: ['Development', 'Production', 'Archived'] },
        since: String,
        ciStatus: { type: String, enum: ['Passing', 'Failing', 'Not Configured'] },
        deploymentType: String
    },
    timeline: {
        start: String,
        end: String,
        history: [{ phase: String, date: String, completed: Boolean, link: String }]
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
