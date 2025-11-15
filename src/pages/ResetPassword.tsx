// src/pages/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Loader2, KeyRound, LogIn } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';

const passwordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // --- UPDATED: Token state ---
  const [token, setToken] = useState(() => searchParams.get('token') || '');
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false); // --- NEW: Separate loading state for login

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: '' },
  });

  // --- NEW: Effect to update token from URL ---
  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const onPasswordResetSubmit = async (data: PasswordFormValues) => {
    setLoading(true);
    if (!token) {
      toast({ title: "Error", description: "No token provided.", variant: "destructive" });
      setLoading(false);
      return;
    }
    
    try {
      await apiClient.post('/admin/reset-password', {
        token: token,
        newPassword: data.newPassword,
      });
      toast({ title: "Success", description: "Password has been reset. Please log in." });
      navigate('/admin/login', { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reset password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Handler for direct one-time login ---
  const handleOneTimeLogin = async () => {
    setLoginLoading(true);
    if (!token) {
      toast({ title: "Error", description: "No token provided.", variant: "destructive" });
      setLoginLoading(false);
      return;
    }

    try {
      const data = await apiClient.post<{ 
        success: boolean; 
        token: string; 
        username: string; 
        error?: string;
      }>('/admin/login-with-token', { token }); // <-- NEW ENDPOINT

      if (data.success) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });
        navigate('/admin/dashboard', { replace: true });
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message || "Invalid or expired token.", variant: "destructive" });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader>
              <KeyRound className="h-10 w-10 text-primary mx-auto" />
              <CardTitle className="text-center">Account Access</CardTitle>
              <CardDescription className="text-center">
                Enter your access token if not in the URL, then choose an option.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* --- NEW: Token Input Field --- */}
              <div>
                <Label htmlFor="token" className="text-sm font-medium">Access Token / Code</Label>
                <Input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Enter code from email"
                  className="mt-1"
                  disabled={loading || loginLoading}
                />
              </div>

              <Separator />

              {/* --- Option 1: Reset Password --- */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onPasswordResetSubmit)} className="space-y-4">
                  <CardDescription className="text-center text-base font-semibold">
                    Option 1: Set a New Password
                  </CardDescription>
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter new password"
                            {...field}
                            disabled={loading || loginLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading || loginLoading || !token}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                    Set New Password
                  </Button>
                </form>
              </Form>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-card px-2 text-sm text-muted-foreground">OR</span>
              </div>

              {/* --- Option 2: One-Time Login --- */}
              <div className="space-y-2">
                <CardDescription className="text-center text-base font-semibold">
                  Option 2: Login Directly (One-Time)
                </CardDescription>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleOneTimeLogin}
                  disabled={loading || loginLoading || !token}
                >
                  {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Login Without Resetting Password
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
