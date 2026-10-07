/**
 * Trend Analysis & Anomaly Detection Engine
 * Pure Node.js math (linear regression, moving averages, z-score anomaly detection, time-to-threshold prediction)
 * Designed to be drop-in replaced by a Python ML service later if desired.
 */

export function calculateMovingAverage(values, windowSize = 5) {
  if (!values || values.length === 0) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const subset = values.slice(start, i + 1);
    const sum = subset.reduce((acc, v) => acc + (v !== null && v !== undefined ? v : 0), 0);
    const count = subset.filter(v => v !== null && v !== undefined).length;
    result.push(count > 0 ? +(sum / count).toFixed(2) : null);
  }
  return result;
}

/**
 * Linear Regression calculation
 * Returns slope (rate of change per unit interval/point), intercept, and correlation coefficient r
 */
export function calculateLinearRegression(points) {
  // points is array of { x, y } where x can be index (0..n) or timestamp (ms)
  const validPoints = points.filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));
  const n = validPoints.length;
  if (n < 2) {
    return { slope: 0, intercept: validPoints[0]?.y || 0, r: 0, direction: 'stable' };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const p of validPoints) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const denominator = (n * sumXX - sumX * sumX);
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, r: 0, direction: 'stable' };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Correlation r
  const rDenominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const r = rDenominator !== 0 ? (n * sumXY - sumX * sumY) / rDenominator : 0;

  let direction = 'stable';
  if (slope > 0.05) direction = 'rising';
  else if (slope < -0.05) direction = 'falling';

  return {
    slope: +slope.toFixed(4),
    intercept: +intercept.toFixed(2),
    r: +r.toFixed(3),
    direction
  };
}

/**
 * Z-score Anomaly Detection
 * Flags data points that deviate more than threshold (default 2.5 std deviations)
 */
export function detectZScoreAnomalies(readings, metric = 'mq2_mv', threshold = 2.5) {
  const validReadings = readings.filter(r => r[metric] !== null && r[metric] !== undefined && !isNaN(r[metric]));
  if (validReadings.length < 5) return [];

  const values = validReadings.map(r => r[metric]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return [];

  const anomalies = [];
  validReadings.forEach((r, idx) => {
    const zScore = (r[metric] - mean) / stdDev;
    if (Math.abs(zScore) >= threshold) {
      anomalies.push({
        index: idx,
        ts: r.ts || r.timestamp,
        value: r[metric],
        zScore: +zScore.toFixed(2),
        type: zScore > 0 ? 'SPIKE_HIGH' : 'DROP_LOW'
      });
    }
  });

  return anomalies;
}

/**
 * Predict Time To Threshold (in minutes)
 * Uses linear slope of the most recent N points
 */
export function predictTimeToThreshold(recentReadings, metric = 'mq2_mv', targetThreshold = 2000) {
  const validReadings = recentReadings
    .filter(r => r[metric] !== null && r[metric] !== undefined && !isNaN(r[metric]))
    .slice(-15); // Look at last 15 readings

  if (validReadings.length < 3) {
    return { predictedMinutes: null, willBreach: false, slopePerMin: 0 };
  }

  // Convert points to (minutes from start, value)
  const firstTs = new Date(validReadings[0].ts || validReadings[0].timestamp || Date.now()).getTime();
  const points = validReadings.map(r => {
    const ts = new Date(r.ts || r.timestamp || Date.now()).getTime();
    const xMinutes = (ts - firstTs) / 60000;
    return { x: xMinutes, y: r[metric] };
  });

  const { slope } = calculateLinearRegression(points);
  const currentVal = points[points.length - 1].y;

  if (currentVal >= targetThreshold) {
    return { predictedMinutes: 0, willBreach: true, slopePerMin: slope };
  }

  if (slope <= 0) {
    // Value is flat or decreasing, won't breach
    return { predictedMinutes: null, willBreach: false, slopePerMin: slope };
  }

  // Time to reach target = (target - current) / slope
  const diff = targetThreshold - currentVal;
  const minutesNeeded = diff / slope;

  return {
    predictedMinutes: minutesNeeded > 0 && minutesNeeded <= 120 ? +minutesNeeded.toFixed(1) : null,
    willBreach: minutesNeeded > 0 && minutesNeeded <= 60,
    slopePerMin: +slope.toFixed(2)
  };
}

/**
 * Generate comprehensive trend analysis report for a worker metric
 */
export function analyzeWorkerMetric(readings, metric = 'mq2_mv', warningThreshold = 2000) {
  if (!readings || readings.length === 0) {
    return {
      status: 'insufficient_data',
      insight: 'Insufficient telemetry data for trend analysis.',
      direction: 'stable',
      slope: 0,
      moving_averages: [],
      anomalies: [],
      time_to_warning_min: null
    };
  }

  const values = readings.map(r => r[metric] ?? null);
  const movingAverages = calculateMovingAverage(values, 5);

  const indexedPoints = readings.map((r, i) => ({ x: i, y: r[metric] }));
  const { slope, direction, r } = calculateLinearRegression(indexedPoints);
  const anomalies = detectZScoreAnomalies(readings, metric, 2.5);
  const timePrediction = predictTimeToThreshold(readings, metric, warningThreshold);

  let insight = 'Metric values are currently stable within standard bounds.';
  if (direction === 'rising') {
    if (timePrediction.willBreach && timePrediction.predictedMinutes !== null) {
      insight = `Gas index rising (+${timePrediction.slopePerMin} mV/min) – estimated ${timePrediction.predictedMinutes} mins to warning threshold!`;
    } else {
      insight = `Upward trend detected (slope: +${slope}). Monitoring for sustained elevation.`;
    }
  } else if (direction === 'falling') {
    insight = `Downward trend observed (slope: ${slope}). Conditions are improving.`;
  }

  if (anomalies.length > 0) {
    insight += ` ${anomalies.length} anomalous spike(s) identified in sample window.`;
  }

  return {
    metric,
    data_points_count: readings.length,
    direction,
    slope,
    correlation_r: r,
    moving_averages: movingAverages,
    anomalies,
    time_to_warning_min: timePrediction.predictedMinutes,
    will_breach_soon: timePrediction.willBreach,
    insight
  };
}
