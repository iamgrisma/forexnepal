// src/utils/chartRateLimiter.ts

// Chart Rate Limiter
// Max 60 charts per hour for short ranges
// Max 1 chart per 69 seconds for 3Y+ ranges

const CHART_LIMITS = {
  SHORT_RANGE_MAX: 60, // UPDATED from 30 to 60
  SHORT_RANGE_WINDOW: 60 * 60 * 1000, // 1 hour (unchanged)
  LONG_RANGE_COOLDOWN: 69 * 1000, // UPDATED from 180 to 69 seconds
  LONG_RANGE_THRESHOLD_DAYS: 365 * 3, // UPDATED from 5 years to 3 years
};

interface ChartRequest {
  timestamp: number;
  rangeInDays: number;
}

const STORAGE_KEY = 'chart_rate_limiter';

// Get request history from localStorage
const getRequestHistory = (): ChartRequest[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

// Save request history to localStorage
const saveRequestHistory = (history: ChartRequest[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save rate limiter history');
  }
};

// Clean old requests outside the window
const cleanOldRequests = (history: ChartRequest[], now: number): ChartRequest[] => {
  return history.filter(req => now - req.timestamp < CHART_LIMITS.SHORT_RANGE_WINDOW);
};

// Check if request is allowed
export const canMakeChartRequest = (rangeInDays: number): { allowed: boolean; reason?: string; cooldownSeconds?: number } => {
  const now = Date.now();
  const history = cleanOldRequests(getRequestHistory(), now);
  
  const isLongRange = rangeInDays >= CHART_LIMITS.LONG_RANGE_THRESHOLD_DAYS;
  
  if (isLongRange) {
    // Check for long range cooldown
    const lastLongRange = history
      .filter(req => req.rangeInDays >= CHART_LIMITS.LONG_RANGE_THRESHOLD_DAYS)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (lastLongRange) {
      const timeSinceLastRequest = now - lastLongRange.timestamp;
      if (timeSinceLastRequest < CHART_LIMITS.LONG_RANGE_COOLDOWN) {
        const cooldownSeconds = Math.ceil((CHART_LIMITS.LONG_RANGE_COOLDOWN - timeSinceLastRequest) / 1000);
        return {
          allowed: false,
          reason: `Please wait ${cooldownSeconds} seconds before requesting another 3Y+ chart`,
          cooldownSeconds,
        };
      }
    }
  }
  
  // Check short range limit (60 per hour)
  const shortRangeRequests = history.filter(req => req.rangeInDays < CHART_LIMITS.LONG_RANGE_THRESHOLD_DAYS);
  if (shortRangeRequests.length >= CHART_LIMITS.SHORT_RANGE_MAX) {
    const oldestRequest = shortRangeRequests.sort((a, b) => a.timestamp - b.timestamp)[0];
    const resetInSeconds = Math.ceil((CHART_LIMITS.SHORT_RANGE_WINDOW - (now - oldestRequest.timestamp)) / 1000);
    return {
      allowed: false,
      reason: `Chart limit reached (${CHART_LIMITS.SHORT_RANGE_MAX}/hour). Reset in ${resetInSeconds} seconds`,
      cooldownSeconds: resetInSeconds,
    };
  }
  
  return { allowed: true };
};

// Record a chart request
export const recordChartRequest = (rangeInDays: number) => {
  const now = Date.now();
  const history = cleanOldRequests(getRequestHistory(), now);
  
  history.push({
    timestamp: now,
    rangeInDays,
  });
  
  saveRequestHistory(history);
};

// Get remaining requests for short range
export const getRemainingRequests = (): number => {
  const now = Date.now();
  const history = cleanOldRequests(getRequestHistory(), now);
  const shortRangeRequests = history.filter(req => req.rangeInDays < CHART_LIMITS.LONG_RANGE_THRESHOLD_DAYS);
  return Math.max(0, CHART_LIMITS.SHORT_RANGE_MAX - shortRangeRequests.length);
};
