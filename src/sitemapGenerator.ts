import { Bindings } from './worker'; // Assuming you have a types file for bindings
import { format, addDays, differenceInDays, startOfDay } from 'date-fns';

const BASE_URL = 'https://forex.grisma.com.np';
const SITEMAP_PAGE_SIZE = 500;

// --- HTML Helper Functions ---

const createHtmlHeader = (title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      padding: 20px 40px; 
      line-height: 1.6; 
      background-color: #f9f9f9; 
      color: #333; 
    }
    .container { 
      max-width: 800px; 
      margin: 0 auto; 
      background: #fff; 
      border: 1px solid #ddd; 
      border-radius: 8px; 
      padding: 20px 40px; 
    }
    h1 { 
      font-size: 28px; 
      border-bottom: 2px solid #eee; 
      padding-bottom: 10px; 
      margin-top: 0; 
      color: #111;
    }
    .sitemap-list { 
      list-style: none; 
      padding: 0; 
      margin: 0;
    }
    .sitemap-list li { 
      padding: 12px 0; 
      border-bottom: 1px solid #eee; 
    }
    .sitemap-list li:last-child { 
      border-bottom: none; 
    }
    .sitemap-list a { 
      text-decoration: none; 
      color: #007bff; 
      font-size: 16px; 
      font-weight: 500;
    }
    .sitemap-list a:hover { 
      text-decoration: underline; 
    }
    .meta { 
      font-size: 13px; 
      color: #555; 
      margin-top: 5px; 
    }
  </style>
</head>
<body>
  <div class="container">
`;

const createHtmlFooter = () => `
  </div>
</body>
</html>
`;

// Creates a clickable <sitemap> entry for the index
const createSitemapEntry = (path: string, lastmod: string) => {
  const fullUrl = `${BASE_URL}${path}`;
  return `
  <li>
    <a href="${fullUrl}">${fullUrl}</a>
    <div class="meta">Last Modified: ${lastmod}</div>
  </li>`;
};

// Creates a clickable <url> entry for pages
const createUrlEntry = (path: string, lastmod: string, changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly', priority: number) => {
  // We must use the full hash-based URL for the crawler
  const fullUrl = `${BASE_URL}/#${path}`;
  return `
  <li>
    <a href="${fullUrl}">${fullUrl}</a>
    <div class="meta">Last Modified: ${lastmod} | Change: ${changefreq} | Priority: ${priority.toFixed(1)}</div>
  </li>`;
};


// --- Sitemap Generators ---

/**
 * Generates the main sitemap index file
 */
export const generateSitemapIndex = (archiveSitemapCount: number) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  let html = createHtmlHeader('Sitemap Index - ForexNepal');
  html += '<h1>Sitemap Index</h1>';
  html += '<ul class="sitemap-list">';

  // 1. Page Sitemap
  html += createSitemapEntry('/page-sitemap.xml', today);
  // 2. Post Sitemap
  html += createSitemapEntry('/post-sitemap.xml', today);
  // 3. Archive Sitemaps
  for (let i = 1; i <= archiveSitemapCount; i++) {
    html += createSitemapEntry(`/archive-sitemap${i}.xml`, today);
  }

  html += '</ul>';
  html += createHtmlFooter();
  return html;
};

/**
 * Generates the sitemap for static pages
 */
export const generatePageSitemap = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  let html = createHtmlHeader('Page Sitemap - ForexNepal');
  html += '<h1>Page Sitemap</h1>';
  html += '<ul class="sitemap-list">';

  // Add your static pages here
  html += createUrlEntry('/', today, 'daily', 1.0);
  html += createUrlEntry('/archive', today, 'daily', 0.8);
  html += createUrlEntry('/posts', today, 'daily', 0.8);
  html += createUrlEntry('/historical-charts', today, 'monthly', 0.7);
  html += createUrlEntry('/converter', today, 'monthly', 0.7);
  html += createUrlEntry('/about', today, 'yearly', 0.5);
  html += createUrlEntry('/contact', today, 'yearly', 0.5);
  html += createUrlEntry('/disclosure', today, 'yearly', 0.3);
  html += createUrlEntry('/privacy-policy', today, 'yearly', 0.3);

  html += '</ul>';
  html += createHtmlFooter();
  return html;
};

/**
 * Generates the sitemap for blog posts (fetches from D1)
 */
export const generatePostSitemap = async (db: D1Database) => {
  let html = createHtmlHeader('Post Sitemap - ForexNepal');
  html += '<h1>Post Sitemap</h1>';
  html += '<ul class="sitemap-list">';

  try {
    const { results } = await db.prepare("SELECT slug, updated_at FROM posts WHERE status = 'published' ORDER BY created_at DESC").all();
    
    if (results && results.length > 0) {
      results.forEach((post: any) => {
        const lastMod = format(new Date(post.updated_at || new Date()), 'yyyy-MM-dd');
        html += createUrlEntry(`/posts/${post.slug}`, lastMod, 'monthly', 0.9);
      });
    } else {
      html += '<li>No posts found.</li>';
    }
  } catch (error) {
    console.error('Error fetching posts for sitemap:', error);
    html += '<li>Error loading posts.</li>';
  }

  html += '</ul>';
  html += createHtmlFooter();
  return html;
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
  
  let html = createHtmlHeader(`Archive Sitemap ${page} - ForexNepal`);
  html += `<h1>Archive Sitemap (Page ${page})</h1>`;
  html += '<ul class="sitemap-list">';

  let daysAdded = 0;

  for (let i = startDay; i <= endDay; i++) {
    const targetDate = addDays(startDate, i);
    
    // If the date is in the future, stop
    if (targetDate > today) {
      break;
    }

    const dateStr = format(targetDate, 'yyyy-MM-dd');
    
    // This uses the URL format you requested: /forex-for/YYYY-MM-DD
    html += createUrlEntry(`/daily-update/forex-for/${dateStr}`, dateStr, 'daily', 0.6);
    daysAdded++;
  }

  // If no days were added (e.g., page number is too high), return null
  if (daysAdded === 0) {
    return null;
  }

  html += '</ul>';
  html += createHtmlFooter();
  return html;
};
