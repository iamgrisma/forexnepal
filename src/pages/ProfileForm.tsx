// src/pages/ProfileForm.tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserProfile } from '@/worker-types';
import { apiClient } from '@/services/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Schema for validation
const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  mobile_number: z.string().optional(),
  profile_pic_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email address'),
  email_verification_code: z.string().optional(),
  password: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: UserProfile;
  onSave: (updatedProfile: UserProfile) => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSave }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(profile.email);
  const [showVerification, setShowVerification] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.full_name || '',
      mobile_number: profile.mobile_number || '',
      profile_pic_url: profile.profile_pic_url || '',
      email: profile.email || '',
      email_verification_code: '',
      password: '',
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<{ success: boolean; user: UserProfile; error?: string }>(
        '/api/admin/profile/update-details',
        values
      );

      if (result.success) {
        sonnerToast.success('Profile updated successfully!');
        onSave(result.user); // Pass updated profile back to parent
        form.reset({
          ...values,
          password: '', // Clear password field
          email_verification_code: '', // Clear code field
        });
        setCurrentEmail(result.user.email);
        setShowVerification(false);
      } else {
        throw new Error(result.error || 'Failed to update profile.');
      }
    } catch (error: any) {
      sonnerToast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendVerificationCode = async () => {
    setIsSendingCode(true);
    const email = form.getValues('email');
    try {
      const result = await apiClient.post<{ success: boolean; error?: string }>(
        '/api/admin/profile/send-verification-code',
        { email }
      );
      if (result.success) {
        sonnerToast.success(`Verification code sent to ${email}`);
        setShowVerification(true);
      } else {
        throw new Error(result.error || 'Failed to send code.');
      }
    } catch (error: any) {
      sonnerToast.error(`Error: ${error.message}`);
    } finally {
      setIsSendingCode(false);
    }
  };

  const emailChanged = form.watch('email') !== currentEmail;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* --- Profile Details --- */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Profile Details</h4>
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Your full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mobile_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile Number</FormLabel>
                <FormControl>
                  <Input placeholder="+977..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profile_pic_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Picture URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* --- Email Change --- */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Email Address</h4>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="user@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {emailChanged && (
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSendVerificationCode}
                disabled={isSendingCode || isSubmitting}
              >
                {isSendingCode ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Verification Code
              </Button>
              <p className="text-sm text-muted-foreground">
                You must verify your new email address.
              </p>
            </div>
          )}

          {showVerification && emailChanged && (
            <FormField
              control={form.control}
              name="email_verification_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Code</FormLabel>
                  <FormControl>
                    <Input placeholder="emver-..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter the code sent to {form.getValues('email')}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <Separator />

        {/* --- Password Change --- */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Change Password</h4>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormDescription>
                  Leave blank to keep your current password.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isSubmitting || (emailChanged && !showVerification)} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
};

export default ProfileForm;
