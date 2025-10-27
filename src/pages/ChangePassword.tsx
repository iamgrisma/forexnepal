import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Layout from '@/components/Layout';
import { Loader2, KeyRound } from 'lucide-react';

const ChangePassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepSame, setKeepSame] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      navigate('/admin/login', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!keepSame && newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    if (!keepSame && newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters long.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    if (!token || !username) {
      toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
      setLoading(false);
      navigate('/admin/login', { replace: true });
      return;
    }

    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          newPassword: keepSame ? 'keepcurrent' : newPassword,
          keepSamePassword: keepSame,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: "Success", description: "Password has been set successfully." });
        localStorage.removeItem('forcePasswordChange');
        navigate('/admin/dashboard', { replace: true });
      } else {
        toast({ title: "Error", description: data.error || "Failed to change password.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast({ title: "Error", description: "A network error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeepSame = async () => {
    setKeepSame(true);
    setNewPassword('keepcurrent');
    setConfirmPassword('keepcurrent');

    setTimeout(() => {
      const form = document.getElementById('change-password-form') as HTMLFormElement;
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-6 w-6 text-primary" />
                <CardTitle>Set Your Secure Password</CardTitle>
              </div>
              <CardDescription>
                You must set a secure password before continuing. This is required for first-time login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
                {!keepSame && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-1 block" htmlFor="newPassword">
                        New Password
                      </label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 chars)"
                        required
                        minLength={8}
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block" htmlFor="confirmPassword">
                        Confirm New Password
                      </label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                        disabled={loading}
                      />
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-destructive mt-1">Passwords do not match.</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="submit"
                        disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                        className="w-full"
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Setting Password...' : 'Set New Password'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleKeepSame}
                        disabled={loading}
                        className="w-full"
                      >
                        Keep Current Password
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePassword;
