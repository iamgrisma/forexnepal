import React from 'react';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import PostsManagement from '@/components/admin/PostsManagement';
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';
import SiteSettings from '@/components/admin/SiteSettings'; // Import the new component
import { Database, Settings, Lock, FileText } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Admin Dashboard</CardTitle>
            <CardDescription>
              Manage site content, data, and settings from this panel.
            </CardDescription>
          </CardHeader>
        </Card>

        <Tabs defaultValue="settings" className="flex flex-col md:flex-row gap-6">
          <TabsList className="flex md:flex-col md:w-1/4 h-max">
            <TabsTrigger value="settings" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" /> Site Settings
            </TabsTrigger>
            <TabsTrigger value="forex" className="w-full justify-start gap-2">
              <Database className="h-4 w-4" /> Forex Data
            </TabsTrigger>
            <TabsTrigger value="posts" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" /> Manage Posts
            </TabsTrigger>
            <TabsTrigger value="security" className="w-full justify-start gap-2">
              <Lock className="h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1">
            <TabsContent value="settings">
              <SiteSettings />
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
