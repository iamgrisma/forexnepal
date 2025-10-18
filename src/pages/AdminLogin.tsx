import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (redirecting && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (redirecting && countdown === 0) {
      window.location.href = 'https://grisma.com.np';
    }
  }, [redirecting, countdown]);

  const cancelRedirect = () => {
    setRedirecting(false);
  };

  const handleLogin = async () => {
    // Placeholder for actual authentication
    toast({
      title: "Admin login",
      description: "Authentication system to be implemented"
    });
  };

  if (redirecting) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Redirecting to Grisma Blog...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center mb-4">Redirecting in {countdown} seconds</p>
              <button 
                onClick={cancelRedirect} 
                className="text-xs text-muted-foreground hover:text-foreground underline mx-auto block"
              >
                cancel
              </button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ForexAdmin"
              />
            </div>
            {username === 'ForexAdmin' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Password</label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
            )}
            <Button onClick={handleLogin} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminLogin;
