// src/pages/AdminLogin.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, ShieldCheck, KeyRound, QrCode } from 'lucide-react';
import { apiClient } from '@/services/apiClient'; // Import the API client
import { toast as sonnerToast } from "sonner"; // Import sonner
import { Separator } from '@/components/ui/separator'; // --- ADD IMPORT ---

// --- Google Auth Constants ---
const GOOGLE_CLIENT_ID = "339956503165-ir1fqjjrso9sk79an6dqh3r69drm60q9.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "https://forex.grisma.com.np/admin/auth/google/callback";

// --- Google SVG Icon component ---
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
  </svg>
);

// --- Login steps ---
type LoginStep = 'redirecting' | 'username' | 'password' | 'oneTimeCode' | 'blocked' | 'error';

// Add keys for session storage
const STEP_STORAGE_KEY = 'loginStep';
const USERNAME_STORAGE_KEY = 'loginUsername';

const AdminLogin = () => {
  // Read initial step from sessionStorage
  const getInitialStep = (): LoginStep => {
    try {
      const storedStep = sessionStorage.getItem(STEP_STORAGE_KEY);
      if (storedStep === 'username' || storedStep === 'password' || storedStep === 'oneTimeCode') {
        return storedStep as LoginStep;
      }
    } catch (e) {}
    return 'redirecting'; // Default
  };
  const [step, setStep] = useState<LoginStep>(getInitialStep());

  // Read initial username from sessionStorage
  const [username, setUsername] = useState(() => {
    try {
      return sessionStorage.getItem(USERNAME_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  });

  const [password, setPassword] = useState('');
  const [oneTimeCode, setOneTimeCode] = useState(''); // State for the code
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

  // 2. Start Timers on 'redirecting' step
  useEffect(() => {
    if (step === 'redirecting') {
      // Clear session storage on redirect step
      try {
        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.removeItem(USERNAME_STORAGE_KEY);
      } catch (e) {}
      
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
  }, [step]);

  // Save step to session storage whenever it changes
  useEffect(() => {
    try {
      if (step === 'username' || step === 'password' || step === 'oneTimeCode') {
        sessionStorage.setItem(STEP_STORAGE_KEY, step);
      } else if (step !== 'redirecting') {
        // Clear storage on block, error, or success
        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.removeItem(USERNAME_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to write to session storage', e);
    }
  }, [step]);
  
  // 3. Click Handler to Stop Redirect
  const handleCircleClick = () => {
    if (step !== 'redirecting') return;
    
    // Stop both timers
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    // Move to next step (the useEffect above will save this)
    setStep('username');
    sonnerToast.success("Redirect cancelled. Please authenticate.", { duration: 2000 });
  };

  // 4. Username Submit Handler
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || loading || !ipAddress) return;
    
    setLoading(true);
    setErrorMessage('');

    try {
      // Call the 'check-user' endpoint
      await apiClient.post('/admin/check-user', {
        username,
        ipAddress,
        sessionId: sessionIdRef.current,
      });

      // Save username to session storage on success
      sessionStorage.setItem(USERNAME_STORAGE_KEY, username);
      setStep('password');
    } catch (error: any) {
      console.error('Username check failed:', error.message);
      // Clear storage on error
      sessionStorage.removeItem(STEP_STORAGE_KEY);
      sessionStorage.removeItem(USERNAME_STORAGE_KEY);

      if (error.message.includes('Bro, get out')) {
        setStep('blocked');
        setErrorMessage(error.message);
      } else if (error.message.includes('Redirect')) {
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

  // 5. Final Login (Password) Submit Handler
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
        // Clear session storage on successful login
        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.removeItem(USERNAME_STORAGE_KEY);

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
      toast({ title: "Server Error", description: error.message || "Unable to login.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 6. One-Time Code Login Handler
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
        sessionStorage.removeItem(STEP_STORAGE_KEY);
        sessionStorage.removeItem(USERNAME_STORAGE_KEY);

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

  // --- NEW 7. Google Login Click Handler ---
  const handleGoogleLoginClick = () => {
    setLoading(true);
    // Construct the Google OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile',
      prompt: 'select_account', // Force account selection
    });
    
    // Redirect the user to Google's login page
    window.location.href = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
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
              <CardHeader className="p-0 pb-4">
                <ShieldCheck className="h-10 w-10 text-green-600 mx-auto" />
                <CardTitle className="text-center">Admin Login</CardTitle>
                <CardDescription className="text-center">
                  Please enter your username to proceed.
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
              <Button type="submit" className="w-full" disabled={loading || !username}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Next
              </Button>

              {/* --- ADDED GOOGLE LOGIN BUTTON --- */}
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-card px-2 text-xs text-muted-foreground">OR</span>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogleLoginClick} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Login with Google
              </Button>
              {/* --- END GOOGLE LOGIN BUTTON --- */}

              <div className="flex justify-between pt-2">
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
              <QrCode className="h-10 w-10 text-primary mx-auto" />
              <CardTitle className="text-center">One-Time Login</CardTitle>
              <CardDescription className="text-center pb-2">
                Enter the 8-digit code provided by your administrator.
              </CardDescription>
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
                onClick={() => setStep('username')} // Go back to username step
                className="w-full text-sm"
              >
                Back to password login
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
