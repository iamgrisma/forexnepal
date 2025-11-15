// iamgrisma/forexnepal/forexnepal-3a6e83ee59906891a05be1ef38aac80d81ccf17d/src/components/admin/ApiSettings.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';
import { ApiAccessSetting, ApiAccessLevel } from '@/worker-types';
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
import { toast as sonnerToast } from 'sonner';
import { Loader2, Save, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

// Helper component for the restricted rules input
const RestrictedRulesInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isValidJson, setIsValidJson] = useState(true);

  useEffect(() => {
    // Sync local value if prop changes (e.g., on save/re-fetch)
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    try {
      JSON.parse(newValue);
      setIsValidJson(true);
      onChange(newValue); // Pass valid JSON string up
    } catch {
      setIsValidJson(false);
      // Don't pass up invalid JSON
    }
  };

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      placeholder='["1.1.1.1", "forex.grisma.com.np", "*.example.com"]'
      className={`min-h-[80px] font-mono text-xs ${!isValidJson ? 'border-destructive' : ''}`}
    />
  );
};

// --- THIS IS THE FIX: ---
// Switched from useState/useEffect to react-query for data fetching
// Removed all 'response.data' wrappers to match apiClient

// Type for the API response
type ApiSettingsResponse = {
  success: boolean;
  settings: ApiAccessSetting[];
  error?: string;
};
type ApiSaveResponse = {
  success: boolean;
  message?: string;
  error?: string;
};

// Function to fetch API settings
const fetchApiSettings = async (): Promise<ApiAccessSetting[]> => {
  const response = await apiClient.get<ApiSettingsResponse>('/admin/api-settings');
  if (response.success) {
    return response.settings;
  }
  throw new Error(response.error || 'Failed to fetch settings');
};

export const ApiSettings: React.FC = () => {
  const queryClient = useQueryClient();
  // Local state only holds the *modified* settings
  const [localSettings, setLocalSettings] = useState<ApiAccessSetting[]>([]);

  // Fetch data with react-query
  const { 
    data: settings, 
    isLoading, 
    error 
  } = useQuery<ApiAccessSetting[]>({
    queryKey: ['apiSettings'],
    queryFn: fetchApiSettings,
    onSuccess: (data) => {
      // Initialize local state once data is fetched
      setLocalSettings(data || []);
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Mutation to update settings
  const mutation = useMutation({
    mutationFn: async (updatedSettings: ApiAccessSetting[]) => {
      const response = await apiClient.post<ApiSaveResponse>('/admin/api-settings', updatedSettings);
      if (response.success) {
        return response;
      }
      throw new Error(response.error || 'Failed to save settings');
    },
    onSuccess: (response) => {
      sonnerToast.success(response.message || 'API settings updated successfully!');
      // Invalidate and refetch data from server
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] });
    },
    onError: (err: Error) => {
      sonnerToast.error(`Failed to update settings: ${err.message}`);
    },
  });

  // Handle changes in the form elements
  const handleSettingChange = (
    endpoint: string,
    key: keyof ApiAccessSetting,
    value: string | number
  ) => {
    setLocalSettings((prevSettings) =>
      prevSettings.map((s) =>
        s.endpoint === endpoint ? { ...s, [key]: value } : s
      )
    );
  };

  const handleSaveChanges = () => {
    mutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-center py-8">
        Error loading API settings: {error.message}
      </p>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">API Access Control</h2>
            <p className="text-sm text-muted-foreground">
              Manage access, restrictions, and quotas for all public API endpoints.
            </p>
          </div>
          <Button onClick={handleSaveChanges} disabled={mutation.isPending} className="w-full sm:w-auto">
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Access Level</TableHead>
                <TableHead>
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
                <TableHead>
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
              {localSettings.map((setting) => (
                <TableRow key={setting.endpoint}>
                  <TableCell className="font-mono text-sm">{setting.endpoint}</TableCell>
                  <TableCell>
                    <Select
                      value={setting.access_level}
                      onValueChange={(value: ApiAccessLevel) =>
                        handleSettingChange(setting.endpoint, 'access_level', value)
                      }
                    >
                      <SelectTrigger className="w-[130px]">
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
                      className="w-[140px]"
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
