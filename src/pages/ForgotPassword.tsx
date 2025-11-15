// iamgrisma/forexnepal/forexnepal-892e763f1401a81eb2bc3250b64698c85e1f23bd/src/pages/ForgotPassword.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Layout from '@/components/Layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldAlert, KeyRound, CheckCircle } from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import { toast as sonnerToast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"


type Step = 'email' | 'code' | 'success';

const ForgotPassword = () => {
  const [step, setStep] = useState<Step>('email');
  const [username, setUsername] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  // Handler for requesting a password reset email
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !username) return;

    setLoading(true);
    setErrorMessage('');
    setGeneratedCode(''); // Clear any old generated code

    try {
      // This is the primary method: request an email
      await apiClient.post('/admin/request-password-reset', { username });
      setStep('success'); // Show success message
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for generating an on-demand code (for admins already logged in, conceptually)
  // This is now a protected route, so this UI part might be better placed inside the admin panel.
  // For now, we'll keep the logic but de-emphasize it.
  const handleGenerateCode = async () => {
    if (loading || !username) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // This endpoint is protected, so it will fail if not logged in.
      // This button is for an admin to generate a code for *another* user.
      // This UI might be in the wrong place, but the logic is here.
      const data = await apiClient.post<{ success: boolean; code: string; error?: string }>(
        '/api/admin/generate-login-code', 
        { username }
      );
      
      if (data.success) {
        setGeneratedCode(data.code);
        setStep('code');
      } else {
        throw new Error(data.error || 'Could not generate code.');
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage("You must be an admin to generate a code. Use 'Send Reset Link' instead.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-md">
            <CardHeader className="text-center">
              <KeyRound className="h-10 w-10 text-primary mx-auto" />
              <CardTitle>Forgot Password</CardTitle>
            </CardHeader>
            <CardContent>
              {step === 'email' && (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <CardDescription className="text-center">
                    Enter your username to receive a password reset link via email.
                  </CardDescription>
                  <div>
                    <label className="text-sm font-medium mb-1 block text-left" htmlFor="username">Username</label>
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      disabled={loading}
                      autoCapitalize="none"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                  {errorMessage && (
                    <Alert variant="destructive" className="mt-4">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={loading || !username}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send Reset Link
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/admin/login')}>
                    Back to Login
                  </Button>
                </form>
              )}

              {step === 'success' && (
                <div className="space-y-4 text-center">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                  <AlertTitle className="text-lg font-medium">Check Your Email</AlertTitle>
                  <AlertDescription>
                    If an account with that username exists, a password reset link has been sent to the associated email.
                  </AlertDescription>
                  <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/admin/login')}>
                    Back to Login
                  </Button>
                </div>
              )}

              {/* This step is likely unused now, but left for completeness */ }
              {step === 'code' && (
                <div className="space-y-6 text-center">
                   <AlertTitle className="text-lg font-medium">Login Code Generated</AlertTitle>
                  <AlertDescription>
                    Provide this one-time login code to the user. It expires in 6 minutes.
                  </AlertDescription>
                  <InputOTP maxLength={8} value={generatedCode}>
                    <InputOTPGroup className="mx-auto">
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setStep('email')}>
                    Back
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
