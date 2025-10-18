import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const SiteSettings = () => {
  const [headerTags, setHeaderTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      setIsFetching(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        setIsFetching(false);
        return;
      }
      try {
        const response = await fetch('/api/admin/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to fetch settings");
        const data = await response.json();
        if (data.success) {
          setHeaderTags(data.header_tags || '');
        } else {
            throw new Error(data.error || "Could not load settings");
        }
      } catch (error) {
        console.error("Fetch settings error:", error);
        toast({ title: "Error", description: `Could not load settings: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, [toast]);

  const handleSave = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast({ title: "Error", description: "Authentication expired.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ header_tags: headerTags }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({ title: "Success", description: "Site settings saved successfully." });
      } else {
        throw new Error(data.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Save settings error:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : 'Could not save settings.', variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>Manage global site settings like header tags for analytics or ads.</CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4"> {/* Wrapper for content when not fetching */}
            <Alert>
              <Info className="h-4 w-4" />
              {/* <AlertTitle>Information</AlertTitle> */}
              <AlertDescription>
                Enter HTML tags (like script or meta tags) to be injected into the head section of every page. Use with caution.
              </AlertDescription>
            </Alert> {/* Alert closed */}

            <div> {/* Wrapper for label + textarea */}
              <label htmlFor="headerTags" className="block text-sm font-medium mb-1">Header Tags</label>
              <Textarea
                id="headerTags"
                value={headerTags}
                onChange={(e) => setHeaderTags(e.target.value)}
                placeholder={`<script async src="..."></script>\n<meta name="google-site-verification" content="..." />`}
                rows={10}
                className="font-mono text-xs"
                disabled={isLoading}
              />
            </div> {/* Wrapper closed */}

            <Button onClick={handleSave} disabled={isLoading || isFetching}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div> // Wrapper closed
        )} {/* Conditional rendering correctly closed */}
      </CardContent>
    </Card>
  );
};

export default SiteSettings;
