import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { KeyRound, Newspaper, Settings, CandlestickChart, LogOut, DatabaseZap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Import the components for each tab
import ChangePasswordForm from '@/components/admin/ChangePasswordForm';
import PostsManagement from '@/components/admin/PostsManagement';
import SiteSettings from '@/components/admin/SiteSettings';
import ForexDataManagement from '@/components/admin/ForexDataManagement';
import BackfillManager from '@/components/admin/BackfillManager'; // Import the new component

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const username = localStorage.getItem('username') || 'Admin';

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
    navigate('/admin/login');
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card className="shadow-lg border-primary/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold">Admin Dashboard</CardTitle>
                <CardDescription>Welcome, {username}! Manage your site content here.</CardDescription>
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6">
                  <TabsTrigger value="posts"><Newspaper className="h-4 w-4 mr-2" />Posts</TabsTrigger>
                  <TabsTrigger value="forex"><CandlestickChart className="h-4 w-4 mr-2" />Forex Data</TabsTrigger>
                  <TabsTrigger value="backfill"><DatabaseZap className="h-4 w-4 mr-2" />Backfill</TabsTrigger>
                  <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Site Settings</TabsTrigger>
                  <TabsTrigger value="password"><KeyRound className="h-4 w-4 mr-2" />Password</TabsTrigger>
                </TabsList>

                <TabsContent value="posts">
                  <PostsManagement />
                </TabsContent>
                <TabsContent value="forex">
                   <ForexDataManagement />
                </TabsContent>
                <TabsContent value="backfill">
                   <BackfillManager />
                </TabsContent>
                <TabsContent value="settings">
                  <SiteSettings />
                </TabsContent>
                <TabsContent value="password">
                  <ChangePasswordForm />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
