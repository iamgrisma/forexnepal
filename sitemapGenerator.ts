// src/sitemapGenerator.ts
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { Env } from './worker-types'; // Import Env type

// D1Database type for sitemap generator
interface D1PreparedStatement {
  bind: (...values: any[]) => D1PreparedStatement;
  all: () => Promise<{ results: any[] }>;
}

interface D1Database {
  prepare: (query: string) => D1PreparedStatement;
}

const BASE_URL = 'https://forex.grisma.com.np';
const SITEMAP_PAGE_SIZE = 500;

// --- XML Helper Functions ---
const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
const xmlStylesheet = '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';
const urlsetStart = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const urlsetEnd = '</urlset>';
const sitemapIndexStart = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const sitemapIndexEnd = '</sitemapindex>';

const createUrlEntry = (path: string, lastmod: string, changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly', priority: number) => {
  const fullUrl = `${BASE_URL}/#${path}`;
  return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
};

const createSitemapEntry = (path: string, lastmod: string) => {
  const fullUrl = `${BASE_URL}${path}`;
  return `
  <sitemap>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
};

// --- Sitemap Generators ---

/**
 * Generates the main sitemap index file
 */
export const generateSitemapIndex = (archiveSitemapCount: number) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  let xml = `${xmlHeader}${xmlStylesheet}${sitemapIndexStart}`;
  xml += createSitemapEntry('/page-sitemap.xml', today);
  xml += createSitemapEntry('/post-sitemap.xml', today);
  for (let i = 1; i <= archiveSitemapCount; i++) {
    xml += createSitemapEntry(`/archive-sitemap${i}.xml`, today);
  }
  xml += sitemapIndexEnd;
  return xml;
};

/**
 * Generates the sitemap for static pages
 */
export const generatePageSitemap = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;
  xml += createUrlEntry('/', today, 'daily', 1.0);
  xml += createUrlEntry('/archive', today, 'daily', 0.8);
  xml += createUrlEntry('/posts', today, 'daily', 0.8);
  xml += createUrlEntry('/historical-charts', today, 'monthly', 0.7);
  xml += createUrlEntry('/converter', today, 'monthly', 0.7);
  xml += createUrlEntry('/about', today, 'yearly', 0.5);
  xml += createUrlEntry('/contact', today, 'yearly', 0.5);
  xml += createUrlEntry('/disclosure', today, 'yearly', 0.3);
  xml += createUrlEntry('/privacy-policy', today, 'yearly', 0.3);
  xml += urlsetEnd;
  return xml;
};

/**
 * Generates the sitemap for blog posts (fetches from D1)
 */
export const generatePostSitemap = async (db: D1Database) => {
  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;
  try {
    const { results } = await db.prepare("SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY created_at DESC").all();
    if (results && results.length > 0) {
      results.forEach((post: any) => {
        const lastMod = format(new Date(post.updated_at || new Date()), 'yyyy-MM-dd');
        xml += createUrlEntry(`/posts/${post.slug}`, lastMod, 'monthly', 0.9);
      });
    }
  } catch (error: any) {
    console.error('Error fetching posts for sitemap:', error.message);
  }
  xml += urlsetEnd;
  return xml;
};

/**
 * Calculates total archive sitemaps needed
 */
export const getArchiveSitemapCount = () => {
  const startDate = new Date(2000, 0, 1); // 2000-01-01
  const today = startOfDay(new Date());
  const totalDays = differenceInDays(today, startDate) + 1;
  return Math.ceil(totalDays / SITEMAP_PAGE_SIZE);
};

/**
 * Generates a specific archive sitemap by page number
 */
export const generateArchiveSitemap = (page: number) => {
  if (page < 1) return null;

  const startDate = new Date(2000, 0, 1);
  const today = startOfDay(new Date());
  
  const startDay = (page - 1) * SITEMAP_PAGE_SIZE;
  const endDay = (page * SITEMAP_PAGE_SIZE) - 1;

  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;
  let daysAdded = 0;

  for (let i = startDay; i <= endDay; i++) {
    const targetDate = addDays(startDate, i);
    if (targetDate > today) break;

    const dateStr = format(targetDate, 'yyyy-MM-dd');
    // --- FIX: This URL was wrong in your file, updated to match your routes ---
    xml += createUrlEntry(`/archive/${dateStr}`, dateStr, 'daily', 0.6); 
    daysAdded++;
  }

  if (daysAdded === 0) return null;
  xml += urlsetEnd;
  return xml;
};

// --- NEW (BUT WAS MISSING) ---
/**
 * Main HTTP request handler for all sitemap routes.
 */
export async function handleSitemap(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const xmlHeaders = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400' // 24 hours
  };

  try {
    if (pathname === '/sitemap.xml' || pathname === '/sitemap_index.xml') {
      const count = getArchiveSitemapCount();
      const xml = generateSitemapIndex(count);
      return new Response(xml, { headers: xmlHeaders });
    }

    if (pathname === '/page-sitemap.xml') {
      const xml = generatePageSitemap();
      return new Response(xml, { headers: xmlHeaders });
    }

    if (pathname === '/post-sitemap.xml') {
      const xml = await generatePostSitemap(env.FOREX_DB);
      return new Response(xml, { headers: xmlHeaders });
    }

    // Handle /archive-sitemap1.xml, /archive-sitemap2.xml, etc.
    const archiveMatch = pathname.match(/\/archive-sitemap(\d+)\.xml$/);
    if (archiveMatch && archiveMatch[1]) {
      const page = parseInt(archiveMatch[1], 10);
      const xml = generateArchiveSitemap(page);
      if (xml) {
        return new Response(xml, { headers: xmlHeaders });
      }
    }
    
    return new Response('Sitemap not found', { status: 404 });
  } catch (error: any) {
    console.error(`Sitemap generation failed for ${pathname}:`, error.message);
    return new Response('Error generating sitemap', { status: 500 });
  }
}
