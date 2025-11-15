// src/api-helpers.ts
import { Env, ApiAccessSetting, ExecutionContext, D1Database, SiteSettings } from './worker-types';
import { corsHeaders } from './constants';

const API_SETTINGS_CACHE_KEY = 'api_access_settings_v1';
const API_SETTINGS_CACHE_TTL = 300; // 5 minutes

// --- NEW (BUT WAS MISSING) ---
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

        const settings = results.reduce((acc, row) => {
            if (row.key === 'ticker_enabled' || row.key === 'adsense_enabled') {
                acc[row.key] = row.value === 'true';
            } else if (row.key === 'adsense_exclusions') {
                acc[row.key] = row.value;
            }
            return acc;
        }, {} as any);

        return { ...defaultSettings, ...settings };
    } catch (e: any) {
        console.error("Failed to fetch settings from D1:", e.message);
        return defaultSettings;
    }
}
// --- END NEW FUNCTION ---


/**
 * Fetches API access rules, using cache first, then falling back to D1.
 */
async function getApiSettings(env: Env): Promise<Map<string, ApiAccessSetting>> {
    // 1. Try to get from KV cache
    try {
        const cachedSettings = await env.API_SETTINGS_CACHE.get(API_SETTINGS_CACHE_KEY, 'json');
        if (cachedSettings) {
            return new Map(Object.entries(cachedSettings));
        }
    } catch (e) {
        console.error('API settings cache read error:', e);
    }

    // 2. If cache miss or error, fetch from D1
    try {
        const { results } = await env.FOREX_DB.prepare("SELECT * FROM api_access_settings").all<ApiAccessSetting>();
        
        const settingsMap = new Map<string, ApiAccessSetting>();
        if (results) {
            for (const setting of results) {
                settingsMap.set(setting.endpoint, setting);
            }
        }

        // 3. Store in KV cache for next time (don't await)
        env.API_SETTINGS_CACHE.put(API_SETTINGS_CACHE_KEY, JSON.stringify(Object.fromEntries(settingsMap)), {
            expirationTtl: API_SETTINGS_CACHE_TTL
        });

        return settingsMap;
    } catch (e: any) {
        console.error('Failed to fetch API settings from D1:', e.message);
        return new Map(); // Return empty map on failure
    }
}

/**
 * Checks if a given identifier (IP or domain) matches the allowed rules.
 */
function isRuleMatch(identifier: string, rules: string[]): boolean {
    if (!identifier) return false;

    for (const rule of rules) {
        if (rule === '*') return true;
        if (rule === identifier) return true;
        
        // Handle wildcard domain matching (e.g., *.example.com)
        if (rule.startsWith('*.') && identifier.endsWith(rule.substring(1))) {
            return true;
        }
    }
    return false;
}

/**
 * Prunes old API usage logs.
 * This should be called periodically (e.g., in the scheduled worker).
 */
export async function pruneApiUsageLogs(db: D1Database): Promise<void> {
    try {
        // Delete logs older than 2 hours (quota is per-hour, 2 hours gives a buffer)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        await db.prepare("DELETE FROM api_usage_logs WHERE request_time < ?").bind(twoHoursAgo).run();
        console.log('Pruned old API usage logs.');
    } catch (e: any) {
        console.error('Error pruning API logs:', e.message);
    }
}

/**
 * The main API access control middleware.
 * Call this before executing any public API handler.
 */
export async function checkApiAccess(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    endpoint: string // The endpoint being accessed, e.g., '/api/latest-rates'
): Promise<Response | null> {

    const url = new URL(request.url);
    
    // Normalize endpoint for dynamic routes
    let matchedEndpoint = endpoint;
    if (endpoint.startsWith('/api/posts/')) matchedEndpoint = '/api/posts/:slug';
    if (endpoint.startsWith('/api/rates/date/')) matchedEndpoint = '/api/rates/date/:date';
    if (endpoint.startsWith('/api/archive/detail/')) matchedEndpoint = '/api/archive/detail/:date';

    const settingsMap = await getApiSettings(env);
    const setting = settingsMap.get(matchedEndpoint);

    if (!setting) {
        console.warn(`No API access setting found for endpoint: ${matchedEndpoint}`);
        // Default to public if not configured, but log it.
        return null;
    }

    // 1. Check Access Level
    if (setting.access_level === 'disabled') {
        return new Response(JSON.stringify({ error: 'This API endpoint is disabled' }), { status: 403, headers: corsHeaders });
    }

    if (setting.access_level === 'public') {
        // Check for public quota
        const quota = setting.quota_per_hour;
        if (quota === -1) {
            return null; // Public and unlimited
        }
        
        // Public quota is IP-based
        const ip = request.headers.get('CF-Connecting-IP') || 'public_ip';
        return checkQuota(env, ctx, ip, matchedEndpoint, quota);
    }

    // 2. Check Restricted Access (IP or Referer)
    if (setting.access_level === 'restricted') {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown_ip';
        const referer = request.headers.get('Referer');
        const origin = referer ? new URL(referer).hostname : 'unknown_domain';
        
        let allowedRules: string[] = [];
        try {
            allowedRules = JSON.parse(setting.allowed_rules || '[]');
        } catch {
            console.error(`Failed to parse rules for ${endpoint}: ${setting.allowed_rules}`);
        }

        const ipMatch = isRuleMatch(ip, allowedRules);
        const domainMatch = isRuleMatch(origin, allowedRules);
        const identifier = domainMatch ? origin : ip; // Prioritize domain

        if (!ipMatch && !domainMatch) {
            return new Response(JSON.stringify({ error: 'Access denied. Invalid IP or domain.' }), { status: 403, headers: corsHeaders });
        }

        // 3. Check Quota
        const quota = setting.quota_per_hour;
        if (quota === -1) {
            return null; // Unlimited quota
        }
        
        return checkQuota(env, ctx, identifier, matchedEndpoint, quota);
    }

    return null; // Default grant if somehow missed
}

/**
 * Helper function to check quota for a given identifier.
 */
async function checkQuota(
    env: Env,
    ctx: ExecutionContext,
    identifier: string,
    endpoint: string,
    quota: number
): Promise<Response | null> {
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { results } = await env.FOREX_DB.prepare(
        "SELECT COUNT(*) as count FROM api_usage_logs WHERE identifier = ? AND endpoint = ? AND request_time > ?"
    ).bind(identifier, endpoint, oneHourAgo).all<{ count: number }>();
    
    const usageCount = results?.[0]?.count || 0;

    if (usageCount >= quota) {
        return new Response(JSON.stringify({ error: `Quota exceeded (${quota}/hr). Please try again later.` }), { status: 429, headers: corsHeaders });
    }

    // Log this request (don't await)
    ctx.waitUntil(
        env.FOREX_DB.prepare("INSERT INTO api_usage_logs (identifier, endpoint) VALUES (?, ?)")
            .bind(identifier, endpoint)
            .run()
            .catch(e => console.error('Failed to log API usage:', e))
    );

    return null; // Access granted
}
