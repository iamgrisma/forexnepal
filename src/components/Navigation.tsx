
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, BarChart } from 'lucide-react';

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
                <BarChart className="h-4 w-4 mr-1" />
                Exchange Rates
              </NavLink>
              <NavLink to="/converter" active={location.pathname === '/converter'}>
                <ArrowRightLeft className="h-4 w-4 mr-1" />
                Currency Converter
              </NavLink>
            </div>
          </div>
          
          <div className="md:hidden flex space-x-2">
            <NavLink to="/" active={location.pathname === '/'}>
              <BarChart className="h-4 w-4" />
            </NavLink>
            <NavLink to="/converter" active={location.pathname === '/converter'}>
              <ArrowRightLeft className="h-4 w-4" />
            </NavLink>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t">
        <div className="grid grid-cols-2 divide-x">
          <NavLink 
            to="/" 
            active={location.pathname === '/'} 
            className="justify-center text-center py-2"
          >
            <BarChart className="h-4 w-4 mx-auto mb-1" />
            Exchange Rates
          </NavLink>
          <NavLink 
            to="/converter" 
            active={location.pathname === '/converter'} 
            className="justify-center text-center py-2"
          >
            <ArrowRightLeft className="h-4 w-4 mx-auto mb-1" />
            Currency Converter
          </NavLink>
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

export default Navigation;
