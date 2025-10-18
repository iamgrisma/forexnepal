import Layout from '@/components/Layout';
import { Mail, Phone, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Contact = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
          <p className="text-xl text-gray-600">
            Get in touch with us for any inquiries or support
          </p>
        </div>

        <Card className="animate-scale-in">
          <CardHeader>
            <CardTitle className="text-2xl">Grisma Blog</CardTitle>
            <CardDescription>
              We're here to help with your foreign exchange rate queries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Email</h3>
                <a 
                  href="mailto:forexhelp@grisma.com.np" 
                  className="text-primary hover:underline"
                >
                  forexhelp@grisma.com.np
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Phone</h3>
                <a 
                  href="tel:9844245717" 
                  className="text-primary hover:underline"
                >
                  9844245717
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Website</h3>
                <a 
                  href="https://grisma.com.np" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  grisma.com.np
                </a>
              </div>
            </div>

            <div className="pt-6 border-t">
              <p className="text-gray-600 text-sm">
                For more information and updates, visit our main blog at{' '}
                <a 
                  href="https://grisma.com.np" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Grisma Blog
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Contact;
