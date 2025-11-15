// src/worker-types.ts
import type { Rate, RatesData } from './types/forex';

// --- D1 & KV Interfaces ---
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    all<T = unknown>(): Promise<D1Result<T>>;
    run<T = unknown>(): Promise<D1Result<T>>;
    first<T = unknown>(): Promise<T | null>;
}

export interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    meta?: any;
}

export interface KVNamespace {
    get(key: string, options?: any): Promise<any>;
    put(key: string, value: any, options?: any): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
}

export interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
}

// --- Main Env Interface ---
export interface Env {
    FOREX_DB: D1Database;
    __STATIC_CONTENT: KVNamespace;
    BREVO_API_KEY: string;
    API_SETTINGS_CACHE: KVNamespace; 
    
    // --- Secrets ---
    JWT_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
}

// --- Custom App Types ---
export interface SiteSettings {
    ticker_enabled: boolean;
    adsense_enabled: boolean;
    adsense_exclusions: string;
}

// --- NEWLY ADDED: The missing UserProfile type ---
export interface UserProfile {
  username: string;
  email: string | null;
  full_name: string | null;
  mobile_number: string | null;
  profile_pic_url: string | null;
  role: string;
}
// --- END OF FIX ---

// --- Types for API Access Control ---
export type ApiAccessLevel = 'public' | 'disabled' | 'restricted';

export interface ApiAccessSetting {
    id: number;
    endpoint: string;
    access_level: ApiAccessLevel;
    allowed_rules: string; // JSON string array
    quota_per_hour: number; // -1 for unlimited
    updated_at: string;
}

export interface ApiUsageLog {
    id?: number;
    identifier: string;
    endpoint: string;
    request_time: string;
}
