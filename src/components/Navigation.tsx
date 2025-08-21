
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, BarChart, Home, BookOpen, User } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();
  
  return (
    <nav className="bg-background border-b mb-6">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold mr-6">Forex NPR</h1>
            <div className="hidden md:flex space-x-4">
              <NavLink to="/" active={location.pathname === '/'}>
                <Home className="h-4 w-4 mr-1" />
                Home
              </NavLink>
              <NavLink to="/converter" active={location.pathname === '/converter'}>
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Converter
              </NavLink>
              <ExternalNavLink href="https://grisma.com.np">
                <BookOpen className="h-4 w-4 mr-1" />
                Blogs
              </ExternalNavLink>
              <ExternalNavLink href="https://grisma.com.np/about">
                <User className="h-4 w-4 mr-1" />
                About
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
            <ExternalNavLink href="https://grisma.com.np">
              <BookOpen className="h-4 w-4" />
            </ExternalNavLink>
            <ExternalNavLink href="https://grisma.com.np/about">
              <User className="h-4 w-4" />
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
          <ExternalNavLink 
            href="https://grisma.com.np" 
            className="justify-center text-center py-2"
          >
            <BookOpen className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">Blogs</span>
          </ExternalNavLink>
          <ExternalNavLink 
            href="https://grisma.com.np/about" 
            className="justify-center text-center py-2"
          >
            <User className="h-4 w-4 mx-auto mb-1" />
            <span className="text-xs">About</span>
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
        "flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors",
        active 
          ? "bg-primary text-primary-foreground" 
          : "text-foreground/80 hover:text-foreground hover:bg-accent",
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
        "flex items-center px-3 py-1.5 rounded text-sm font-medium transition-colors",
        "text-foreground/80 hover:text-foreground hover:bg-accent",
        className
      )}
    >
      {children}
    </a>
  );
};

export default Navigation;
