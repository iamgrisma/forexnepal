
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, BarChart, Home, BookOpen, User, Phone } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 mb-8 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 py-1.5 rounded-lg font-bold text-lg shadow-md hover:shadow-lg transition-shadow">
                Forex NPR
              </div>
            </Link>
            <div className="hidden md:flex space-x-2 ml-8">
              <NavLink to="/" active={location.pathname === '/'}>
                <Home className="h-4 w-4 mr-1" />
                Home
              </NavLink>
              <NavLink to="/converter" active={location.pathname === '/converter'}>
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Converter
              </NavLink>
              <NavLink to="/about" active={location.pathname === '/about'}>
                <User className="h-4 w-4 mr-1" />
                About
              </NavLink>
              <ExternalNavLink href="https://grisma.com.np">
                <BookOpen className="h-4 w-4 mr-1" />
                Blogs
              </ExternalNavLink>
              <ExternalNavLink href="https://grisma.com.np/contact">
                <Phone className="h-4 w-4 mr-1" />
                Contact
              </ExternalNavLink>
            </div>
          </div>
          
          <div className="md:hidden flex space-x-1">
            <NavLink to="/" active={location.pathname === '/'}>
              <Home className="h-4 w-4" />
            </NavLink>
            <NavLink to="/converter" active={location.pathname === '/converter'}>
              <ArrowRightLeft className="h-4 w-4" />
            </NavLink>
            <NavLink to="/about" active={location.pathname === '/about'}>
              <User className="h-4 w-4" />
            </NavLink>
            <ExternalNavLink href="https://grisma.com.np/contact">
              <Phone className="h-4 w-4" />
            </ExternalNavLink>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t">
        <div className="grid grid-cols-4 divide-x">
          <NavLink 
            to="/" 
            active={location.pathname === '/'} 
            className="justify-center text-center py-2"
          >
            <Home className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">Home</span>
          </NavLink>
          <NavLink 
            to="/converter" 
            active={location.pathname === '/converter'} 
            className="justify-center text-center py-2"
          >
            <ArrowRightLeft className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">Converter</span>
          </NavLink>
          <NavLink 
            to="/about" 
            active={location.pathname === '/about'} 
            className="justify-center text-center py-2"
          >
            <User className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">About</span>
          </NavLink>
          <ExternalNavLink 
            href="https://grisma.com.np/contact" 
            className="justify-center text-center py-2"
          >
            <Phone className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">Contact</span>
          </ExternalNavLink>
        </div>
      </div>
    </nav>
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
