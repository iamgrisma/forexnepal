// src/components/admin/ApiSettings.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/ProtectedRoute';
import { apiClient } from '@/services/apiClient';
import { ApiAccessSetting, ApiAccessLevel } from '@/worker-types'; // Assuming types are accessible
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Helper component for the restricted rules input
const RestrictedRulesInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isValidJson, setIsValidJson] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    try {
      JSON.parse(newValue);
      setIsValidJson(true);
      onChange(newValue);
    } catch {
      setIsValidJson(false);
      // Don't call onChange if invalid, or decide if you want to
    }
  };

  const handleBlur = () => {
    if (!isValidJson) {
      // Revert to original value if invalid on blur
      setLocalValue(value);
      setIsValidJson(true);
    } else {
      onChange(localValue); // Ensure parent has the latest valid value
    }
  };

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder='["1.1.1.1", "forex.grisma.com.np", "*.example.com"]'
      className={`min-h-[80px] font-mono text-xs ${!isValidJson ? 'border-red-500' : ''}`}
    />
  );
};

export const ApiSettings: React.FC = () => {
  const [settings, setSettings] = useState<ApiAccessSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { token } = useAuth();
  const { toast } = useToast();

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/admin/api-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setSettings(response.data.settings);
      } else {
        throw new Error(response.data.error || 'Failed to fetch settings');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not fetch API settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const handleSettingChange = (
    endpoint: string,
    key: keyof ApiAccessSetting,
    value: string | number
  ) => {
    setSettings((prevSettings) =>
      prevSettings.map((s) =>
        s.endpoint === endpoint ? { ...s, [key]: value } : s
      )
    );
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await apiClient.post('/admin/api-settings', settings, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        toast({
          title: 'Success',
          description: 'API settings saved and cache cleared.',
        });
        fetchSettings(); // Refresh data
      } else {
        throw new Error(response.data.error || 'Failed to save settings');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not save API settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading API Settings...</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">API Access Control</h2>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage access levels, restrictions, and quotas for all public API endpoints.
          Changes may take up to 5 minutes to apply (due to caching).
        </p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Endpoint</TableHead>
                <TableHead className="w-[150px]">Access Level</TableHead>
                <TableHead className="w-1/4">
                  <div className="flex items-center">
                    Allowed Rules (IP/Domain)
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Only applies if Access Level is 'restricted'.
                          <br />
                          Enter a valid JSON array of strings.
                          <br />
                          E.g: ["1.1.1.1", "yourdomain.com", "*.yourdomain.com"]
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="w-[150px]">
                  Quota (req/hr)
                  <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Info className="ml-2 h-4 w-4 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Requests per hour per identifier (IP/Domain).
                        <br/>
                        Enter -1 for unlimited quota.</p>
                      </TooltipContent>
                  </Tooltip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((setting) => (
                <TableRow key={setting.endpoint}>
                  <TableCell className="font-mono text-sm">{setting.endpoint}</TableCell>
                  <TableCell>
                    <Select
                      value={setting.access_level}
                      onValueChange={(value: ApiAccessLevel) =>
                        handleSettingChange(setting.endpoint, 'access_level', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="restricted">Restricted</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <RestrictedRulesInput
                      value={setting.allowed_rules || '[]'}
                      onChange={(value) =>
                        handleSettingChange(setting.endpoint, 'allowed_rules', value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={setting.quota_per_hour}
                      onChange={(e) =>
                        handleSettingChange(
                          setting.endpoint,
                          'quota_per_hour',
                          parseInt(e.target.value, 10) || -1
                        )
                      }
                      placeholder="-1 for unlimited"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ApiSettings;
