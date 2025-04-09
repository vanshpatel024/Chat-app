import React from 'react';
import './StyleSheets/LoadingScreen.css';

function LoadingScreen() {
    return (
        <div className="loading-overlay">
            <div className="loader-text">Loading...</div>
        </div>
    );
}

export default LoadingScreen;
