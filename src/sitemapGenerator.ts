import { D1Database } from './worker'; // Import D1 type
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';

const BASE_URL = 'https://forex.grisma.com.np';
const SITEMAP_PAGE_SIZE = 500;

// --- XML Helper Functions ---

const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
// This is the magic line that makes it clickable in a browser
const xmlStylesheet = '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>';

const urlsetStart = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const urlsetEnd = '</urlset>';
const sitemapIndexStart = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const sitemapIndexEnd = '</sitemapindex>';

// Creates a single <url> entry
const createUrlEntry = (path: string, lastmod: string, changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly', priority: number) => {
  // We must use the full hash-based URL for the crawler
  const fullUrl = `${BASE_URL}/#${path}`;
  return `
  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
};

// Creates a single <sitemap> entry for the index
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
  // Add the stylesheet link
  let xml = `${xmlHeader}${xmlStylesheet}${sitemapIndexStart}`;

  // 1. Page Sitemap
  xml += createSitemapEntry('/page-sitemap.xml', today);
  // 2. Post Sitemap
  xml += createSitemapEntry('/post-sitemap.xml', today);
  // 3. Archive Sitemaps
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
  // Add the stylesheet link
  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;

  // Add your static pages here
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
  // Add the stylesheet link
  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;

  try {
    const { results } = await db.prepare("SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY created_at DESC").all();
    
    if (results && results.length > 0) {
      results.forEach((post: any) => {
        const lastMod = format(new Date(post.updated_at || new Date()), 'yyyy-MM-dd');
        xml += createUrlEntry(`/posts/${post.slug}`, lastMod, 'monthly', 0.9);
      });
    }
  } catch (error) {
    console.error('Error fetching posts for sitemap:', error);
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

  // Add the stylesheet link
  let xml = `${xmlHeader}${xmlStylesheet}${urlsetStart}`;
  let daysAdded = 0;

  for (let i = startDay; i <= endDay; i++) {
    const targetDate = addDays(startDate, i);
    
    // If the date is in the future, stop
    if (targetDate > today) {
      break;
    }

    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // This uses your correct /daily-update/forex-for/YYYY-MM-DD format
    xml += createUrlEntry(`/daily-update/forex-for/${dateStr}`, dateStr, 'daily', 0.6);
    daysAdded++;
  }

  // If no days were added (e.g., page number is too high), return null
  if (daysAdded === 0) {
    return null;
  }

  xml += urlsetEnd;
  return xml;
};
