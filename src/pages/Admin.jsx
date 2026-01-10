import React, { useState } from 'react';
import { Search, MoreVertical, Shield, User, Plus, X, Trash2, Edit2, Check } from 'lucide-react';

const Admin = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user', apps: [] });

    const availableApps = ['dispo', 'labproject']; // Added LabProject

    React.useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setModalMode('add');
        setFormData({ name: '', email: '', password: '', role: 'user', apps: ['dispo'] }); // Default to dispo
        setShowModal(true);
    };

    const handleOpenEdit = (user) => {
        setModalMode('edit');
        setCurrentUser(user);
        setFormData({
            name: user.name || '',
            email: user.email || '',
            password: '', // Keep empty to not change
            role: user.role || 'user',
            apps: user.apps || []
        });
        setShowModal(true);
    };

    const handleDelete = async (email) => {
        if (!window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch(`/api/admin/users?email=${email}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchUsers();
            } else {
                alert('Silme işlemi başarısız oldu');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = '/api/admin/users';
            const method = modalMode === 'add' ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modalMode === 'add' ? formData : { ...formData, email: currentUser.email })
            });

            if (response.ok) {
                setShowModal(false);
                fetchUsers();
            } else {
                const data = await response.json();
                alert(data.message || 'İşlem başarısız');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        }
    };

    const toggleApp = (app) => {
        setFormData(prev => ({
            ...prev,
            apps: prev.apps.includes(app)
                ? prev.apps.filter(a => a !== app)
                : [...prev.apps, app]
        }));
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Kullanıcı Yönetimi</h1>
                    <p className="mt-2 text-slate-500">Kullanıcı erişimlerini ve rollerini yönetin</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    <Plus size={20} />
                    Kullanıcı Ekle
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Kullanıcı ara..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Kullanıcı</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Erişim</th>
                                <th className="px-6 py-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900">{user.name || user.email}</div>
                                                <div className="text-slate-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                                            ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                            }`}>
                                            {user.role === 'admin' && <Shield size={12} />}
                                            {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {user.apps && user.apps.map(app => (
                                                <span key={app} className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs border border-slate-200 font-medium">
                                                    {app}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenEdit(user)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                title="Düzenle"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.email)}
                                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">
                                {modalMode === 'add' ? 'Yeni Kullanıcı Ekle' : 'Kullanıcı Düzenle'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    disabled={modalMode === 'edit'}
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </div>

                            {modalMode === 'add' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                                    <input
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Uygulama Erişimi</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableApps.map(app => (
                                        <button
                                            key={app}
                                            type="button"
                                            onClick={() => toggleApp(app)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${formData.apps.includes(app)
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {app}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    {modalMode === 'add' ? 'Kullanıcı Oluştur' : 'Değişiklikleri Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
