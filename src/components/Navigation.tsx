// src/components/Navigation.tsx
import React from 'react';
import { NavLink, useNavigate }'react-router-dom';
import { Home, Archive, BarChart2, FileText, Cpu, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/components/ProtectedRoute'; // Import useAuth
import { useToast } from '@/hooks/use-toast';

// Helper component for NavLink
const NavItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`
    }
  >
    {children}
  </NavLink>
);

// Helper for Sheet NavLink
const SheetNavItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <SheetClose asChild>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  </SheetClose>
);

// --- 1. Desktop Navigation ---
const DesktopNavigation = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast({ title: "Logged out successfully." });
    navigate('/');
  };

  const navLinks = [
    { to: '/', icon: <Home className="h-4 w-4" />, label: 'Home' },
    { to: '/archive', icon: <Archive className="h-4 w-4" />, label: 'Archive' },
    { to: '/historical-charts', icon: <BarChart2 className="h-4 w-4" />, label: 'Charts' },
    { to: '/posts', icon: <FileText className="h-4 w-4" />, label: 'Blogs' },
    { to: '/api-docs', icon: <Cpu className="h-4 w-4" />, label: 'API' },
  ];

  return (
    <nav className="hidden md:flex items-center space-x-4">
      {navLinks.map((link) => (
        <NavItem key={link.to} to={link.to}>
          {link.icon}
          <span>{link.label}</span>
        </NavItem>
      ))}
      {isAuthenticated && (
        <>
          <NavItem to="/admin/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </NavItem>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </>
      )}
    </nav>
  );
};

// --- 2. Mobile Top Navigation (Hamburger Menu) ---
const MobileSheetNavigation = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleLogout = () => {
    logout();
    toast({ title: "Logged out successfully." });
    navigate('/');
  };
  
  const navLinks = [
    { to: '/', icon: <Home className="h-5 w-5" />, label: 'Home' },
    { to: '/archive', icon: <Archive className="h-5 w-5" />, label: 'Archive' },
    { to: '/historical-charts', icon: <BarChart2 className="h-5 w-5" />, label: 'Charts' },
    { to: '/posts', icon: <FileText className="h-5 w-5" />, label: 'Blogs' },
    { to: '/api-docs', icon: <Cpu className="h-5 w-5" />, label: 'API' },
  ];

  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <div className="flex flex-col space-y-4 py-6">
            <div className="px-2 space-y-1">
              {navLinks.map((link) => (
                <SheetNavItem key={link.to} to={link.to}>
                  {link.icon}
                  <span>{link.label}</span>
                </SheetNavItem>
              ))}
            </div>
            
            {/* Conditional Admin Links */}
            {isAuthenticated && (
              <>
                <div className="border-t border-border pt-4">
                  <div className="px-2 space-y-1">
                    <SheetNavItem to="/admin/dashboard">
                      <LayoutDashboard className="h-5 w-5" />
                      <span>Dashboard</span>
                    </SheetNavItem>
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="w-full justify-start space-x-3 px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// --- 3. Mobile Bottom Navigation ---
const MobileBottomNavigation = () => {
  const navLinks = [
    { to: '/', icon: <Home className="h-5 w-5" />, label: 'Home' },
    { to: '/archive', icon: <Archive className="h-5 w-5" />, label: 'Archive' },
    { to: '/historical-charts', icon: <BarChart2 className="h-5 w-5" />, label: 'Charts' },
    { to: '/posts', icon: <FileText className="h-5 w-5" />, label: 'Blogs' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
      <div className="flex justify-around items-center h-16">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end // Ensure 'Home' link is only active for exact path
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-primary'
              }`
            }
          >
            {link.icon}
            <span className="text-xs font-medium">{link.label}</span>
          </NavLink>
        ))}
        {/* Hamburger menu trigger is part of the bottom bar */}
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center w-full text-muted-foreground hover:text-primary">
              <Menu className="h-5 w-5" />
              <span className="text-xs font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <div className="flex flex-col space-y-4 py-6">
              <div className="px-2 space-y-1">
                {/* Re-list links for the sheet */}
                {navLinks.map((link) => (
                  <SheetNavItem key={link.to} to={link.to}>
                    {link.icon}
                    <span>{link.label}</span>
                  </SheetNavItem>
                ))}
                {/* 'More' links */}
                <SheetNavItem to="/api-docs">
                  <Cpu className="h-5 w-5" />
                  <span>API</span>
                </SheetNavItem>
                {/* You can add more links here like Contact, About etc. */}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
};

// --- Main Navigation Component ---
export const Navigation = () => {
  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-7xl items-center justify-between">
          <NavLink to="/" className="flex items-center space-x-2">
            <img src="/icon-192.png" alt="Forex Nepal Logo" className="h-8 w-8" />
            <span className="font-bold text-lg">Forex Nepal</span>
          </NavLink>
          
          {/* Render Desktop Nav */}
          <DesktopNavigation />
          
          {/* Render Mobile Hamburger (for top bar, but it's part of the bottom bar now) */}
          {/* We'll use a placeholder div for spacing if needed, but DesktopNavigation is hidden on mobile */}
          <div className="md:hidden" />
        </div>
      </header>
      
      {/* Render Mobile Bottom Nav */}
      <MobileBottomNavigation />
    </>
  );
};
