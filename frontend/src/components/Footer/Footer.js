import React, { useEffect, useRef, useState } from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const footerRef = useRef(null);
  const [showMarquee, setShowMarquee] = useState(false);

  useEffect(() => {
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        setShowMarquee(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    if (footerRef.current) {
      observer.observe(footerRef.current);
    }
    return () => {
      if (footerRef.current) observer.unobserve(footerRef.current);
    };
  }, []);

  const marqueeText = (
    <>
      © {currentYear} ASK KRISHNA. All rights reserved. Created by <span className="creator-highlight">Shivam Chamoli</span>.
    </>
  );

  return (
    <>
      {showMarquee && (
        <div className="footer-marquee-bar">
          <marquee behavior="scroll" direction="left" scrollamount="5">{marqueeText}</marquee>
        </div>
      )}
      <footer className="footer" ref={footerRef}>
        <div className="container footer-container">
          <div className="footer-content">
            <div className="footer-logo">
              <img src="/footerLogo4.png" alt="ASK KRISHNA Logo" className="footer-logo-img" />
              <span className="footer-logo-text">ASK KRISHNA</span>
            </div>
            <p className="footer-description">
              Your guide to the wisdom of Bhagavad Gita
            </p>
          </div>
          <div className="footer-bottom">
            <p className="copyright">
              &copy; {currentYear} ASK KRISHNA. All rights reserved.
              Created by <span className="creator-highlight">Shivam Chamoli</span>.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;