# Cloudflare D1 Database Setup Instructions

This project now uses Cloudflare D1 to cache historical forex data, reducing API calls to NRB and improving performance.

## Setup Steps

### 1. Create D1 Database

Run this command in your terminal:

```bash
npx wrangler d1 create forex-rates
```

This will output something like:
```
✅ Successfully created DB 'forex-rates'!
Created your database using D1's new storage backend.
[[d1_databases]]
binding = "FOREX_DB"
database_name = "forex-rates"
database_id = "xxxx-xxxx-xxxx-xxxx"
```

### 2. Update wrangler.jsonc

Copy the `database_id` from the output above and update `wrangler.jsonc`:

```json
"d1_databases": [
    {
        "binding": "FOREX_DB",
        "database_name": "forex-rates",
        "database_id": "YOUR_DATABASE_ID_HERE"
    }
]
```

### 3. Run Database Migration

Execute the migration to create the tables:

```bash
npx wrangler d1 execute forex-rates --file=./migrations/001_create_forex_tables.sql
```

### 4. Initial Data Load (Optional)

To populate the database with initial data, you can manually trigger the scheduled worker or wait for it to run automatically at 5 AM Nepal time (23:00 UTC).

To manually trigger:
```bash
npx wrangler dev
# Then in another terminal, trigger the cron:
curl "http://localhost:8787/__scheduled?cron=0+23+*+*+*"
```

### 5. Deploy

Deploy your worker with D1 support:

```bash
npm run build
npx wrangler deploy
```

## How It Works

- **D1 Cache**: Historical forex data is stored in D1 database
- **Scheduled Updates**: Every day at 5 AM Nepal time (23:00 UTC), the worker fetches the last 7 days of data from NRB API and updates D1
- **Fallback**: If data is not in D1, the app falls back to fetching directly from NRB API
- **Hash Routing**: URLs now use hash-based routing (#) for direct access compatibility

## Database Schema

```sql
CREATE TABLE forex_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_code TEXT NOT NULL,
  currency_name TEXT NOT NULL,
  date TEXT NOT NULL,
  buy_rate REAL NOT NULL,
  sell_rate REAL NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(currency_code, date)
);
```

## Cron Schedule

The worker runs daily at 23:00 UTC (5:00 AM Nepal Time) to fetch and update forex data.

## Testing

To test the D1 integration locally:

1. Run `npx wrangler dev` 
2. Visit `http://localhost:8787/#/historical-charts`
3. Check browser console for any errors

## Troubleshooting

- If you get "Binding not found" error, make sure you've created the D1 database and updated the `database_id` in `wrangler.jsonc`
- Check D1 data: `npx wrangler d1 execute forex-rates --command "SELECT COUNT(*) FROM forex_rates"`
- View logs: `npx wrangler tail`
