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
import Layout from '@/components/Layout'; // <-- 1. FIX: IMPORTING LAYOUT

const CodeBlock: React.FC<{ code: string; title?: string }> = ({ code, title }) => (
  <div className="mt-4">
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

  // --- 2. FIX: NEW STYLING for all widgets ---
  const widgetStyles = `
    <style>
      .forex-grisma-widget {
        all: initial; /* Reset all inherited styles */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        box-sizing: border-box;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        overflow: hidden;
        max-width: 500px;
        min-width: 300px;
        background: #ffffff;
        color: #1f2937;
      }
      .forex-grisma-widget * {
        box-sizing: border-box;
      }
      .fgw-header {
        padding: 0.75rem 1rem;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }
      .fgw-header h3 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
        color: #111827;
      }
      .fgw-header p {
        font-size: 0.75rem;
        color: #6b7280;
        margin: 0.25rem 0 0;
      }
      .fgw-body {
        max-height: 350px;
        overflow-y: auto;
      }
      .fgw-body-padded {
        padding: 1rem;
      }
      .fgw-footer {
        padding: 0.75rem 1rem;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        font-size: 0.75rem;
        text-align: center;
        color: #6b7280;
      }
      .fgw-footer a {
        color: #2563eb;
        text-decoration: none;
      }
      .fgw-footer a:hover {
        text-decoration: underline;
      }
      .fgw-loader {
        padding: 2rem;
        text-align: center;
        font-size: 0.875rem;
        color: #6b7280;
      }
      .fgw-error {
        padding: 2rem;
        text-align: center;
        font-size: 0.875rem;
        color: #ef4444;
      }
    </style>
  `;

  const imageTableEmbedCode = `
<div id="forex-grisma-widget-table" class="forex-grisma-widget"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-table');
    if (!container) return;

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer">Forex by Grisma</a>, A NRB Realtime API Based Platform';

    const style = \`
      ${widgetStyles}
      <style>
        .fgwt-table {
          width: 100%;
          border-collapse: collapse;
        }
        .fgwt-table th, .fgwt-table td {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .fgwt-table th {
          font-weight: 500;
          color: #4b5563;
        }
        .fgwt-table td {
          color: #1f2937;
        }
        .fgwt-table tr:last-child td {
          border-bottom: none;
        }
        .fgwt-currency {
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .fgwt-flag {
          width: 20px;
          height: 15px;
          margin-right: 0.5rem;
          border: 1px solid #e5e7eb;
        }
        .fgwt-trend {
          font-size: 1.125rem;
          line-height: 1;
          margin-left: 0.25rem;
        }
        .fgwt-trend-increase { color: #10b981; }
        .fgwt-trend-decrease { color: #ef4444; }
        .fgwt-trend-stable { color: #9ca3af; font-size: 0.75rem; vertical-align: middle; }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    function renderWidget(data) {
      const getTrendIcon = (trend) => {
        if (trend.trend === 'increase') return \`<span class="fgwt-trend fgwt-trend-increase" title="Up by \${trend.diff.toFixed(2)}">&#9650;</span>\`;
        if (trend.trend === 'decrease') return \`<span class="fgwt-trend fgwt-trend-decrease" title="Down by \${trend.diff.toFixed(2)}">&#9660;</span>\`;
        return \`<span class="fgwt-trend fgwt-trend-stable" title="Stable">&#9679;</span>\`;
      };

      container.innerHTML = \`
        <div class="fgw-header">
          <h3>Nepal Forex Rates</h3>
          <p>As of \${data.date}</p>
        </div>
        <div class="fgw-body">
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
                  <td class="fgwt-currency">
                    <img src="https://flagsapi.com/\${rate.iso3.substring(0, 2)}/flat/32.png" class="fgwt-flag" alt="\${rate.iso3}">
                    \${rate.iso3} (\${rate.unit})
                  </td>
                  <td>\${rate.buy.toFixed(2)} \${getTrendIcon(rate.buyTrend)}</td>
                  <td>\${rate.sell.toFixed(2)} \${getTrendIcon(rate.sellTrend)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        </div>
        <div class="fgw-footer">
          \${sourceLink}
        </div>
      \`;
    }

    container.innerHTML = '<div class="fgw-loader">Loading...</div>';

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
        container.innerHTML = \`<div class="fgw-error">\${error.message}</div>\`;
      });
  })();
</script>
  `;
  
  const imageGridEmbedCode = `
<div id="forex-grisma-widget-grid" class="forex-grisma-widget"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-grid');
    if (!container) return;
    
    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer">Forex by Grisma</a>, A NRB Realtime API Based Platform';

    const style = \`
      ${widgetStyles}
      <style>
        .fgwg-body {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 1px;
          background: #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
        }
        .fgwg-card {
          background: #ffffff;
          padding: 0.75rem;
        }
        .fgwg-currency {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          display: flex;
          align-items: center;
        }
        .fgwg-flag {
          width: 20px;
          height: 15px;
          margin-right: 0.5rem;
          border: 1px solid #e5e7eb;
        }
        .fgwg-unit {
          font-size: 0.75rem;
          color: #6b7280;
          margin-left: 0.25rem;
        }
        .fgwg-rates {
          margin-top: 0.5rem;
          font-size: 0.875rem;
        }
        .fgwg-rate {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #374151;
        }
        .fgwg-label {
          color: #6b7280;
          font-size: 0.75rem;
        }
        .fgwg-value {
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        .fgwg-trend {
          font-size: 1rem;
          line-height: 1;
          margin-left: 0.25rem;
        }
        .fgwg-trend-increase { color: #10b981; }
        .fgwg-trend-decrease { color: #ef4444; }
        .fgwg-trend-stable { color: #9ca3af; font-size: 0.6rem; vertical-align: middle; }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    function renderWidget(data) {
      const getTrendIcon = (trend) => {
        if (trend.trend === 'increase') return \`<span class="fgwg-trend fgwg-trend-increase" title="Up by \${trend.diff.toFixed(2)}">&#9650;</span>\`;
        if (trend.trend === 'decrease') return \`<span class="fgwg-trend fgwg-trend-decrease" title="Down by \${trend.diff.toFixed(2)}">&#9660;</span>\`;
        return \`<span class="fgwg-trend fgwg-trend-stable" title="Stable">&#9679;</span>\`;
      };

      container.innerHTML = \`
        <div class="fgw-header">
          <h3>Nepal Forex Rates</h3>
          <p>As of \${data.date}</p>
        </div>
        <div class="fgw-body">
          \${data.rates.map(rate => \`
            <div class="fgwg-card">
              <div>
                <span class="fgwg-currency">
                  <img src="https://flagsapi.com/\${rate.iso3.substring(0, 2)}/flat/32.png" class="fgwg-flag" alt="\${rate.iso3}">
                  \${rate.iso3}
                </span>
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
        <div class="fgw-footer">
          \${sourceLink}
        </div>
      \`;
    }

    container.innerHTML = '<div class="fgw-loader">Loading...</div>';

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
        container.innerHTML = \`<div class="fgw-error">\${error.message}</div>\`;
      });
  })();
</script>
  `;
  
  const archiveListEmbedCode = `
<div id="forex-grisma-widget-archive-list" class="forex-grisma-widget"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-archive-list');
    if (!container) return;

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer">Forex by Grisma</a>, A NRB Realtime API Based Platform';
    
    const style = \`
      ${widgetStyles}
      <style>
        .fgwal-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .fgwal-list-item a {
          display: block;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          color: #1f2937;
          text-decoration: none;
          border-bottom: 1px solid #f3f4f6;
        }
        .fgwal-list-item:last-child a {
          border-bottom: none;
        }
        .fgwal-list-item a:hover {
          background: #f9fafb;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    container.innerHTML = '<div class="fgw-loader">Loading Archive...</div>';

    fetch('https://forex.grisma.com.np/api/archive/list?page=1&limit=20')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          container.innerHTML = \`
            <div class="fgw-header">
              <h3>Forex Archive</h3>
            </div>
            <div class="fgw-body">
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
            <div class="fgw-footer">
              \${sourceLink}
            </div>
          \`;
        } else {
          throw new Error(data.error || 'Failed to load archive');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div class="fgw-error">\${error.message}</div>\`;
      });
  })();
</script>
  `;

  const archiveDetailEmbedCode = `
<div id="forex-grisma-widget-archive-detail" class="forex-grisma-widget" data-date="2024-07-20"></div>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-archive-detail');
    if (!container) return;

    const getYesterday = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    };
    const date = container.dataset.date || getYesterday();
    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer">Forex by Grisma</a>, A NRB Realtime API Based Platform';
    
    const style = \`
      ${widgetStyles}
      <style>
        .fgwad-header {
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .fgwad-body {
          font-size: 0.875rem;
          line-height: 1.6;
          color: #374151;
        }
        .fgwad-body p {
          margin: 0 0 1rem;
        }
        .fgwad-body p:last-child {
          margin-bottom: 0;
        }
        .fgwad-download-btn {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 0.25rem;
          cursor: pointer;
          color: #374151;
        }
        .fgwad-download-btn:hover {
          background: #f9fafb;
        }
      </style>
    \`;
    document.head.insertAdjacentHTML('beforeend', style);

    container.innerHTML = \`<div class="fgw-loader">Loading News for \${date}...</div>\`;

    fetch(\`https://forex.grisma.com.np/api/archive/detail/\${date}\`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const { intro, summary, detail } = data.paragraphs;
          container.innerHTML = \`
            <div class="fgw-header fgwad-header">
              <div>
                <h3>Forex News Summary</h3>
                <p>Date: \${data.date}</p>
              </div>
              <button class="fgwad-download-btn" id="fgwad-download-\${date}">Download</button>
            </div>
            <div class="fgw-body fgw-body-padded">
              <p>\${intro}</p>
              <p>\${summary}</p>
              <p>\${detail}</p>
            </div>
            <div class="fgw-footer">
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
          throw new Error(data.error || 'No data found for this date.');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div class="fgw-error">\${error.message}</div>\`;
      });
  })();
</script>
  `;

  // --- 3. FIX: NEW CHART EMBED CODE ---
  const chartEmbedCode = `
<div id="forex-grisma-widget-chart" class="forex-grisma-widget" 
     data-currency="USD" 
     data-from="2024-01-01"
     data-to=""> </div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script>
  (function() {
    const container = document.getElementById('forex-grisma-widget-chart');
    if (!container) return;

    // --- Configuration ---
    const getToday = () => new Date().toISOString().split('T')[0];
    const currency = container.dataset.currency || 'USD';
    const from = container.dataset.from || '2024-01-01';
    const to = container.dataset.to || getToday();
    // --- End Configuration ---

    const sourceLink = 'Source: <a href="https://forex.grisma.com.np" target="_blank" rel="noopener noreferrer">Forex by Grisma</a>, A NRB Realtime API Based Platform';
    const style = \`${widgetStyles}\`;
    document.head.insertAdjacentHTML('beforeend', style);

    function renderChart(data) {
      container.innerHTML = \`
        <div class="fgw-header">
          <h3>Historical Rates: \${data.currency}</h3>
          <p>\${from} to \${to}</p>
        </div>
        <div class="fgw-body fgw-body-padded">
          <canvas id="fgwc-canvas"></canvas>
        </div>
        <div class="fgw-footer">
          \${sourceLink}
        </div>
      \`;
      
      const ctx = document.getElementById('fgwc-canvas').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.data.map(d => d.date),
          datasets: [
            {
              label: 'Buy',
              data: data.data.map(d => d.buy),
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: false,
              tension: 0.1
            },
            {
              label: 'Sell',
              data: data.data.map(d => d.sell),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: false,
              tension: 0.1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'month'
              },
              adapters: {
                date: window.chartjsAdapterDateFns
              },
              title: {
                display: true,
                text: 'Date'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Rate (NPR)'
              }
            }
          }
        }
      });
    }

    container.innerHTML = '<div class="fgw-loader">Loading Chart Data...</div>';

    fetch(\`https://forex.grisma.com.np/api/historical-rates?currency=\${currency}&from=\${from}&to=\${to}\`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data.length > 0) {
          renderChart(data);
        } else {
          throw new Error(data.error || 'No chart data found for this range.');
        }
      })
      .catch(error => {
        container.innerHTML = \`<div class="fgw-error">\${error.message}</div>\`;
      });
  })();
</script>
  `;


  return (
    // --- 1. FIX: WRAP IN LAYOUT ---
    <Layout>
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

        <Accordion type="multiple" className="w-full" defaultValue={['item-1']}>
          
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
                    This is our primary API for widgets. It provides JSON data for the latest rates, 
                    including trend information. Use the embed codes below to display a 
                    professionally-styled table or grid on your site.
                    <br />
                    <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/image/latest-rates</code>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="table-view">
                    <TabsList>
                      <TabsTrigger value="table-view">Table View</TabsTrigger>
                      <TabsTrigger value="grid-view">Grid View</TabsTrigger>
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
    "intro": "Nepal Rastra Bank (NRB) published...",
    "summary": "Today's market saw mixed movements...",
    "detail": "The Indian Rupee (INR) remained fixed..."
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
                    Embeds a live-updating line chart for any currency and date range.
                    This widget requires Chart.js and the date-fns adapter.
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
                       <p className="text-sm text-muted-foreground mt-2">
                        Copy this code to embed the chart. You can change the attributes like
                        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">data-currency="USD"</code> to customize.
                      </p>
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
    // ... more dates
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

          {/* === 4. FIX: ADDED MISSING POSTS & OTHER APIS === */}
          <AccordionItem value="item-5">
            <AccordionTrigger className="text-xl font-semibold">
              Other JSON-Only APIs
            </AccordionTrigger>
            <AccordionContent>
               <Card className="border-none shadow-none">
                <CardHeader className="pb-4">
                  <CardTitle>Raw JSON Endpoints</CardTitle>
                  <CardDescription>
                    These are basic endpoints for developers. They do not have pre-built
                    embeddable UIs but provide the raw data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  <div>
                    <h4 className="font-semibold">List Posts API</h4>
                    <p className="text-sm text-muted-foreground">
                      Gets a list of all published posts.
                      <br />
                      <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/posts</code>
                    </p>
                    <CodeBlock code={`
// GET /api/posts
{
  "success": true,
  "posts": [
    {
      "id": 1,
      "title": "Understanding Forex",
      "slug": "understanding-forex",
      "excerpt": "A brief guide...",
      "featured_image_url": null,
      "author_name": "Grisma",
      "author_url": "https://grisma.com.np/about",
      "published_at": "2024-07-20T10:00:00Z"
    },
    // ... more posts
  ]
}
                    `} />
                  </div>

                  <div>
                    <h4 className="font-semibold">Single Post API</h4>
                    <p className="text-sm text-muted-foreground">
                      Gets the full content of a single post by its slug.
                      <br />
                      <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/posts/:slug</code>
                    </p>
                    <CodeBlock code={`
// GET /api/posts/understanding-forex
{
  "success": true,
  "post": {
    "id": 1,
    "title": "Understanding Forex",
    "slug": "understanding-forex",
    "excerpt": "A brief guide...",
    "content": "<p>Full HTML content...</p>",
    // ... all other post fields
  }
}
                    `} />
                  </div>

                  <div>
                    <h4 className="font-semibold">Latest Rates (Raw)</h4>
                    <p className="text-sm text-muted-foreground">
                      Gets the latest rates as a raw JSON object.
                      <br />
                      <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/latest-rates</code>
                    </p>
                    <CodeBlock code={`
// GET /api/latest-rates
{
  "date": "2024-07-21",
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
                      <br />
                      <strong>Endpoint:</strong> <code className="font-mono text-sm bg-muted px-1 py-0.5 rounded">/api/rates/date/:date</code>
                    </p>
                    <CodeBlock code={`
// GET /api/rates/date/2024-07-20
{
  "date": "2024-07-20",
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
    </Layout>
  );
};

export default ApiDocs;
