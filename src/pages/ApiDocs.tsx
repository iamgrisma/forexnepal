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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// --- Code Snippets ---

const tableSnippet = `
// This is a basic HTML/JavaScript example.
// You can paste this into any .html file and run it.

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
</style>

<script>
  async function fetchForexData() {
    const container = document.getElementById('forex-table-container');
    container.innerHTML = '<p>Loading forex data...</p>';

    try {
      // 1. Fetch data from the API
      const response = await fetch('https://forex.grisma.com.np/api/latest-rates');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();

      if (!data.rates || data.rates.length === 0) {
        container.innerHTML = '<p>No rates available.</p>';
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
      container.innerHTML = '<p style="color: red;">Failed to load data.</p>';
    }
  }

  // Load the data when the script runs
  fetchForexData();
</script>
`;

const gridSnippet = `
// This is a basic HTML/JavaScript example.
// You can paste this into any .html file and run it.

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
</style>

<script>
  async function fetchForexData() {
    const container = document.getElementById('forex-grid-container');
    container.innerHTML = '<p>Loading forex data...</p>';

    try {
      // 1. Fetch data from the API
      const response = await fetch('https://forex.grisma.com.np/api/latest-rates');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();

      if (!data.rates || data.rates.length === 0) {
        container.innerHTML = '<p>No rates available.</p>';
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
      container.innerHTML = '<p style="color: red;">Failed to load data.</p>';
    }
  }

  // Load the data when the script runs
  fetchForexData();
</script>
`;

const ApiDocs = () => {
  const [snippet, setSnippet] = useState(tableSnippet);
  const [design, setDesign] = useState('table');

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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">API Documentation</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access live and historical forex data directly via our simple JSON API.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            
            {/* API 1: Live Forex Rates */}
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Live Forex Rates (JSON)</span>
                  <Badge variant="default">Live</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4">
                  Provides the latest available daily foreign exchange rates published by Nepal Rastra Bank.
                </p>
                <Card className="mb-6">
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4">https://forex.grisma.com.np/api/latest-rates</span>
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
                      <pre className="bg-gray-900 text-white p-4 rounded-md overflow-x-auto text-sm">
                        <code>
                          {snippet}
                        </code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* API 2: Historical Rates */}
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Historical Rates (JSON)</span>
                  <Badge variant="outline">Upcoming</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4">
                  Returns forex rates for a specific past date.
                </p>
                <Card>
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4">/api/historical?date=YYYY-MM-DD</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* API 3: Currency List */}
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Currency List (JSON)</span>
                  <Badge variant="outline">Upcoming</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4">
                  Returns a list of all supported currencies, their ISO codes, and full names.
                </p>
                <Card>
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4">/api/currencies</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>

            {/* API 4: Image API */}
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">
                <div className="flex items-center gap-4">
                  <span>Live Rates Image (PNG)</span>
                  <Badge variant="destructive">Advanced / Upcoming</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <p className="mb-4">
                  Generates and returns a PNG image of the latest forex rates, styled similar to the homepage download.
                  This is a server-side task and is in development.
                </p>
                <Card>
                  <CardContent className="pt-4">
                    <div className="font-mono text-sm">
                      <span className="text-green-600 font-semibold">GET</span>
                      <span className="ml-4">/api/image/latest-rates.png</span>
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
