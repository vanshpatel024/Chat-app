import React, { createContext, useContext, useState } from 'react';
import LoadingScreen from './LoadingScreen'; // Your animated component

const LoadingContext = createContext();

export function useLoading() {
    return useContext(LoadingContext);
}

export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false);

    const showLoading = () => setIsLoading(true);
    const hideLoading = () => setIsLoading(false);

    return (
        <LoadingContext.Provider value={{ showLoading, hideLoading }}>
            {children}
            {isLoading && <LoadingScreen />}
        </LoadingContext.Provider>
    );
}
