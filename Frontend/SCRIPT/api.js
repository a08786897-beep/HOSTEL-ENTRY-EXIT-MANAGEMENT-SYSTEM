(function () {
    const apiBase = `http://${location.hostname || '127.0.0.1'}:3000/api`;
    const tokenKey = 'hemsToken';
    const userKey = 'hemsUser';

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        const token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        if (options.body && !(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        let response;
        try {
            response = await fetch(`${apiBase}${path}`, { ...options, headers });
        } catch (_error) {
            throw new Error('Cannot reach the server. Check that the backend is running on port 3000.');
        }

        const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) {
                clearSession();
                if (!options.allowUnauthorized && !location.pathname.endsWith('/login.html')) {
                    location.replace('login.html');
                }
            }
            throw new Error(data.message || `Request failed (${response.status}).`);
        }
        return data;
    }

    function storeSession(data) {
        const storage = document.querySelector('#rememberMe')?.checked ? localStorage : sessionStorage;
        const otherStorage = storage === localStorage ? sessionStorage : localStorage;
        otherStorage.removeItem(tokenKey);
        otherStorage.removeItem(userKey);
        storage.setItem(tokenKey, data.token);
        storage.setItem(userKey, JSON.stringify(data.user));
    }

    function clearSession() {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function showMessage(element, message, kind = 'danger') {
        if (!element) return;
        element.className = `alert alert-${kind}`;
        element.textContent = message;
        element.hidden = false;
    }

    async function requireUser(roles = []) {
        if (!sessionStorage.getItem(tokenKey) && !localStorage.getItem(tokenKey)) {
            location.replace('login.html');
            return null;
        }
        try {
            const { user } = await request('/auth/me');
            const storage = sessionStorage.getItem(tokenKey) ? sessionStorage : localStorage;
            storage.setItem(userKey, JSON.stringify(user));
            if (roles.length && !roles.includes(user.role)) {
                sessionStorage.setItem('hemsNotice', 'Your account does not have access to that page.');
                location.replace('dashboard.html');
                return null;
            }
            return user;
        } catch (_error) {
            return null;
        }
    }

    window.HEMS = {
        request,
        storeSession,
        clearSession,
        escapeHtml,
        showMessage,
        requireUser,
        get user() {
            try { return JSON.parse(sessionStorage.getItem(userKey) || 'null'); }
            catch (_error) { return null; }
        }
    };
}());
