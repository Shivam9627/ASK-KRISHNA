import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaCamera, FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';
import './Profile.css';

const Profile = () => {
  const { currentUser, logout, updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    username: currentUser?.username || '',
    email: currentUser?.email || '',
    profileImage: currentUser?.profileImage || null
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOTP, setDeleteOTP] = useState('');
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    setProfileData({
      username: currentUser.username || '',
      email: currentUser.email || '',
      profileImage: currentUser.profileImage || null
    });
  }, [currentUser, navigate]);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData(prev => ({
          ...prev,
          profileImage: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const updatedUser = await authService.updateProfile({
        username: profileData.username,
        profileImage: profileData.profileImage
      });
      
      // Merge with stored user shape
      const stored = localStorage.getItem('user');
      let merged = updatedUser;
      try {
        if (stored) {
          const parsed = JSON.parse(stored);
          merged = {
            ...parsed,
            username: updatedUser.username,
            email: updatedUser.email,
            created_at: updatedUser.created_at,
            profileImage: updatedUser.profileImage,
            token: parsed.token,
            user_id: updatedUser.user_id || parsed.user_id
          };
          if (merged && merged.token && typeof merged.token === 'object') {
            merged.token = JSON.stringify(merged.token);
          }
        }
      } catch {}
      updateCurrentUser(merged);
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      username: currentUser?.username || '',
      email: currentUser?.email || '',
      profileImage: currentUser?.profileImage || null
    });
    setIsEditing(false);
    setError('');
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const sendDeleteOTP = async () => {
    setLoading(true);
    setError('');
    
    try {
      await authService.sendDeleteOTP();
      setOtpSent(true);
      setShowOTPModal(true);
      setShowDeleteModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!deleteOTP.trim()) {
      setError('Please enter the OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await authService.deleteAccount(deleteOTP);
      logout();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1>Profile Settings</h1>
      </div>

      <div className="profile-content">
        <div className="profile-section">
          <div className="profile-image-section">
            <div className="profile-image-container">
              {profileData.profileImage ? (
                <img 
                  src={profileData.profileImage} 
                  alt="Profile" 
                  className="profile-image"
                />
              ) : (
                <div className="profile-image-placeholder">
                  <FaUser />
                </div>
              )}
              
              {isEditing && (
                <label className="image-upload-label">
                  <FaCamera />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="profile-details">
            <div className="profile-field">
              <label>Username</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              ) : (
                <div className="field-value">{profileData.username}</div>
              )}
            </div>

            <div className="profile-field">
              <label>Email</label>
              <div className="field-value email-field">
                <FaEnvelope />
                {profileData.email}
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="profile-actions">
              {isEditing ? (
                <>
                  <button 
                    className="save-button" 
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <FaSave />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button 
                    className="cancel-button" 
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <FaTimes />
                    Cancel
                  </button>
                </>
              ) : (
                <button 
                  className="edit-button" 
                  onClick={() => setIsEditing(true)}
                >
                  <FaEdit />
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <p>Once you delete your account, there is no going back. Please be certain.</p>
          <button 
            className="delete-account-button" 
            onClick={handleDeleteAccount}
          >
            <FaTrash />
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Account</h3>
            <p>Are you sure you want to delete your account? This action cannot be undone.</p>
            <p>You will receive an OTP on your registered email to confirm the deletion.</p>
            <div className="modal-actions">
              <button 
                className="confirm-button" 
                onClick={sendDeleteOTP}
                disabled={loading}
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
              <button 
                className="cancel-button" 
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP Modal */}
      {showOTPModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Enter OTP</h3>
            <p>Please enter the OTP sent to your email to confirm account deletion.</p>
            <input
              type="text"
              value={deleteOTP}
              onChange={(e) => setDeleteOTP(e.target.value)}
              placeholder="Enter OTP"
              className="otp-input"
            />
            <div className="modal-actions">
              <button 
                className="confirm-button" 
                onClick={confirmDeleteAccount}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
              <button 
                className="cancel-button" 
                onClick={() => {
                  setShowOTPModal(false);
                  setDeleteOTP('');
                  setOtpSent(false);
                }}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

