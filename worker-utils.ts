// src/worker-utils.ts
import { corsHeaders } from './constants';

/**
 * Handles CORS pre-flight OPTIONS requests.
 */
export function handleOptions(request: Request) {
    return new Response(null, { headers: corsHeaders });
}

/**
 * Formats a Date object into 'yyyy-mm-dd' string.
 */
export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Generates a URL-friendly slug from a title string.
 */
export function generateSlug(title: string): string {
    if (!title) return `post-${Date.now()}`;
    return title.toLowerCase()
        .replace(/&/g, '-and-').replace(/[^\w\s-]/g, '').trim()
        .replace(/\s+/g, '-').replace(/-+/g, '-');
}
