
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, BarChart, Home, BookOpen, User, Phone } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <>
      {/* Desktop Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center gap-8">
            <Link to="/" className="flex items-center flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transition-shadow">
                ForexNepal
              </div>
            </Link>
            
            <div className="hidden md:flex items-center space-x-1 flex-1 justify-end">
              <NavLink to="/" active={location.pathname === '/'}>
                <Home className="h-4 w-4 mr-2" />
                Home
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
              <ExternalNavLink href="https://grisma.com.np">
                <BookOpen className="h-4 w-4 mr-2" />
                Blog
              </ExternalNavLink>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-lg z-50">
        <div className="grid grid-cols-5 divide-x divide-gray-200">
          <NavLink 
            to="/about" 
            active={location.pathname === '/about'} 
            className="flex flex-col items-center justify-center py-3 px-2"
          >
            <User className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">About</span>
          </NavLink>
          <NavLink 
            to="/contact" 
            active={location.pathname === '/contact'} 
            className="flex flex-col items-center justify-center py-3 px-2"
          >
            <Phone className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Contact</span>
          </NavLink>
          <NavLink 
            to="/" 
            active={location.pathname === '/'} 
            className="flex flex-col items-center justify-center py-3 px-2"
          >
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>
          <NavLink 
            to="/historical-charts" 
            active={location.pathname === '/historical-charts' || location.pathname.startsWith('/historical-data')} 
            className="flex flex-col items-center justify-center py-3 px-2"
          >
            <BarChart className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Charts</span>
          </NavLink>
          <NavLink 
            to="/converter" 
            active={location.pathname === '/converter'} 
            className="flex flex-col items-center justify-center py-3 px-2"
          >
            <ArrowRightLeft className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Converter</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
};

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
        "flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
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
        "flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
        "text-gray-700 hover:text-blue-600 hover:bg-blue-50",
        className
      )}
    >
      {children}
    </a>
  );
};

export default Navigation;
