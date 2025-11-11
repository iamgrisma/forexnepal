// src/api-admin.ts
// --- ADMIN-FACING API HANDLERS ---

import { Env, ExecutionContext, SiteSettings, D1Database } from './worker-types';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { generateSlug, formatDate } from './worker-utils';
import { verifyToken, simpleHash, simpleHashCompare, generateToken } from './auth';
import { processAndStoreApiData } from './scheduled';
import { getAllSettings } from './api-helpers'; // Import from new helper

/**
 * (ADMIN) Forces the worker to fetch from NRB API and store in D1.
 */
export async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    
    if (!fromDate || !toDate) {
           return new Response(JSON.stringify({ error: 'Missing date parameters' }), { status: 400, headers: corsHeaders });
    }

    try {
        const { action } = (await request.json()) as { action: 'update' | 'replace' };
        if (action !== 'update' && action !== 'replace') {
            return new Response(JSON.stringify({ error: 'Invalid action specified' }), { status: 400, headers: corsHeaders });
        }

        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data available from NRB.' }), { headers: corsHeaders });
            }
            throw new Error(`NRB API error: ${response.status}`);
        }

        const data = await response.json();
        const processedDates = await processAndStoreApiData(data, env, action);

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * (ADMIN) GET/POST site settings.
 */
export async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        if (request.method === 'GET') {
            const settings = await getAllSettings(env.FOREX_DB);
            return new Response(JSON.stringify(settings), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (request.method === 'POST') {
            const settings: SiteSettings = await request.json();

            if (typeof settings.ticker_enabled === 'undefined' || typeof settings.adsense_enabled === 'undefined') {
                 return new Response(JSON.stringify({ success: false, error: 'Missing settings keys' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }

            const stmt1 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('ticker_enabled', ?)")
                .bind(settings.ticker_enabled ? 'true' : 'false');
            const stmt2 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('adsense_enabled', ?)")
                .bind(settings.adsense_enabled ? 'true' : 'false');
            const stmt3 = env.FOREX_DB.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('adsense_exclusions', ?)")
                .bind(settings.adsense_exclusions || '/admin,/login');


            await env.FOREX_DB.batch([stmt1, stmt2, stmt3]);
            
            // Clear the API settings cache
            await env.API_SETTINGS_CACHE.delete(API_SETTINGS_CACHE_KEY); // Use key from api-helpers

            const updatedSettings = await getAllSettings(env.FOREX_DB);
            return new Response(JSON.stringify(updatedSettings), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleSiteSettings (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Check if a user exists before asking for a password.
 */
export async function handleCheckUser(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, ipAddress, sessionId } = await request.json();
        if (!username || !ipAddress || !sessionId) {
             return new Response(JSON.stringify({ success: false, error: 'Missing credentials/identifiers' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const { results: attemptsResults } = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'check' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).all<{ count: number }>();
        const failedAttempts = attemptsResults[0]?.count || 0;

        if (failedAttempts >= 10) {
            return new Response(JSON.stringify({ success: false, error: 'Bro, get out of my system!' }), { status: 429, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        
        if (Math.random() < 0.05) {
            return new Response(JSON.stringify({ success: false, error: 'Redirect' }), { status: 418, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username FROM users WHERE username = ?`
        ).bind(username).first<{ username: string }>();

        const userExists = !!user;

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success, type) VALUES (?, ?, ?, ?, 'check')`
        ).bind(ipAddress, sessionId, username, userExists ? 1 : 0).run();

        if (!userExists) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        return new Response(JSON.stringify({ success: true, message: "User verified" }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Check user error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error during user check' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Login handler.
 */
export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, password, ipAddress, sessionId } = await request.json();
        if (!username || !password || !ipAddress || !sessionId) {
             return new Response(JSON.stringify({ success: false, error: 'Missing credentials/identifiers' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const { results: attemptsResults } = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'login' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).all<{ count: number }>();
        const failedAttempts = attemptsResults[0]?.count || 0;

        if (failedAttempts >= 7) {
            return new Response(JSON.stringify({ success: false, error: 'Too many failed password attempts.' }), { status: 429, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, plaintext_password, password_hash FROM users WHERE username = ? AND is_active = 1`
        ).bind(username).first<{ username: string; plaintext_password: string | null; password_hash: string | null }>();

        let isValid = false;
        let mustChangePassword = false;

        if (user) {
            if (user.plaintext_password && user.password_hash) {
                if (password === user.plaintext_password || await simpleHashCompare(password, user.password_hash)) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (user.plaintext_password && !user.password_hash) {
                if (password === user.plaintext_password) {
                    isValid = true;
                    mustChangePassword = true;
                }
            } else if (!user.plaintext_password && user.password_hash) {
                isValid = await simpleHashCompare(password, user.password_hash);
                mustChangePassword = false;
            }
        }

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success, type) VALUES (?, ?, ?, ?, 'login')`
        ).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const token = await generateToken(username);
        return new Response(JSON.stringify({
            success: true,
            token,
            username,
            mustChangePassword
        }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Login error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error during login' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Check login attempt count.
 */
export async function handleCheckAttempts(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ipAddress = url.searchParams.get('ip');
    const sessionId = url.searchParams.get('session');
    if (!ipAddress || !sessionId) {
        return new Response(JSON.stringify({ error: 'Missing IP or session' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const result = await env.FOREX_DB.prepare(
            `SELECT COUNT(*) as count FROM login_attempts WHERE (ip_address = ? OR session_id = ?) AND type = 'login' AND success = 0 AND datetime(attempt_time) > datetime('now', '-1 hour')`
        ).bind(ipAddress, sessionId).first<{ count: number }>();
        const attempts = result?.count || 0;
        return new Response(JSON.stringify({ attempts: attempts, remaining: Math.max(0, 7 - attempts) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error("Check attempts error:", error.message, error.cause);
        return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Change password handler.
 */
export async function handleChangePassword(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        const { username, newPassword, keepSamePassword } = await request.json();
        if (!username) {
             return new Response(JSON.stringify({ success: false, error: 'Username is required.' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (!keepSamePassword && (!newPassword || newPassword.length < 8)) {
             return new Response(JSON.stringify({ success: false, error: 'New password must be >= 8 chars.' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, plaintext_password, password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; plaintext_password: string | null; password_hash: string | null }>();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        let newPasswordHash: string | null = null;
        if (keepSamePassword) {
            if (user.password_hash) {
                newPasswordHash = user.password_hash;
            } else if (user.plaintext_password) {
                newPasswordHash = await simpleHash(user.plaintext_password);
            } else {
                 return new Response(JSON.stringify({ success: false, error: 'Cannot keep password, no hash or plaintext found.' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
        } else {
            newPasswordHash = await simpleHash(newPassword);
        }

        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, plaintext_password = NULL, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, username).run();

        // This table is deprecated but we'll clear it for legacy support.
        await env.FOREX_DB.prepare(`DELETE FROM user_recovery`).run();

        return new Response(JSON.stringify({ success: true, message: "Password updated." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('Password change error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Helper function to send password reset email via Brevo.
 */
async function sendPasswordResetEmail(
    env: Env,
    to: string,
    username: string,
    resetToken: string,
    resetUrl: string,
    ctx: ExecutionContext
): Promise<void> {
    const BREVO_API_KEY = env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
        console.error('BREVO_API_KEY secret not set in Cloudflare Worker.');
        return;
    }

    const emailPromise = fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: {
                name: 'Forex Nepal Admin',
                email: 'cadmin@grisma.com.np',
            },
            to: [{ email: to, name: username }],
            subject: 'Password Reset Request - Forex Nepal Admin',
            htmlContent: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                  .token { font-family: 'Courier New', monospace; background: #e9ecef; padding: 10px; border-radius: 4px; font-size: 18px; letter-spacing: 2px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Password Reset Request</h1>
                  </div>
                  <div class="content">
                    <p>Hello <strong>${username}</strong>,</p>
                    <p>We received a request to reset your password for the Forex Nepal Admin Dashboard.</p>
                    <p>Click the button below to reset your password:</p>
                    <p style="text-align: center;">
                      <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                    <p>Alternatively, use this reset code:</p>
                    <p style="text-align: center;" class="token">${resetToken}</p>
                    <p><strong>This link and code will expire in 1 hour.</strong></p>
                    <p>If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.</p>
                  </div>
                  <div class="footer">
                    <p>Forex Nepal Admin Dashboard | Powered by Grisma</p>
                    <p>This is an automated email, please do not reply.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
        }),
    }).then(async (emailResponse) => {
         if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('Brevo API error:', errorText);
        } else {
            console.log('Password reset email sent successfully via Brevo.');
        }
    }).catch(emailError => {
        console.error('Email sending error:', emailError);
    });

    ctx.waitUntil(emailPromise);
}

/**
 * (ADMIN) Request a password reset email.
 */
export async function handleRequestPasswordReset(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        const { username } = await request.json();
        if (!username) {
            return new Response(JSON.stringify({ success: false, error: 'Username required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, email FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; email: string | null }>();

        if (!user || !user.email) {
            console.log(`Password reset request for "${username}", but user or email not found. Sending success for security.`);
            return new Response(JSON.stringify({ success: true, message: "If account exists, reset email sent" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const resetToken = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await env.FOREX_DB.prepare(
            `INSERT INTO password_reset_tokens (username, token, expires_at) VALUES (?, ?, ?)`
        ).bind(username, resetToken, expiresAt).run();

        const resetUrl = `https://forex.grisma.com.np/#/admin/reset-password?token=${resetToken}`;
        
        sendPasswordResetEmail(
            env,
            user.email,
            user.username,
            resetToken,
            resetUrl,
            ctx
        );

        return new Response(JSON.stringify({ success: true, message: "If account exists, reset email sent" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Request password reset error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) Reset password using a token.
 */
export async function handleResetPassword(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        const { token, newPassword } = await request.json();
        if (!token || !newPassword) {
            return new Response(JSON.stringify({ success: false, error: 'Token and password required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (newPassword.length < 8) {
            return new Response(JSON.stringify({ success: false, error: 'Password must be >= 8 characters' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const resetRecord = await env.FOREX_DB.prepare(
            `SELECT username, expires_at, used FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ username: string; expires_at: string; used: number }>();

        if (!resetRecord) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired reset token' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (resetRecord.used === 1) {
            return new Response(JSON.stringify({ success: false, error: 'Reset token already used' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const expiresAt = new Date(resetRecord.expires_at);
        if (expiresAt < new Date()) {
            return new Response(JSON.stringify({ success: false, error: 'Reset token expired' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const newPasswordHash = await simpleHash(newPassword);
        await env.FOREX_DB.prepare(
            `UPDATE users SET password_hash = ?, plaintext_password = NULL, updated_at = datetime('now') WHERE username = ?`
        ).bind(newPasswordHash, resetRecord.username).run();

        await env.FOREX_DB.prepare(
            `UPDATE password_reset_tokens SET used = 1 WHERE token = ?`
        ).bind(token).run();

        return new Response(JSON.stringify({ success: true, message: "Password reset successfully" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Reset password error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) GET all users or POST a new user.
 */
export async function handleUsers(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        if (request.method === 'GET') {
            const { results } = await env.FOREX_DB.prepare(
                `SELECT username, email, role, is_active, created_at FROM users ORDER BY created_at DESC`
            ).all();
            return new Response(JSON.stringify({ success: true, users: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        if (request.method === 'POST') {
            const { username, email, password, role } = await request.json();
            if (!username
