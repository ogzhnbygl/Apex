import React, { createContext, useContext, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const AuthUserContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthUser = () => useContext(AuthUserContext);

const RequireAuth = ({ children }) => {
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const verify = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('user', JSON.stringify(data));
                    setUser(data);
                } else {
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } catch (err) {
                console.error(err);
                setUser(null);
            } finally {
                setChecking(false);
            }
        };
        verify();
    }, []);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-500 animate-pulse">Kontrol ediliyor...</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <AuthUserContext.Provider value={user}>
            {children}
        </AuthUserContext.Provider>
    );
};

export default RequireAuth;
