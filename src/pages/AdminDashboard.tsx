import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import PostsManagement from '@/components/admin/PostsManagement';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';
import SiteSettings from '@/components/admin/SiteSettings';
import UserManagement from '@/components/admin/UserManagement';
import { Database, Settings, Lock, FileText, LogOut, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const username = localStorage.getItem('username') || 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('forcePasswordChange');
    
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    
    navigate('/admin/login', { replace: true });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">Welcome, {username}!</CardTitle>
              <CardDescription>
                Manage site content, data, and settings from this panel.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </CardHeader>
        </Card>

        <Tabs defaultValue="settings" className="flex flex-col md:flex-row gap-6">
          <TabsList className="flex md:flex-col md:w-1/4 h-max p-2 bg-muted/50 rounded-lg">
            <TabsTrigger value="settings" className="w-full justify-start gap-2 py-2.5">
              <Settings className="h-4 w-4" /> Site Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="w-full justify-start gap-2 py-2.5">
              <Users className="h-4 w-4" /> User Management
            </TabsTrigger>
            <TabsTrigger value="forex" className="w-full justify-start gap-2 py-2.5">
              <Database className="h-4 w-4" /> Forex Data
            </TabsTrigger>
            <TabsTrigger value="posts" className="w-full justify-start gap-2 py-2.5">
              <FileText className="h-4 w-4" /> Manage Posts
            </TabsTrigger>
            <TabsTrigger value="security" className="w-full justify-start gap-2 py-2.5">
              <Lock className="h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1">
            <TabsContent value="settings">
              <SiteSettings />
            </TabsContent>
            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
            <TabsContent value="forex">
              <ForexDataManagement />
            </TabsContent>
            <TabsContent value="posts">
              <PostsManagement />
            </TabsContent>
            <TabsContent value="security">
              <ChangePasswordForm />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
