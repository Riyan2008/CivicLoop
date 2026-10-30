/**
 * CivicLoop - AI Engine Service
 * 
 * Provides production-grade heuristic and algorithmic NLP services:
 * 1. Auto-Categorization & 1-sentence abstractive/extractive summarization
 * 2. Duplicate Detection via Lexical Similarity + Geospatial Proximity
 * 3. Explainable Prioritization (High / Medium / Low) with plain-language rationale
 * 4. Geospatial & Street-level Hotspot Clustering
 */

// Category Lexicon with weighted key terms and department routing
const CATEGORY_TAXONOMY = {
  'damaged roads': {
    department: 'Roads & Infrastructure',
    keywords: [
      'pothole', 'crater', 'asphalt', 'tarmac', 'road', 'sinkhole', 'cave-in',
      'paver', 'curb', 'undulation', 'rutting', 'trench', 'gravel', 'speed breaker',
      'divider', 'footpath', 'skid', 'accident', 'tire', 'car bottom', 'lane'
    ],
    urgencyWeight: 1.2
  },
  'waterlogging': {
    department: 'Water & Sewerage',
    keywords: [
      'waterlogging', 'water', 'flood', 'flooding', 'rainwater', 'drain', 'drainage',
      'storm water', 'manhole', 'sewage', 'clogged', 'submerged', 'knee-deep',
      'pipe burst', 'gutter', 'stagnant', 'pool', 'swamped', 'slush', 'overflow'
    ],
    urgencyWeight: 1.3
  },
  'broken streetlights': {
    department: 'Electrical & Energy',
    keywords: [
      'streetlight', 'street light', 'lamp', 'pole', 'post', 'wire', 'wires',
      'sparking', 'spark', 'electrocution', 'blackout', 'dark', 'pitch black',
      'darkness', 'bulb', 'luminaire', 'fixture', 'tube light', 'subway lights', 'cable'
    ],
    urgencyWeight: 1.4
  },
  'waste bins': {
    department: 'Solid Waste Management',
    keywords: [
      'waste', 'garbage', 'bin', 'dumpster', 'trash', 'litter', 'rubbish',
      'stench', 'smell', 'rotting', 'maggots', 'medical waste', 'syringes',
      'debris', 'dumped', 'overflowing', 'pest', 'rubble', 'plastic'
    ],
    urgencyWeight: 1.0
  }
};

// Life-safety hazard indicators for explainable prioritization
const CRITICAL_HAZARDS = [
  { term: 'live wire', weight: 45, reason: 'Exposed live electrical conductor poses immediate electrocution hazard' },
  { term: 'sparking', weight: 40, reason: 'Active electrical arcing creates severe fire and life-safety danger' },
  { term: 'sinkhole', weight: 45, reason: 'Sudden structural collapse of road surface risks catastrophic entrapment' },
  { term: 'school', weight: 30, reason: 'Close proximity to vulnerable pedestrian population (school children)' },
  { term: 'hospital', weight: 35, reason: 'Impedes emergency vehicle and patient access to healthcare facility' },
  { term: 'ambulance', weight: 35, reason: 'Direct obstruction to life-saving medical transit' },
  { term: 'open manhole', weight: 40, reason: 'Concealed deep opening presents severe fall or drowning hazard' },
  { term: 'submerged manhole', weight: 45, reason: 'Invisible open drain underneath water poses mortal trap' },
  { term: 'medical waste', weight: 35, reason: 'Bio-hazardous clinical debris and contaminated sharps exposure' },
  { term: 'syringe', weight: 35, reason: 'Unshielded clinical sharps present immediate disease transmission risk' },
  { term: 'skid', weight: 25, reason: 'Reported vehicular loss of traction and collision incidents' },
  { term: 'blackout', weight: 25, reason: 'Total nocturnal illumination failure elevates crime and vehicular collision rates' },
  { term: 'knee-deep', weight: 25, reason: 'Severe standing water depth obstructing emergency transit' }
];

/**
 * Text normalizer and tokenizer helper
 * @param {string} text - Raw input text
 * @returns {string[]} Array of normalized word tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'this', 'that', 'these', 'those', 'it', 'its', 'near', 'very', 'here', 'there'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !stopWords.has(token));
}

/**
 * Calculate Jaccard similarity coefficient between two token sets
 * @param {string[]} tokensA 
 * @param {string[]} tokensB 
 * @returns {number} Jaccard similarity coefficient (0.0 to 1.0)
 */
function calculateJaccardSimilarity(tokensA = [], tokensB = []) {
  if (!Array.isArray(tokensA) || !Array.isArray(tokensB) || !tokensA.length || !tokensB.length) {
    return 0;
  }
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) intersectionSize++;
  }
  
  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Haversine formula to calculate spherical distance between two coordinates in meters
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters (or Infinity if coordinates are invalid)
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
    return Infinity;
  }

  const R = 6371e3; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 1. Auto-Categorize text and generate 1-sentence summary
 * @param {string} title - Incident title
 * @param {string} description - Incident description
 * @param {string} [userCategory] - User-selected category override
 * @returns {Object} { category, confidence, assignedDepartment, summary }
 */
function autoCategorizeAndSummarize(title = '', description = '', userCategory = null) {
  const safeTitle = typeof title === 'string' ? title.trim() : '';
  const safeDescription = typeof description === 'string' ? description.trim() : '';
  const combinedText = `${safeTitle} ${safeDescription}`.toLowerCase();
  
  // Score categories based on keyword taxonomy
  const categoryScores = {};
  for (const [category, meta] of Object.entries(CATEGORY_TAXONOMY)) {
    let score = 0;
    for (const kw of meta.keywords) {
      if (combinedText.includes(kw)) {
        score += kw.includes(' ') ? 3 : 1.5;
      }
    }
    categoryScores[category] = score;
  }
  
  // Pick highest scoring category
  let predictedCategory = userCategory;
  let highestScore = 0;
  
  for (const [category, score] of Object.entries(categoryScores)) {
    if (score > highestScore) {
      highestScore = score;
      predictedCategory = category;
    }
  }

  // Graceful fallback to user category or 'damaged roads' default
  if (!predictedCategory || highestScore === 0) {
    predictedCategory = userCategory && CATEGORY_TAXONOMY[userCategory] ? userCategory : 'damaged roads';
  }

  const confidence = highestScore > 0 ? Math.min(0.99, 0.70 + (highestScore * 0.05)) : 0.75;
  const assignedDepartment = CATEGORY_TAXONOMY[predictedCategory]?.department || 'Public Works';

  // Generate crisp 1-sentence AI summary
  let cleanDesc = safeDescription.replace(/\s+/g, ' ');
  if (cleanDesc.length > 130) {
    cleanDesc = cleanDesc.substring(0, 127) + '...';
  }
  
  const baseTitle = safeTitle || 'Civic Incident Reported';
  const summary = cleanDesc 
    ? `${baseTitle}. ${cleanDesc.endsWith('.') ? cleanDesc : cleanDesc + '.'}`
    : `${baseTitle}. Civic complaint logged for municipal inspection.`;

  return {
    category: predictedCategory,
    confidence: Number(confidence.toFixed(2)),
    assignedDepartment,
    summary
  };
}

/**
 * 2. Duplicate Detection
 * Checks text similarity and location proximity against existing reports.
 * Returns match score, parent duplicate ID, and token incentive adjustment.
 * @param {Object} candidateReport 
 * @param {Array} [existingReports=[]] 
 * @returns {Object} Duplicate analysis payload
 */
function detectDuplicate(candidateReport = {}, existingReports = []) {
  if (!candidateReport || typeof candidateReport !== 'object') {
    return {
      isDuplicate: false,
      duplicateOf: null,
      similarityScore: 0,
      matchReason: 'Invalid report data for duplicate verification.',
      tokensAwarded: 50
    };
  }

  const reportsList = Array.isArray(existingReports) ? existingReports : [];
  const candidateTitle = typeof candidateReport.title === 'string' ? candidateReport.title : '';
  const candidateDesc = typeof candidateReport.description === 'string' ? candidateReport.description : '';
  const candidateTokens = tokenize(`${candidateTitle} ${candidateDesc}`);
  const candidateStreet = (candidateReport.location?.street || '').toLowerCase().trim();
  const candidateLat = candidateReport.location?.lat;
  const candidateLng = candidateReport.location?.lng;

  let bestMatch = null;
  let highestSimilarity = 0;
  let proximityMeters = Infinity;

  // Scan against recent active or existing reports
  for (const report of reportsList) {
    if (!report || report.id === candidateReport.id) continue;

    const reportTokens = tokenize(`${report.title || ''} ${report.description || ''}`);
    const textSim = calculateJaccardSimilarity(candidateTokens, reportTokens);
    
    // Check street match or geo proximity
    const reportStreet = (report.location?.street || '').toLowerCase().trim();
    const isSameStreet = Boolean(candidateStreet && reportStreet && (
      candidateStreet.includes(reportStreet) || reportStreet.includes(candidateStreet)
    ));

    let distance = Infinity;
    if (candidateLat && candidateLng && report.location?.lat && report.location?.lng) {
      distance = calculateHaversineDistance(
        candidateLat, candidateLng,
        report.location.lat, report.location.lng
      );
    }

    // Weighted composite score
    let compositeScore = textSim;
    if (distance <= 250) {
      compositeScore += 0.35; // Physical proximity bonus
    } else if (isSameStreet) {
      compositeScore += 0.20; // Same corridor bonus
    }

    // Matching category reinforcement
    if (report.category && candidateReport.category && report.category === candidateReport.category) {
      compositeScore += 0.10;
    }

    const normalizedScore = Math.min(0.99, compositeScore);

    if (normalizedScore > highestSimilarity) {
      highestSimilarity = normalizedScore;
      bestMatch = report;
      proximityMeters = distance;
    }
  }

  // Composite score threshold: >= 0.70 is flagged as duplicate
  const isDuplicate = highestSimilarity >= 0.70 && bestMatch !== null;

  return {
    isDuplicate,
    duplicateOf: isDuplicate ? (bestMatch.aiMetadata?.duplicateOf || bestMatch.id) : null,
    similarityScore: Number(highestSimilarity.toFixed(2)),
    matchReason: isDuplicate
      ? `Matches ticket #${bestMatch.id} (${(highestSimilarity * 100).toFixed(0)}% match, ~${proximityMeters < 5000 ? Math.round(proximityMeters) + 'm' : 'same sector'})`
      : 'No duplicate detected. Unique civic report.',
    // Reduced token reward (+10 corroboration bonus instead of +50) to prevent spam
    tokensAwarded: isDuplicate ? 10 : 50
  };
}

/**
 * 3. Explainable Prioritization
 * Evaluates urgency, hazard severity, traffic artery impact, and plain-language reasoning.
 * @param {Object} report 
 * @returns {Object} { priority: 'High'|'Medium'|'Low', urgencyScore: number, priorityReasoning: string }
 */
function evaluatePrioritization(report = {}) {
  const title = typeof report.title === 'string' ? report.title : '';
  const desc = typeof report.description === 'string' ? report.description : '';
  const landmark = typeof report.location?.landmark === 'string' ? report.location.landmark : '';
  const combinedText = `${title} ${desc} ${landmark}`.toLowerCase();
  
  let baseScore = 35;
  const identifiedHazards = [];

  // 1. Critical life-safety hazard keyword detection
  for (const hazard of CRITICAL_HAZARDS) {
    if (combinedText.includes(hazard.term)) {
      baseScore += hazard.weight;
      identifiedHazards.push(hazard.reason);
    }
  }

  // 2. High traffic / arterial street impact
  const street = (report.location?.street || '').toLowerCase();
  const isArterialStreet = street.includes('mg road') || street.includes('ring road') || street.includes('100 feet') || street.includes('brigade');
  if (isArterialStreet) {
    baseScore += 18;
    identifiedHazards.push('Location on major commercial or arterial thoroughfare maximizes public disruption');
  }

  // 3. Category inherent weight
  const catWeight = (report.category && CATEGORY_TAXONOMY[report.category]?.urgencyWeight) || 1.0;
  baseScore = Math.round(baseScore * (catWeight > 1.2 ? 1.15 : 1.0));

  // Cap between 15 and 99
  const urgencyScore = Math.min(99, Math.max(15, baseScore));

  // Priority classification
  let priority = 'Low';
  if (urgencyScore >= 75) {
    priority = 'High';
  } else if (urgencyScore >= 50) {
    priority = 'Medium';
  }

  // Plain-language explainable reasoning
  let reasoning = '';
  if (identifiedHazards.length > 0) {
    reasoning = `${priority} Priority (Score ${urgencyScore}/100): ${identifiedHazards[0]}. ${identifiedHazards.slice(1, 2).join('. ')}`;
  } else if (priority === 'High') {
    reasoning = `High Priority (Score ${urgencyScore}/100): High hazard density requiring expedited field response.`;
  } else if (priority === 'Medium') {
    reasoning = `Medium Priority (Score ${urgencyScore}/100): Moderate civic nuisance and infrastructure impediment without immediate life hazard.`;
  } else {
    reasoning = `Low Priority (Score ${urgencyScore}/100): Routine maintenance requirement with localized aesthetic or low-speed impact.`;
  }

  return {
    priority,
    urgencyScore,
    priorityReasoning: reasoning.trim()
  };
}

/**
 * 4. Hotspot Clustering
 * Groups reports by geographic zone and street, computing cluster severity index and metrics.
 * @param {Array} reports - Array of report objects
 * @returns {Array} Clustered hotspots ordered by severity and report density
 */
function clusterHotspots(reports = []) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return [];
  }

  const clusterMap = new Map();

  for (const report of reports) {
    if (!report) continue;

    // Normalize street name as primary cluster key
    let streetKey = (report.location?.street || 'Central Municipal Sector').trim();
    if (/mg road|m\.g\. road|mahatma gandhi road/i.test(streetKey)) {
      streetKey = 'MG Road';
    }

    if (!clusterMap.has(streetKey)) {
      clusterMap.set(streetKey, {
        street: streetKey,
        area: report.location?.area || 'Municipal Ward',
        reports: [],
        categories: {},
        totalUrgency: 0,
        highPriorityCount: 0,
        activeCount: 0,
        lats: [],
        lngs: []
      });
    }

    const cluster = clusterMap.get(streetKey);
    cluster.reports.push(report);
    cluster.totalUrgency += (report.aiMetadata?.urgencyScore || 50);

    if (report.aiMetadata?.priority === 'High') {
      cluster.highPriorityCount++;
    }

    if (report.status !== 'Resolved') {
      cluster.activeCount++;
    }

    // Category distribution
    const cat = report.category || 'damaged roads';
    cluster.categories[cat] = (cluster.categories[cat] || 0) + 1;

    // Track coordinates for centroid
    if (report.location?.lat && report.location?.lng) {
      cluster.lats.push(Number(report.location.lat));
      cluster.lngs.push(Number(report.location.lng));
    }
  }

  // Format and sort clusters
  const clusters = Array.from(clusterMap.values()).map(c => {
    const totalReports = c.reports.length;
    const avgUrgency = totalReports > 0 ? Math.round(c.totalUrgency / totalReports) : 50;
    
    // Find dominant category
    let topCategory = 'damaged roads';
    let maxCatCount = 0;
    for (const [cat, count] of Object.entries(c.categories)) {
      if (count > maxCatCount) {
        maxCatCount = count;
        topCategory = cat;
      }
    }

    // Centroid calculation
    const avgLat = c.lats.length ? (c.lats.reduce((a, b) => a + b, 0) / c.lats.length) : 12.9716;
    const avgLng = c.lngs.length ? (c.lngs.reduce((a, b) => a + b, 0) / c.lngs.length) : 77.5946;

    // Severity index determination
    let severityLevel = 'Moderate';
    if (totalReports >= 8 || c.highPriorityCount >= 4 || avgUrgency >= 80) {
      severityLevel = 'Critical Hotspot';
    } else if (totalReports >= 3 || c.highPriorityCount >= 2 || avgUrgency >= 65) {
      severityLevel = 'Elevated Alert';
    }

    return {
      street: c.street,
      area: c.area,
      totalReports,
      activeIssues: c.activeCount,
      resolvedIssues: totalReports - c.activeCount,
      highPriorityCount: c.highPriorityCount,
      averageUrgency: avgUrgency,
      topCategory,
      severityLevel,
      centroid: {
        lat: Number(avgLat.toFixed(5)),
        lng: Number(avgLng.toFixed(5))
      },
      description: `${severityLevel}: ${totalReports} reported issues (${c.activeCount} unresolved). Prominent category: ${topCategory}.`,
      sampleReportIds: c.reports.slice(0, 4).map(r => r.id)
    };
  });

  // Sort by highest report volume and urgency
  clusters.sort((a, b) => (b.totalReports * 1.5 + b.averageUrgency) - (a.totalReports * 1.5 + a.averageUrgency));

  return clusters;
}

module.exports = {
  autoCategorizeAndSummarize,
  detectDuplicate,
  evaluatePrioritization,
  clusterHotspots,
  CATEGORY_TAXONOMY
};
