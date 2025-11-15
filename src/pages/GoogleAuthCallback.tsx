// src/pages/GoogleAuthCallback.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/services/apiClient';

type Status = 'loading' | 'success' | 'error';

const GoogleAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setErrorMessage(`Google login failed: ${error}`);
        setStatus('error');
        return;
      }

      if (!code) {
        setErrorMessage('No authentication code provided. Returning to login.');
        setStatus('error');
        setTimeout(() => navigate('/admin/login'), 3000);
        return;
      }

      try {
        // Exchange the code for a JWT by calling our worker backend
        const data = await apiClient.post<{
          success: boolean;
          token: string;
          username: string;
          error?: string;
        }>('/admin/auth/google/callback', { code });

        if (data.success) {
          // Store token and navigate to dashboard
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('username', data.username);
          setStatus('success');
          navigate('/admin/dashboard', { replace: true });
        } else {
          throw new Error(data.error || 'Authentication failed. Please try again.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'An unknown error occurred.');
        setStatus('error');
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Authenticating...</CardTitle>
          <CardDescription className="text-center">
            Please wait while we securely log you in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center space-y-4 p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying with Google...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin/login">Return to Login</Link>
              </Button>
            </div>
          )}
          {status === 'success' && (
            <div className="flex flex-col items-center justify-center space-y-4 p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Success! Redirecting...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAuthCallback;
