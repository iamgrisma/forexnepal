// src/components/admin/ProfileForm.tsx
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
  const [codeSent, setCodeSent] = useState(false);

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

  const { watch } = form;
  const currentEmail = watch('email');
  const emailChanged = currentEmail !== profile.email;

  // Handler for sending verification code
  const handleSendVerificationCode = async () => {
    setIsSendingCode(true);
    try {
      await apiClient.post('/admin/request-email-verification', { email: currentEmail });
      sonnerToast.success('Verification code sent!', {
        description: `A code has been sent to ${currentEmail}.`,
      });
      setCodeSent(true);
    } catch (error: any) {
      sonnerToast.error('Failed to send code', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  // Handler for form submission
  const onSubmit = async (data: ProfileFormValues) => {
    if (emailChanged && !data.email_verification_code) {
      toast({
        title: "Please verify your email",
        description: "You must send and enter a verification code for your new email address.",
        variant: "destructive",
      });
      return;
    }
    
    // Don't send empty password string
    const payload = {
      ...data,
      password: data.password && data.password.length > 0 ? data.password : undefined,
    };

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<{ success: boolean, profile: UserProfile }>(
        '/admin/profile', 
        payload
      );
      
      onSave(response.profile); // Update parent state
      
      sonnerToast.success('Profile Updated', {
        description: 'Your changes have been saved successfully.',
      });
    } catch (error: any) {
      sonnerToast.error('Update Failed', {
        description: error.message || 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Google Auth Constants ---
  const GOOGLE_CLIENT_ID = "339956503165-ir1fqjjrso9sk79an6dqh3r69drm60q9.apps.googleusercontent.com";
  const GOOGLE_REDIRECT_URI = "https://forex.grisma.com.np/admin/auth/google/callback";

  // --- Google SVG Icon component ---
  const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
    </svg>
  );

  const handleGoogleLoginClick = () => {
    setIsSubmitting(true); // Show loading
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'email profile',
      prompt: 'select_account',
      // Pass the user's current email to pre-fill the Google login
      login_hint: profile.email || undefined, 
    });
    window.location.href = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* --- Personal Information --- */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Personal Information</h4>
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
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
                <FormDescription>
                  Enter a URL to a publicly accessible image.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <Separator />

        {/* --- Email & Google Connection --- */}
        <div className="space-y-4">
          <h4 className="text-lg font-medium">Account & Security</h4>
           <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLoginClick}
            disabled={isSubmitting}
          >
            <GoogleIcon />
            {profile.email ? 'Connect / Re-sync Google Account' : 'Connect Google Account'}
          </Button>
          <FormDescription className="text-center">
            Connect your Google account to update your profile picture and name, or to enable Google login.
          </FormDescription>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendVerificationCode}
                    disabled={!emailChanged || isSendingCode}
                  >
                    {isSendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <FormDescription>
                  {emailChanged ? 'Click the button to send a verification code to change your email.' : 'This is your current verified email.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {emailChanged && (
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
                    Enter the code sent to {currentEmail}.
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
};

export default ProfileForm;
