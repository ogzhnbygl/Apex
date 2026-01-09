import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const RequireAdmin = ({ children }) => {
    const location = useLocation();
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : null;

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default RequireAdmin;
