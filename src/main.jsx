// Local Development Fetch Interceptor to attach Authorization header
if (import.meta.env.DEV) {
    const originalFetch = window.fetch;
    window.fetch = async function (resource, options = {}) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
            if (!options.headers.has('Authorization')) {
                options.headers.set('Authorization', 'Bearer dev@wildtype.app');
            }
        } else if (Array.isArray(options.headers)) {
            const hasAuth = options.headers.some(([key]) => key.toLowerCase() === 'authorization');
            if (!hasAuth) {
                options.headers.push(['Authorization', 'Bearer dev@wildtype.app']);
            }
        } else {
            if (!options.headers['Authorization'] && !options.headers['authorization']) {
                options.headers['Authorization'] = 'Bearer dev@wildtype.app';
            }
        }
        return originalFetch(resource, options);
    };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
