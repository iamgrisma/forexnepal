import { NavLink, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, X, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from 'react';

// Main navigation items
const navItems = [
  { to: '/', label: 'Home' },
  { to: '/converter', label: 'Converter' },
  { to: '/historical-charts', label: 'Charts' },
  { to: '/archive', label: 'Archive' },
  { to: '/api', label: 'API' }, // --- ADDED THIS LINE ---
  { to: '/posts', label: 'News' },
  { to: '/about', label: 'About' },
];

// Secondary/footer navigation items
const secondaryNavItems = [
  { to: '/contact', label: 'Contact' },
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/disclosure', label: 'Disclosure' },
];

// Theme toggle hook
const useTheme = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
};

// Theme toggle button component
const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
};

// Main navigation component
const Navigation = () => {
  const location = useLocation();

  const renderNavLinks = (isMobile = false) => {
    const linkClass = isMobile
      ? "block px-4 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-100"
      : "px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100";
    
    const activeLinkClass = isMobile
      ? "block px-4 py-2 rounded-md text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
      : "px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90";

    return navItems.map((item) => (
      <SheetClose asChild key={item.to}>
        <NavLink
          to={item.to}
          className={location.pathname === item.to ? activeLinkClass : linkClass}
        >
          {item.label}
        </NavLink>
      </SheetClose>
    ));
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / Brand */}
          <div className="flex-shrink-0 flex items-center">
            <NavLink to="/" className="flex items-center space-x-2">
              <img 
                src="/icon-192.png" 
                alt="ForexNepal Logo" 
                className="h-8 w-8"
              />
              <span className="font-bold text-xl text-gray-900">ForexNepal</span>
            </NavLink>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:space-x-4">
            {renderNavLinks(false)}
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full max-w-xs">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-lg">Menu</span>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon">
                      <X className="h-6 w-6" />
                    </Button>
                  </SheetClose>
                </div>
                <div className="flex flex-col space-y-2">
                  {renderNavLinks(true)}
                  
                  {/* --- Mobile Secondary Links --- */}
                  <div className="pt-4 mt-4 border-t">
                    {secondaryNavItems.map((item) => (
                      <SheetClose asChild key={item.to}>
                        <NavLink
                          to={item.to}
                          className={cn(
                            "block px-4 py-2 rounded-md text-base font-medium text-gray-500 hover:bg-gray-100",
                            location.pathname === item.to && "text-primary"
                          )}
                        >
                          {item.label}
                        </NavLink>
                      </SheetClose>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          
        </div>
      </nav>
    </header>
  );
};

export default Navigation;
export { navItems, secondaryNavItems, ThemeToggle };
