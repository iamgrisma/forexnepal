// src/pages/AdminLogin.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, KeyRound, QrCode } from 'lucide-react';
import { apiClient } from '@/services/apiClient'; // Import the API client

// --- Simplified Login Steps ---
type LoginStep = 'login' | 'oneTimeCode' | 'error';

const AdminLogin = () => {
  const [step, setStep] = useState<LoginStep>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [oneTimeCode, setOneTimeCode] = useState(''); // State for the code
  const [loading, setLoading] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  
  const navigate = useNavigate();
  const { toast } = useToast(); // shadcn toast

  // 1. Get IP Address on Load
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip);
        setIpAddress(ip);
      } catch (e) {
        console.error("Failed to fetch IP address", e);
        setStep('error');
        setErrorMessage("Could not verify connection. Please refresh and try again.");
      }
    };
    fetchIp();
  }, []);

  // 2. Clear session storage on load (in case old steps are stuck)
  useEffect(() => {
    try {
      sessionStorage.removeItem('loginStep');
      sessionStorage.removeItem('loginUsername');
    } catch (e) {}
  }, []);

  // 3. Combined Username/Password Login Handler
  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || loading || !ipAddress) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // Call the 'login' endpoint directly with both username and password
      const data = await apiClient.post<{ 
        success: boolean; 
        token: string; 
        username: string; 
        mustChangePassword?: boolean;
        error?: string;
      }>('/admin/login', {
        username,
        password,
        ipAddress,
        sessionId: sessionIdRef.current,
      });

      if (data.success) {
        // Clear session storage on successful login
        sessionStorage.removeItem('loginStep');
        sessionStorage.removeItem('loginUsername');

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });

        if (data.mustChangePassword) {
          localStorage.setItem('forcePasswordChange', '1');
          navigate('/admin/change-password', { replace: true });
          return;
        }

        navigate('/admin/dashboard', { replace: true });
      } else {
        toast({ title: "Login Failed", description: data?.error || 'Invalid credentials', variant: "destructive" });
      }
    } catch (error: any) {
      console.error(error);
      // The backend rate-limiting will return a 429 error, which will be caught here
      if (error.message.includes('Too many failed')) {
        toast({ title: "Too many attempts", description: "You have been locked out. Please try again later.", variant: "destructive" });
      } else {
        toast({ title: "Login Error", description: error.message || "Invalid credentials.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. One-Time Code Login Handler (Unchanged)
  const handleOneTimeLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oneTimeCode || loading) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await apiClient.post<{ 
        success: boolean; 
        token: string; 
        username: string; 
        mustChangePassword?: boolean;
        error?: string;
      }>('/admin/login-one-time', {
        code: oneTimeCode,
      });

      if (data.success) {
        // Clear session storage on successful login
        sessionStorage.removeItem('loginStep');
        sessionStorage.removeItem('loginUsername');

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });
        
        // One-time code login skips password change
        navigate('/admin/dashboard', { replace: true });
      } else {
        toast({ title: "Login Failed", description: data?.error || 'Invalid code', variant: "destructive" });
      }
    } catch (error: any)
    {
      console.error(error);
      toast({ title: "Login Failed", description: error.message || "Invalid or expired code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  // --- RENDER LOGIC ---

  const renderStep = () => {
    switch (step) {
      // --- THIS IS THE NEW DEFAULT STEP ---
      case 'login':
        return (
          <CardContent>
            <form onSubmit={handlePasswordLoginSubmit} className="space-y-4">
              <CardHeader className="p-0 pb-4">
                <KeyRound className="h-10 w-10 text-primary mx-auto" />
                <CardTitle className="text-center">Admin Login</CardTitle>
                <CardDescription className="text-center">
                  Please enter your credentials.
                </CardDescription>
              </CardHeader>
              
              <div>
                <label className="text-sm font-medium mb-1 block text-left" htmlFor="username">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={loading}
                  autoCapitalize="none"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block text-left" htmlFor="password">Password</label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading || !username || !password}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login
              </Button>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate('/admin/forgot-password')}
                  className="text-sm px-0"
                >
                  Forgot Password?
                </Button>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setStep('oneTimeCode')}
                  className="text-sm px-0"
                >
                  Login with one-time code
                </Button>
              </div>
            </form>
          </CardContent>
        );

      case 'oneTimeCode':
        return (
          <CardContent>
            <form onSubmit={handleOneTimeLoginSubmit} className="space-y-4">
              <CardHeader className="p-0 pb-4">
                <QrCode className="h-10 w-10 text-primary mx-auto" />
                <CardTitle className="text-center">One-Time Login</CardTitle>
                <CardDescription className="text-center">
                  Enter the 8-digit code provided by your administrator.
                </CardDescription>
              </CardHeader>
              
              <div>
                <label className="text-sm font-medium mb-1 block text-left" htmlFor="oneTimeCode">One-Time Code</label>
                <Input
                  id="oneTimeCode"
                  type="text"
                  value={oneTimeCode}
                  onChange={(e) => setOneTimeCode(e.target.value.replace(/\D/g, ''))} // Only allow digits
                  placeholder="Enter 8-digit code"
                  required
                  disabled={loading}
                  autoComplete="one-time-code"
                  maxLength={8}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || oneTimeCode.length < 8}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login with Code
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => setStep('login')} // Go back to password login
                className="w-full text-sm"
              >
                Back to password login
              </Button>
            </form>
          </CardContent>
        );

      case 'error':
        return (
          <CardContent className="min-h-[300px] flex flex-col items-center justify-center">
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {errorMessage || 'An unknown error occurred. Please refresh.'}
              </AlerDescription>
            </Alert>
            <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        );
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            {renderStep()}
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AdminLogin;
