// src/pages/ApiDocs.tsx
import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CopyCodeButton from '@/components/CopyCodeButton';
import ApiEmbedPreview from '@/components/ApiEmbedPreview';

const CodeBlock: React.FC<{ code: string; title?: string }> = ({ code, title }) => (
  <div className="relative mt-4">
    {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
    <div className="relative rounded-md border bg-gray-900 text-gray-50 p-4 font-mono text-sm overflow-x-auto">
      <CopyCodeButton
        codeToCopy={code}
        className="absolute top-2 right-2 text-white hover:bg-gray-700"
      />
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  </div>
);

const ApiDocs = () => {

  const imageTableEmbedCode = `
<div id="forex-grisma-widget-table"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-table');
    if (!container) return;

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">Forex by Grisma</a>, A NRB Realtime API Based Platform';

    const style = \`
      <style>
        #forex-grisma-widget-table {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          max-width: 400px;
          min-width: 300px;
          background: #ffffff;
        }
        .fgwt-header {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e2e8f0;
        }
        .fgwt-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .fgwt-header p {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0 0;
        }
        .fgwt-body {
          max-height: 300px;
          overflow-y: auto;
        }
        .fgwt-table {
          width: 100%;
          border-collapse: collapse;
        }
        .fgwt-table th, .fgwt-table td {
          text-align: left;
          padding: 10px 16px;
          font-size: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .fgwt-table th {
          background: #f8f9fa;
          font-weight: 500;
          color: #475569;
        }
        .fgwt-table td {
          color: #1e293b;
        }
        .fgwt-currency {
          font-weight: 500;
        }
        .fgwt-trend {
          font-size: 18px;
          line-height: 1;
        }
        .fgwt-trend-increase { color: #10b981; }
        .fgwt-trend-decrease { color: #ef4444; }
        .fgwt-trend-stable { color: #64748b; }
        .fgwt-footer {
          padding: 12px 16px;
          background: #f8f9fa;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          text-align: center;
          color: #64748b;
        }
        .fgwt-footer a {
          color: #3b82f6;
          text-decoration: none;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    function renderWidget(data) {
      const getTrendIcon = (trend) => {
        if (trend.trend === 'increase') return '<span class="fgwt-trend fgwt-trend-increase" title="Up by ' + trend.diff.toFixed(2) + '">&#9650;</span>';
        if (trend.trend === 'decrease') return '<span class="fgwt-trend fgwt-trend-decrease" title="Down by ' + trend.diff.toFixed(2) + '">&#9660;</span>';
        return '<span class="fgwt-trend fgwt-trend-stable" title="Stable">&#9644;</span>';
      };

      container.innerHTML = \`
        <div class="fgwt-header">
          <h3>Nepal Forex Rates</h3>
          <p>As of \${data.date}</p>
        </div>
        <div class="fgwt-body">
          <table class="fgwt-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Buy</th>
                <th>Sell</th>
              </tr>
            </thead>
            <tbody>
              \${data.rates.map(rate => \`
                <tr>
                  <td class="fgwt-currency">\${rate.iso3} (\${rate.unit})</td>
                  <td>\${rate.buy.toFixed(2)} \${getTrendIcon(rate.buyTrend)}</td>
                  <td>\${rate.sell.toFixed(2)} \${getTrendIcon(rate.sellTrend)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
        <div class="fgwt-footer">
          \${sourceLink}
        </div>
      \`;
    }

    container.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 14px; color: #64748b;">Loading...</div>';

    fetch('https://forex.grisma.com.np/api/image/latest-rates')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          renderWidget(data);
        } else {
          throw new Error(data.error || 'Failed to load data');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div style="padding: 20px; text-align: center; font-size: 14px; color: #ef4444;">\${error.message}</div>\`;
      });
  })();
</script>
  `;
  
  const imageGridEmbedCode = `
<div id="forex-grisma-widget-grid"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-grid');
    if (!container) return;
    
    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">Forex by Grisma</a>, A NRB Realtime API Based Platform';

    const style = \`
      <style>
        #forex-grisma-widget-grid {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          max-width: 100%;
          background: #ffffff;
        }
        .fgwg-header {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e2e8f0;
        }
        .fgwg-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .fgwg-header p {
          font-size: 12px;
          color: #64748b;
          margin: 4px 0 0;
        }
        .fgwg-body {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 1px;
          background: #e2e8f0;
          max-height: 320px;
          overflow-y: auto;
          border-bottom: 1px solid #e2e8f0;
        }
        .fgwg-card {
          background: #ffffff;
          padding: 12px;
        }
        .fgwg-currency {
          font-size: 14px;
          font-weight: 600;
          color: #1e293b;
        }
        .fgwg-unit {
          font-size: 11px;
          color: #64748b;
          margin-left: 4px;
        }
        .fgwg-rates {
          margin-top: 8px;
          font-size: 13px;
        }
        .fgwg-rate {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .fgwg-label {
          color: #64748b;
        }
        .fgwg-value {
          font-weight: 500;
        }
        .fgwg-trend {
          font-size: 14px;
          line-height: 1;
          margin-left: 4px;
        }
        .fgwg-trend-increase { color: #10b981; }
        .fgwg-trend-decrease { color: #ef4444; }
        .fgwg-trend-stable { color: #64748b; }
        .fgwg-footer {
          padding: 12px 16px;
          background: #f8f9fa;
          font-size: 11px;
          text-align: center;
          color: #64748b;
        }
        .fgwg-footer a {
          color: #3b82f6;
          text-decoration: none;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    function renderWidget(data) {
      const getTrendIcon = (trend) => {
        if (trend.trend === 'increase') return '<span class="fgwg-trend fgwg-trend-increase" title="Up by ' + trend.diff.toFixed(2) + '">&#9650;</span>';
        if (trend.trend === 'decrease') return '<span class="fgwg-trend fgwg-trend-decrease" title="Down by ' + trend.diff.toFixed(2) + '">&#9660;</span>';
        return '<span class="fgwg-trend fgwg-trend-stable" title="Stable">&#9644;</span>';
      };

      container.innerHTML = \`
        <div class="fgwg-header">
          <h3>Nepal Forex Rates</h3>
          <p>As of \${data.date}</p>
        </div>
        <div class="fgwg-body">
          \${data.rates.map(rate => \`
            <div class="fgwg-card">
              <div>
                <span class="fgwg-currency">\${rate.iso3}</span>
                <span class="fgwg-unit">(\${rate.unit})</span>
              </div>
              <div class="fgwg-rates">
                <div class="fgwg-rate">
                  <span class="fgwg-label">Buy:</span>
                  <span class="fgwg-value">\${rate.buy.toFixed(2)} \${getTrendIcon(rate.buyTrend)}</span>
                </div>
                <div class="fgwg-rate">
                  <span class="fgwg-label">Sell:</span>
                  <span class="fgwg-value">\${rate.sell.toFixed(2)} \${getTrendIcon(rate.sellTrend)}</span>
                </div>
              </div>
            </div>
          \`).join('')}
        </div>
        <div class="fgwg-footer">
          \${sourceLink}
        </div>
      \`;
    }

    container.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 14px; color: #64748b;">Loading...</div>';

    fetch('https://forex.grisma.com.np/api/image/latest-rates')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          renderWidget(data);
        } else {
          throw new Error(data.error || 'Failed to load data');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div style="padding: 20px; text-align: center; font-size: 14px; color: #ef4444;">\${error.message}</div>\`;
      });
  })();
</script>
  `;
  
  const archiveListEmbedCode = `
<div id="forex-grisma-widget-archive-list"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-archive-list');
    if (!container) return;

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">Forex by Grisma</a>, A NRB Realtime API Based Platform';
    
    const style = \`
      <style>
        #forex-grisma-widget-archive-list {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          max-width: 400px;
          min-width: 300px;
          background: #ffffff;
        }
        .fgwal-header {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e2e8f0;
        }
        .fgwal-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .fgwal-body {
          max-height: 300px;
          overflow-y: auto;
          padding: 8px 0;
        }
        .fgwal-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .fgwal-list-item a {
          display: block;
          padding: 8px 16px;
          font-size: 14px;
          color: #1e293b;
          text-decoration: none;
        }
        .fgwal-list-item a:hover {
          background: #f1f5f9;
        }
        .fgwal-footer {
          padding: 12px 16px;
          background: #f8f9fa;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          text-align: center;
          color: #64748b;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    container.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 14px; color: #64748b;">Loading Archive...</div>';

    fetch('https://forex.grisma.com.np/api/archive/list?page=1&limit=20')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          container.innerHTML = \`
            <div class="fgwal-header">
              <h3>Forex Archive</h3>
            </div>
            <div class="fgwal-body">
              <ul class="fgwal-list">
                \${data.dates.map(date => \`
                  <li class="fgwal-list-item">
                    <a href="https://forex.grisma.com.np/archive/\${date}" target="_blank" rel="noopener noreferrer">
                      View Rates for \${date}
                    </a>
                  </li>
                \`).join('')}
              </ul>
            </div>
            <div class="fgwal-footer">
              \${sourceLink}
            </div>
          \`;
        } else {
          throw new Error(data.error || 'Failed to load archive');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div style="padding: 20px; text-align: center; font-size: 14px; color: #ef4444;">\${error.message}</div>\`;
      });
  })();
</script>
  `;

  const archiveDetailEmbedCode = `
<div id="forex-grisma-widget-archive-detail" data-date="2024-07-20"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-archive-detail');
    if (!container) return;

    // --- CONFIGURATION ---
    // Get date from data attribute, or use yesterday
    const getYesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    };
    const date = container.dataset.date || getYesterday();
    // --- END CONFIGURATION ---

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">Forex by Grisma</a>, A NRB Realtime API Based Platform';
    
    const style = \`
      <style>
        #forex-grisma-widget-archive-detail {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          max-width: 600px;
          background: #ffffff;
        }
        .fgwad-header {
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .fgwad-header h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .fgwad-header p {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }
        .fgwad-body {
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          color: #334155;
        }
        .fgwad-body p {
          margin: 0 0 12px;
        }
        .fgwad-body p:last-child {
          margin-bottom: 0;
        }
        .fgwad-download-btn {
          font-size: 12px;
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 4px;
          cursor: pointer;
          color: #475569;
        }
        .fgwad-download-btn:hover {
          background: #f1f5f9;
        }
        .fgwad-footer {
          padding: 12px 16px;
          background: #f8f9fa;
          border-top: 1px solid #e2e8f0;
          font-size: 11px;
          text-align: center;
          color: #64748b;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    container.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 14px; color: #64748b;">Loading News for ' + date + '...</div>';

    fetch(\`https://forex.grisma.com.np/api/archive/detail/\${date}\`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const { intro, summary, detail } = data.paragraphs;
          container.innerHTML = \`
            <div class="fgwad-header">
              <div>
                <h3>Forex News Summary</h3>
                <p>Date: \${data.date}</p>
              </div>
              <button class="fgwad-download-btn" id="fgwad-download-\${date}">Download</button>
            </div>
            <div class="fgwad-body">
              <p>\${intro}</p>
              <p>\${summary}</p>
              <p>\${detail}</p>
            </div>
            <div class="fgwad-footer">
              \${sourceLink}
            </div>
          \`;
          
          document.getElementById(\`fgwad-download-\${date}\`).addEventListener('click', () => {
            const content = [
              \`Forex News Summary for \${data.date}\n\`,
              \`Source: https://forex.grisma.com.np/archive/\${data.date}\n\n\`,
              intro, \`\n\n\`, summary, \`\n\n\`, detail
            ].join('');
            const a = document.createElement('a');
            const file = new Blob([content], {type: 'text/plain'});
            a.href = URL.createObjectURL(file);
            a.download = \`forex-summary-\${data.date}.txt\`;
            a.click();
            URL.revokeObjectURL(a.href);
          });
          
        } else {
          throw new Error(data.error || 'Failed to load news');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div style="padding: 20px; text-align: center; font-size: 14px; color: #ef4444;">\${error.message}</div>\`;
      });
  })();
</script>
  `;

  const chartEmbedCode = `
<iframe
  src="https://forex.grisma.com.np/charts?currency=USD&from=2024-01-01&to=2024-07-01&embed=true"
  width="100%"
  height="450"
  style="border: 1px solid #ccc; border-radius: 8px; min-width: 300px;"
  frameborder="0"
  loading="lazy"
  title="Forex Historical Chart"
></iframe>
<p style="font-family: sans-serif; font-size: 11px; text-align: center; color: #64748b; margin-top: 8px;">
  Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none;">Forex by Grisma</a>, A NRB Realtime API Based Platform
</p>
  `;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Helmet>
        <title>API Documentation - Forex Nepal</title>
        <meta name="description" content="Embeddable widgets and API documentation for Forex Nepal by Grisma." />
      </Helmet>

      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">API Documentation</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Embed live Nepal Forex Rates on your website with our easy-to-use widgets and APIs.
          All embeds are client-side and update automatically.
        </p>
      </div>

      <Accordion type="multiple" collapsible className="w-full">
        
        {/* === Live Rates Image/Widget API === */}
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-xl font-semibold">
            Live Rates Widget API
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-none shadow-none">
              <CardHeader className="pb-4">
                <CardTitle>Embeddable Rates Widget</CardTitle>
                <CardDescription>
                  This is the most important API. It provides the data for our embeddable widgets.
                  The endpoint returns JSON data for the latest rates, including trend information.
                  <br />
                  <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/image/latest-rates</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="table-view">
                  <TabsList>
                    <TabsTrigger value="table-view">Table View Embed</TabsTrigger>
                    <TabsTrigger value="grid-view">Grid View Embed</TabsTrigger>
                    <TabsTrigger value="json">JSON Response</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="table-view">
                    <p className="text-sm text-muted-foreground mt-2">
                      A compact table view, ideal for sidebars or smaller content areas.
                    </p>
                    <CodeBlock code={imageTableEmbedCode} />
                    <ApiEmbedPreview htmlContent={imageTableEmbedCode} />
                  </TabsContent>
                  
                  <TabsContent value="grid-view">
                    <p className="text-sm text-muted-foreground mt-2">
                      A responsive grid view that fills the container width.
                    </p>
                    <CodeBlock code={imageGridEmbedCode} />
                    <ApiEmbedPreview htmlContent={imageGridEmbedCode} />
                  </TabsContent>

                  <TabsContent value="json">
                    <CodeBlock code={`
{
  "success": true,
  "date": "2024-07-21",
  "published_on": "2024-07-21 10:00:00",
  "rates": [
    {
      "iso3": "USD",
      "name": "U.S. Dollar",
      "unit": 1,
      "buy": 134.05,
      "sell": 134.65,
      "buyTrend": { "diff": 0.01, "trend": "increase" },
      "sellTrend": { "diff": 0.01, "trend": "increase" }
    },
    {
      "iso3": "EUR",
      "name": "European Euro",
      "unit": 1,
      "buy": 145.50,
      "sell": 146.15,
      "buyTrend": { "diff": -0.25, "trend": "decrease" },
      "sellTrend": { "diff": -0.25, "trend": "decrease" }
    }
    // ... more currencies
  ]
}
                    `} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
        
        {/* === Archive Detail (News) API === */}
        <AccordionItem value="item-2">
          <AccordionTrigger className="text-xl font-semibold">
            Archive Detail (News) API
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-none shadow-none">
              <CardHeader className="pb-4">
                <CardTitle>Archive Detail Embed</CardTitle>
                <CardDescription>
                  Embeds the auto-generated "news" paragraphs for a specific date.
                  Includes a download button.
                  <br />
                  <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/archive/detail/:date</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="embed">
                  <TabsList>
                    <TabsTrigger value="embed">Embed Code</TabsTrigger>
                    <TabsTrigger value="json">JSON Response</TabsTrigger>
                  </TabsList>

                  <TabsContent value="embed">
                    <p className="text-sm text-muted-foreground mt-2">
                      Copy this code to embed the news summary. You can change the date in the
                      <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">data-date="YYYY-MM-DD"</code> attribute.
                    </p>
                    <CodeBlock code={archiveDetailEmbedCode} />
                    <ApiEmbedPreview htmlContent={archiveDetailEmbedCode} />
                  </TabsContent>

                  <TabsContent value="json">
                    <CodeBlock code={`
// GET /api/archive/detail/2024-07-20
{
  "success": true,
  "date": "2024-07-20",
  "paragraphs": {
    "intro": "Nepal Rastra Bank (NRB) published the official foreign exchange rates for 2024-07-20. The U.S. Dollar settled at a buying rate of Rs. 134.05 and a selling rate of Rs. 134.65.",
    "summary": "Today's market saw mixed movements. The European Euro was the top gainer, while the Japanese Yen saw the most significant decline. In total, 8 currencies gained value against the NPR, while 6 lost ground.",
    "detail": "The Indian Rupee (INR) remained fixed at Rs. 160.00 (Buy) and Rs. 160.15 (Sell) per 100 units. Other major currencies like the European Euro and UK Pound Sterling also saw adjustments in line with global market trends."
  }
}
                    `} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* === Historical Chart API === */}
        <AccordionItem value="item-3">
          <AccordionTrigger className="text-xl font-semibold">
            Historical Chart API
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-none shadow-none">
              <CardHeader className="pb-4">
                <CardTitle>Historical Chart Embed</CardTitle>
                <CardDescription>
                  Embed the full historical chart page using an <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">&lt;iframe&gt;</code>.
                  You can customize the currency and date range in the <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">src</code> URL.
                  <br />
                  <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/historical-rates</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="embed">
                  <TabsList>
                    <TabsTrigger value="embed">Embed Code</TabsTrigger>
                    <TabsTrigger value="json">JSON Response</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="embed">
                    <CodeBlock code={chartEmbedCode} />
                    <ApiEmbedPreview htmlContent={chartEmbedCode} />
                  </TabsContent>

                  <TabsContent value="json">
                     <CodeBlock code={`
// GET /api/historical-rates?currency=USD&from=2024-07-01&to=2024-07-05
{
  "success": true,
  "data": [
    { "date": "2024-07-01", "buy": 133.50, "sell": 134.10 },
    { "date": "2024-07-02", "buy": 133.52, "sell": 134.12 },
    { "date": "2024-07-03", "buy": 133.50, "sell": 134.10 },
    { "date": "2024-07-04", "buy": 133.80, "sell": 134.40 },
    { "date": "2024-07-05", "buy": 134.05, "sell": 134.65 }
  ],
  "currency": "USD"
}
                    `} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* === Archive List API === */}
        <AccordionItem value="item-4">
          <AccordionTrigger className="text-xl font-semibold">
            Archive List API
          </AccordionTrigger>
          <AccordionContent>
            <Card className="border-none shadow-none">
              <CardHeader className="pb-4">
                <CardTitle>Archive List Embed</CardTitle>
                <CardDescription>
                  Embeds a list of recent archive dates, linking to your site's archive pages.
                  <br />
                  <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/archive/list</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="embed">
                  <TabsList>
                    <TabsTrigger value="embed">Embed Code</TabsTrigger>
                    <TabsTrigger value="json">JSON Response</TabsTrigger>
                  </TabsList>

                  <TabsContent value="embed">
                    <CodeBlock code={archiveListEmbedCode} />
                    <ApiEmbedPreview htmlContent={archiveListEmbedCode} />
                  </TabsContent>

                  <TabsContent value="json">
                    <CodeBlock code={`
// GET /api/archive/list?page=1&limit=3
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 3,
    "total": 1200,
    "totalPages": 400
  },
  "dates": [
    "2024-07-21",
    "2024-07-20",
    "2024-07-19"
  ]
}
                    `} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* === Other JSON APIs === */}
        <AccordionItem value="item-5">
          <AccordionTrigger className="text-xl font-semibold">
            Other JSON-Only APIs
          </AccordionTrigger>
          <AccordionContent>
             <Card className="border-none shadow-none">
              <CardHeader className="pb-4">
                <CardTitle>Raw JSON Endpoints</CardTitle>
                <CardDescription>
                  These are the basic endpoints for fetching raw data. They do not have embeddable UIs,
                  but are useful for developers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold">Latest Rates (Raw)</h4>
                  <p className="text-sm text-muted-foreground">
                    Gets the latest rates as a raw JSON object.
                  </p>
                  <CodeBlock code={`
// GET /api/latest-rates
{
  "date": "2024-07-21",
  "published_on": "2024-07-21 10:00:00",
  "modified_on": "2024-07-21 10:00:00",
  "rates": [
    {
      "currency": { "name": "U.S. Dollar", "unit": 1, "iso3": "USD" },
      "buy": 134.05,
      "sell": 134.65
    },
    // ... more currencies
  ]
}
                  `} />
                </div>
                <div>
                  <h4 className="font-semibold">Rates by Date (Raw)</h4>
                  <p className="text-sm text-muted-foreground">
                    Gets rates for a specific date.
                  </p>
                  <CodeBlock code={`
// GET /api/rates/date/2024-07-20
{
  "date": "2024-07-20",
  "published_on": "2024-07-20 10:00:00",
  "rates": [
    // ...
  ]
}
                  `} />
                </div>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
};

export default ApiDocs;
