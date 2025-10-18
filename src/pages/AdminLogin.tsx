import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [redirecting, setRedirecting] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [loading, setLoading] = useState(false);
  const [attemptsInfo, setAttemptsInfo] = useState<{ attempts: number; remaining: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const sessionIdRef = useRef(Math.random().toString(36).substring(7)); // Unique session ID

  // Fetch IP and check attempts on mount or when redirect is cancelled
  useEffect(() => {
    const fetchIpAndCheckAttempts = async () => {
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        sessionStorage.setItem('userIP', ip); // Store IP for login attempt

        const attemptsResponse = await fetch(`/api/admin/check-attempts?ip=${ip}&session=${sessionIdRef.current}`);
        if (attemptsResponse.ok) {
          const data = await attemptsResponse.json();
          setAttemptsInfo(data);
          if (data.remaining <= 0) {
            toast({
              title: "Too many failed attempts",
              description: "Login is temporarily blocked. Please try again later.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching IP or checking attempts:", error);
        toast({
          title: "Network Error",
          description: "Could not check login status. Please try again.",
          variant: "destructive",
        });
      }
    };

    if (!redirecting) {
      fetchIpAndCheckAttempts();
    }
  }, [redirecting, toast]);

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
    e.preventDefault(); // Prevent potential form submission if wrapped in form
    setRedirecting(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const ipAddress = sessionStorage.getItem('userIP');
    if (!ipAddress) {
      toast({ title: "Error", description: "Could not retrieve IP address. Please refresh.", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (attemptsInfo && attemptsInfo.remaining <= 0) {
       toast({ title: "Login Blocked", description: "Too many failed attempts. Try again later.", variant: "destructive" });
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
        localStorage.setItem('authToken', data.token); // Store token
        localStorage.setItem('username', data.username);
        toast({ title: "Login Successful", description: `Welcome, ${data.username}!` });
        navigate('/admin/dashboard'); // Redirect to dashboard
      } else {
        toast({
          title: "Login Failed",
          description: data.error || 'Invalid credentials or too many attempts.',
          variant: "destructive",
        });
        // Refresh attempts count after failed login
         const attemptsResponse = await fetch(`/api/admin/check-attempts?ip=${ipAddress}&session=${sessionIdRef.current}`);
         if (attemptsResponse.ok) {
           setAttemptsInfo(await attemptsResponse.json());
         }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login Error",
        description: "An error occurred during login. Check console for details.",
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
             {attemptsInfo && attemptsInfo.remaining < 7 && attemptsInfo.remaining > 0 && (
               <Alert variant="destructive" className="mb-4">
                 <Terminal className="h-4 w-4" />
                 <AlertTitle>Warning</AlertTitle>
                 <AlertDescription>
                   {attemptsInfo.remaining} login attempt{attemptsInfo.remaining > 1 ? 's' : ''} remaining before temporary block.
                 </AlertDescription>
               </Alert>
             )}
             {attemptsInfo && attemptsInfo.remaining <= 0 && (
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
                  disabled={loading || (attemptsInfo && attemptsInfo.remaining <= 0)}
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
                  disabled={loading || (attemptsInfo && attemptsInfo.remaining <= 0)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || (attemptsInfo && attemptsInfo.remaining <= 0)}>
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
