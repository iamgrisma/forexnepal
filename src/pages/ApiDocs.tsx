import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/Layout';
import CopyCodeButton from '@/components/CopyCodeButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Info, Zap } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const BASE_URL = window.location.origin;

interface EndpointDemoProps {
  method: 'GET' | 'POST';
  endpoint: string;
  description: string;
  example: string;
  response: string;
  params?: { name: string; type: string; description: string; required?: boolean }[];
}

const EndpointDemo = ({ method, endpoint, description, example, response, params }: EndpointDemoProps) => (
  <Card className="mb-6 overflow-hidden border-border/40 shadow-sm">
    <CardHeader className="bg-muted/30 pb-3">
      <div className="flex items-center gap-3 mb-2">
        <Badge variant={method === 'GET' ? 'default' : 'secondary'} className="font-mono">
          {method}
        </Badge>
        <code className="text-sm font-semibold text-foreground">{endpoint}</code>
      </div>
      <CardDescription className="text-muted-foreground">{description}</CardDescription>
    </CardHeader>
    <CardContent className="p-4 space-y-4">
      {params && params.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 text-foreground">Parameters</h4>
          <div className="space-y-1.5">
            {params.map((param, idx) => (
              <div key={idx} className="text-sm flex items-start gap-2">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{param.name}</code>
                <span className="text-muted-foreground">
                  ({param.type}) {param.required && <span className="text-destructive">*</span>}
                  {param.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div>
        <h4 className="text-sm font-semibold mb-2 text-foreground flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Example Request
        </h4>
        <div className="relative group">
          <pre className="bg-card border border-border rounded-md p-3 overflow-x-auto text-xs max-h-[400px] overflow-y-auto scrollbar-thin">
            <code className="text-foreground font-mono">{example}</code>
          </pre>
          <CopyCodeButton codeToCopy={example} />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2 text-foreground">Example Response</h4>
        <div className="relative group">
          <pre className="bg-muted/50 border border-border rounded-md p-3 overflow-x-auto text-xs max-h-[400px] overflow-y-auto scrollbar-thin">
            <code className="text-foreground font-mono">{response}</code>
          </pre>
          <CopyCodeButton codeToCopy={response} />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ApiDocs = () => {
  const [activeTab, setActiveTab] = useState('forex');

  const forexEndpoints: EndpointDemoProps[] = [
    {
      method: 'GET',
      endpoint: '/api/latest-rates',
      description: 'Get the latest forex exchange rates for all currencies.',
      example: `curl ${BASE_URL}/api/latest-rates`,
      response: JSON.stringify({
        date: '2025-01-15',
        published_on: '2025-01-15 17:45:00',
        modified_on: '2025-01-15 17:50:00',
        rates: [
          {
            currency: { iso3: 'USD', name: 'U.S. Dollar', unit: 1 },
            buy: '134.50',
            sell: '135.10'
          },
          {
            currency: { iso3: 'EUR', name: 'European Euro', unit: 1 },
            buy: '145.20',
            sell: '145.85'
          }
        ]
      }, null, 2)
    },
    {
      method: 'GET',
      endpoint: '/api/rates/date/:date',
      description: 'Get forex rates for a specific date (YYYY-MM-DD format).',
      params: [
        { name: 'date', type: 'string', description: 'Date in YYYY-MM-DD format', required: true }
      ],
      example: `curl ${BASE_URL}/api/rates/date/2025-01-15`,
      response: JSON.stringify({
        date: '2025-01-15',
        published_on: '2025-01-15 17:45:00',
        rates: [
          {
            currency: { iso3: 'USD', name: 'U.S. Dollar', unit: 1 },
            buy: '134.50',
            sell: '135.10'
          }
        ]
      }, null, 2)
    },
    {
      method: 'GET',
      endpoint: '/api/historical-rates',
      description: 'Get historical forex rates with optional date range filtering.',
      params: [
        { name: 'from', type: 'string', description: 'Start date (YYYY-MM-DD)', required: false },
        { name: 'to', type: 'string', description: 'End date (YYYY-MM-DD)', required: false },
        { name: 'limit', type: 'number', description: 'Max records to return (default: 100)', required: false }
      ],
      example: `curl "${BASE_URL}/api/historical-rates?from=2025-01-01&to=2025-01-15&limit=10"`,
      response: JSON.stringify({
        data: [
          {
            date: '2025-01-15',
            published_on: '2025-01-15 17:45:00',
            rates: [
              {
                currency: { iso3: 'USD', name: 'U.S. Dollar', unit: 1 },
                buy: '134.50',
                sell: '135.10'
              }
            ]
          }
        ],
        meta: {
          total: 10,
          from: '2025-01-01',
          to: '2025-01-15'
        }
      }, null, 2)
    },
    {
      method: 'GET',
      endpoint: '/api/archive/list',
      description: 'Get a list of all available forex data dates in the archive.',
      example: `curl ${BASE_URL}/api/archive/list`,
      response: JSON.stringify({
        dates: [
          { date: '2025-01-15', published_on: '2025-01-15 17:45:00' },
          { date: '2025-01-14', published_on: '2025-01-14 17:45:00' },
          { date: '2025-01-13', published_on: '2025-01-13 17:45:00' }
        ],
        total: 365
      }, null, 2)
    },
    {
      method: 'GET',
      endpoint: '/api/archive/detail/:date',
      description: 'Get detailed forex data for a specific archived date.',
      params: [
        { name: 'date', type: 'string', description: 'Date in YYYY-MM-DD format', required: true }
      ],
      example: `curl ${BASE_URL}/api/archive/detail/2025-01-15`,
      response: JSON.stringify({
        date: '2025-01-15',
        published_on: '2025-01-15 17:45:00',
        modified_on: '2025-01-15 17:50:00',
        rates: [
          {
            currency: { iso3: 'USD', name: 'U.S. Dollar', unit: 1 },
            buy: '134.50',
            sell: '135.10'
          }
        ]
      }, null, 2)
    }
  ];

  const imageEndpoint: EndpointDemoProps = {
    method: 'GET',
    endpoint: '/api/image/latest-rates',
    description: 'Get an HTML snippet that renders latest forex rates as a table/grid. Perfect for embedding. Renders on client browser.',
    example: `<!-- Embed as iframe -->
<iframe 
  src="${BASE_URL}/api/image/latest-rates" 
  width="100%" 
  height="800" 
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>

<!-- Or fetch and inject -->
<script>
  fetch('${BASE_URL}/api/image/latest-rates')
    .then(r => r.text())
    .then(html => {
      document.getElementById('forex-container').innerHTML = html;
    });
</script>
<div id="forex-container"></div>`,
    response: `<!-- Returns fully styled HTML table with client-side rendering -->`
  };

  return (
    <Layout>
      <Helmet>
        <title>API Documentation - Forex Nepal</title>
        <meta name="description" content="Complete API documentation for Forex Nepal. Access real-time and historical forex exchange rates." />
      </Helmet>

      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">API Documentation</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Access Nepal's official forex exchange rates programmatically with our free REST API.
          </p>
          
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Base URL:</strong> <code className="bg-muted px-2 py-0.5 rounded">{BASE_URL}</code>
              <br />
              All endpoints return JSON data. No authentication required.
            </AlertDescription>
          </Alert>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="forex">Forex Data</TabsTrigger>
            <TabsTrigger value="embed">Embed Widget</TabsTrigger>
            <TabsTrigger value="examples">Code Examples</TabsTrigger>
          </TabsList>

          <TabsContent value="forex" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Forex Exchange Rate Endpoints</CardTitle>
                <CardDescription>
                  Access current and historical forex rates published by Nepal Rastra Bank
                </CardDescription>
              </CardHeader>
              <CardContent>
                {forexEndpoints.map((endpoint, idx) => (
                  <EndpointDemo key={idx} {...endpoint} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Embeddable Forex Widget</CardTitle>
                <CardDescription>
                  Ready-to-use HTML that renders on client side
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EndpointDemo {...imageEndpoint} />
                
                <Alert className="mt-6">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Client-Side Rendering:</strong> This endpoint returns raw HTML that renders in your user's browser - no server-side image generation!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integration Examples</CardTitle>
                <CardDescription>
                  Code examples for popular programming languages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">JavaScript / Node.js</h3>
                  <div className="relative group">
                    <pre className="bg-card border rounded p-4 overflow-x-auto text-sm max-h-[400px] overflow-y-auto">
                      <code className="font-mono">{`// Fetch latest rates
async function getLatestRates() {
  const response = await fetch('${BASE_URL}/api/latest-rates');
  const data = await response.json();
  console.log('Rates for', data.date);
  return data;
}

// Get historical data
async function getHistoricalRates(from, to) {
  const url = \`${BASE_URL}/api/historical-rates?from=\${from}&to=\${to}\`;
  const response = await fetch(url);
  return await response.json();
}`}</code>
                    </pre>
                    <CopyCodeButton codeToCopy={`fetch('${BASE_URL}/api/latest-rates').then(r => r.json()).then(console.log)`} />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Python</h3>
                  <div className="relative group">
                    <pre className="bg-card border rounded p-4 overflow-x-auto text-sm max-h-[400px] overflow-y-auto">
                      <code className="font-mono">{`import requests

# Get latest rates
def get_latest_rates():
    response = requests.get('${BASE_URL}/api/latest-rates')
    data = response.json()
    print(f"Rates for {data['date']}")
    return data

# Get historical
def get_historical(from_date, to_date):
    url = f'${BASE_URL}/api/historical-rates?from={from_date}&to={to_date}'
    return requests.get(url).json()`}</code>
                    </pre>
                    <CopyCodeButton codeToCopy={`import requests\nrequests.get('${BASE_URL}/api/latest-rates').json()`} />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">PHP</h3>
                  <div className="relative group">
                    <pre className="bg-card border rounded p-4 overflow-x-auto text-sm max-h-[400px] overflow-y-auto">
                      <code className="font-mono">{`<?php
function getLatestRates() {
    $url = '${BASE_URL}/api/latest-rates';
    $response = file_get_contents($url);
    return json_decode($response, true);
}

function getHistorical($from, $to) {
    $url = "${BASE_URL}/api/historical-rates?from={$from}&to={$to}";
    return json_decode(file_get_contents($url), true);
}
?>`}</code>
                    </pre>
                    <CopyCodeButton codeToCopy={`<?php\n$data = json_decode(file_get_contents('${BASE_URL}/api/latest-rates'), true);\n?>`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Practices</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">⚡ Performance Tips</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Cache responses for at least 15 minutes</li>
                    <li>Use <code>/api/latest-rates</code> for real-time data</li>
                    <li>Batch historical requests when possible</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🔒 Usage Guidelines</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Attribution: Credit "Forex Nepal" when using data</li>
                    <li>No authentication required for public endpoints</li>
                    <li>Fair use policy - excessive requests may be rate limited</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Need Help?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-3">
                  Questions or need assistance?
                </p>
                <a href="/contact" className="text-primary hover:underline font-medium">
                  Contact support →
                </a>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default ApiDocs;
