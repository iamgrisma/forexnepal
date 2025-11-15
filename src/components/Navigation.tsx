// src/components/Navigation.tsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, X, Sun, Moon, Home, BarChart2, Book, Settings, LayoutDashboard, LogOut } from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile'; // Assuming you have this hook

// --- UPDATED: Removed About, Contact, Disclosure, Privacy from main links ---
const navLinks = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/historical-charts', label: 'Charts', Icon: BarChart2 },
  { href: '/posts', label: 'Posts', Icon: Book },
  { href: '/api-docs', label: 'API', Icon: Settings },
];

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useMobile();
  const navigate = useNavigate();

  // Handle theme toggling
  const toggleTheme = () => {
    const isDarkMode = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  };

  // Check for stored theme on load
  React.useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleAdminLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('forcePasswordChange');
    navigate('/admin/login');
  };

  const renderNavLinks = (isMobileSheet = false) => {
    const linkClass = isMobileSheet
      ? 'flex items-center p-3 rounded-md text-lg hover:bg-muted'
      : 'px-3 py-2 text-sm font-medium rounded-md hover:bg-muted dark:hover:bg-muted/50 transition-colors';
    
    const activeClass = isMobileSheet
      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
      : 'bg-primary text-primary-foreground hover:bg-primary/90 dark:hover:bg-primary/90';

    const authToken = localStorage.getItem('authToken');

    return (
      <>
        {navLinks.map((link) => (
          <NavLink
            key={link.label}
            to={link.href}
            className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
            onClick={() => isMobileSheet && setIsMobileMenuOpen(false)}
          >
            {isMobileSheet && <link.Icon className="mr-3 h-5 w-5" />}
            {link.label}
          </NavLink>
        ))}
        {authToken && (
          <>
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}
              onClick={() => isMobileSheet && setIsMobileMenuOpen(false)}
            >
              {isMobileSheet && <LayoutDashboard className="mr-3 h-5 w-5" />}
              Dashboard
            </NavLink>
            <Button
              variant={isMobileSheet ? 'ghost' : 'outline'}
              size="sm"
              className={isMobileSheet ? `${linkClass} text-red-500 hover:bg-red-500/10 hover:text-red-600` : 'ml-2'}
              onClick={() => {
                if (isMobileSheet) setIsMobileMenuOpen(false);
                handleAdminLogout();
              }}
            >
              {isMobileSheet && <LogOut className="mr-3 h-5 w-5" />}
              Logout
            </Button>
          </>
        )}
      </>
    );
  };

  return (
    <nav className="bg-card dark:bg-card/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl font-bold text-primary flex items-center">
              <img src="/icon-192.png" alt="Forex Nepal Logo" className="h-8 w-8 mr-2" />
              ForexNepal
            </Link>
          </div>

          {/* Desktop Nav */}
          {!isMobile && (
            <div className="hidden md:flex md:items-center md:space-x-1">
              {renderNavLinks(false)}
            </div>
          )}
          
          <div className="flex items-center">
             {/* Theme Toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="mr-2">
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* Mobile Menu Button */}
            {isMobile && (
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-80 p-4">
                  <div className="flex flex-col space-y-3 pt-8">
                    {renderNavLinks(true)}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navigation;
