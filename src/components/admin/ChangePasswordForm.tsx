// src/components/admin/ChangePasswordForm.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient'; // <-- 1. IMPORT apiClient

const ChangePasswordForm = () => {
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
    // Token is now read by apiClient automatically
    const username = localStorage.getItem('username');

    if (!username) {
      toast({ title: "Error", description: "Authentication error. Please log in again.", variant: "destructive" });
      setLoading(false);
      return;
    }

    // --- 2. REPLACE raw fetch with apiClient ---
    try {
      const data = await apiClient.post<{ success: boolean, message?: string, error?: string }>(
        '/admin/change-password', // apiClient adds the /api prefix
        {
          username,
          newPassword,
          keepSamePassword: false,
        }
      );

      // 3. apiClient throws errors, so if we get here, it was successful
      if (data.success) {
        toast({ title: "Success", description: "Password changed successfully." });
        setNewPassword('');
        setConfirmPassword('');
      } else {
         // This is a fallback, but apiClient should have thrown an error
         toast({ title: "Error", description: data.error || "Failed to change password.", variant: "destructive" });
      }
    } catch (error: any) {
      // 4. The catch block now handles API errors
      console.error("Password change error:", error);
      toast({ title: "Error", description: error.message || "A network error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  // --- END OF CHANGES ---

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Admin Password</CardTitle>
        <CardDescription>Update your login password with a new secure password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
