// src/api-admin.ts
// --- ADMIN-FACING API HANDLERS ---

import { Env, ExecutionContext, SiteSettings, D1Database, ApiAccessSetting, D1PreparedStatement } from './worker-types';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { generateSlug, formatDate } from './worker-utils';
import { verifyToken, simpleHash, simpleHashCompare, generateToken } from './auth';
import { processAndStoreApiData } from './scheduled';
import { getAllSettings } from './api-helpers';

const API_SETTINGS_CACHE_KEY = 'api_access_settings_v1';

/**
 * (ADMIN) Forces the worker to fetch from NRB API and store in D1.
 */
export async function handleFetchAndStore(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    const url = new URL(request.url);
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    
    if (!fromDate || !toDate) {
           // --- SYNTAX ERROR FIX ---
           return new Response(JSON.stringify({ error: 'Missing date parameters' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const { action } = (await request.json()) as { action: 'update' | 'replace' };
        if (action !== 'update' && action !== 'replace') {
            // --- SYNTAX ERROR FIX ---
            return new Response(JSON.stringify({ error: 'Invalid action specified' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const apiUrl = `https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=100&from=${fromDate}&to=${toDate}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            if (response.status === 404) {
                 return new Response(JSON.stringify({ success: true, stored: 0, message: 'No data available from NRB.' }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
            throw new Error(`NRB API error: ${response.status}`);
        }

        const data = await response.json();
        const processedDates = await processAndStoreApiData(data, env, action);

        return new Response(JSON.stringify({ success: true, stored: processedDates, fromDate, toDate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to fetch and store data' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) GET/POST site settings.
 */
export async function handleSiteSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
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
            
            await env.API_SETTINGS_CACHE.delete(API_SETTINGS_CACHE_KEY); 

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

        return new Response(JSON.stringify({ success: true, message: "User verified" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

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
            `SELECT username, password_hash, plaintext_password FROM users WHERE username = ? AND is_active = 1`
        ).bind(username).first<{ username: string; password_hash: string | null; plaintext_password: string | null }>();

        let isValid = false;
        let mustChangePassword = false;

        if (user) {
            if (user.password_hash) {
                // Standard path: compare against stored hash
                isValid = await simpleHashCompare(password, user.password_hash);
                // Force password change if placeholder hash is present
                if (isValid && user.password_hash === '0000000000000000000000000000000000000000000000000000000000000000') {
                    mustChangePassword = true;
                }
            } 
            else if (user.plaintext_password) {
                // First-time login path (from migration)
                isValid = (password === user.plaintext_password);
                if (isValid) {
                    mustChangePassword = true; // Force password change
                }
            }
        }

        await env.FOREX_DB.prepare(
            `INSERT INTO login_attempts (ip_address, session_id, username, success, type) VALUES (?, ?, ?, ?, 'login')`
        ).bind(ipAddress, sessionId, username, isValid ? 1 : 0).run();

        if (!isValid) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const token = await generateToken(username, env.JWT_SECRET); // <-- Pass secret
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
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
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
            `SELECT username, password_hash FROM users WHERE username = ?`
        ).bind(username).first<{ username: string; password_hash: string | null }>();
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        let newPasswordHash: string | null = null;
        if (keepSamePassword) {
            if (user.password_hash && user.password_hash !== '0000000000000000000000000000000000000000000000000000000000000000') {
                newPasswordHash = user.password_hash;
            } else {
                return new Response(JSON.stringify({ success: false, error: 'Cannot keep password, no valid hash found.' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
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
                email: 'admin@grisma.com.np',
            },
            to: [{ email: to, name: username }],
            // --- UPDATED: Email content reflects both options ---
            subject: 'Login Code / Password Reset Request - Forex Nepal Admin',
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
                    <h1>Account Access Request</h1>
                  </div>
                  <div class="content">
                    <p>Hello <strong>${username}</strong>,</p>
                    <p>We received a request for a one-time login or password reset for your Forex Nepal Admin account.</p>
                    <p>Click the button below to log in or reset your password:</p>
                    <p style="text-align: center;">
                      <a href="${resetUrl}" class="button">Access Your Account</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                    <p>Alternatively, you can use this code on the login page:</p>
                    <p style="text-align: center;" class="token">${resetToken}</p>
                    <p><strong>This link and code will expire in 15 minutes.</strong></p>
                    <p>If you didn't request this, please ignore this email.</p>
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
            console.log('Password reset/login email sent successfully via Brevo.');
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

        // --- UPDATED: Always find the user to check if they exist ---
        // But only send an email if one is present
        if (!user) {
            console.log(`Password reset request for "${username}", but user not found. Sending success for security.`);
            return new Response(JSON.stringify({ success: true, message: "If account exists, reset email sent" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        
        // --- This function now generates the token for BOTH use cases ---
        const resetToken = crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 900000).toISOString(); // 15 minutes

        await env.FOREX_DB.prepare(
            `INSERT INTO password_reset_tokens (username, token, expires_at) VALUES (?, ?, ?)`
        ).bind(username, resetToken, expiresAt).run();

        const resetUrl = `https://forex.grisma.com.np/#/admin/reset-password?token=${resetToken}`;
        
        // Only send the email if the user has one
        if (user.email) {
            sendPasswordResetEmail(
                env,
                user.email,
                user.username,
                resetToken,
                resetUrl,
                ctx
            );
        }

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

        // --- Mark token as used ---
        await env.FOREX_DB.prepare(
            `UPDATE password_reset_tokens SET used = 1 WHERE token = ?`
        ).bind(token).run();

        return new Response(JSON.stringify({ success: true, message: "Password reset successfully" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Reset password error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

// --- NEW: ONE-TIME LOGIN WITH TOKEN HANDLER ---
/**
 * (PUBLIC) Logs a user in using a password reset token without changing the password.
 */
export async function handleLoginWithToken(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const { token } = await request.json();
        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'Token is required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // Find the token
        const resetRecord = await env.FOREX_DB.prepare(
            `SELECT username, expires_at, used FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ username: string; expires_at: string; used: number }>();

        if (!resetRecord) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (resetRecord.used === 1) {
            return new Response(JSON.stringify({ success: false, error: 'This token has already been used' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const expiresAt = new Date(resetRecord.expires_at);
        if (expiresAt < new Date()) {
            return new Response(JSON.stringify({ success: false, error: 'This token has expired' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // Mark code as used
        await env.FOREX_DB.prepare(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?`).bind(token).run();

        // Log the user in
        const authToken = await generateToken(resetRecord.username, env.JWT_SECRET);
        
        return new Response(JSON.stringify({
            success: true,
            token: authToken,
            username: resetRecord.username,
            mustChangePassword: false // One-time login assumes they are trusted
        }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('One-time login error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


/**
 * (ADMIN) GET all users or POST a new user.
 */
export async function handleUsers(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
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
            if (!username || !password) {
                return new Response(JSON.stringify({ success: false, error: 'Username and password required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
            }
            
            const passwordHash = await simpleHash(password);
            await env.FOREX_DB.prepare(
                `INSERT INTO users (username, email, password_hash, role, created_at, updated_at, is_active) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 1)`
            ).bind(username, email || null, passwordHash, role || 'admin').run();
            
            return new Response(JSON.stringify({ success: true }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('User management error:', error.message, error.cause);
        if (error.message.includes('UNIQUE constraint failed: users.username')) {
            return new Response(JSON.stringify({ success: false, error: 'Username already exists.' }), { status: 409, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) DELETE a user by username.
 */
export async function handleUserById(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    const url = new URL(request.url);
    const username = url.pathname.split('/').pop();
    
    try {
        if (request.method === 'DELETE') {
            await env.FOREX_DB.prepare(`DELETE FROM users WHERE username = ?`).bind(username).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error('User delete error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) GET all posts or POST a new post.
 */
export async function handlePosts(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const { results } = await env.FOREX_DB.prepare(`SELECT id, title, slug, status, published_at, created_at, updated_at FROM posts ORDER BY created_at DESC`).all();
            return new Response(JSON.stringify({ success: true, posts: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (request.method === 'POST') {
            const post = await request.json();
            const slug = post.slug || generateSlug(post.title);
            const nowISO = new Date().toISOString();
            const status = ['draft', 'published'].includes(post.status) ? post.status : 'draft';
            const published_at = status === 'published' ? (post.published_at || nowISO) : null;
            const { meta } = await env.FOREX_DB.prepare(
                `INSERT INTO posts (title, slug, excerpt, content, featured_image_url, author_name, author_url, status, published_at, meta_title, meta_description, meta_keywords, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
            ).bind(
                post.title || 'Untitled', slug, post.excerpt || null, post.content || '', post.featured_image_url || null,
                post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, published_at,
                post.meta_title || post.title || 'Untitled', post.meta_description || post.excerpt || null, post.meta_keywords || null
            ).run();
            return new Response(JSON.stringify({ success: true, id: meta?.lastRowId || null }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handlePosts (${request.method}):`, error.message, error.cause);
        if (error.message.includes('UNIQUE constraint failed: posts.slug')) {
            return new Response(JSON.stringify({ success: false, error: 'Slug already exists. Please choose a unique slug.' }), { status: 409, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) GET, PUT, or DELETE a single post by its ID.
 */
export async function handlePostById(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const postId = parseInt(id || '', 10);
    if (isNaN(postId)) {
        return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const post = await env.FOREX_DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(postId).first();
            return post
                ? new Response(JSON.stringify({ success: true, post }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
                : new Response(JSON.stringify({ success: false, error: 'Not found' }), { status: 404, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (request.method === 'PUT') {
            const post = await request.json();
            const slug = post.slug || generateSlug(post.title);
            const status = ['draft', 'published'].includes(post.status) ? post.status : 'draft';
            let published_at = post.published_at;
            if (status === 'published' && !published_at) published_at = new Date().toISOString();
            else if (status === 'draft') published_at = null;
            await env.FOREX_DB.prepare(
                `UPDATE posts SET title=?, slug=?, excerpt=?, content=?, featured_image_url=?, author_name=?, author_url=?, status=?, published_at=?, meta_title=?, meta_description=?, meta_keywords=?, updated_at=datetime('now') WHERE id=?`
            ).bind(
                post.title || 'Untitled', slug, post.excerpt || null, post.content || '', post.featured_image_url || null,
                post.author_name || 'Grisma', post.author_url || 'https://grisma.com.np/about', status, published_at,
                post.meta_title || post.title || 'Untitled', post.meta_description || post.excerpt || null, post.meta_keywords || null,
                postId
            ).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        if (request.method === 'DELETE') {
            await env.FOREX_DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(postId).run();
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handlePostById (${request.method}, ID: ${postId}):`, error.message, error.cause);
        if (error.message.includes('UNIQUE constraint failed: posts.slug')) {
            return new Response(JSON.stringify({ success: false, error: 'Slug already exists. Please choose a unique slug.' }), { status: 409, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) GET or POST manual forex data.
 */
export async function handleForexData(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    try {
        if (request.method === 'GET') {
            const url = new URL(request.url);
            const date = url.searchParams.get('date');
            if (date) {
                const result = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates WHERE date = ?`).bind(date).first();
                return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
            } else {
                const { results } = await env.FOREX_DB.prepare(`SELECT * FROM forex_rates ORDER BY date DESC LIMIT 30`).all();
                return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
            }
        }
        if (request.method === 'POST') {
            const data = await request.json();
            const date = data.date;
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!date || !dateRegex.test(date)) return new Response(JSON.stringify({ success: false, error: 'Invalid date' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });

            const wideColumns: string[] = ['date', 'updated_at'];
            const widePlaceholders: string[] = ['?', "datetime('now')"];
            const wideValues: (string | number | null)[] = [date];

            let validRatesFound = false;

            for (const currency of CURRENCIES) {
                const buyKey = `${currency}_buy`, sellKey = `${currency}_sell`;
                const parsedBuy = (data[buyKey] === '' || data[buyKey] == null) ? null : parseFloat(data[buyKey]);
                const parsedSell = (data[sellKey] === '' || data[sellKey] == null) ? null : parseFloat(data[sellKey]);

                wideColumns.push(`"${buyKey}"`, `"${sellKey}"`);
                widePlaceholders.push('?', '?');
                wideValues.push(parsedBuy, parsedSell);

                if (parsedBuy !== null || parsedSell !== null) {
                    validRatesFound = true;
                }
            }

            if (!validRatesFound) return new Response(JSON.stringify({ success: false, error: 'No rates provided' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });

            const wideQuery = `INSERT OR REPLACE INTO forex_rates (${wideColumns.join(', ')}) VALUES (${widePlaceholders.join(', ')})`;
            await env.FOREX_DB.prepare(wideQuery).bind(...wideValues).run();

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    } catch (error: any) {
        console.error(`Error in handleForexData (${request.method}):`, error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


// --- ADMIN HANDLERS FOR API SETTINGS ---

/**
 * (ADMIN) GET all API access settings.
 */
export async function handleGetApiSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const { results } = await env.FOREX_DB.prepare("SELECT * FROM api_access_settings ORDER BY endpoint ASC").all<ApiAccessSetting>();
        return new Response(JSON.stringify({ success: true, settings: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) {
        console.error('Failed to fetch API settings:', e);
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}

/**
 * (ADMIN) POST (update) API access settings.
 */
export async function handleUpdateApiSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token, env.JWT_SECRET))) { // <-- Pass secret
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const settings: ApiAccessSetting[] = await request.json();
        
        if (!Array.isArray(settings)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid data format, expected an array of settings' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const stmts: D1PreparedStatement[] = [];
        for (const setting of settings) {
            if (!setting.endpoint || !setting.access_level) {
                console.warn('Skipping invalid API setting entry:', setting);
                continue;
            }

            stmts.push(
                env.FOREX_DB.prepare(
                    `UPDATE api_access_settings 
                     SET access_level = ?, allowed_rules = ?, quota_per_hour = ?, updated_at = datetime('now')
                     WHERE endpoint = ?`
                ).bind(
                    setting.access_level,
                    setting.allowed_rules || '[]',
                    setting.quota_per_hour || -1,
                    setting.endpoint
                )
            );
        }

        if (stmts.length > 0) {
            await env.FOREX_DB.batch(stmts);
        }
        
        // Clear the KV cache
        await env.API_SETTINGS_CACHE.delete(API_SETTINGS_CACHE_KEY);

        return new Response(JSON.stringify({ success: true, message: `${stmts.length} settings updated` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) {
        console.error('Failed to update API settings:', e);
        return new Response(JSON.stringify({ success: false, error: 'Database update failed' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


// --- REMOVED: ONE-TIME LOGIN HANDLERS ---
// --- Removed handleOneTimeLogin ---
// --- Removed handleGenerateOneTimeLoginCode ---


// --- NEW GOOGLE LOGIN HANDLER ---
/**
 * (PUBLIC) Handles the Google OAuth callback.
 * Exchanges the code for an access token, gets user email,
 * and logs in if the email exists in the DB.
 */
export async function handleGoogleLoginCallback(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    const { code } = await request.json();
    if (!code) {
        return new Response(JSON.stringify({ success: false, error: 'Authorization code is required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        console.error('Google OAuth secrets not set in worker environment');
        return new Response(JSON.stringify({ success: false, error: 'Server configuration error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    // This MUST match the URI in your Google Cloud Console
    const REDIRECT_URI = 'https://forex.grisma.com.np/admin/auth/google/callback';
    
    try {
        // 1. Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code: code as string,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Google token exchange failed:', errorData);
            return new Response(JSON.stringify({ success: false, error: 'Failed to verify Google token' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const { access_token } = await tokenResponse.json();

        // 2. Get user info with access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
            },
        });

        if (!userInfoResponse.ok) {
            console.error('Failed to fetch Google user info');
            return new Response(JSON.stringify({ success: false, error: 'Failed to get user info from Google' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const googleUser = await userInfoResponse.json() as { email: string; email_verified: boolean };

        if (!googleUser.email || !googleUser.email_verified) {
            return new Response(JSON.stringify({ success: false, error: 'Google account must have a verified email' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // 3. Find user in *your* database by email (as requested: "just login")
        const user = await env.FOREX_DB.prepare(
            `SELECT username FROM users WHERE email = ? AND is_active = 1`
        ).bind(googleUser.email).first<{ username: string }>();

        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'No admin account is associated with this Google email.' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // 4. User exists! Generate your app's JWT token and log them in.
        const token = await generateToken(user.username, env.JWT_SECRET);
        
        return new Response(JSON.stringify({
            success: true,
            token,
            username: user.username,
            mustChangePassword: false // Google login is trusted
        }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Google callback error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error during Google login' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}
