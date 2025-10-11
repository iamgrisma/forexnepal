import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-9xl font-bold text-gray-200 mb-4">404</h1>
          <h2 className="text-3xl font-semibold text-gray-900 mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-500 flex items-center gap-2">
              It might be my mistake, try clicking the menu item again
              <ArrowUp className="h-4 w-4 animate-bounce" />
            </p>
            <Link to="/">
              <Button size="lg">
                Go to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
