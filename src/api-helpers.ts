// src/api-helpers.ts
import { Env, ApiAccessSetting, ExecutionContext, D1Database, SiteSettings, User } from './worker-types';
import { corsHeaders } from './constants';
import { getUsernameFromToken } from './auth'; // <-- This is a function from auth.ts

const API_SETTINGS_CACHE_KEY = 'api_access_settings_v1';
const API_SETTINGS_CACHE_TTL = 300; // 5 minutes

/**
 * Fetches all site settings from D1 and formats them as an object.
 */
export async function getAllSettings(db: D1Database): Promise<SiteSettings> {
    const defaultSettings: SiteSettings = {
        ticker_enabled: true,
        adsense_enabled: false,
        adsense_exclusions: '/admin,/login',
    };
    
    try {
        const { results } = await db.prepare("SELECT key, value FROM site_settings").all<{ key: string, value: string }>();
        
        if (!results) {
            return defaultSettings;
        }

        // Fold the results into an object, parsing boolean values
        const settings = results.reduce((acc, row) => {
            if (row.key === 'ticker_enabled' || row.key === 'adsense_enabled') {
                acc[row.key] = row.value === 'true';
            } else if (row.key === 'adsense_exclusions') {
                acc[row.key] = row.value;
            }
            // Add other settings if needed
            return acc;
        }, {} as Record<string, any>);

        return { ...defaultSettings, ...settings };

    } catch (e: any) {
        console.error("Failed to fetch all settings:", e.message, e.cause);
        return defaultSettings; // Return defaults on error
    }
}


/**
 * Fetches API access settings from KV cache or D1.
 */
export async function getApiAccessSettings(env: Env): Promise<ApiAccessSetting[]> {
  try {
    // 1. Try KV Cache first
    const cachedSettings = await env.API_SETTINGS_CACHE.get(API_SETTINGS_CACHE_KEY, 'json');
    if (cachedSettings) {
      return cachedSettings as ApiAccessSetting[];
    }
  } catch (e) {
    console.warn('KV cache read failed (continuing with D1):', e);
  }

  try {
    // 2. If cache miss or fail, fetch from D1
    const { results } = await env.FOREX_DB.prepare("SELECT * FROM api_access_settings").all<ApiAccessSetting>();
    
    // 3. Store in KV for next time
    if (results) {
      // Don't await, do it in the background
      ctx.waitUntil(
        env.API_SETTINGS_CACHE.put(API_SETTINGS_CACHE_KEY, JSON.stringify(results), {
          expirationTtl: API_SETTINGS_CACHE_TTL,
        })
      );
      return results;
    }
    return [];
  } catch (e) {
    console.error('D1 fetch for API settings failed:', e);
    return [];
  }
}

// Context variable for API access checks
let ctx: ExecutionContext;

/**
 * Logs an API usage event to D1.
 */
async function logApiUsage(db: D1Database, identifier: string, endpoint: string, status: number) {
  try {
    await db.prepare(
      "INSERT INTO api_usage_logs (identifier, endpoint, status_code, request_time) VALUES (?, ?, ?, datetime('now'))"
    ).bind(identifier, endpoint, status).run();
  } catch (e) {
    console.error('Failed to log API usage:', e);
  }
}

/**
 * Prunes old API usage logs (older than 2 hours).
 */
export async function pruneApiUsageLogs(db: D1Database) {
  try {
    const result = await db.prepare(
      "DELETE FROM api_usage_logs WHERE request_time < datetime('now', '-2 hours')"
    ).run();
    if (result.meta.rows_written > 0) {
        console.log(`Pruned old API usage logs: ${result.meta.rows_written} rows deleted`);
    }
  } catch (e) {
    console.error('Failed to prune API logs:', e);
  }
}

/**
 * Checks if an API request is allowed.
 * Returns null if allowed, or a Response object if denied.
 */
export async function checkApiAccess(
  request: Request,
  env: Env,
  context: ExecutionContext,
  endpoint: string
): Promise<Response | null> {
  // Store context for logging
  ctx = context; 
  
  const settings = await getApiAccessSettings(env);
  const endpointSetting = settings.find(s => s.endpoint === endpoint);
  const identifier = request.headers.get('CF-Connecting-IP') || 'unknown_ip';

  if (!endpointSetting) {
    console.warn(`API endpoint not configured: ${endpoint}. Denying access.`);
    const resp = new Response(JSON.stringify({ error: 'Endpoint not configured' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 404));
    return resp;
  }

  const { access_level, allowed_rules, quota_per_hour } = endpointSetting;

  // 1. Check Access Level
  if (access_level === 'disabled') {
    const resp = new Response(JSON.stringify({ error: 'This API endpoint is disabled' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 403));
    return resp;
  }
  
  if (access_level === 'public') {
    // Public: No further checks needed, log and allow
    ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 200));
    return null; 
  }

  // 2. Check for 'restricted'
  if (access_level === 'restricted') {
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    let allowed = false;
    let allowedRules: string[] = [];

    try {
      allowedRules = JSON.parse(allowed_rules);
    } catch {
      console.error('Failed to parse allowed_rules JSON');
    }

    for (const rule of allowedRules) {
      if (rule === '*') { // Wildcard allows all
        allowed = true;
        break;
      }
      if (origin && rule.length > 2 && origin.includes(rule)) {
        allowed = true;
        break;
      }
      if (referer && rule.length > 2 && referer.includes(rule)) {
        allowed = true;
        break;
      }
    }

    if (!allowed) {
      const resp = new Response(JSON.stringify({ error: 'Access denied for this origin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 403));
      return resp;
    }
  }

  // 3. Check Quota (if quota is set)
  const quota = quota_per_hour || 0;
  if (quota > 0) {
    const { results } = await env.FOREX_DB.prepare(
      "SELECT COUNT(*) as count FROM api_usage_logs WHERE identifier = ? AND endpoint = ? AND request_time > datetime('now', '-1 hour')"
    ).bind(identifier, endpoint).all<{ count: number }>();
    
    const usageCount = results?.[0]?.count || 0;

    if (usageCount >= quota) {
        const resp = new Response(JSON.stringify({ error: `Quota exceeded (${quota}/hr). Please try again later.` }), { status: 429, headers: corsHeaders });
        ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 429));
        return resp;
    }
  }

  // 4. Log the successful access (do not await)
  ctx.waitUntil(logApiUsage(env.FOREX_DB, identifier, endpoint, 200));

  // If all checks passed
  return null;
}

/**
 * Verifies a JWT token from a request and returns the full user object from the DB.
 */
export async function getUserFromToken(request: Request, env: Env): Promise<User | null> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        return null;
    }

    const username = await getUsernameFromToken(token, env.JWT_SECRET);
    if (!username) {
        return null;
    }

    // Now fetch the user from D1
    try {
        const user = await env.FOREX_DB.prepare(
            `SELECT * FROM users WHERE username = ? AND is_active = 1`
        ).bind(username).first<User>();
        
        return user; // Will be null if not found
    } catch (e) {
        console.error('Failed to fetch user from token:', e);
        return null;
    }
}
