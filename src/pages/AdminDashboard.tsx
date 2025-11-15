// src/pages/AdminDashboard.tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/ProtectedRoute'; // This import will now work
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
import { LogOut, Home } from 'lucide-react';

// Import Admin Components
import DataUpdateControl from '@/components/admin/DataUpdateControl';
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import PostsManagement from '@/components/admin/PostsManagement';
import UserManagement from '@/components/admin/UserManagement';
import SiteSettingsComponent from '@/components/admin/SiteSettings';
import ApiSettings from '@/components/admin/ApiSettings';

const AdminDashboard = () => {
  const { logout } = useAuth(); // This will now receive the logout function
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // Call the logout function from context
    // The ProtectedRoute's effect will handle navigation,
    // but we can also navigate directly for a faster UI update.
    navigate('/admin/login');
  };

  const goToHome = () => {
    navigate('/');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col sm:gap-4 sm:py-4">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <div className="ml-auto flex items-center gap-2">
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
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="data-update">Data Update</TabsTrigger>
                <TabsTrigger value="forex-data">Forex Data</TabsTrigger>
                <TabsTrigger value="posts">Posts</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="site-settings">Site Settings</TabsTrigger>
                <TabsTrigger value="api-settings">API Settings</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="data-update">
              <Card>
                <CardHeader>
                  <CardTitle>Data Update Control</CardTitle>
                  <CardDescription>
                    Manually fetch data from NRB API and update the database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataUpdateControl />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="forex-data">
              <Card>
                <CardHeader>
                  <CardTitle>Forex Data Management</CardTitle>
                  <CardDescription>
                    Manually add or edit forex data for a specific date.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ForexDataManagement />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="posts">
              <Card>
                <CardHeader>
                  <CardTitle>Posts Management</CardTitle>
                  <CardDescription>
                    Create, edit, and delete blog posts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PostsManagement />
                </CardContent>
              </Card>
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
