import { useState } from 'react';
import Layout from '@/components/Layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Code } from 'lucide-react';

// --- Code Snippets ---

const tableSnippet = `
<div id="forex-table-container"></div>

<style>
  #forex-table-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 2rem;
  }
  .forex-table {
    width: 100%;
    border-collapse: collapse;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    border-radius: 8px;
    overflow: hidden;
  }
  .forex-table th, .forex-table td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #eee;
  }
  .forex-table th {
    background-color: #f9fafb;
    font-weight: 600;
    color: #374151;
  }
  .forex-table tbody tr:hover {
    background-color: #f5f5f5;
  }
  .forex-table td:nth-child(4) {
    color: #16a34a;
    font-weight: 500;
  }
  .forex-table td:nth-child(5) {
    color: #dc2626;
    font-weight: 500;
  }
  .loading-text {
    text-align: center;
    padding: 2rem;
    font-size: 1.2rem;
    color: #555;
  }
</style>

<script>
  async function fetchForexData() {
    const container = document.getElementById('forex-table-container');
    container.innerHTML = '<p class="loading-text">Loading forex data...</p>';

    try {
      // 1. Fetch data from the API
      const response = await fetch('https://forex.grisma.com.np/api/latest-rates');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();

      if (!data.rates || data.rates.length === 0) {
        container.innerHTML = '<p class="loading-text">No rates available.</p>';
        return;
      }

      // 2. Build the HTML table
      let tableHTML = \`
        <table class="forex-table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Unit</th>
              <th>Buy</th>
              <th>Sell</th>
            </tr>
          </thead>
          <tbody>
      \`;

      // 3. Loop through rates and create rows
      for (const rate of data.rates) {
        tableHTML += \`
          <tr>
            <td><strong>\${rate.currency.iso3}</strong> (\${rate.currency.name})</td>
            <td>\${rate.currency.unit}</td>
            <td>\${rate.buy.toFixed(2)}</td>
            <td>\${rate.sell.toFixed(2)}</td>
          </tr>
        \`;
      }

      tableHTML += \`
          </tbody>
        </table>
        <p style="text-align: right; font-size: 0.9rem; color: #6b7280; margin-top: 8px;">
          Data published on: \${new Date(data.date).toLocaleDateString()}
        </p>
      \`;

      // 4. Display the table
      container.innerHTML = tableHTML;

    } catch (error) {
      console.error('Fetch error:', error);
      container.innerHTML = '<p style="color: red; text-align: center;">Failed to load data.</p>';
    }
  }

  // Load the data when the script runs
  fetchForexData();
</script>
`;

const gridSnippet = `
<div id="forex-grid-container"></div>

<style>
  #forex-grid-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }
  .forex-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }
  .card-header {
    margin-bottom: 1rem;
  }
  .card-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
  .card-header p {
    font-size: 0.9rem;
    color: #6b7280;
    margin: 4px 0 0 0;
  }
  .card-rates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .rate-box {
    padding: 1rem;
    border-radius: 6px;
    text-align: center;
  }
  .rate-box-buy {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
  }
  .rate-box-sell {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
  }
  .rate-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  .rate-box-buy .rate-label { color: #166534; }
  .rate-box-sell .rate-label { color: #991b1b; }
  .rate-value {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 4px;
  }
  .rate-box-buy .rate-value { color: #15803d; }
  .rate-box-sell .rate-value { color: #b91c1c; }
  .loading-text {
    grid-column: 1 / -1;
    text-align: center;
    padding: 2rem;
    font-size: 1.2rem;
    color: #555;
  }
</style>

<script>
  async function fetchForexData() {
    const container = document.getElementById('forex-grid-container');
    container.innerHTML = '<p class="loading-text">Loading forex data...</p>';

    try {
      // 1. Fetch data from the API
      const response = await fetch('https://forex.grisma.com.np/api/latest-rates');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();

      if (!data.rates || data.rates.length === 0) {
        container.innerHTML = '<p class="loading-text">No rates available.</p>';
        return;
      }

      // 2. Clear loading message
      container.innerHTML = ''; 

      // 3. Loop through rates and create cards
      for (const rate of data.rates) {
        const card = document.createElement('div');
        card.className = 'forex-card';
        
        card.innerHTML = \`
          <div class="card-header">
            <h3>\${rate.currency.name}</h3>
            <p>\${rate.currency.iso3} / NPR (Unit: \${rate.currency.unit})</p>
          </div>
          <div class="card-rates">
            <div class="rate-box rate-box-buy">
              <div class="rate-label">Buy</div>
              <div class="rate-value">\${rate.buy.toFixed(2)}</div>
            </div>
            <div class="rate-box rate-box-sell">
              <div class="rate-label">Sell</div>
              <div class="rate-value">\${rate.sell.toFixed(2)}</div>
            </div>
          </div>
        \`;
        container.appendChild(card);
      }

    } catch (error) {
      console.error('Fetch error:', error);
      container.innerHTML = '<p style="color: red; text-align: center;">Failed to load data.</p>';
    }
  }

  // Load the data when the script runs
  fetchForexData();
</script>
`;

const ApiDocs = () => {
  const [snippet, setSnippet] = useState(tableSnippet);
  const [design, setDesign] = useState('table');
  const [activeAccordion, setActiveAccordion] = useState('item-1');

  const handleDesignChange = (value: string) => {
    setDesign(value);
    if (value === 'table') {
      setSnippet(tableSnippet);
    } else if (value === 'grid') {
      setSnippet(gridSnippet);
    }
  };

  return (
    <Layout>
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Code className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">API Documentation</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access live and historical forex data directly via our simple JSON API.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full" value={activeAccordion} onValueChange={setActiveAccordion}>
            
            {/* API 1: Live Forex Rates */}
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Live Forex Rates (JSON)</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  Provides the latest available daily foreign exchange rates published by Nepal Rastra Bank.
                  This endpoint automatically falls back to yesterday's data if today's rates are not yet published.
                </p>
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4 text-primary font-medium">https://forex.grisma.com.np/api/latest-rates</span>
                    </div>
                  </CardContent>
                </Card>

                <h4 className="font-semibold text-md mb-4">Frontend Code Examples</h4>
                <p className="text-sm text-gray-700 mb-4">
                  Here are full, copy-pasteable HTML/JS code snippets to consume this API and display the data.
                  Select a design from the dropdown to see the code.
                </p>

                <div className="mb-4">
                  <Select value={design} onValueChange={handleDesignChange}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select a design snippet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table Design</SelectItem>
                      <SelectItem value="grid">Grid Card Design</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full">
                  <Tabs defaultValue="html-js">
                    <TabsList>
                      <TabsTrigger value="html-js">HTML + JavaScript</TabsTrigger>
                      <TabsTrigger value="react" disabled>React / Next.js (Soon)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="html-js">
                      <pre className="bg-gray-900 text-white p-4 rounded-md overflow-x-auto text-sm max-h-[500px]">
                        <code>
                          {snippet}
                        </code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            {/* API 2: Rates by Date */}
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Rates by Date (JSON)</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  Returns forex rates for a specific past date.
                </p>
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4 text-primary font-medium">https://forex.grisma.com.np/api/rates/date/YYYY-MM-DD</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
            
            {/* API 3: Historical Rates */}
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Historical Range (JSON)</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  Returns historical data for a *single currency* over a date range.
                </p>
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4 text-primary font-medium">/api/historical-rates?currency=USD&from=YYYY-MM-DD&to=YYYY-MM-DD</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
            
            {/* API 4: Public Posts */}
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Public Posts (JSON)</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  Returns a list of all published blog posts.
                </p>
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4 text-primary font-medium">https://forex.grisma.com.np/api/posts</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* API 5: Static Images */}
            <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Static Image Links</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  These are not dynamic APIs, but direct links to static image assets used in the site.
                </p>
                <Card>
                  <CardContent className="pt-4 space-y-2 font-mono text-sm">
                    <div><a href="/og-image.png" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">/og-image.png</a></div>
                    <div><a href="/forexnepal-screenshot.jpg" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">/forexnepal-screenshot.jpg</a></div>
                    <div><a href="/icon-512.png" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">/icon-512.png</a></div>
                    <div><a href="/pwa-icon-512.png" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">/pwa-icon-512.png</a></div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* API 6: Image API */}
            <AccordionItem value="item-6">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Live Rates Image (PNG)</span>
                  <Badge variant="outline">Upcoming</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4 text-muted-foreground">
                  A future API that will dynamically generate and return a PNG image of the latest forex rates,
                  styled similar to the homepage download.
                </p>
                <Card>
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4 text-muted-foreground">/api/image/latest-rates.png</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </Layout>
  );
};

export default ApiDocs;
