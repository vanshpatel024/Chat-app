import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth } from './Firebase';
import { useNotification } from './Notification';
import { useLoading } from './LoadingContext';
import "./StyleSheets/LoadingScreen.css";

function ProtectedRoute({ children }) {
    const { showNotification } = useNotification();
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const { showLoading, hideLoading } = useLoading();

    useEffect(() => {
        showLoading();

        const unsubscribe = auth.onAuthStateChanged((user) => {
            setIsAuthenticated(!!user);
            hideLoading();
        });

        return () => {
            unsubscribe();
            hideLoading();
        };
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            showNotification("Auto Login Successful!");
        }
    }, [isAuthenticated]);

    if (isAuthenticated === null) {
        return null;
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;
