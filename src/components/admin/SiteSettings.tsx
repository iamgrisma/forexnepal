// src/components/admin/SiteSettings.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea'; // <-- IMPORT Textarea
import { Label } from '@/components/ui/label';       // <-- IMPORT Label
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

// --- UPDATED: Added adsense_exclusions ---
interface SiteSettings {
  ticker_enabled: boolean;
  adsense_enabled: boolean;
  adsense_exclusions: string; // new field
}

const SiteSettingsComponent = () => {
  const [settings, setSettings] = useState<SiteSettings>({
    ticker_enabled: false,
    adsense_enabled: false,
    adsense_exclusions: '/admin,/login', // default
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<SiteSettings>('/admin/settings');
        // --- UPDATED: Ensure exclusions are not null/undefined ---
        setSettings({
            ...data,
            adsense_exclusions: data.adsense_exclusions || '/admin,/login',
        });
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load settings.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedSettings = await apiClient.post<SiteSettings>('/admin/settings', settings);
      setSettings(savedSettings);
      toast({ title: "Success", description: "Settings saved successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
          <CardDescription>Loading site configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>Manage global site configuration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2">
          <div>
            <Label htmlFor="ticker-enabled">Forex Ticker</Label>
            <p className="text-sm text-muted-foreground">Enable or disable the live forex ticker bar at the top of the site.</p>
          </div>
          {/* --- FIX: Added checked and onCheckedChange --- */}
          <Switch
            id="ticker-enabled"
            checked={settings.ticker_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ticker_enabled: checked }))}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between space-x-2">
          <div>
            <Label htmlFor="adsense-enabled">Enable AdSense</Label>
            <p className="text-sm text-muted-foreground">Enable or disable Google AdSense ads across the site.</p>
          </div>
          {/* --- FIX: Added checked and onCheckedChange --- */}
          <Switch
            id="adsense-enabled"
            checked={settings.adsense_enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, adsense_enabled: checked }))}
            disabled={saving}
          />
        </div>

        {/* --- NEW FEATURE: AdSense Exclusion Input --- */}
        <div className="space-y-2">
          <Label htmlFor="adsense-exclusions">AdSense Exclusions</Label>
          <p className="text-sm text-muted-foreground">
            Paths where ads should NOT be shown. Separate with commas.
            e.g., <strong>/admin,/login,/admin/posts</strong>
          </p>
          <Textarea
            id="adsense-exclusions"
            placeholder="/admin,/login"
            value={settings.adsense_exclusions}
            onChange={(e) => setSettings(prev => ({ ...prev, adsense_exclusions: e.target.value }))}
            disabled={saving}
          />
        </div>
        {/* --- END NEW FEATURE --- */}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SiteSettingsComponent;
