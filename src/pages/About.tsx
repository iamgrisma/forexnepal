import Layout from '@/components/Layout';
import { User, Mail, ExternalLink, TrendingUp, Calculator, BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const About = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <User className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-2">About Forex NPR</h1>
          <p className="text-muted-foreground">Your trusted source for Nepal Rastra Bank forex rates</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                About This Application
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Forex NPR is a comprehensive web application that provides real-time foreign exchange rates 
                as published by Nepal Rastra Bank (NRB), the central bank of Nepal. Our platform offers 
                an intuitive and user-friendly interface to track currency fluctuations and convert between 
                different currencies.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                All forex data is sourced directly from official NRB APIs, ensuring accuracy and reliability 
                for personal use, business decisions, and financial planning.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <RefreshCw className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Real-time Forex Rates</h3>
                    <p className="text-muted-foreground text-sm">
                      Live exchange rates updated directly from Nepal Rastra Bank APIs
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calculator className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Currency Converter</h3>
                    <p className="text-muted-foreground text-sm">
                      Convert between NPR and foreign currencies, or between any two foreign currencies
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Historical Data Tracking</h3>
                    <p className="text-muted-foreground text-sm">
                      Compare current rates with previous day's rates to track market trends
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold">Categorized View</h3>
                    <p className="text-muted-foreground text-sm">
                      Browse currencies by regions: Popular, Asian, European, Middle East, and Others
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Developer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Developed by:</h3>
                  <a 
                    href="https://grisma.com.np" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    Grisma Blog
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Contact & Support:</h3>
                  <a 
                    href="mailto:forexhelp@grisma.com.np"
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    <Mail className="h-4 w-4" />
                    forexhelp@grisma.com.np
                  </a>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">
                    For general inquiries, visit our{' '}
                    <a 
                      href="https://grisma.com.np/contact" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      contact page
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center pt-8 border-t">
            <p className="text-muted-foreground text-sm">
              Built with modern web technologies including React, TypeScript, and Tailwind CSS
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              © {new Date().getFullYear()} Grisma Blog. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default About;