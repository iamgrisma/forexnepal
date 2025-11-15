// src/components/Navigation.tsx
import React from 'react';
// --- FIX: Added 'from' keyword ---
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Archive, BarChart2, FileText, Cpu, LayoutDashboard, LogOut, Menu, BookOpen, ArrowRightLeft, User, Phone, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/components/ProtectedRoute'; // Import useAuth
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

// Helper component for NavLink
const NavItem = ({ to, children, end = false }: { to: string; children: React.ReactNode; end?: boolean }) => (
  <NavLink
    to={to}
    end={end} // Add end prop for Home
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
const SheetNavItem = ({ to, children, end = false }: { to: string; children: React.ReactNode; end?: boolean }) => (
  <SheetClose asChild>
    <NavLink
      to={to}
      end={end} // Add end prop for Home
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

  // --- FIX: Restored all correct navigation links ---
  const navLinks = [
    { to: '/', icon: <Home className="h-4 w-4" />, label: 'Home', end: true },
    { to: '/archive', icon: <Archive className="h-4 w-4" />, label: 'Archive' },
    { to: '/historical-charts', icon: <BarChart2 className="h-4 w-4" />, label: 'Charts' },
    { to: '/posts', icon: <BookOpen className="h-4 w-4" />, label: 'Blogs' },
    { to: '/api-docs', icon: <Cpu className="h-4 w-4" />, label: 'API' },
  ];

  return (
    <nav className="hidden md:flex items-center space-x-4">
      {navLinks.map((link) => (
        <NavItem key={link.to} to={link.to} end={link.end}>
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

// --- 2. Mobile Sheet Navigation (for 'More' button) ---
const MobileSheetNavigation = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const handleLogout = () => {
    logout();
    toast({ title: "Logged out successfully." });
    navigate('/');
  };
  
  // --- FIX: Links for the "More" sheet ---
  const navLinks = [
    { to: '/converter', icon: <ArrowRightLeft className="h-5 w-5" />, label: 'Converter' },
    { to: '/api-docs', icon: <Cpu className="h-5 w-5" />, label: 'API' },
    { to: '/about', icon: <User className="h-5 w-5" />, label: 'About' },
    { to: '/contact', icon: <Phone className="h-5 w-5" />, label: 'Contact' },
    { to: '/disclosure', icon: <FileText className="h-5 w-5" />, label: 'Disclosure' },
    { to: '/privacy', icon: <Shield className="h-5 w-5" />, label: 'Privacy' },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="flex flex-col items-center justify-center w-full text-muted-foreground hover:text-primary pt-3 pb-2">
          <Menu className="h-5 w-5" />
          <span className="text-xs font-medium">More</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto">
        <div className="flex flex-col space-y-4 py-6">
          <div className="px-2 grid grid-cols-3 gap-4">
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
                <div className="px-2 grid grid-cols-3 gap-4">
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
  );
};

// --- 3. Mobile Bottom Navigation ---
const MobileBottomNavigation = () => {
  const location = useLocation();

  // --- FIX: Restored correct bottom bar links ---
  const navLinks = [
    { to: '/', icon: <Home className="h-5 w-5" />, label: 'Home', end: true },
    { to: '/archive', icon: <Archive className="h-5 w-5" />, label: 'Archive' },
    { to: '/historical-charts', icon: <BarChart2 className="h-5 w-5" />, label: 'Charts' },
    { to: '/posts', icon: <BookOpen className="h-5 w-5" />, label: 'Blogs' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border shadow-lg z-30">
      <div className="flex justify-around items-center h-16">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full transition-colors pt-3 pb-2 ${
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
        {/* 'More' button that opens the sheet */}
        <MobileSheetNavigation />
      </div>
    </nav>
  );
};

// --- Main Navigation Component ---
export const Navigation = () => {
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-7xl items-center justify-between">
          <NavLink to="/" className="flex items-center space-x-2 mr-6" end>
            <img src="/icon-192.png" alt="Forex Nepal Logo" className="h-8 w-8" />
            <span className="font-bold text-lg hidden sm:inline-block">Forex Nepal</span>
          </NavLink>
          
          {/* Render Desktop Nav */}
          <div className="flex-1 flex justify-end">
            <DesktopNavigation />
          </div>
        </div>
      </header>
      
      {/* Render Mobile Bottom Nav (for phones) */}
      <MobileBottomNavigation />
    </>
  );
};
