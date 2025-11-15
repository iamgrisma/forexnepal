import Layout from '@/components/Layout';
import { Shield, Eye, Server, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PrivacyPolicy = () => {
  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground">Your privacy matters to us</p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Data Collection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  This website does <strong>not collect any personal data</strong> from its users. We do not use cookies, 
                  tracking scripts, or any other methods to collect, store, or process personal information.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>All forex exchange rate data displayed on this website is sourced from:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Nepal Rastra Bank (NRB)</strong> - Official central bank of Nepal</li>
                    <li>Data is fetched in real-time from public APIs</li>
                    <li>No user data is required to access this information</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Third-Party Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>This website may use the following third-party services:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Google AdSense</strong> - For displaying relevant advertisements</li>
                    <li>These services may have their own privacy policies</li>
                    <li>We recommend reviewing their policies if you have concerns</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Full Privacy Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  For our complete privacy policy covering all Grisma Blog services, please visit:
                </p>
                <a 
                  href="https://grisma.com.np/privacy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  grisma.com.np/privacy
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>

            <div className="text-center pt-8 border-t">
              <p className="text-muted-foreground text-sm">
                Last updated: {new Date().toLocaleDateString()}
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                Questions? Contact us at{' '}
                <a href="https://grisma.com.np/contact" className="text-primary hover:underline">
                  grisma.com.np/contact
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;