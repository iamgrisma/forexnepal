// iamgrisma/forexnepal/forexnepal-892e763f1401a81eb2bc3250b64698c85e1f23bd/src/components/admin/UserManagement.tsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// --- THIS IS THE FIX: Removed DialogFooter and DialogClose from the import ---
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';
import { Loader2, UserPlus, Trash2, AlertCircle, KeyRound, Copy, Mail } from 'lucide-react'; // Removed 'Send' icon, using 'Mail'

interface User {
  username: string;
  email: string | null;
  role: string;
  is_active: number;
  created_at: string;
}

const fetchUsers = async (): Promise<User[]> => {
  const data = await apiClient.get<{ success: boolean; users: User[] }>('/admin/users');
  return data.users || [];
};

const createUser = async (userData: { username: string; email: string; password: string; role: string }) => {
  return await apiClient.post('/admin/users', userData);
};

const deleteUser = async (username: string) => {
  return await apiClient.delete(`/admin/users/${username}`);
};

// --- NEW: Generate Token Function (Admin-only, returns token) ---
// This calls the NEW endpoint you approved, which uses the correct table
const generateResetToken = async (username: string) => {
  return await apiClient.post<{ success: boolean, token: string, username: string, expires_at: string }>(
    '/admin/generate-reset-token', 
    { username }
  );
};

// --- NEW: Send Reset Email Function (Public, no return) ---
// This calls the EXISTING password reset endpoint
const sendResetEmail = async (username: string) => {
  return await apiClient.post('/admin/request-password-reset', { username });
};


const UserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'admin',
  });
  
  // --- NEW: State for the TWO new dialogs ---
  const [actionUser, setActionUser] = useState<User | null>(null); // Holds the user you clicked on
  const [generatedToken, setGeneratedToken] = useState<string | null>(null); // Holds the token to be copied
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null);


  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully!');
      setIsAddUserOpen(false);
      setNewUser({ username: '', email: '', password: '', role: 'admin' });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: (_, username) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User "${username}" deleted successfully!`);
      setShowDeleteConfirm(null);
    },
    onError: (error: Error, username) => {
      toast.error(`Failed to delete "${username}": ${error.message}`);
      setShowDeleteConfirm(null);
    },
  });
  
  // --- NEW: Mutation for GENERATING a token (Option 1) ---
  const generateTokenMutation = useMutation({
    mutationFn: generateResetToken,
    onSuccess: (data) => {
      setGeneratedToken(data.token); // This will open the copy dialog
      setActionUser(null); // Close the action dialog
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate token: ${error.message}`);
    },
  });

  // --- NEW: Mutation for SENDING an email (Option 2) ---
  const sendEmailMutation = useMutation({
    mutationFn: sendResetEmail,
    onSuccess: (_, username) => {
      toast.success(`Login/Reset email sent to ${username}!`);
      setActionUser(null); // Close the action dialog
    },
    onError: (error: Error) => {
      toast.error(`Failed to send email: ${error.message}`);
    },
  });


  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast.error('Username and password are required');
      return;
    }
    if (newUser.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    createMutation.mutate(newUser);
  };

  // --- MODIFIED: Delete handler now just shows dialog ---
  const handleDeleteClick = (user: User) => {
    const currentUser = localStorage.getItem('username');
    if (user.username === currentUser) {
      toast.error('You cannot delete your own account');
      return;
    }
    setShowDeleteConfirm(user);
  };
  
  // --- NEW: Handler for "Generate Token" button ---
  const handleGenerateToken = (username: string) => {
    generateTokenMutation.mutate(username);
  };

  // --- NEW: Handler for "Send Email" button ---
  const handleSendEmail = (username: string) => {
    sendEmailMutation.mutate(username);
  };

  // --- NEW: Handler to copy token to clipboard ---
  const copyTokenToClipboard = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken).then(() => {
      toast.success("Token copied to clipboard!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy token.');
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage admin users and their access levels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage admin users and their access levels.</CardDescription>
            </div>
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new admin user to the system.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="Enter username"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Min 8 characters"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {createMutation.isPending ? 'Creating...' : 'Create User'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              All users currently have admin access. Role-based permissions are not yet enforced.
            </AlertDescription>
          </Alert>

          {!users || users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.username}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email || 'No email'}</TableCell>
                    <TableCell>
                      <span className="capitalize">{user.role}</span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {/* --- MODIFIED: Key button now opens action dialog --- */}
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Generate one-time login code"
                        onClick={() => setActionUser(user)} // <-- Opens the new dialog
                      >
                        <KeyRound className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete user"
                        onClick={() => handleDeleteClick(user)} // <-- Opens delete confirm
                        disabled={deleteMutation.isPending && deleteMutation.variables === user.username}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* --- NEW: Key Actions Dialog (Your 2 Options) --- */}
      <Dialog open={!!actionUser} onOpenChange={(open) => !open && setActionUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Actions for <span className="text-primary">{actionUser?.username}</span></DialogTitle>
            <DialogDescription>
              Choose how to grant access to this user. The token/link will be valid for 1 hour (if generated) or 15 minutes (if emailed).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              onClick={() => handleGenerateToken(actionUser!.username)}
              disabled={generateTokenMutation.isPending}
            >
              {generateTokenMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Generate & Copy Token
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleSendEmail(actionUser!.username)}
              disabled={!actionUser?.email || sendEmailMutation.isPending}
              title={!actionUser?.email ? "This user has no email address." : "Send login link"}
            >
              {sendEmailMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send Login Link via Email
            </Button>
          </div>
          {/* --- THIS IS THE FIX: Replaced DialogFooter/DialogClose with this --- */}
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setActionUser(null)}>
              Cancel
            </Button>
          </div>
          {/* --- END FIX --- */}
        </DialogContent>
      </Dialog>

      {/* --- NEW: Dialog to show generated token for copying --- */}
      <AlertDialog open={!!generatedToken} onOpenChange={(open) => !open && setGeneratedToken(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login Token Generated</AlertDialogTitle>
            <AlertDialogDescription>
              Share this token with the user. It expires in 1 hour and can only be used once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="p-4 bg-muted rounded-md flex items-center justify-between gap-4">
            <code className="text-lg font-mono font-bold tracking-tight break-all">
              {generatedToken}
            </code>
            <Button variant="ghost" size="icon" onClick={copyTokenToClipboard}>
              <Copy className="h-5 w-5" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setGeneratedToken(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* --- NEW: Delete Confirmation Dialog --- */}
      <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user 
              <span className="font-bold text-primary"> {showDeleteConfirm?.username}</span> and all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(showDeleteConfirm!.username)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserManagement;
