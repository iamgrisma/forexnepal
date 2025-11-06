import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';

// Types for settings
type SiteSettings = {
  ticker_enabled: boolean;
  adsense_enabled: boolean;
  // We can add more settings here later
  // adsense_pages: string; // e.g., "all", "home,archive"
};

// API functions for settings
const fetchSiteSettings = async (): Promise<SiteSettings> => {
  try {
    const { data } = await apiClient.get('/admin/settings');
    // If no settings exist, return default values
    if (!data) {
      return { ticker_enabled: true, adsense_enabled: false };
    }
    return data;
  } catch (error) {
    // Handle 404 or other errors if settings don't exist yet
    console.warn("Could not fetch settings, returning defaults.");
    return { ticker_enabled: true, adsense_enabled: false };
  }
};

const updateSiteSettings = async (settings: SiteSettings): Promise<SiteSettings> => {
  const { data } = await apiClient.post('/admin/settings', settings);
  return data;
};


const SiteSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SiteSettings>({
    ticker_enabled: true,
    adsense_enabled: false,
  });

  const { data: fetchedSettings, isLoading } = useQuery({
    queryKey: ['siteSettings'],
    queryFn: fetchSiteSettings,
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
    }
  }, [fetchedSettings]);

  const mutation = useMutation({
    mutationFn: updateSiteSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['siteSettings'], data);
      queryClient.invalidateQueries({ queryKey: ['publicSiteSettings'] }); // Invalidate public query
      toast.success('Settings saved successfully!');
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleToggle = (key: keyof SiteSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
          <CardDescription>Manage global site features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>Manage global site features like the ticker and advertising.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
            <Label htmlFor="ticker-enabled" className="flex flex-col space-y-1">
              <span>Forex Ticker</span>
              <span className="font-normal text-sm text-muted-foreground">
                Show the scrolling forex ticker at the top of pages.
              </span>
            </Label>
            <Switch
              id="ticker-enabled"
              checked={settings.ticker_enabled}
              onCheckedChange={() => handleToggle('ticker_enabled')}
            />
          </div>

          <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
            <Label htmlFor="adsense-enabled" className="flex flex-col space-y-1">
              <span>Google AdSense</span>
              <span className="font-normal text-sm text-muted-foreground">
                Enable or disable all AdSense ad units sitewide.
              </span>
            </Label>
            <Switch
              id="adsense-enabled"
              checked={settings.adsense_enabled}
              onCheckedChange={() => handleToggle('adsense_enabled')}
            />
          </div>
          
          {/* Add more settings here in the future */}

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SiteSettings;
