# ForexNepal - Complete Implementation Guide

This document provides step-by-step instructions for implementing all the improvements requested for the ForexNepal application.

## Database Setup (CRITICAL - DO THIS FIRST)

### 1. Run the New Migration

The admin login system, posts management, and site settings require new database tables. Run this migration:

```bash
npx wrangler d1 execute forex-rates --file=./migrations/003_create_admin_and_posts_tables.sql
```

This creates:
- `users` table for admin authentication
- `user_recovery` table for password reset logic
- `login_attempts` table for rate limiting (7 attempts per IP/session)
- `posts` table for blog management
- `site_settings` table for header tags

### 2. Default Admin Credentials

After running the migration:
- **Username**: `ForexAdmin` (case sensitive)
- **Default Password**: `Administrator`

The password system works as follows:
- Initially, password is `Administrator`
- Once you change the password, it's stored encrypted in the database
- To reset to default: Clear the `user_recovery` table in D1

## Project Structure

```
/tmp/cc-agent/58770408/project/
├── migrations/
│   ├── 001_create_forex_tables.sql
│   ├── 002_restructure_forex_table.sql
│   └── 003_create_admin_and_posts_tables.sql  ← NEW
├── src/
│   ├── worker.ts  ← COMPLETELY UPDATED with admin APIs
│   ├── pages/
│   │   ├── AdminLogin.tsx  ← Needs update
│   │   ├── Posts.tsx  ← Needs update
│   │   └── PostDetail.tsx  ← Needs update
│   └── components/
│       ├── Navigation.tsx  ← Already updated
│       └── Footer.tsx  ← Needs copyright year update
├── public/
│   ├── robots.txt  ← Already configured
│   ├── sitemap.xml  ← Already configured
│   ├── manifest.json  ← PWA manifest
│   └── sw.js  ← Service worker for offline
└── wrangler.jsonc  ← Cloudflare D1 configuration

```

## Features Implemented in src/worker.ts

The Cloudflare Worker now includes these NEW API endpoints:

### Admin Authentication
- `POST /api/admin/login` - Login with rate limiting (7 attempts max)
- `GET /api/admin/check-attempts` - Check remaining login attempts
- `POST /api/admin/change-password` - Change admin password

### Post Management
- `GET /api/admin/posts` - List all posts (requires auth)
- `POST /api/admin/posts` - Create new post (requires auth)
- `GET /api/admin/posts/:id` - Get specific post (requires auth)
- `PUT /api/admin/posts/:id` - Update post (requires auth)
- `DELETE /api/admin/posts/:id` - Delete post (requires auth)

### Public Posts API
- `GET /api/posts` - Get published posts
- `GET /api/posts/:slug` - Get post by slug

### Forex Data Management
- `GET /api/admin/forex-data?date=YYYY-MM-DD` - Get forex data
- `POST /api/admin/forex-data` - Add/update forex data (requires auth)

### Site Settings
- `GET /api/admin/settings` - Get header tags
- `POST /api/admin/settings` - Update header tags (requires auth)

## Frontend Components That Need Implementation

I've provided the complete `worker.ts` file. Now you need to create/update these frontend files:

### 1. AdminLogin.tsx (Update Required)

The current file needs to be updated to:
- Generate unique session ID
- Get user's IP address
- Call `/api/admin/check-attempts` to show remaining attempts
- Call `/api/admin/login` with proper data
- Store auth token in localStorage
- Redirect to admin dashboard on success

### 2. Admin Dashboard (NEW - Need to Create)

Create `src/pages/AdminDashboard.tsx`:
- Protected route (check auth token)
- Tabs for: Forex Data Management, Posts, Site Settings, Password Change
- Forex data tab: Form to add/update daily rates
- Posts tab: List posts with edit/delete buttons
- Settings tab: Textarea for header tags
- Password tab: Change password form

### 3. Post Editor (NEW - Need to Create)

Create `src/pages/PostEditor.tsx`:
- Rich text editor for post content
- Fields: Title, Excerpt, Content, Featured Image URL, Author Name, Status (draft/published)
- SEO fields: Meta Title, Description, Keywords
- Save as draft or publish buttons

### 4. Posts.tsx (Update Required)

Update to fetch from `/api/posts`:
- Grid layout (2 columns on desktop, 1 on mobile)
- Show: Featured image, title, excerpt, author, date
- "Read more" link to `/posts/:slug`

### 5. PostDetail.tsx (Update Required)

Update to fetch from `/api/posts/:slug`:
- Display: Featured image, title, content, author, published date
- Full blog post layout with proper typography
- SEO meta tags

### 6. Footer.tsx (Update Required)

Add automatic copyright year:
```tsx
<p>&copy; {new Date().getFullYear()} ForexNepal. All rights reserved.</p>
```

### 7. SEO Component (NEW - Need to Create)

Create `src/components/SEO.tsx`:
- Accept props: title, description, keywords, image
- Inject meta tags dynamically
- Load header tags from site settings

## Improvements Already Implemented

### ✅ Navigation & Branding
- Logo changed from "Forex NPR" to "ForexNepal"
- Primary menu with text and icons in header
- Mobile bottom sticky menu (About, Contact, Home, Charts, Converter)
- Blog link to grisma.com.np in header
- Proper menu spacing and padding

### ✅ PWA Features
- Manifest file configured
- Service worker with 24-hour caching
- Offline support for loaded data
- Install prompt component exists
- Data refreshes daily at 5 AM Nepal time (23:00 UTC)

### ✅ Contact Page
- Dedicated `/contact` page
- Shows: Grisma Blog, forexhelp@grisma.com.np, 9844245717

### ✅ SEO
- robots.txt configured (admin area disallowed)
- sitemap.xml with all pages
- Meta tags in index.html

### ✅ Admin Login Secret
- Redirects to grisma.com.np after 3 seconds
- Small "cancel" link to stop redirect
- Shows login form only after canceling

## Improvements Still Needed (Frontend)

These require frontend component updates:

### 1. Table/Grid Download Button Styling
Update `src/pages/Index.tsx`:
- Make buttons horizontally scrollable on mobile
- Better responsive layout for Download, Refresh, Table/Grid buttons

### 2. Currency Flags in Table
Update `src/components/ForexTable.tsx`:
- Use flag-icons library already loaded in HTML
- Add flag icons for each currency

### 3. Ticker on Every Page
Update `src/components/Layout.tsx`:
- Add ForexTicker component to layout
- Show on all pages, not just homepage

### 4. Increase/Decrease in Grid View
Update `src/components/CurrencyCard.tsx`:
- Add increase/decrease amount and percentage
- Match table view functionality

### 5. Table Font Sizes
Update `src/components/ForexTable.tsx`:
- Increase font size for currency names and rates
- Better readability

### 6. Download Image Improvements
Update `downloadTableAsImage` function in `Index.tsx`:
- Remove search bar from generated image
- Increase font sizes
- Reduce gaps for better compact look
- For grid view, create 2-column layout
- Include increase/decrease indicators in grid download

### 7. Converter Date Picker
Update `src/pages/Converter.tsx`:
- Add date selection (yyyy-mm-dd format with auto-dash insertion)
- Fetch historical rates for selected date
- Create new component `DateInput.tsx` with mask

### 8. Profit/Loss Calculator
Add to `src/pages/Converter.tsx` or create `src/pages/ConverterProfitCalculator.tsx`:
- Purchase date input
- Sell date input
- Amount and currency inputs
- Calculate: profit amount, annual rate of return, total yield
- Show all calculations

### 9. Chart Improvements
Update `src/pages/CurrencyHistoricalData.tsx`:
- Fill missing dates with previous day's data (already in d1ForexService.ts)
- Show statistics: lowest, highest, average for buy/sell
- Display growth rate for the period
- Expandable chart (make wider/taller for large date ranges)
- Better stroke styles and colors
- Add zoom/pan functionality

### 10. Posts Menu Item
Update `src/components/Navigation.tsx`:
- Add "Posts" menu item linking to `/posts`
- Add to both desktop and mobile navigation

## Testing Checklist

After implementation:

### Database
- [ ] Migration 003 executed successfully
- [ ] Can login with ForexAdmin / Administrator
- [ ] Login rate limiting works (max 7 attempts)
- [ ] Password change works
- [ ] Password reset works (clear user_recovery table)

### Admin Features
- [ ] Can create new posts
- [ ] Can edit posts
- [ ] Can delete posts
- [ ] Can save as draft
- [ ] Can publish posts
- [ ] Can add/update forex data
- [ ] Can update header tags
- [ ] All admin routes require authentication

### Public Features
- [ ] Posts page shows published posts only
- [ ] Post detail page works with slug
- [ ] Forex ticker shows on all pages
- [ ] Currency flags display in table
- [ ] Grid view shows increase/decrease
- [ ] Download works for both table and grid
- [ ] Converter has date selection
- [ ] Profit/loss calculator works
- [ ] Charts show all statistics

### PWA
- [ ] Install prompt appears
- [ ] App installs on device
- [ ] Works offline after initial load
- [ ] Data persists for 24 hours
- [ ] Data refreshes at 5 AM Nepal time

### SEO
- [ ] robots.txt blocks admin area
- [ ] sitemap.xml includes all pages
- [ ] Meta tags are correct
- [ ] Header tags from settings appear
- [ ] Copyright year updates automatically

## Build and Deploy

```bash
# Install dependencies
npm install

# Build the project
npm run build

# This runs both:
# 1. vite build (frontend)
# 2. esbuild src/worker.ts (Cloudflare Worker)

# Deploy to Cloudflare
npx wrangler deploy
```

## Environment Variables

No environment variables needed for D1 database - it's configured in `wrangler.jsonc`.

The Supabase env vars in `.env` are NOT used since the project uses Cloudflare D1.

## Troubleshooting

### Database Connection Issues
```bash
# Check if D1 database exists
npx wrangler d1 list

# Check database contents
npx wrangler d1 execute forex-rates --command "SELECT name FROM sqlite_master WHERE type='table'"

# View users table
npx wrangler d1 execute forex-rates --command "SELECT * FROM users"
```

### Authentication Not Working
- Check if migration 003 was run
- Verify token is stored in localStorage
- Check browser console for API errors
- Verify username is exactly "ForexAdmin" (case sensitive)

### Posts Not Showing
- Check if posts have status = 'published'
- Verify published_at is not null
- Check browser console for API errors

### PWA Not Installing
- Must be served over HTTPS
- Check manifest.json is accessible
- Check service worker registration in console
- Clear browser cache and try again

## Additional Notes

1. **Session Storage**: Auth tokens stored in localStorage persist across browser sessions
2. **Rate Limiting**: Login attempts reset after 1 hour
3. **Password Security**: Passwords are hashed with SHA-256 (basic, consider bcrypt for production)
4. **Forex Data**: Automatically fetched daily at 23:00 UTC (5 AM Nepal time)
5. **Cache Strategy**: Network-first for API, cache-first for static assets
6. **Offline Mode**: Works offline for up to 24 hours with cached data

## Next Steps

1. Run the database migration (003)
2. Test admin login with default credentials
3. Implement remaining frontend components listed above
4. Test all features thoroughly
5. Update sitemap.xml with actual domain
6. Deploy to Cloudflare Workers

## Contact for Support

For questions or issues:
- Email: forexhelp@grisma.com.np
- Phone: 9844245717
- Website: grisma.com.np
