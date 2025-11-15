import React, { useEffect } from 'react';

const AdsTxt = () => {
  useEffect(() => {
    // Redirect to the actual ads.txt file
    window.location.replace('/ads.txt');
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>Redirecting to ads.txt...</h1>
    </div>
  );
};

export default AdsTxt;