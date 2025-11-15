// src/pages/AdminDashboard.tsx
import React, { lazy, Suspense } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/components/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="data-update">Data Update</TabsTrigger>
            <TabsTrigger value="site-settings">Site Settings</TabsTrigger>
            <TabsTrigger value="manage-posts">Manage Posts</TabsTrigger>
            <TabsTrigger value="manage-users">Manage Users</TabsTrigger>
            <TabsTrigger value="api-settings">API Settings</TabsTrigger>
            <TabsTrigger value="forex-data">Forex Data</TabsTrigger>
          </TabsList>

          <Suspense fallback={<AdminFallback />}>
            {/* 1. Profile Tab (Your new tab) */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProfileForm />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Data Update Tab (Restored) */}
            <TabsContent value="data-update">
              <Card>
                <CardHeader>
                  <CardTitle>Data Update Control</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataUpdateControl />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Site Settings Tab (Restored) */}
            <TabsContent value="site-settings">
              <Card>
                <CardHeader>
                  <CardTitle>Site Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <SiteSettings />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. Manage Posts Tab (Restored) */}
            <TabsContent value="manage-posts">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Posts</CardTitle>
                </CardHeader>
                <CardContent>
                  <PostsManagement onNewPost={handleNewPost} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Manage Users Tab (Restored) */}
            <TabsContent value="manage-users">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>

            {/* 6. API Settings Tab (Restored) */}
            <TabsContent value="api-settings">
              <Card>
                <CardHeader>
                  <CardTitle>API Access Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ApiSettings />
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* 7. Forex Data Tab (Restored) */}
            <TabsContent value="forex-data">
              <Card>
                <CardHeader>
                  <CardTitle>Forex Data Management</CardTitle>
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
