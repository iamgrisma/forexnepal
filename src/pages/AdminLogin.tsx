import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Terminal, ShieldAlert, ShieldCheck, KeyRound } from 'lucide-react';
import { apiClient } from '@/services/apiClient'; // Import the API client
import { toast as sonnerToast } from "sonner"; // Import sonner

// Define the steps for the multi-stage login
type LoginStep = 'redirecting' | 'username' | 'password' | 'blocked' | 'error';

const AdminLogin = () => {
  const [step, setStep] = useState<LoginStep>('redirecting');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5); // Visual countdown
  const [ipAddress, setIpAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const redirectTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast(); // shadcn toast
  const REDIRECT_URL = 'https://grisma.com.np';
  const REDIRECT_TIME_MS = 7000; // 7 seconds total
  const COUNTDOWN_INTERVAL_MS = REDIRECT_TIME_MS / 6; // ~1166ms per number

  // --- 1. Get IP Address on Load ---
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

  // --- 2. Start Timers on 'redirecting' step ---
  useEffect(() => {
    if (step === 'redirecting') {
      // Start the main 7-second redirect timer
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.href = REDIRECT_URL;
      }, REDIRECT_TIME_MS);

      // Start the visual 5-second countdown timer
      setCountdown(5);
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((c) => {
          if (c <= 0) {
            clearInterval(countdownIntervalRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, COUNTDOWN_INTERVAL_MS);
    }
    
    // Cleanup timers on unmount or step change
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [step]); // Only run when step changes to 'redirecting'

  // --- 3. Click Handler to Stop Redirect ---
  const handleCircleClick = () => {
    if (step !== 'redirecting') return;
    
    // Stop both timers
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Move to next step
    setStep('username');
    sonnerToast.success("Redirect cancelled. Please authenticate.", { duration: 2000 });
  };

  // --- 4. Username Submit Handler ---
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || loading || !ipAddress) return;
    
    setLoading(true);
    setErrorMessage('');

    try {
      // Call the new 'check-user' endpoint
      await apiClient.post('/admin/check-user', {
        username,
        ipAddress,
        sessionId: sessionIdRef.current,
      });

      // If successful (user exists), move to password step
      setStep('password');
    } catch (error: any) {
      console.error('Username check failed:', error.message);
      // Handle custom error responses from the worker
      if (error.message.includes('Bro, get out')) {
        setStep('blocked');
        setErrorMessage(error.message);
      } else if (error.message.includes('Redirect')) {
        // Worker randomly chose to redirect
        window.location.href = REDIRECT_URL;
      } else if (error.message.includes('User not found')) {
        toast({ title: "Error", description: "Invalid username.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  // --- 5. Final Login (Password) Submit Handler ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading || !ipAddress) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // Call the original 'login' endpoint
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
        // This case should be rare if check-user passed, but handles password failure
        toast({ title: "Login Failed", description: data?.error || 'Invalid credentials', variant: "destructive" });
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: "Server Error", description: error.message || "Unable to login.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER LOGIC ---

  const renderStep = () => {
    switch (step) {
      case 'redirecting':
        return (
          <CardContent className="flex flex-col items-center justify-center space-y-6 min-h-[300px]">
            <CardTitle className="text-xl text-center">Secure Environment Login</CardTitle>
            <CardDescription>
              You are being redirected for login in secured environment please wait...
            </CardDescription>
            {/* The Clickable Countdown Circle */}
            <div
              className="relative w-32 h-32 rounded-full flex items-center justify-center bg-muted/50 border-4 border-dashed border-primary/20 cursor-pointer group transition-all hover:bg-muted"
              onClick={handleCircleClick}
            >
              <Loader2 className="absolute h-32 w-32 text-primary/30 animate-spin-slow" />
              <span className="text-6xl font-bold text-primary opacity-75 group-hover:opacity-100 transition-opacity">
                {countdown}
              </span>
            </div>
          </CardContent>
        );

      case 'username':
        return (
          <CardContent>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <ShieldCheck className="h-10 w-10 text-green-600 mx-auto" />
              <CardTitle className="text-center">Security Check Passed</CardTitle>
              <CardDescription className="text-center pb-2">
                Please enter your username to proceed.
              </CardDescription>
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
              <Button type="submit" className="w-full" disabled={loading || !username}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/admin/forgot-password')}
                className="w-full text-sm"
              >
                Forgot Password?
              </Button>
            </form>
          </CardContent>
        );

      case 'password':
        return (
          <CardContent>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <KeyRound className="h-10 w-10 text-primary mx-auto" />
              <CardTitle className="text-center">Welcome, {username}</CardTitle>
              <CardDescription className="text-center pb-2">
                Please enter your password.
              </CardDescription>
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
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !password}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Login
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate('/admin/forgot-password')}
                className="w-full text-sm"
              >
                Forgot Password?
              </Button>
            </form>
          </CardContent>
        );

      case 'blocked':
      case 'error':
        return (
          <CardContent className="min-h-[300px] flex flex-col items-center justify-center">
            <Alert variant="destructive" className="mb-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{step === 'blocked' ? 'Access Denied' : 'Error'}</AlertTitle>
              <AlertDescription>
                {errorMessage || 'An unknown error occurred. Please refresh.'}
              </AlertDescription>
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
