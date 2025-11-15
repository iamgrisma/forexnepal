import Layout from '@/components/Layout';
import { AlertTriangle, Database, Shield, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Disclosure = () => {
  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-2">Data Disclosure</h1>
            <p className="text-muted-foreground">Important information about our data sources and limitations</p>
          </div>

          <div className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription>
                This application displays forex data for informational purposes only. Please verify rates 
                with official sources before making financial decisions.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    <strong>All forex exchange rate data displayed on this website is sourced directly from:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>
                      <strong>Nepal Rastra Bank (NRB)</strong> - The official central bank of Nepal
                    </li>
                    <li>
                      Data is fetched in real-time from official NRB public APIs
                    </li>
                    <li>
                      Historical data is also retrieved from NRB APIs in real-time
                    </li>
                    <li>
                      No manual intervention or data manipulation occurs on our end
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Liability Disclaimer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    <strong>This application and its owner/developer are NOT liable for:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Any incorrect or outdated forex data displayed</li>
                    <li>Any financial decisions made based on the data provided</li>
                    <li>Any losses incurred due to reliance on the displayed rates</li>
                    <li>Temporary unavailability of data due to API issues</li>
                    <li>Any discrepancies between displayed rates and official NRB rates</li>
                  </ul>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                    <h3 className="font-semibold text-yellow-800 mb-2">Important:</h3>
                    <p className="text-yellow-700 text-sm">
                      This application is NOT affiliated with, endorsed by, or officially connected to 
                      Nepal Rastra Bank. We are an independent service that displays publicly available 
                      NRB data for convenience.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Official Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  For the most accurate and up-to-date forex rates, please always refer to the official 
                  Nepal Rastra Bank website:
                </p>
                <a 
                  href="https://www.nrb.org.np" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  www.nrb.org.np
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            <div className="text-center pt-8 border-t">
              <p className="text-muted-foreground text-sm">
                Last updated: {new Date().toLocaleDateString()}
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Questions about this disclosure? Contact us at{' '}
                <a href="mailto:forexhelp@grisma.com.np" className="text-primary hover:underline">
                  forexhelp@grisma.com.np
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Disclosure;