/**
 * CivicLoop - Senior QA Diagnostic & Edge-Case Verification Suite
 * Tests all 4 core scenarios requested:
 * 1. API Endpoint Integrity (GET, POST, PATCH, Hotspots)
 * 2. AI Pipeline & Anti-Fraud Logic (Deduplication, Token Restrictions, Priority Reasoning)
 * 3. Cross-Device / Payload Edge Cases
 * 4. Error Boundaries (Empty inputs, invalid statuses, malformed JSON, 404s)
 */

const http = require('http');
const assert = require('assert');

let passedCount = 0;
let failedCount = 0;

function reportResult(name, passed, detail = '') {
  if (passed) {
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
    if (detail) console.log(`         \x1b[90m↳ ${detail}\x1b[0m`);
    passedCount++;
  } else {
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}`);
    if (detail) console.log(`         \x1b[31m↳ ${detail}\x1b[0m`);
    failedCount++;
  }
}

function req(options, body = null) {
  return new Promise((resolve) => {
    const request = http.request({
      hostname: 'localhost',
      port: 3000,
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    request.on('error', (err) => resolve({ error: err }));
    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

async function runDiagnostic() {
  console.log('\n=============================================================');
  console.log('  CIVICLOOP RIGOROUS QA LEAD DIAGNOSTIC AUDIT');
  console.log('=============================================================\n');

  // =================================================================
  // SCENARIO 1: API Endpoint Integrity
  // =================================================================
  console.log('\x1b[1m--- SCENARIO 1: API ENDPOINT INTEGRITY ---\x1b[0m');

  // 1.1 GET /api/reports
  const resGet = await req({ path: '/api/reports', method: 'GET' });
  const getPassed = resGet.status === 200 && resGet.data.success === true && Array.isArray(resGet.data.reports) && resGet.data.reports.length > 0;
  reportResult('GET /api/reports: Returns catalog accurately', getPassed, `Fetched ${resGet.data.count || resGet.data.reports?.length} active reports`);

  // 1.2 POST /api/reports (AI Engine Execution & Coin Allocation)
  const initialWallet = await req({ path: '/api/wallet', method: 'GET' });
  const startBalance = initialWallet.data.wallet.balance;

  const testUniqueTag = Date.now();
  const testStreet = `Skyline Avenue ${testUniqueTag}`;
  const testTitle = `Damaged tarmac obstruction blocking emergency access [REF-${testUniqueTag}]`;
  const testDesc = `Severe asphalt pavement rupture blocking ambulance access lane near hospital emergency wing #${testUniqueTag}`;

  const resPost = await req({
    path: '/api/reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    title: testTitle,
    description: testDesc,
    category: 'damaged roads',
    location: { street: testStreet, area: 'North Ward', landmark: `City General Hospital Gate #${testUniqueTag.toString().slice(-3)}` }
  });

  const postPassed = resPost.status === 201 &&
                     resPost.data.success === true &&
                     resPost.data.report.category === 'damaged roads' &&
                     resPost.data.report.assignedDepartment === 'Roads & Infrastructure' &&
                     resPost.data.report.aiMetadata?.priority === 'High' &&
                     resPost.data.tokensAwarded === 50 &&
                     resPost.data.walletBalance === startBalance + 50;

  reportResult('POST /api/reports: Executes AI Engine (Category, High Priority, +50 Coins)', postPassed,
    `Category: "${resPost.data.report?.category}" | Dept: "${resPost.data.report?.assignedDepartment}" | Urgency: ${resPost.data.report?.aiMetadata?.urgencyScore} | Tokens: +${resPost.data.tokensAwarded}`);

  const createdId = resPost.data.report?.id;

  // 1.3 PATCH /api/reports/:id/status (Submitted -> In Progress -> Resolved + Bonus 100)
  const resPatchProgress = await req({
    path: `/api/reports/${createdId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Key': 'civicloop-field-worker-2026'
    }
  }, { status: 'In Progress', resolutionNotes: 'Line maintenance crew dispatched' });

  const progressPassed = resPatchProgress.status === 200 && resPatchProgress.data.report?.status === 'In Progress';
  reportResult('PATCH /api/reports/:id/status: Transition to "In Progress"', progressPassed, `Status: ${resPatchProgress.data.report?.status}`);

  const preResolveWallet = await req({ path: '/api/wallet', method: 'GET' });
  const preResolveBalance = preResolveWallet.data.wallet.balance;

  const resPatchResolved = await req({
    path: `/api/reports/${createdId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Key': 'civicloop-field-worker-2026'
    }
  }, {
    status: 'Resolved',
    resolutionNotes: 'Wire re-insulated and streetlight repaired.',
    resolvedImageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600'
  });

  const postResolveWallet = await req({ path: '/api/wallet', method: 'GET' });
  const resolvePassed = resPatchResolved.status === 200 &&
                        resPatchResolved.data.report?.status === 'Resolved' &&
                        resPatchResolved.data.bonusAwarded === 100 &&
                        postResolveWallet.data.wallet.balance === preResolveBalance + 100;

  reportResult('PATCH /api/reports/:id/status: Transition to "Resolved" + 100 Bonus Coins', resolvePassed,
    `Status: ${resPatchResolved.data.report?.status} | Bonus Coins Awarded: +${resPatchResolved.data.bonusAwarded} | Resolved At: ${resPatchResolved.data.report?.resolvedAt}`);

  // 1.4 GET /api/insights/hotspots
  const resHotspots = await req({ path: '/api/insights/hotspots', method: 'GET' });
  const hotspotsPassed = resHotspots.status === 200 &&
                         resHotspots.data.success === true &&
                         Array.isArray(resHotspots.data.hotspots) &&
                         resHotspots.data.hotspots.length > 0;
  reportResult('GET /api/insights/hotspots: Returns clustered geospatial hotspots', hotspotsPassed,
    `Total Clusters: ${resHotspots.data.totalClusters} | Primary Zone: "${resHotspots.data.hotspots[0]?.street}" (${resHotspots.data.hotspots[0]?.totalReports} reports)`);

  // =================================================================
  // SCENARIO 2: AI Pipeline & Anti-Fraud Logic
  // =================================================================
  console.log('\n\x1b[1m--- SCENARIO 2: AI PIPELINE & ANTI-FRAUD LOGIC ---\x1b[0m');

  // 2.1 Deduplication Penalty (Anti-Spam)
  const dupSubmission = await req({
    path: '/api/reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    title: testTitle,
    description: testDesc,
    category: 'damaged roads',
    location: { street: testStreet, area: 'North Ward', landmark: `Near School Gate #${testUniqueTag.toString().slice(-3)}` }
  });

  const isDupDetected = dupSubmission.status === 201 &&
                        dupSubmission.data.report?.aiMetadata?.isDuplicate === true &&
                        dupSubmission.data.tokensAwarded === 10; // Anti-spam rate limit: +10 instead of +50

  reportResult('Anti-Fraud: Duplicate submission detected & reward restricted to +10 corroboration coins', isDupDetected,
    `isDuplicate: ${dupSubmission.data.report?.aiMetadata?.isDuplicate} | duplicateOf: #${dupSubmission.data.report?.aiMetadata?.duplicateOf} | similarity: ${(dupSubmission.data.report?.aiMetadata?.similarityScore * 100).toFixed(0)}% | tokensAwarded: +${dupSubmission.data.tokensAwarded}`);

  // 2.2 Explainable AI Priority Reasoning
  const reasoning = resPost.data.report?.aiMetadata?.priorityReasoning || '';
  const reasoningPassed = reasoning.length > 20 &&
                          (reasoning.toLowerCase().includes('collapse') || reasoning.toLowerCase().includes('accident') || reasoning.toLowerCase().includes('hazard') || reasoning.toLowerCase().includes('safety') || reasoning.toLowerCase().includes('priority'));

  reportResult('Explainable AI: Generates human-readable safety reasoning', reasoningPassed,
    `Explanation text: "${reasoning}"`);

  // =================================================================
  // SCENARIO 3 & 4: Error Handling, Security Boundaries & Edge Cases
  // =================================================================
  console.log('\n\x1b[1m--- SCENARIO 3 & 4: ERROR HANDLING & EDGE CASES ---\x1b[0m');

  // 4.1 Empty / Missing Title
  const emptyTitleRes = await req({
    path: '/api/reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { title: '', description: 'Valid description here' });
  const emptyTitlePassed = emptyTitleRes.status === 400 && emptyTitleRes.data.success === false;
  reportResult('Error Boundary: Empty title returns HTTP 400 validation error', emptyTitlePassed, `Message: "${emptyTitleRes.data.message}"`);

  // 4.2 Empty / Missing Description
  const emptyDescRes = await req({
    path: '/api/reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { title: 'Pothole on street', description: '    ' });
  const emptyDescPassed = emptyDescRes.status === 400 && emptyDescRes.data.success === false;
  reportResult('Error Boundary: Whitespace-only description returns HTTP 400 validation error', emptyDescPassed, `Message: "${emptyDescRes.data.message}"`);

  // 4.3 Unauthorized Worker Patch
  const unauthRes = await req({
    path: `/api/reports/${createdId}/status`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' } // No worker key
  }, { status: 'Resolved' });
  const unauthPassed = unauthRes.status === 401 && unauthRes.data.success === false;
  reportResult('Security Boundary: Unauthorized worker mutation rejected with HTTP 401', unauthPassed, `Message: "${unauthRes.data.message}"`);

  // 4.4 Invalid Workflow Status Value
  const invalidStatusRes = await req({
    path: `/api/reports/${createdId}/status`,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Worker-Key': 'civicloop-field-worker-2026'
    }
  }, { status: 'InvalidStatusXYZ' });
  const invalidStatusPassed = invalidStatusRes.status === 400 && invalidStatusRes.data.success === false;
  reportResult('Error Boundary: Invalid workflow status rejected with HTTP 400', invalidStatusPassed, `Message: "${invalidStatusRes.data.message}"`);

  // 4.5 Non-Existent Ticket ID
  const notFoundRes = await req({ path: '/api/reports/REP-NONEXISTENT-99999', method: 'GET' });
  const notFoundPassed = notFoundRes.status === 404 && notFoundRes.data.success === false;
  reportResult('Error Boundary: Non-existent ticket returns clean HTTP 404', notFoundPassed, `Message: "${notFoundRes.data.message}"`);

  // 4.6 Malformed JSON Payload Handling
  const malformedRes = await req({
    path: '/api/reports',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, '{ title: "Unclosed json string... ');
  const malformedPassed = malformedRes.status === 400 && malformedRes.data.success === false;
  reportResult('Error Boundary: Malformed client JSON payload returns clean HTTP 400 (no 500 crash)', malformedPassed, `Message: "${malformedRes.data.message}"`);

  // 4.7 Insufficient Wallet Balance for Redemption
  const overdrawRes = await req({
    path: '/api/wallet/redeem',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { cost: 999999, rewardTitle: 'Super Expensive Reward' });
  const overdrawPassed = overdrawRes.status === 400 && overdrawRes.data.success === false;
  reportResult('Wallet Protection: Overdraw request safely rejected with HTTP 400', overdrawPassed, `Message: "${overdrawRes.data.message}"`);

  // =================================================================
  // SUMMARY
  // =================================================================
  console.log('\n-------------------------------------------------------------');
  console.log(`  DIAGNOSTIC AUDIT RESULTS:`);
  console.log(`  TOTAL SCENARIOS CHECKED: ${passedCount + failedCount}`);
  console.log(`  PASSED:                  \x1b[32m${passedCount}\x1b[0m`);
  console.log(`  FAILED:                  \x1b[31m${failedCount}\x1b[0m`);
  console.log('-------------------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m  ALL RIGOROUS QA DIAGNOSTIC SCENARIOS PASSED WITH ZERO ERRORS.\x1b[0m\n');
    process.exit(0);
  }
}

runDiagnostic().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
