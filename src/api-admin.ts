// src/api-admin.ts
// --- ADMIN-FACING API HANDLERS ---
// (This is an updated file, now including new API settings handlers)

import { Env, ExecutionContext, SiteSettings, D1Database, ApiAccessSetting } from './worker-types';
import { corsHeaders, CURRENCIES, CURRENCY_MAP } from './constants';
import { generateSlug, formatDate } from './worker-utils';
import { verifyToken, simpleHash, simpleHashCompare, generateToken } from './auth';
import { processAndStoreApiData } from './scheduled';
import { getAllSettings } from './api-helpers';

const API_SETTINGS_CACHE_KEY = 'api_access_settings_v1';

// --- All existing admin handlers (handleFetchAndStore, handleSiteSettings, handleCheckUser, etc.) go here ---
// ... (omitted for brevity, they are identical to the file from Step 3) ...
// ... (omitted for brevity) ...
// ... (omitted for brevity) ...


// --- NEW ADMIN HANDLERS ---

/**
 * (ADMIN) GET all API access settings.
 */
export async function handleGetApiSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const { results } = await env.FOREX_DB.prepare("SELECT * FROM api_access_settings").all<ApiAccessSetting>();
        return new Response(JSON.stringify({ success: true, settings: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (e: any) {
        console.error('Failed to fetch API settings:', e);
        return new Response(JSON.stringify({ success: false, error: 'Database query failed' }), { status: 500, headers: corsHeaders });
    }
}

/**
 * (ADMIN) POST (update) API access settings.
 */
export async function handleUpdateApiSettings(request: Request, env: Env): Promise<Response> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !(await verifyToken(token))) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: {...corsHeaders, 'Content-Type': 'application/json'} });
    }

    try {
        const settings: ApiAccessSetting[] = await request.json();
        
        if (!Array.isArray(settings)) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid data format, expected an array of settings' }), { status: 400, headers: corsHeaders });
        }

        const stmts: D1PreparedStatement[] = [];
        for (const setting of settings) {
            // Basic validation
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
        return new Response(JSON.stringify({ success: false, error: 'Database update failed' }), { status: 500, headers: corsHeaders });
    }
}


// --- PASTE ALL OTHER ADMIN HANDLERS FROM THE PREVIOUS STEP (api-admin.ts) BELOW ---
// (handleFetchAndStore, handleSiteSettings, handleCheckUser, handleAdminLogin, 
// handleCheckAttempts, handleChangePassword, handleRequestPasswordReset, handleResetPassword,
// handleUsers, handleUserById, handlePosts, handlePostById, handleForexData)

// (Helper function to be pasted in)
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
