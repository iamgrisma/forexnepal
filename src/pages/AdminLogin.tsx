import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react'; // Import Loader2

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [redirecting, setRedirecting] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [loading, setLoading] = useState(false);
  const [checkingAttempts, setCheckingAttempts] = useState(true); // State for checking attempts
  const [attemptsInfo, setAttemptsInfo] = useState<{ attempts: number; remaining: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  // Generate session ID once per component mount
  const sessionIdRef = useRef(Math.random().toString(36).substring(7));
  const ipAddressRef = useRef<string | null>(null); // Ref to store IP address

  // Fetch IP and check attempts on mount or when redirect is cancelled
  useEffect(() => {
    const fetchIpAndCheckAttempts = async () => {
      setCheckingAttempts(true); // Start checking
      setAttemptsInfo(null); // Reset attempts info
      try {
        // Fetch IP only once if not already fetched
        if (!ipAddressRef.current) {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          if (!ipResponse.ok) throw new Error('Failed to fetch IP address');
          const { ip } = await ipResponse.json();
          ipAddressRef.current = ip;
        }

        const attemptsResponse = await fetch(`/api/admin/check-attempts?ip=${ipAddressRef.current}&session=${sessionIdRef.current}`);
        if (attemptsResponse.ok) {
          const data = await attemptsResponse.json();
          setAttemptsInfo(data);
          if (data.remaining <= 0) {
            toast({
              title: "Too many failed attempts",
              description: "Login is temporarily blocked. Please try again later.",
              variant: "destructive",
              duration: 10000, // Keep message longer
            });
          }
        } else {
             console.error("Failed to check attempts:", attemptsResponse.statusText);
             // Don't block login if check fails, but log it
        }
      } catch (error) {
        console.error("Error fetching IP or checking attempts:", error);
        toast({
          title: "Network Error",
          description: "Could not check login status. Please check your connection.",
          variant: "destructive",
        });
         // Allow login attempt even if check fails
         setAttemptsInfo({ attempts: 0, remaining: 7 }); // Assume attempts are available
      } finally {
          setCheckingAttempts(false); // Finish checking
      }
    };

    if (!redirecting) {
      fetchIpAndCheckAttempts();
    }
  }, [redirecting, toast]); // Rerun effect if redirecting state changes

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (redirecting && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (redirecting && countdown === 0) {
      window.location.href = 'https://grisma.com.np';
    }
    // Cleanup timer on unmount or when redirecting stops
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [redirecting, countdown]);

  const cancelRedirect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setRedirecting(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const ipAddress = ipAddressRef.current; // Get IP from ref
    if (!ipAddress) {
      toast({ title: "Error", description: "IP address not available. Please refresh and try again.", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (attemptsInfo && attemptsInfo.remaining <= 0) {
       toast({ title: "Login Blocked", description: "Too many failed attempts. Please try again later.", variant: "destructive" });
       setLoading(false);
       return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          ipAddress,
          sessionId: sessionIdRef.current,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });
        // TODO: Replace '/admin/dashboard' with your actual dashboard route if different
        navigate('/admin/dashboard');
      } else {
        // Handle specific error statuses
        let description = data.error || 'Invalid credentials or login issue.';
        if (response.status === 429) {
            description = "Too many failed attempts. Please try again later.";
        } else if (response.status === 401) {
            description = "Invalid username or password.";
        }

        toast({
          title: "Login Failed",
          description: description,
          variant: "destructive",
        });

        // Refresh attempts count immediately after a failed login
         try {
           const attemptsResponse = await fetch(`/api/admin/check-attempts?ip=${ipAddress}&session=${sessionIdRef.current}`);
           if (attemptsResponse.ok) {
             const newAttemptsData = await attemptsResponse.json();
              setAttemptsInfo(newAttemptsData);
               if (newAttemptsData.remaining <= 0) {
                 toast({
                   title: "Login Blocked",
                   description: "Maximum login attempts reached. Please try again later.",
                   variant: "destructive",
                   duration: 10000,
                 });
               }
           }
         } catch (attemptsError) {
             console.error("Failed to re-check attempts:", attemptsError);
         }
      }
    } catch (error) {
      console.error("Login network/fetch error:", error);
      toast({
        title: "Login Error",
        description: "A network error occurred. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Redirect Section
  if (redirecting) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center shadow-lg border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-primary">Redirecting...</CardTitle>
              <CardDescription>Secure admin area. Redirecting to Grisma Blog.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">
                Redirecting in <span className="font-bold text-foreground">{countdown}</span> seconds
              </p>
              <button
                onClick={cancelRedirect}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                cancel redirect
              </button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Login Form Section
  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
            <CardDescription>Access the ForexNepal dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
             {checkingAttempts && (
                 <div className="flex items-center justify-center text-muted-foreground text-sm mb-4">
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking login status...
                 </div>
             )}
             {!checkingAttempts && attemptsInfo && attemptsInfo.remaining < 7 && attemptsInfo.remaining > 0 && (
               <Alert variant="destructive" className="mb-4">
                 <Terminal className="h-4 w-4" />
                 <AlertTitle>Warning</AlertTitle>
                 <AlertDescription>
                   {attemptsInfo.remaining} login attempt{attemptsInfo.remaining !== 1 ? 's' : ''} remaining before temporary block.
                 </AlertDescription>
               </Alert>
             )}
             {!checkingAttempts && attemptsInfo && attemptsInfo.remaining <= 0 && (
                <Alert variant="destructive" className="mb-4">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Login Blocked</AlertTitle>
                  <AlertDescription>
                    Too many failed attempts. Please try again later.
                  </AlertDescription>
                </Alert>
             )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block text-left" htmlFor="username">Username</label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={loading || checkingAttempts || (attemptsInfo && attemptsInfo.remaining <= 0)}
                  autoCapitalize="none" // Prevent auto-capitalization issues
                  autoComplete="username"
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
                  disabled={loading || checkingAttempts || (attemptsInfo && attemptsInfo.remaining <= 0)}
                   autoComplete="current-password"
                />
              </div>
              <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || checkingAttempts || (attemptsInfo && attemptsInfo.remaining <= 0)}
                >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminLogin;
