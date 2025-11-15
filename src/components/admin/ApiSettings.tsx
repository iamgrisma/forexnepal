// iamgrisma/forexnepal/forexnepal-3a6e83ee59906891a05be1ef38aac80d81ccf17d/src/components/admin/ApiSettings.tsx
import React, { useState } from 'react';
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
import { toast as sonnerToast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Function to fetch API settings
const fetchApiSettings = async (): Promise<ApiAccessSetting[]> => {
  // --- THIS IS THE FIX ---
  // Was: '/admin/settings' (incorrect)
  // Is Now: '/admin/api-settings' (correct)
  return await apiClient.get('/admin/api-settings');
};

const ApiSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<ApiAccessSetting[]>([]);

  // Fetch data
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
  });

  // Mutation to update settings
  const mutation = useMutation({
    mutationFn: async (updatedSettings: ApiAccessSetting[]) => {
      // --- THIS IS THE FIX ---
      // Was: '/admin/settings' (incorrect)
      // Is Now: '/admin/api-settings' (correct)
      return await apiClient.post('/admin/api-settings', updatedSettings);
    },
    onSuccess: () => {
      sonnerToast.success('API settings updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['apiSettings'] });
    },
    onError: (err: Error) => {
      sonnerToast.error(`Failed to update settings: ${err.message}`);
    },
  });

  // Handle changes in the form elements
  const handleChange = (
    endpoint: string,
    field: keyof ApiAccessSetting,
    value: string | number | string[]
  ) => {
    setLocalSettings((prev) =>
      prev.map((setting) =>
        setting.endpoint === endpoint ? { ...setting, [field]: value } : setting
      )
    );
  };

  const handleSave = () => {
    mutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-destructive text-center py-8">
        Error loading API settings: {error.message}.
        <br />
        <span className="text-sm text-muted-foreground">
          (The backend endpoint <code className="mx-1 px-1 bg-muted rounded">GET /api/admin/api-settings</code> might be failing)
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Endpoint</TableHead>
            <TableHead>Access Level</TableHead>
            <TableHead>Allowed Rules (JSON)</TableHead>
            <TableHead>Quota/Hour</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {localSettings.map((setting) => (
            <TableRow key={setting.endpoint}>
              <TableCell className="font-mono">{setting.endpoint}</TableCell>
              <TableCell>
                <Select
                  value={setting.access_level}
                  onValueChange={(value: ApiAccessLevel) =>
                    handleChange(setting.endpoint, 'access_level', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  className="font-mono"
                  value={setting.allowed_rules}
                  onChange={(e) =>
                    handleChange(setting.endpoint, 'allowed_rules', e.target.value)
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={setting.quota_per_hour}
                  onChange={(e) =>
                    handleChange(
                      setting.endpoint,
                      'quota_per_hour',
                      parseInt(e.target.value, 10)
                    )
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default ApiSettings;
