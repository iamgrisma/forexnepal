// iamgrisma/forexnepal/forexnepal-3a6e83ee59906891a05be1ef38aac80d81ccf17d/src/pages/AdminDashboard.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { LogOut, Home, Loader2, User, Mail, Phone, Edit } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { UserProfile } from '@/worker-types';

// Import Admin Components
// import DataUpdateControl from '@/components/admin/DataUpdateControl'; // --- REMOVED ---
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import PostsManagement from '@/components/admin/PostsManagement';
import UserManagement from '@/components/admin/UserManagement';
import SiteSettingsComponent from '@/components/admin/SiteSettings';
import ApiSettings from '@/components/admin/ApiSettings';
import ProfileForm from './ProfileForm'; // Assuming ProfileForm.tsx is in src/pages/
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Function to fetch the user's own profile
const fetchProfile = async (): Promise<UserProfile> => {
  // --- THIS IS THE FIX: Removed the redundant /api prefix ---
  return await apiClient.get<UserProfile>('/admin/profile');
};

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false); // State for toggling edit mode

  // Query to fetch the admin's profile data
  const { 
    data: userProfile, 
    isLoading: isProfileLoading 
  } = useQuery({
    queryKey: ['userProfile'],
    queryFn: fetchProfile,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const goToHome = () => {
    navigate('/');
  };

  // Save handler to update query cache AND exit edit mode
  const handleSaveProfile = (updatedProfile: UserProfile) => {
    queryClient.setQueryData(['userProfile'], updatedProfile);
    setIsEditingProfile(false); // Return to view mode on save
  };
  
  // Gets the first letter of the username for the Avatar fallback
  const getAvatarFallback = (username?: string) => {
    return username ? username.charAt(0).toUpperCase() : <User className="h-12 w-12" />;
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToHome}>
              <Home className="h-4 w-4 mr-2" />
              Go to Site
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </header>
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {/* --- MODIFIED: Default tab is now 'dashboard' --- */}
          <Tabs defaultValue="dashboard">
            <TabsList className="flex flex-wrap h-auto justify-start">
              {/* --- NEW: Dashboard Tab --- */}
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              {/* --- REMOVED: Data Update Tab --- */}
              <TabsTrigger value="forex-data">Forex Data</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="site-settings">Site Settings</TabsTrigger>
              <TabsTrigger value="api-settings">API Settings</TabsTrigger>
            </TabsList>

            {/* --- NEW: Dashboard Tab Content (Profile View/Edit) --- */}
            <TabsContent value="dashboard">
              <Card>
                <CardHeader>
                  <CardTitle>{isEditingProfile ? 'Edit Your Profile' : 'My Profile'}</CardTitle>
                  <CardDescription>
                    {isEditingProfile 
                      ? 'Update your profile details and password.' 
                      : 'View your profile and system overview.'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isProfileLoading && (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <Skeleton className="h-24 w-24 rounded-full" />
                      <Skeleton className="h-8 w-48" />
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-10 w-32" />
                    </div>
                  )}
                  
                  {!isProfileLoading && !userProfile && (
                     <p className="text-destructive text-center py-8">
                      Error: Could not load user profile.
                      <br />
                      <span className="text-sm text-muted-foreground">
                        (The backend endpoint <code className="mx-1 px-1 bg-muted rounded">GET /api/admin/profile</code> is not working)
                      </span>
                    </p>
                  )}

                  {userProfile && (
                    <>
                      {isEditingProfile ? (
                        // --- EDIT MODE ---
                        <ProfileForm 
                          profile={userProfile} 
                          onSave={handleSaveProfile} 
                          onCancel={() => setIsEditingProfile(false)} // Pass cancel handler
                        />
                      ) : (
                        // --- VIEW MODE (Your new design) ---
                        <div className="flex flex-col items-center gap-4 py-8 text-center">
                          <Avatar className="h-24 w-24 text-4xl">
                            <AvatarImage src={userProfile.profile_pic_url || ''} alt={userProfile.username} />
                            <AvatarFallback>{getAvatarFallback(userProfile.username)}</AvatarFallback>
                          </Avatar>
                          <h2 className="text-2xl font-semibold">{userProfile.username}</h2>
                          
                          {userProfile.full_name && (
                            <p className="text-lg text-muted-foreground">{userProfile.full_name}</p>
                          )}
                          
                          <div className="text-sm text-muted-foreground space-y-2">
                            {userProfile.email && (
                              <div className="flex items-center justify-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{userProfile.email}</span>
                              </div>
                            )}
                            {userProfile.mobile_number && (
                              <div className="flex items-center justify-center gap-2">
                                <Phone className="h-4 w-4" />
                                <span>{userProfile.mobile_number}</span>
                              </div>
                            )}
                             {userProfile.role && (
                              <div className="flex items-center justify-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="capitalize">{userProfile.role}</span>
                              </div>
                            )}
                          </div>
                          
                          <Button variant="link" onClick={() => setIsEditingProfile(true)} className="mt-4">
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profile
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {/* --- END: New Dashboard Tab --- */}

            <TabsContent value="forex-data">
              <ForexDataManagement />
            </TabsContent>
            <TabsContent value="posts">
              <PostsManagement />
            </TabsContent>
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Add or remove admin users.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="site-settings">
                <Card>
                  <CardHeader>
                    <CardTitle>Site Settings</CardTitle>
                    <CardDescription>
                      Manage global site settings like ticker and ads.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SiteSettingsComponent />
                  </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="api-settings">
                <Card>
                  <CardHeader>
                    <CardTitle>API Settings</CardTitle>
                    <CardDescription>
                      Manage public API access, restrictions, and quotas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ApiSettings />
                  </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
