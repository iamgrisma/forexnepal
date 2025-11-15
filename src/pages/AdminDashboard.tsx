// src/pages/AdminDashboard.tsx
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
import { LogOut, Home, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { UserProfile } from '@/worker-types';

// Import Admin Components
import DataUpdateControl from '@/components/admin/DataUpdateControl';
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import PostsManagement from '@/components/admin/PostsManagement';
import UserManagement from '@/components/admin/UserManagement';
import SiteSettingsComponent from '@/components/admin/SiteSettings';
import ApiSettings from '@/components/admin/ApiSettings';
// --- THIS IS THE FIX ---
// Changed the import path to be relative, assuming it's in the same /pages directory
import ProfileForm from './ProfileForm'; 
// --- END OF FIX ---
import { Skeleton } from '@/components/ui/skeleton';

// Function to fetch the user's own profile
const fetchProfile = async (): Promise<UserProfile> => {
  // This assumes you have a GET endpoint at /api/admin/profile
  // You will need to build this endpoint in your worker
  return await apiClient.get<UserProfile>('/api/admin/profile');
};

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Save handler to update query cache on successful save
  const handleSaveProfile = (updatedProfile: UserProfile) => {
    // The ProfileForm component handles the mutation,
    // this callback updates the local cache to show changes instantly.
    queryClient.setQueryData(['userProfile'], updatedProfile);
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
          <Tabs defaultValue="data-update">
            <TabsList className="flex flex-wrap h-auto justify-start">
              <TabsTrigger value="data-update">Data Update</TabsTrigger>
              <TabsTrigger value="forex-data">Forex Data</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="site-settings">Site Settings</TabsTrigger>
              <TabsTrigger value="api-settings">API Settings</TabsTrigger>
              <TabsTrigger value="profile">My Profile</TabsTrigger>
            </TabsList>

            {/* --- Existing Tabs --- */}
            <TabsContent value="data-update">
              <DataUpdateControl />
            </TabsContent>
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

            {/* --- Profile Tab Content --- */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                  <CardDescription>
                    Manage your profile details and change your password.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isProfileLoading && (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-1/3" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  )}
                  {userProfile && (
                    <ProfileForm profile={userProfile} onSave={handleSaveProfile} />
                  )}
                  {!isProfileLoading && !userProfile && (
                    <p className="text-destructive">
                      Error: Could not load user profile.
                      <br />
                      <span className="text-sm text-muted-foreground">
                        (You still need to build the
                        <code className="mx-1 px-1 bg-muted rounded">GET /api/admin/profile</code>
                        endpoint in your worker)
                      </span>
                    </p>
                  )}
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
