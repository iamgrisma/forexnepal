// src/pages/AdminDashboard.tsx
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { UserProfile } from '@/worker-types';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Phone, User, Shield, Edit, X } from 'lucide-react';
import ProfileForm from '@/components/admin/ProfileForm'; // The new edit form

const fetchProfile = async (): Promise<UserProfile> => {
  const data = await apiClient.get<{ success: boolean; profile: UserProfile }>('/admin/profile');
  return data.profile;
};

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchProfile,
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'FN'; // Forex Nepal
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleEditSuccess = (updatedProfile: UserProfile) => {
    queryClient.setQueryData(['userProfile'], updatedProfile);
    setIsEditing(false);
  };

  const renderProfileView = () => (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="flex flex-col items-center text-center relative">
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute top-4 right-4"
          onClick={() => setIsEditing(true)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Avatar className="h-24 w-24 text-3xl">
          <AvatarImage src={profile?.profile_pic_url || undefined} alt={profile?.full_name || profile?.username} />
          <AvatarFallback>{getInitials(profile?.full_name || profile?.username)}</AvatarFallback>
        </Avatar>
        <CardTitle className="mt-4 text-2xl">
          {profile?.full_name || 'N/A'}
        </CardTitle>
        <CardDescription>@{profile?.username}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center">
              <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
              <span>{profile?.email || 'No email provided'}</span>
            </div>
            <div className="flex items-center">
              <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
              <span>{profile?.mobile_number || 'No mobile provided'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Access & Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center">
              <User className="h-5 w-5 mr-3 text-muted-foreground" />
              <span>Username: <strong>{profile?.username}</strong></span>
            </div>
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-3 text-muted-foreground" />
              <span>Role: <strong className="capitalize">{profile?.role}</strong></span>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );

  const renderEditView = () => (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your personal and security information.</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setIsEditing(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {profile && <ProfileForm profile={profile} onSave={handleEditSuccess} />}
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="p-4 md:p-8">
        {isLoading && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        )}
        {error && (
          <Card className="max-w-3xl mx-auto bg-destructive/10 border-destructive">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{(error as Error).message || 'Failed to load profile.'}</CardDescription>
            </CardHeader>
          </Card>
        )}
        {!isLoading && !error && profile && (
          isEditing ? renderEditView() : renderProfileView()
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
