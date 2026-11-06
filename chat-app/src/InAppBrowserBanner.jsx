import React, { useState } from 'react';
import { isInAppBrowser } from './authUtils';
import './StyleSheets/InAppBrowserBanner.css';

export default function InAppBrowserBanner() {
    const [dismissed, setDismissed] = useState(false);
    const inApp = isInAppBrowser();

    if (!inApp || dismissed) return null;

    return (
        <div className="in-app-banner" role="alert">
            <div className="in-app-banner-content">
                <i className="fas fa-exclamation-triangle in-app-banner-icon"></i>
                <div className="in-app-banner-text">
                    <strong>Embedded browser detected.</strong> Google blocks sign-in inside in-app webviews (Instagram, TikTok, Facebook, Line). Please tap the menu (<strong>⋮</strong> or <strong>⋯</strong>) and select <strong>&quot;Open in Chrome&quot;</strong> or <strong>&quot;Open in Safari&quot;</strong>.
                </div>
            </div>
            <button
                type="button"
                className="in-app-banner-close"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss banner"
            >
                &times;
            </button>
        </div>
    );
}

