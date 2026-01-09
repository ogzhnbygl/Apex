import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Shield, LayoutGrid } from 'lucide-react';

const Layout = () => {
    const navigate = useNavigate();
    // Actual logout logic
    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed', error);
        }
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500/30">
            <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-8">
                            <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                    <span className="text-white">A</span>
                                </div>
                                Apex
                            </Link>
                            <div className="hidden md:flex items-center gap-4">
                                <Link to="/" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                    <LayoutGrid size={16} />
                                    Dashboard
                                </Link>
                                <Link to="/admin" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-2">
                                    <Shield size={16} />
                                    Yönetici
                                </Link>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Çıkış Yap"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
