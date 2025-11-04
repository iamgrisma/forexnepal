import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
// Import icons
import { ArrowRightLeft, BarChart, Home, BookOpen, User, Phone, BookText, Shield, FileText, ChevronRight } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  return (
    <>
      {/* Desktop/Scrollable Mobile Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 md:sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <Link to="/" className="flex items-center flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transition-shadow">
                ForexNepal
              </div>
            </Link>

            {/* Desktop Navigation - Hidden on small screens */}
            <div className="hidden md:flex items-center space-x-1 flex-1 justify-end">
              <NavLink to="/" active={location.pathname === '/'}>
                <Home className="h-4 w-4 mr-2" />
                Home
              </NavLink>
              <NavLink to="/archive" active={location.pathname.startsWith('/archive') || location.pathname.startsWith('/daily-update/')}>
                <BookOpen className="h-4 w-4 mr-2" />
                Daily Archive
              </NavLink>
              <NavLink to="/posts" active={location.pathname === '/posts' || location.pathname.startsWith('/posts/')}>
                  <BookText className="h-4 w-4 mr-2" />
                  Posts
              </NavLink>
              <NavLink to="/historical-charts" active={location.pathname === '/historical-charts' || location.pathname.startsWith('/historical-data')}>
                <BarChart className="h-4 w-4 mr-2" />
                Charts
              </NavLink>
              <NavLink to="/converter" active={location.pathname === '/converter'}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Converter
              </NavLink>
              <NavLink to="/about" active={location.pathname === '/about'}>
                <User className="h-4 w-4 mr-2" />
                About
              </NavLink>
              <NavLink to="/contact" active={location.pathname === '/contact'}>
                <Phone className="h-4 w-4 mr-2" />
                Contact
              </NavLink>
              <NavLink to="/disclosure" active={location.pathname === '/disclosure'}>
                <FileText className="h-4 w-4 mr-2" />
                Disclosure
              </NavLink>
              <NavLink to="/privacy-policy" active={location.pathname === '/privacy-policy'}>
                <Shield className="h-4 w-4 mr-2" />
                Privacy
              </NavLink>
              <ExternalNavLink href="https://grisma.com.np">
                <BookOpen className="h-4 w-4 mr-2" />
                Grisma Blog
              </ExternalNavLink>
            </div>

            {/* Mobile Navigation - Horizontal Scroll with indicator */}
            <div className="relative flex md:hidden items-center flex-1 overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide flex items-center space-x-1 scroll-smooth snap-x snap-mandatory">
                <NavLink to="/" active={location.pathname === '/'}>
                  <Home className="h-4 w-4 mr-1" />
                  <span className="text-xs">Home</span>
                </NavLink>
                <NavLink to="/archive" active={location.pathname.startsWith('/archive') || location.pathname.startsWith('/daily-update/')}>
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span className="text-xs">Archive</span>
                </NavLink>
                <NavLink to="/posts" active={location.pathname === '/posts' || location.pathname.startsWith('/posts/')}>
                  <BookText className="h-4 w-4 mr-1" />
                  <span className="text-xs">Posts</span>
                </NavLink>
                <NavLink to="/historical-charts" active={location.pathname === '/historical-charts' || location.pathname.startsWith('/historical-data')}>
                  <BarChart className="h-4 w-4 mr-1" />
                  <span className="text-xs">Charts</span>
                </NavLink>
                <NavLink to="/converter" active={location.pathname === '/converter'}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  <span className="text-xs">Convert</span>
                </NavLink>
                <NavLink to="/about" active={location.pathname === '/about'}>
                  <User className="h-4 w-4 mr-1" />
                  <span className="text-xs">About</span>
                </NavLink>
                <NavLink to="/contact" active={location.pathname === '/contact'}>
                  <Phone className="h-4 w-4 mr-1" />
                  <span className="text-xs">Contact</span>
                </NavLink>
              </div>
              {/* Scroll indicator - shows user can scroll */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/90 to-transparent pointer-events-none flex items-center justify-end pr-1">
                <ChevronRight className="h-4 w-4 text-gray-400 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - UPDATED Order */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-5 divide-x divide-gray-200">
          <NavLink
            to="/posts"
            active={location.pathname === '/posts' || location.pathname.startsWith('/posts/')}
            className="flex flex-col items-center justify-center py-3 px-1 text-center"
          >
            <BookText className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium leading-tight">Posts</span>
          </NavLink>
          <NavLink
            to="/archive"
            active={location.pathname.startsWith('/archive') || location.pathname.startsWith('/daily-update/')}
            className="flex flex-col items-center justify-center py-3 px-1 text-center"
          >
            <BookOpen className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium leading-tight">Archive</span>
          </NavLink>
          <NavLink
            to="/"
            active={location.pathname === '/'}
            className="flex flex-col items-center justify-center py-3 px-1 text-center"
          >
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium leading-tight">Home</span>
          </NavLink>
          <NavLink
            to="/historical-charts"
            active={location.pathname === '/historical-charts' || location.pathname.startsWith('/historical-data')}
            className="flex flex-col items-center justify-center py-3 px-1 text-center"
          >
            <BarChart className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium leading-tight">Charts</span>
          </NavLink>
          <NavLink
            to="/converter"
            active={location.pathname === '/converter'}
            className="flex flex-col items-center justify-center py-3 px-1 text-center"
          >
            <ArrowRightLeft className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium leading-tight">Convert</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
};

// NavLink and ExternalNavLink remain the same as provided
interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

const NavLink = ({ to, active, children, className }: NavLinkProps) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap", // Added whitespace-nowrap
        active
          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
          : "text-gray-700 hover:text-blue-600 hover:bg-blue-50",
        className
      )}
    >
      {children}
    </Link>
  );
};

interface ExternalNavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

const ExternalNavLink = ({ href, children, className }: ExternalNavLinkProps) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap", // Added whitespace-nowrap
        "text-gray-700 hover:text-blue-600 hover:bg-blue-50",
        className
      )}
    >
      {children}
    </a>
  );
};
export default Navigation;
