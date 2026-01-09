import React from 'react';
import { ExternalLink, Box } from 'lucide-react';

const Dashboard = () => {
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const allApps = [
        {
            id: 'dispo',
            name: 'Dispo',
            description: 'Disposition Management System',
            url: 'https://dispo.wildtype.app',
            icon: Box,
            color: 'from-emerald-500 to-teal-600'
        },
        // Add more apps here
    ];

    // Filter apps based on user access
    const apps = allApps.filter(app => {
        if (!user) return false; // User should always be available if RequireAuth handles it
        if (user.role === 'admin') return true;
        return user.apps?.some(a => a.toLowerCase() === app.id.toLowerCase());
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Panel</h1>
                <p className="mt-2 text-slate-500">Başlatmak için bir uygulama seçin</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {apps.map((app) => (
                    <a
                        key={app.id}
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 hover:border-indigo-300 transition-all hover:shadow-xl hover:shadow-indigo-500/10"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative flex items-start justify-between">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.color} flex items-center justify-center shadow-lg shadow-indigo-500/20`}>
                                <app.icon className="text-white" size={24} />
                            </div>
                            <ExternalLink className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={20} />
                        </div>

                        <div className="relative mt-4">
                            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {app.name}
                            </h3>
                            <p className="mt-2 text-sm text-slate-500">
                                {app.description}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
