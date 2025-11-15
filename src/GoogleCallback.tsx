// src/pages/GoogleCallback.tsx
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/services/apiClient';
import Layout from '@/components/Layout';
import { Loader2 } from 'lucide-react';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        toast({
          title: 'Google Login Failed',
          description: `Error: ${error}`,
          variant: 'destructive',
        });
        navigate('/admin/login', { replace: true });
        return;
      }

      if (!code) {
        toast({
          title: 'Google Login Failed',
          description: 'Authorization code not found.',
          variant: 'destructive',
        });
        navigate('/admin/login', { replace: true });
        return;
      }

      try {
        // Exchange the code with your backend
        const data = await apiClient.post<{ 
          success: boolean; 
          token: string; 
          username: string;
          error?: string; 
        }>('/api/admin/auth/google/callback', { code });

        if (data.success) {
          // Save session and redirect to dashboard
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('username', data.username);
          toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });
          navigate('/admin/dashboard', { replace: true });
        } else {
          // Handle "user not found" or other errors
          toast({
            title: 'Login Failed',
            description: data.error || 'An unknown error occurred.',
            variant: 'destructive',
          });
          navigate('/admin/login', { replace: true });
        }
      } catch (err: any) {
        // Handle network or 500 errors
        toast({
          title: 'Login Failed',
          description: err.message || 'Failed to contact server.',
          variant: 'destructive',
        });
        navigate('/admin/login', { replace: true });
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  return (
    <Layout>
      <div className="flex justify-center items-center h-[50vh] flex-col space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Authenticating with Google...</p>
      </div>
    </Layout>
  );
};

export default GoogleCallback;
