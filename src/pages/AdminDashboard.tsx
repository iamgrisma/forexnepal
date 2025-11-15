// src/pages/AdminDashboard.tsx
import React, { lazy, Suspense } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Lazy load admin components for better performance
const DataUpdateControl = lazy(() => import('@/components/admin/DataUpdateControl'));
const SiteSettings = lazy(() => import('@/components/admin/SiteSettings'));
const PostsManagement = lazy(() => import('@/components/admin/PostsManagement'));
const UserManagement = lazy(() => import('@/components/admin/UserManagement'));
const ApiSettings = lazy(() => import('@/components/admin/ApiSettings'));
const ForexDataManagement = lazy(() => import('@/components/admin/ForexDataManagement'));
// --- This is the new component you added ---
const ProfileForm = lazy(() => import('@/components/admin/ProfileForm'));

const AdminFallback = () => (
  <div className="flex justify-center items-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AdminDashboard = () => {
  const { username } = useAuth();
  const navigate = useNavigate();

  // Handle navigation to the PostEditor
  const handleNewPost = () => {
    navigate('/admin/posts/new');
  };
  
  // Handle navigation to edit a post
  const handleEditPost = (postId: number) => {
    navigate(`/admin/posts/edit/${postId}`);
  };

  return (
    <Layout>
      <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome, {username}! Manage your site content and settings here.
          </p>
        </header>

        <Tabs defaultValue="profile" className="w-full">
          {/* --- Restored all tabs --- */}
          <div className="overflow-x-auto scrollbar-hide border-b">
            <TabsList className="flex-nowrap w-max">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="data-update">Data Update</TabsTrigger>
              <TabsTrigger value="site-settings">Site Settings</TabsTrigger>
              <TabsTrigger value="manage-posts">Manage Posts</TabsTrigger>
              <TabsTrigger value="manage-users">Manage Users</TabsTrigger>
              <TabsTrigger value="api-settings">API Settings</TabsTrigger>
              <TabsTrigger value="forex-data">Forex Data</TabsTrigger>
            </TabsList>
          </div>

          <Suspense fallback={<AdminFallback />}>
            {/* 1. Profile Tab (Your new tab) */}
            <TabsContent value="profile" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Manage your admin account details and password.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ProfileForm />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Data Update Tab (Restored) */}
            <TabsContent value="data-update" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Data Update Control</CardTitle>
                  <CardDescription>Manually fetch data from NRB API and update the database.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataUpdateControl />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Site Settings Tab (Restored) */}
            <TabsContent value="site-settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Site Settings</CardTitle>
                  <CardDescription>Manage global site settings like ticker and ads.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SiteSettings />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. Manage Posts Tab (Restored) */}
            <TabsContent value="manage-posts" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Posts</CardTitle>
                  <CardDescription>Create, edit, and delete blog posts.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PostsManagement onNewPost={handleNewPost} onEditPost={handleEditPost} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Manage Users Tab (Restored) */}
            <TabsContent value="manage-users" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Users</CardTitle>
                  <CardDescription>Add or remove admin users.</CardDescription>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 6. API Settings Tab (Restored) */}
            <TabsContent value="api-settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>API Access Settings</CardTitle>
                  <CardDescription>Manage public API access, restrictions, and quotas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ApiSettings />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 7. Forex Data Tab (Restored) */}
            <TabsContent value="forex-data" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Forex Data Management</CardTitle>
                  <CardDescription>Manually add or edit forex data for a specific date.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ForexDataManagement />
                </CardContent>
              </Card>
            </TabsContent>
          </Suspense>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
