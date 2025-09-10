import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaUserPlus, FaShieldAlt, FaArrowLeft } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';
import './Auth.css';

const Register = () => {
  const [step, setStep] = useState(1); // 1: form, 2: OTP verification
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    console.log('🔍 Sending OTP for registration:', { username, email });
    
    // Simple validation
    if (!username || !email || !password || !confirmPassword) {
      console.warn('⚠️ Validation failed: Missing fields');
      return setError('Please fill in all fields');
    }
    
    if (password !== confirmPassword) {
      console.warn('⚠️ Validation failed: Passwords do not match');
      return setError('Passwords do not match');
    }
    
    if (password.length < 6) {
      console.warn('⚠️ Validation failed: Password too short');
      return setError('Password must be at least 6 characters');
    }
    
    try {
      setError('');
      setLoading(true);
      await authService.sendRegistrationOTP(email);
      console.log('✅ OTP sent successfully');
      setOtpSent(true);
      setStep(2);
    } catch (err) {
      console.error('❌ Error sending OTP:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    console.log('🔍 Verifying OTP for:', { email, otp });
    
    if (!otp.trim()) {
      console.warn('⚠️ Validation failed: Missing OTP');
      return setError('Please enter the OTP');
    }
    
    try {
      setError('');
      setLoading(true);
      await authService.verifyRegistrationOTP(email, otp);
      console.log('✅ OTP verified, registering user');
      await register(username, email, password);
      console.log('✅ Registration successful, redirecting to /chat');
      navigate('/chat');
    } catch (err) {
      console.error('❌ Error verifying OTP or registering:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(err.response?.data?.error || 'Failed to verify OTP or create account');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    console.log('🔍 Resending OTP for:', { email });
    try {
      setError('');
      setLoading(true);
      await authService.sendRegistrationOTP(email);
      console.log('✅ OTP resent successfully');
      setError('');
    } catch (err) {
      console.error('❌ Error resending OTP:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      setError(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    console.log('🔍 Going back to registration form');
    setStep(1);
    setOtp('');
    setError('');
  };

  if (step === 2) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>Verify Your Email</h2>
            <p>We've sent a 6-digit code to {email}</p>
          </div>
          
          {error && <div className="auth-error">{error}</div>}
          
          <form className="auth-form" onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label htmlFor="otp">
                <FaShieldAlt className="input-icon" />
                Enter OTP
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength="6"
                required
                style={{ textAlign: 'center', letterSpacing: '2px', fontSize: '1.2rem' }}
              />
            </div>
            
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? (
                'Verifying...'
              ) : (
                <>
                  <FaShieldAlt className="button-icon" />
                  Verify & Create Account
                </>
              )}
            </button>
          </form>
          
          <div className="auth-footer">
            <button 
              type="button" 
              onClick={handleResendOTP} 
              disabled={loading}
              className="resend-button"
            >
              Resend OTP
            </button>
            <button 
              type="button" 
              onClick={goBack}
              className="back-button"
            >
              <FaArrowLeft />
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Create an Account</h2>
          <p>Join ASK KRISHNA to unlock unlimited questions</p>
        </div>
        
        {error && <div className="auth-error">{error}</div>}
        
        <form className="auth-form" onSubmit={handleSendOTP}>
          <div className="form-group">
            <label htmlFor="username">
              <FaUser className="input-icon" />
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">
              <FaEnvelope className="input-icon" />
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">
              <FaLock className="input-icon" />
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">
              <FaLock className="input-icon" />
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              'Sending OTP...'
            ) : (
              <>
                <FaUserPlus className="button-icon" />
                Send OTP
              </>
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;