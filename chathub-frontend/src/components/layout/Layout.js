import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
          <div className="animate-slide-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
