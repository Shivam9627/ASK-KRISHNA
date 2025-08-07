import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaComments, FaHistory, FaLanguage } from 'react-icons/fa';
import './Home.css';

const Home = () => {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Discover the Wisdom of Bhagavad Gita</h1>
          <p className="hero-subtitle">
            Ask questions and receive insights from the ancient text through our AI-powered assistant
          </p>
          <Link to="/chat" className="cta-button">
            Start Chatting <FaArrowRight className="icon" />
          </Link>
        </div>
        <div className="hero-image">
          <img src="/krishna-arjuna3.png" alt="Krishna and Arjuna" />
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <FaComments />
            </div>
            <h3 className="feature-title">Interactive Conversations</h3>
            <p className="feature-description">
              Engage in meaningful conversations about the teachings of Bhagavad Gita with our AI assistant
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaLanguage />
            </div>
            <h3 className="feature-title">Multilingual Support</h3>
            <p className="feature-description">
              Get responses in English or Hindi based on your preference
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <FaHistory />
            </div>
            <h3 className="feature-title">Chat History</h3>
            <p className="feature-description">
              Save and review your previous conversations when you create an account
            </p>
          </div>
        </div>
      </section>

      <section className="about">
        <h2 className="section-title">About ASK KRISHNA</h2>
        <div className="about-content">
          <p>
            ASK KRISHNA is an AI-powered assistant that helps you explore the teachings of the Bhagavad Gita. 
            Whether you're seeking spiritual guidance, philosophical insights, or simply curious about this 
            ancient text, our assistant is here to help.
          </p>
          <p>
            The assistant is trained on the complete text of the Bhagavad Gita and can provide context-aware 
            responses to your questions. It can understand and respond in multiple languages including English, 
            Hindi, and Sanskrit.
          </p>
          <div className="about-cta">
            <Link to="/chat" className="secondary-button">
              Start Your Journey
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;