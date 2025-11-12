// src/api-admin.ts
// --- ADMIN-FACING API HANDLERS ---

import { Env, ExecutionContext, SiteSettings, D1Database, ApiAccessSetting, D1PreparedStatement } from './worker-types';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { generateSlug, formatDate } from './worker-utils';
import { verifyToken, simpleHash, simpleHashCompare, generateToken } from './auth';
import { processAndStoreApiData } from './scheduled';
import { getAllSettings } from './api-helpers';

const API_SETTINGS_CACHE_KEY = 'api_access_settings_v1';

// ... [ALL EXISTING FUNCTIONS from handleFetchAndStore to handleResetPassword] ...
// (No changes to any of the existing functions up to this point)


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


// ... [ALL OTHER FUNCTIONS from handlePosts to handleUpdateApiSettings] ...
// (No changes to any of the existing functions up to this point)


// --- NEW: ONE-TIME LOGIN (MAGIC LINK) HANDLERS ---

/**
 * (ADMIN) Helper function to send one-time login email via Brevo.
 */
async function sendOneTimeLoginEmail(
    env: Env,
    to: string,
    username: string,
    loginToken: string,
    loginUrl: string,
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
            subject: 'One-Time Login Request - Forex Nepal Admin',
            htmlContent: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; padding: 12px 30px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>One-Time Login Request</h1>
                  </div>
                  <div class="content">
                    <p>Hello <strong>${username}</strong>,</p>
                    <p>We received a request for a one-time login to the Forex Nepal Admin Dashboard.</p>
                    <p>Click the button below to log in securely:</p>
                    <p style="text-align: center;">
                      <a href="${loginUrl}" class="button">Log In to Dashboard</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #3498db;">${loginUrl}</p>
                    <p><strong>This login link will expire in 15 minutes.</strong></p>
                    <p>If you didn't request this, please ignore this email or contact support if you're concerned about your account security.</p>
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
            console.log('One-time login email sent successfully via Brevo.');
        }
    }).catch(emailError => {
        console.error('Email sending error:', emailError);
    });

    ctx.waitUntil(emailPromise);
}


/**
 * (PUBLIC) Request a one-time login link.
 */
export async function handleRequestOneTimeLoginLink(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
    
    try {
        const { username } = await request.json(); // Can be username or email
        if (!username) {
            return new Response(JSON.stringify({ success: false, error: 'Username or email required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const user = await env.FOREX_DB.prepare(
            `SELECT username, email FROM users WHERE (username = ? OR email = ?) AND is_active = 1`
        ).bind(username, username).first<{ username: string; email: string | null }>();

        // Secure: Always return success to prevent user enumeration
        if (!user || !user.email) {
            console.log(`One-time login link request for "${username}", but user or email not found. Sending success for security.`);
            return new Response(JSON.stringify({ success: true, message: "If your account exists, a login link has been sent to your email." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // Use a secure UUID for the token
        const loginToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 900000).toISOString(); // 15 minutes

        // Store in the 'one_time_access' table
        await env.FOREX_DB.prepare(
            `INSERT INTO one_time_access (username, access_code, expires_at, code_type) VALUES (?, ?, ?, 'login')`
        ).bind(user.username, loginToken, expiresAt).run();

        // The new URL for the frontend page that will validate this token
        const loginUrl = `https://forex.grisma.com.np/#/admin/login-link?token=${loginToken}`;
        
        sendOneTimeLoginEmail(
            env,
            user.email,
            user.username,
            loginToken,
            loginUrl,
            ctx
        );

        return new Response(JSON.stringify({ success: true, message: "If your account exists, a login link has been sent to your email." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('Request one-time login link error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


/**
 * (PUBLIC) Logs a user in using a one-time login token from a URL.
 */
export async function handleValidateOneTimeLoginToken(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const { token } = await request.json();
        if (!token) {
            return new Response(JSON.stringify({ success: false, error: 'Login token is required' }), { status: 400, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // Find the token in the 'one_time_access' table
        const accessRecord = await env.FOREX_DB.prepare(
            `SELECT id, username, expires_at, used FROM one_time_access WHERE access_code = ? AND code_type = 'login'`
        ).bind(token).first<{ id: number; username: string; expires_at: string; used: number }>();

        if (!accessRecord) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid or expired login link' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        if (accessRecord.used === 1) {
            return new Response(JSON.stringify({ success: false, error: 'This login link has already been used' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        const expiresAt = new Date(accessRecord.expires_at);
        if (expiresAt < new Date()) {
            return new Response(JSON.stringify({ success: false, error: 'This login link has expired' }), { status: 403, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
        }

        // Mark code as used
        await env.FOREX_DB.prepare(`UPDATE one_time_access SET used = 1 WHERE id = ?`).bind(accessRecord.id).run();

        // Log the user in by generating a JWT
        const jwtToken = await generateToken(accessRecord.username, env.JWT_SECRET);
        
        return new Response(JSON.stringify({
            success: true,
            token: jwtToken,
            username: accessRecord.username,
            mustChangePassword: false // One-time login assumes they are trusted
        }), { headers: {...corsHeaders, 'Content-Type': 'application/json'} });

    } catch (error: any) {
        console.error('One-time login token validation error:', error.message, error.cause);
        return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }
}


/* --- REMOVED OBSOLETE CODE ---
 * The two functions handleOneTimeLogin and handleGenerateOneTimeLoginCode
 * (which were for the 8-digit code) are no longer needed.
 */
