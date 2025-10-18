import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Layout from './Layout';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Verify token with backend to ensure it's valid
    const verifyAuth = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        // Verify token by making a request to an admin endpoint
        const response = await fetch('/api/admin/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // Token is invalid or expired
          localStorage.removeItem('authToken');
          localStorage.removeItem('username');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        setIsAuthenticated(false);
      }
    };

    verifyAuth();
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
