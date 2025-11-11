import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setLoading(true);

    try {
      const response = await fetch('/api/admin/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailSent(true);
        toast({
          title: "Email Sent",
          description: "If an account with that username exists, you'll receive a password reset email.",
        });
      } else {
        toast({
          title: "Request Sent",
          description: "If an account with that username exists, you'll receive a password reset email.",
        });
        setEmailSent(true); // Always show success for security
      }
    } catch (error) {
      console.error('Password reset request error:', error);
      toast({
        title: "Error",
        description: "Unable to process your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <Layout>
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-6 w-6 text-green-600" />
                  <CardTitle>Check Your Email</CardTitle>
                </div>
                <CardDescription>
                  If an account with username "{username}" exists, we've sent password reset instructions to the associated email address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The email may take a few minutes to arrive. Please check your spam folder if you don't see it in your inbox.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => navigate('/admin/login')} className="flex-1">
                    Return to Login
                  </Button>
                  <Button onClick={() => navigate('/admin/reset-password')} variant="outline" className="flex-1">
                    I have a code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                <CardTitle>Forgot Password?</CardTitle>
              </div>
              <CardDescription>
                Enter your username and we'll send you instructions to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block" htmlFor="username">
                    Username
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="submit" disabled={loading || !username} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {loading ? 'Sending...' : 'Send Reset Instructions'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/admin/login')}
                    className="w-full"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
