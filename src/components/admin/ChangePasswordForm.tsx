import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ChangePasswordForm = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
         toast({ title: "Error", description: "New password must be at least 8 characters long.", variant: "destructive" });
         return;
    }

    setLoading(true);
    const token = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');

    if (!token || !username) {
      toast({ title: "Error", description: "Authentication error. Please log in again.", variant: "destructive" });
      setLoading(false);
      // Optional: redirect to login
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
          username, // Send username for backend verification if needed
          currentPassword, // Backend currently doesn't verify old pw, but we send it
          newPassword,
          token, // Send token again in body as per worker logic (though header should suffice)
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: "Success", description: "Password changed successfully." });
        // Clear fields after success
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({ title: "Error", description: data.error || "Failed to change password.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Password change error:", error);
      toast({ title: "Error", description: "An network error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Admin Password</CardTitle>
        <CardDescription>Update your login password. Your current password isn't verified by the backend, but enter your new password carefully.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* We keep current password field even if backend doesn't use it for now */}
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="currentPassword">Current Password (Optional)</label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password (not verified)"
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="newPassword">New Password</label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 chars)"
              required
              minLength={8}
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" htmlFor="confirmPassword">Confirm New Password</label>
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
          <Button type="submit" disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Updating...' : 'Change Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordForm;
