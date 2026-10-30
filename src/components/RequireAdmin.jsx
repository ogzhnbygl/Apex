import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthUser } from './RequireAuth';

const RequireAdmin = ({ children }) => {
    const location = useLocation();
    const contextUser = useAuthUser();
    const [checking, setChecking] = useState(!contextUser);
    const [verifiedUser, setVerifiedUser] = useState(contextUser);

    useEffect(() => {
        if (contextUser) {
            setVerifiedUser(contextUser);
            setChecking(false);
            return;
        }

        const verify = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    localStorage.setItem('user', JSON.stringify(data));
                    setVerifiedUser(data);
                } else {
                    localStorage.removeItem('user');
                    setVerifiedUser(null);
                }
            } catch (err) {
                console.error(err);
                setVerifiedUser(null);
            } finally {
                setChecking(false);
            }
        };
        verify();
    }, [contextUser]);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-500 animate-pulse">Kontrol ediliyor...</div>
            </div>
        );
    }

    if (!verifiedUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (verifiedUser.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RequireAdmin;
