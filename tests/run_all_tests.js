/**
 * CivicLoop - Comprehensive Automated Test Suite
 * Zero-dependency standalone runner for Node.js
 * Evaluates: AI Classification, Deduplication, Geospatial Clustering,
 * REST API Contracts, and Security Guards.
 */

const http = require('http');
const assert = require('assert');
const {
  autoCategorizeAndSummarize,
  detectDuplicate,
  evaluatePrioritization,
  clusterHotspots
} = require('../services/aiEngine');

let passedTests = 0;
let failedTests = 0;

function logTest(name, passed, err = null) {
  if (passed) {
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    passedTests++;
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    if (err) console.error(`    \x1b[31mError:\x1b[0m ${err.message}`);
    failedTests++;
  }
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('  CIVICLOOP COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // -----------------------------------------------------------------
  // 1. AI Categorization & Department Triage Unit Tests
  // -----------------------------------------------------------------
  console.log('1. AI Categorization & Department Triage:');
  try {
    const resRoad = autoCategorizeAndSummarize('Deep pothole on main road', 'Cars skidding on asphalt craters');
    assert.strictEqual(resRoad.category, 'damaged roads');
    assert.strictEqual(resRoad.assignedDepartment, 'Roads & Infrastructure');
    logTest('Correctly classifies "damaged roads" and assigns Roads & Infrastructure', true);
  } catch (e) { logTest('Damaged roads triage test', false, e); }

  try {
    const resWire = autoCategorizeAndSummarize('Snapped wire sparking', 'Live electric pole fallen on street');
    assert.strictEqual(resWire.category, 'broken streetlights');
    assert.strictEqual(resWire.assignedDepartment, 'Electrical & Energy');
    logTest('Correctly classifies electrical life-safety hazard and assigns Electrical & Energy', true);
  } catch (e) { logTest('Electrical triage test', false, e); }

  try {
    const resWater = autoCategorizeAndSummarize('Flooded underpass', 'Blocked drain with dirty sewerage water overflowing');
    assert.strictEqual(resWater.category, 'waterlogging');
    assert.strictEqual(resWater.assignedDepartment, 'Water & Sewerage');
    logTest('Correctly classifies stormwater flooding and assigns Water & Sewerage', true);
  } catch (e) { logTest('Waterlogging triage test', false, e); }

  // -----------------------------------------------------------------
  // 2. AI Explainable Prioritization & Severity Scoring
  // -----------------------------------------------------------------
  console.log('\n2. Explainable AI Prioritization & Severity Scoring:');
  try {
    const highHazard = evaluatePrioritization({
      title: 'Fallen live wire with sparks near school children',
      description: 'Severe electrocution danger',
      category: 'broken streetlights',
      location: { street: 'MG Road' }
    });
    assert.strictEqual(highHazard.priority, 'High');
    assert.ok(highHazard.urgencyScore >= 80, `Expected urgency >= 80, got ${highHazard.urgencyScore}`);
    assert.ok(highHazard.priorityReasoning.length > 10, 'Expected non-empty reasoning');
    logTest('High priority accurately triggered with urgency score >= 80 and explainable reasoning', true);
  } catch (e) { logTest('High priority evaluation test', false, e); }

  try {
    const lowIssue = evaluatePrioritization({
      title: 'Small litter paper on sidewalk',
      description: 'Minor dry leaves on grass',
      category: 'waste bins',
      location: { street: 'Residential Lane' }
    });
    assert.ok(lowIssue.urgencyScore <= 65, `Expected low/medium urgency <= 65, got ${lowIssue.urgencyScore}`);
    logTest('Minor non-hazardous issue receives moderate/low urgency score', true);
  } catch (e) { logTest('Low urgency evaluation test', false, e); }

  // -----------------------------------------------------------------
  // 3. AI Spatial & Semantic Duplicate Detection
  // -----------------------------------------------------------------
  console.log('\n3. AI Duplicate Detection & Corroboration Engine:');
  const mockCatalog = [
    {
      id: 'REP-1001',
      title: 'Deep pothole on MG Road near Metro Pillar 42',
      description: 'Asphalt crater causing severe vehicle damage',
      category: 'damaged roads',
      status: 'In Progress',
      location: { street: 'MG Road', area: 'Central Ward', lat: 12.9752, lng: 77.6094 }
    }
  ];

  try {
    const duplicateCandidate = {
      title: 'Dangerous pothole near metro pillar 42',
      description: 'Big pothole on MG Road where scooters skid',
      category: 'damaged roads',
      location: { street: 'MG Road', area: 'Central Ward', lat: 12.9753, lng: 77.6095 }
    };
    const dupCheck = detectDuplicate(duplicateCandidate, mockCatalog);
    assert.strictEqual(dupCheck.isDuplicate, true);
    assert.strictEqual(dupCheck.duplicateOf, 'REP-1001');
    assert.strictEqual(dupCheck.tokensAwarded, 10);
    logTest('Correctly identifies duplicate incident, links to parent REP-1001, and awards corroboration bonus', true);
  } catch (e) { logTest('Duplicate detection test', false, e); }

  try {
    const uniqueCandidate = {
      title: 'Broken water pipeline burst',
      description: 'Potable water leaking on 100 Feet Road',
      category: 'waterlogging',
      location: { street: '100 Feet Road', area: 'Indiranagar', lat: 12.9640, lng: 77.6400 }
    };
    const uniqueCheck = detectDuplicate(uniqueCandidate, mockCatalog);
    assert.strictEqual(uniqueCheck.isDuplicate, false);
    assert.strictEqual(uniqueCheck.tokensAwarded, 50);
    logTest('Correctly verifies unique incident at distinct location without false duplicate matches', true);
  } catch (e) { logTest('Unique incident detection test', false, e); }

  // -----------------------------------------------------------------
  // 4. Geospatial Radius Clustering (Haversine Formula)
  // -----------------------------------------------------------------
  console.log('\n4. Geospatial Corridor Hotspot Clustering:');
  try {
    const spatialCluster = clusterHotspots(mockCatalog);
    assert.ok(Array.isArray(spatialCluster), 'Expected cluster list');
    assert.ok(spatialCluster.length > 0, 'Expected at least 1 cluster');
    assert.ok(spatialCluster[0].street, 'Cluster must contain street name');
    assert.ok(spatialCluster[0].centroid?.lat, 'Cluster must have centroid GPS');
    logTest('Haversine algorithm clusters incidents by geographic corridor with valid centroids', true);
  } catch (e) { logTest('Geospatial clustering test', false, e); }

  // -----------------------------------------------------------------
  // 5. REST API Integration & Security Guard Tests
  // -----------------------------------------------------------------
  console.log('\n5. REST API Integration & Security Enforcement:');
  try {
    const resReports = await request({ path: '/api/reports', method: 'GET' });
    assert.strictEqual(resReports.status, 200);
    assert.strictEqual(resReports.data.success, true);
    assert.ok(Array.isArray(resReports.data.reports));
    logTest('GET /api/reports responds with HTTP 200 and reports array', true);
  } catch (e) { logTest('GET /api/reports test', false, e); }

  try {
    const resStats = await request({ path: '/api/insights/stats', method: 'GET' });
    assert.strictEqual(resStats.status, 200);
    assert.strictEqual(resStats.data.success, true);
    assert.ok(typeof resStats.data.metrics.total === 'number');
    assert.ok(typeof resStats.data.metrics.highPriority === 'number');
    logTest('GET /api/insights/stats returns calculated municipal KPIs', true);
  } catch (e) { logTest('GET /api/insights/stats test', false, e); }

  try {
    const resWallet = await request({ path: '/api/wallet', method: 'GET' });
    assert.strictEqual(resWallet.status, 200);
    assert.strictEqual(resWallet.data.success, true);
    assert.ok(typeof resWallet.data.wallet.balance === 'number');
    logTest('GET /api/wallet returns citizen token ledger and balance', true);
  } catch (e) { logTest('GET /api/wallet test', false, e); }

  try {
    // Security Guard: Unauthorized PATCH should return HTTP 401
    const unauthPatch = await request({
      path: '/api/reports/REP-1001/status',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'In Progress' });

    assert.strictEqual(unauthPatch.status, 401);
    assert.strictEqual(unauthPatch.data.success, false);
    logTest('PATCH /api/reports/:id/status rejects unauthorized requests with HTTP 401 Guard', true);
  } catch (e) { logTest('Unauthorized PATCH test', false, e); }

  try {
    // Security Guard: Authorized PATCH with X-Worker-Key should return HTTP 200
    const authPatch = await request({
      path: '/api/reports/REP-1001/status',
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Key': 'civicloop-field-worker-2026'
      }
    }, {
      status: 'In Progress',
      resolutionNotes: 'Dispatched response unit to site.'
    });

    assert.strictEqual(authPatch.status, 200);
    assert.strictEqual(authPatch.data.success, true);
    assert.strictEqual(authPatch.data.report.status, 'In Progress');
    logTest('PATCH /api/reports/:id/status succeeds with HTTP 200 when municipal worker key provided', true);
  } catch (e) { logTest('Authorized PATCH test', false, e); }

  try {
    // XSS Sanitization & Image Disk Upload
    const postReport = await request({
      path: '/api/reports',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      title: '<script>alert("hack")</script>Clogged storm drain on Commercial St',
      description: 'Water accumulation on intersection',
      category: 'waterlogging',
      location: { street: 'Commercial Street', area: 'Central Ward' }
    });

    assert.strictEqual(postReport.status, 201);
    assert.strictEqual(postReport.data.success, true);
    assert.ok(!postReport.data.report.title.includes('<script>'), 'Title must have XSS tags stripped');
    logTest('POST /api/reports sanitizes XSS inputs and safely logs complaint', true);
  } catch (e) { logTest('POST /api/reports XSS test', false, e); }

  console.log('\n------------------------------------------------------');
  console.log(`  TOTAL TESTS: ${passedTests + failedTests}`);
  console.log(`  PASSED:      \x1b[32m${passedTests}\x1b[0m`);
  console.log(`  FAILED:      \x1b[31m${failedTests}\x1b[0m`);
  console.log('------------------------------------------------------\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m  ALL 13 AUTOMATED TESTS PASSED WITH 100% SUCCESS!\x1b[0m\n');
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
