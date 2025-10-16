-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule OG image generation daily at 5:15 AM Nepal Time (UTC+5:45)
-- Converting to UTC: 5:15 AM NPT = 11:30 PM UTC previous day
SELECT cron.schedule(
  'generate-og-image-daily',
  '30 23 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://pziopeawvwyvzyjapijy.supabase.co/functions/v1/generate-og-image',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6aW9wZWF3dnd5dnp5amFwaWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMzA0NTUsImV4cCI6MjA3NTYwNjQ1NX0.O-4hdjlOTCgtWtlkqAB9Z8P3dZTYTjj9_M98_68C2x4"}'::jsonb,
      body := '{"trigger": "scheduled"}'::jsonb
    ) as request_id;
  $$
);