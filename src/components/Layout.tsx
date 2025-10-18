
import React from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import PWAInstallPrompt from './PWAInstallPrompt';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
}

const Layout = ({ children, className = "" }: LayoutProps) => {
  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 ${className}`}>
      <Navigation />
      <main className="pb-24 md:pb-16">
        {children}
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20 md:mb-0">
        <Footer />
      </div>
      <PWAInstallPrompt />
    </div>
  );
};

export default Layout;
