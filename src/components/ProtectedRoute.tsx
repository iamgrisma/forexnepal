import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Layout from './Layout';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Basic check: Does the token exist?
    // In a real app, you might want to verify the token with the backend.
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    // Show loading state while checking auth
    return (
      <Layout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    // If not authenticated, redirect to login
    return <Navigate to="/admin/login" replace />;
  }

  // If authenticated, render the child route (the dashboard)
  return <Outlet />;
};

export default ProtectedRoute;
