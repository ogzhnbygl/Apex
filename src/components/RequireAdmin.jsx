import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAdmin = ({ children }) => {
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const verify = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('user', JSON.stringify(data));
                    setIsAuthenticated(true);
                    setIsAdmin(data.role === 'admin');
                } else {
                    localStorage.removeItem('user');
                    setIsAuthenticated(false);
                    setIsAdmin(false);
                }
            } catch (err) {
                console.error(err);
                setIsAuthenticated(false);
                setIsAdmin(false);
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

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RequireAdmin;
