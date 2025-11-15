// src/pages/ResetPassword.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Terminal, ShieldAlert, KeyRound, LogIn } from 'lucide-react'; // <-- Added LogIn
import { apiClient } from '@/services/apiClient';
import { Separator } from '@/components/ui/separator'; // <-- Added Separator
import { toast as sonnerToast } from "sonner";

type ResetStep = 'loading' | 'form' | 'success' | 'error';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState<ResetStep>('loading');
  const [loading, setLoading] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false); // <-- NEW: State for direct login button
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      setStep('form');
    } else {
      setStep('form'); // Allow user to paste token
    }
  }, [searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLoginLoading) return;

    if (!token) {
      toast({ title: "Error", description: "No reset token provided.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await apiClient.post('/admin/reset-password', {
        token,
        newPassword: password,
      });

      if (data.success) {
        setStep('success');
        sonnerToast.success("Password Reset Successful", {
          description: "You can now log in with your new password.",
          duration: 3000,
        });
        navigate('/admin/login');
      } else {
        throw new Error(data.error || 'Failed to reset password.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "An unknown error occurred.");
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Direct Login Handler ---
  const handleDirectLogin = async () => {
    if (loading || isLoginLoading) return;

    if (!token) {
      toast({ title: "Error", description: "No token provided.", variant: "destructive" });
      return;
    }

    setIsLoginLoading(true);
    setErrorMessage('');

    try {
      const data = await apiClient.post<{
        success: boolean;
        token: string;
        username: string;
        error?: string;
      }>('/admin/login-with-token', { token });

      if (data.success) {
        // Clear any lingering session storage
        sessionStorage.removeItem('loginStep');
        sessionStorage.removeItem('loginUsername');
        
        // Store new auth data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        
        sonnerToast.success("Login Successful", {
          description: `Welcome, ${data.username}!`,
          duration: 2000,
        });
        
        // Navigate to dashboard
        navigate('/admin/dashboard', { replace: true });
      } else {
        throw new Error(data.error || 'Failed to log in with token.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "An unknown error occurred.");
      setStep('error');
    } finally {
      setIsLoginLoading(false);
    }
  };
  // --- END: New Handler ---


  const renderContent = () => {
    if (step === 'error') {
      return (
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorMessage}
              <br />
              This may be because your token is invalid, expired, or has already been used.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/admin/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      );
    }

    if (step === 'success') {
      return (
        <CardContent className="space-y-4 text-center">
          <p>Your password has been reset successfully.</p>
          <Button className="w-full" asChild>
            <Link to="/admin/login">Go to Login</Link>
          </Button>
        </CardContent>
      );
    }

    // Default to 'form' or 'loading'
    return (
      <CardContent>
        <form onSubmit={handlePasswordReset} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block text-left" htmlFor="token">
              Reset Token
            </label>
            <Input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token from email"
              required
              disabled={loading || isLoginLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-left" htmlFor="password">
              New Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password (min 8 chars)"
              required
              disabled={loading || isLoginLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block text-left" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={loading || isLoginLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || isLoginLoading || !password || !confirmPassword || !token}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change Password
          </Button>

          {/* --- NEW: Direct Login Button --- */}
          <div className="relative pt-2">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-1 bg-card px-2 text-xs text-muted-foreground">OR</span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleDirectLogin}
            disabled={loading || isLoginLoading || !token}
          >
            {isLoginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Login Directly (Use Token)
          </Button>
          {/* --- END: New Button --- */}

        </form>
      </CardContent>
    );
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader className="text-center">
              <KeyRound className="h-10 w-10 text-primary mx-auto" />
              <CardTitle>Reset Your Password</CardTitle>
              <CardDescription>
                Enter your reset token and a new password.
              </CardDescription>
            </CardHeader>
            {renderContent()}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
