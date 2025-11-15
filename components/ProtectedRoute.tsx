// src/components/ProtectedRoute.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import Layout from './Layout';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/services/apiClient';

// --- Define the Auth Context ---
interface AuthContextType {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// --- Create the useAuth hook ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Updated ProtectedRoute component ---
const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('authToken')
  );
  const [username, setUsername] = useState<string | null>(
    localStorage.getItem('username')
  );
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        // --- THIS IS THE FIX ---
        // apiClient.get() will throw an error if the request fails (e.g., 401 Unauthorized).
        // If it does *not* throw, the token is valid.
        await apiClient.get<any>('/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // If the request was successful, we are authenticated.
        setIsAuthenticated(true);
        
        // --- END OF FIX ---

      } catch (error) {
        // If apiClient.get throws (due to 401, 500, or network error), we land here.
        console.error('Auth verification failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('username');
        setToken(null);
        setUsername(null);
        setIsAuthenticated(false);
      }
    };

    verifyAuth();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setIsAuthenticated(false);
    navigate('/admin/login');
  };

  // --- Memoize the context value ---
  const authContextValue = useMemo(
    () => ({
      token,
      username,
      isAuthenticated: isAuthenticated === true,
      logout: handleLogout,
    }),
    [token, username, isAuthenticated]
  );

  if (isAuthenticated === null) {
    // Show loading state while checking auth
    return (
      <Layout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    // If not authenticated, redirect to login
    return <Navigate to="/admin/login" replace />;
  }

  // --- Wrap Outlet with AuthContext.Provider ---
  // This makes the `useAuth` hook work for all child components
  return (
    <AuthContext.Provider value={authContextValue}>
      <Outlet />
    </AuthContext.Provider>
  );
};

export default ProtectedRoute;
