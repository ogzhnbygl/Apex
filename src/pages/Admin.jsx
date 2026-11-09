import React, { useState } from 'react';
import { Search, Shield, User, Plus, X, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { useAuthUser } from '../components/RequireAuth';

const Admin = () => {
    const sessionUser = useAuthUser();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [currentUser, setCurrentUser] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'user', apps: [] });

    const availableApps = ['dispo', 'labproject', 'silo', 'circa', 'locus', 'pulsus'];

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
        setCurrentUser(null);
        setShowPassword(false);
        setFormData({ name: '', email: '', password: '', role: 'user', apps: ['dispo'] });
        setShowModal(true);
    };

    const handleOpenEdit = (user) => {
        setModalMode('edit');
        setCurrentUser(user);
        setShowPassword(false);
        setFormData({
            name: user.name || '',
            email: user.email || '',
            password: '', // Optional in edit mode: leave empty to keep existing password
            role: user.role || 'user',
            apps: user.apps || []
        });
        setShowModal(true);
    };

    const handleDelete = async (email) => {
        if (sessionUser?.email && email.toLowerCase() === sessionUser.email.toLowerCase()) {
            alert('Kendi yönetici hesabınızı silemezsiniz.');
            return;
        }
        if (!window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;

        try {
            const response = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchUsers();
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Silme işlemi başarısız oldu');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);

        try {
            const url = '/api/admin/users';
            const method = modalMode === 'add' ? 'POST' : 'PUT';

            const payload = modalMode === 'add'
                ? formData
                : {
                    name: formData.name,
                    email: currentUser.email,
                    role: formData.role,
                    apps: formData.apps,
                    ...(formData.password.trim() ? { password: formData.password } : {})
                };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setShowModal(false);
                fetchUsers();
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'İşlem başarısız');
            }
        } catch (error) {
            console.error('Error saving user:', error);
        } finally {
            setSubmitting(false);
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

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredUsers = users.filter((u) => {
        if (!normalizedQuery) return true;
        const nameMatch = (u.name || '').toLowerCase().includes(normalizedQuery);
        const emailMatch = (u.email || '').toLowerCase().includes(normalizedQuery);
        return nameMatch || emailMatch;
    });

    const isEditingSelf = modalMode === 'edit' && currentUser?.email && sessionUser?.email &&
        currentUser.email.toLowerCase() === sessionUser.email.toLowerCase();

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Kullanıcı Yönetimi</h1>
                    <p className="mt-2 text-slate-500">Kullanıcı erişimlerini ve rollerini yönetin</p>
                </div>
                <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    <Plus size={20} />
                    Kullanıcı Ekle
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <label htmlFor="admin-user-search" className="sr-only">Kullanıcı ara</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            id="admin-user-search"
                            name="q"
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            placeholder="Ad soyad veya e-posta ile kullanıcı ara..."
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
                            {!loading && filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        Arama kriterine uygun kullanıcı bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const isSelf = sessionUser?.email && user.email?.toLowerCase() === sessionUser.email.toLowerCase();
                                    return (
                                        <tr key={user._id || user.email} className="hover:bg-slate-50 transition-colors">
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
                                                <div className="flex flex-wrap gap-2">
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
                                                        type="button"
                                                        onClick={() => handleOpenEdit(user)}
                                                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                                        title="Düzenle"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isSelf}
                                                        onClick={() => handleDelete(user.email)}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title={isSelf ? 'Kendi hesabınızı silemezsiniz' : 'Sil'}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
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
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-slate-400 hover:text-slate-600"
                                aria-label="Kapat"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="admin-user-name" className="block text-sm font-medium text-slate-700 mb-1">
                                    Ad Soyad
                                </label>
                                <input
                                    id="admin-user-name"
                                    name="name"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="admin-user-email" className="block text-sm font-medium text-slate-700 mb-1">
                                    Email
                                </label>
                                <input
                                    id="admin-user-email"
                                    name="email"
                                    type="email"
                                    required
                                    disabled={modalMode === 'edit'}
                                    autoComplete="email"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                                />
                            </div>

                            <div>
                                <label htmlFor="admin-user-password" className="block text-sm font-medium text-slate-700 mb-1">
                                    {modalMode === 'add' ? 'Şifre' : 'Yeni Şifre (Opsiyonel)'}
                                </label>
                                <div className="relative">
                                    <input
                                        id="admin-user-password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required={modalMode === 'add'}
                                        minLength={6}
                                        autoComplete="new-password"
                                        aria-describedby="admin-password-help"
                                        placeholder={modalMode === 'edit' ? 'Değiştirmemek için boş bırakın' : 'En az 6 karakter'}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(prev => !prev)}
                                        aria-pressed={showPassword}
                                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <p id="admin-password-help" className="mt-1 text-xs text-slate-500">
                                    {modalMode === 'add'
                                        ? 'En az 6 karakter uzunluğunda olmalıdır.'
                                        : 'Şifreyi sıfırlamak istiyorsanız en az 6 karakter girin.'}
                                </p>
                            </div>

                            <div>
                                <label htmlFor="admin-user-role" className="block text-sm font-medium text-slate-700 mb-1">
                                    Rol
                                </label>
                                <select
                                    id="admin-user-role"
                                    name="role"
                                    disabled={isEditingSelf}
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                                {isEditingSelf && (
                                    <p className="mt-1 text-xs text-slate-500">Kendi yönetici rolünüzü değiştiremezsiniz.</p>
                                )}
                            </div>

                            <div>
                                <span className="block text-sm font-medium text-slate-700 mb-2">Uygulama Erişimi</span>
                                <div className="flex flex-wrap gap-2">
                                    {availableApps.map(app => (
                                        <button
                                            key={app}
                                            type="button"
                                            onClick={() => toggleApp(app)}
                                            aria-pressed={formData.apps.includes(app)}
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
                                    disabled={submitting}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                >
                                    {submitting
                                        ? 'Kaydediliyor...'
                                        : (modalMode === 'add' ? 'Kullanıcı Oluştur' : 'Değişiklikleri Kaydet')}
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
