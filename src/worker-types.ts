// src/worker-types.ts
import { D1Database, R2Bucket, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  // --- BINDINGS ---
  FOREX_DB: D1Database;
  __STATIC_CONTENT: R2Bucket; // Default for Pages
  API_SETTINGS_CACHE: KVNamespace; // KV for API settings cache

  // --- SECRETS ---
  JWT_SECRET: string;
  BREVO_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

// Re-export ExecutionContext and ScheduledEvent
export type { ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';


export interface Rate {
  iso3: string;
  name: string;
  unit: number;
  buy: number;
  sell: number;
}

export interface ForexData {
  date: string;
  published_on: string;
  modified_on: string;
  rates: Rate[];
}

export interface SiteSettings {
  ticker_enabled: boolean;
  adsense_enabled: boolean;
  adsense_exclusions: string;
}

export interface ApiAccessSetting {
  id: number;
  endpoint: string;
  access_level: 'public' | 'disabled' | 'restricted';
  allowed_rules: string; // JSON array
  quota_per_hour: number;
  updated_at: string;
}

export interface User {
  username: string;
  email: string | null;
  password_hash: string | null;
  plaintext_password?: string | null; // For migration
  role: 'admin' | 'editor';
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
  // --- ADDED NEW PROFILE FIELDS ---
  full_name: string | null;
  mobile_number: string | null;
  profile_pic_url: string | null;
}

// --- NEW: Profile-only type for frontend ---
export interface UserProfile {
  username: string;
  email: string | null;
  full_name: string | null;
  mobile_number: string | null;
  profile_pic_url: string | null;
  role: 'admin' | 'editor';
}
