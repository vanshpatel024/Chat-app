import React from 'react';
import { useNavigate } from 'react-router-dom';
import './StyleSheets/GoogleDisabledModal.css';

export default function GoogleDisabledModal({ isOpen, onClose, showCreateAccountOption = true }) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return (
        <div className="google-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="google-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="google-modal-icon">
                    <i className="fas fa-info-circle"></i>
                </div>
                <h2>Google Sign-In Unavailable</h2>
                <p className="google-modal-msg">
                    Google sign-in is temporarily disabled in this build.
                </p>
                <div className="google-modal-tip">
                    <i className="fas fa-lightbulb"></i>
                    <div>
                        <strong>Testing Info:</strong> You can create an account using <em>any</em> email address (e.g. <code>test@gmail.com</code>) with any password. <strong>No verification email is required</strong>, and you can log in immediately!
                    </div>
                </div>
                <div className="google-modal-buttons">
                    {showCreateAccountOption && (
                        <button
                            type="button"
                            className="login-button google-modal-action-btn"
                            onClick={() => {
                                onClose();
                                navigate('/create');
                            }}
                        >
                            Create Account
                        </button>
                    )}
                    <button
                        type="button"
                        className="login-button cancel-button google-modal-close-btn"
                        onClick={onClose}
                    >
                        Got It
                    </button>
                </div>
            </div>
        </div>
    );
}

