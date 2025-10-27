import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [redirecting, setRedirecting] = useState(true);
  // Extended countdown to 5 seconds (was 3)
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(false);
  const [checkingAttempts, setCheckingAttempts] = useState(true);
  const [attemptsInfo, setAttemptsInfo] = useState<{ attempts: number; remaining: number } | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let t: number | undefined;
    if (redirecting) {
      t = window.setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            window.location.href = 'https://grisma.com.np';
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (t) window.clearInterval(t);
    };
  }, [redirecting]);

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const ip = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip);
        const res = await fetch(`/api/admin/check-attempts?ip=${encodeURIComponent(ip)}&sessionId=${sessionIdRef.current}`);
        if (res.ok) {
          setAttemptsInfo(await res.json());
        }
      } catch (e) {
        // ignore network/ip issues here
      } finally {
        setCheckingAttempts(false);
      }
    };
    fetchAttempts();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let ipAddress = '';
    try {
      ipAddress = await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => d.ip);
    } catch (err) {
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

        if (data.mustChangePassword) {
          localStorage.setItem('forcePasswordChange', '1');
          navigate('/admin/change-password', { replace: true });
          return;
        }

        navigate('/admin/dashboard', { replace: true });
      } else {
        toast({ title: "Login Failed", description: data?.error || 'Invalid credentials', variant: "destructive" });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Server Error", description: "Unable to login right now.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Admin Login</CardTitle>
              <CardDescription>
                Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''} — <button className="underline text-sm" onClick={() => setRedirecting(false)}>cancel</button>
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    autoCapitalize="none"
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
      </div>
    </Layout>
  );
};

export default AdminLogin;