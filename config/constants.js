/**
 * CivicLoop - Central System Configuration & Constants
 * Standardized configuration tokens, municipal departments, and reward parameters.
 * @module config/constants
 */

module.exports = {
  // Network & Environment
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WORKER_SECRET: process.env.WORKER_SECRET || 'civicloop-field-worker-2026',
  DEFAULT_USER_ID: process.env.DEFAULT_USER_ID || 'CITIZEN-CURRENT',

  // Rate Limiting Parameters (Requests per window per IP)
  RATE_LIMITS: {
    WINDOW_MS: 60 * 1000, // 1 minute window
    GLOBAL_MAX: 150,      // General API read limit
    SUBMISSION_MAX: 30,   // Report creation limit
    MUTATION_MAX: 60      // Worker status change limit
  },

  // Token Incentive Economy Rules
  REWARDS: {
    UNIQUE_VERIFIED_REPORT: 50,  // Standard reward for valid unique report
    CORROBORATION_DUPLICATE: 10, // Reduced anti-spam incentive
    RESOLUTION_VERIFIED_BONUS: 100 // Awarded to citizen when issue is resolved
  },

  // Municipal Departments & Routing Taxonomy
  DEPARTMENTS: {
    ROADS: 'Roads & Infrastructure',
    ELECTRICAL: 'Electrical & Energy',
    WATER: 'Water & Sewerage',
    SANITATION: 'Solid Waste Management',
    TRAFFIC: 'Traffic Management'
  },

  // Valid Municipal Workflow States
  VALID_STATUSES: ['Submitted', 'In Progress', 'Resolved'],

  // Geospatial Defaults (Bangalore Central Corridor)
  GEO_DEFAULTS: {
    LAT: 12.9752,
    LNG: 77.6094,
    CLUSTER_RADIUS_METERS: 350
  }
};
