import React, { useEffect } from 'react';

declare global {
    interface Window {
        adsbygoogle: any;
    }
}

const AdSense = () => {
    useEffect(() => {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error(e);
        }
    }, []);

    return (
        <div style={{ margin: '20px 0', textAlign: 'center' }}>
            <ins className="adsbygoogle"
                 style={{ display: 'block' }}
                 data-ad-client="ca-pub-5410507143596599" // Your AdSense client ID
                 data-ad-slot="2194448645"       // Replace with your AdSense ad slot ID
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
        </div>
    );
};

export default AdSense;
