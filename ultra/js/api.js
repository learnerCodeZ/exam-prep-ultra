// 期末刷题宝典 Ultra — API 统一封装

const API = {
  // 通用 fetch 封装
  async request(url, options = {}) {
    const opts = {
      credentials: 'include', // 携带 cookie
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    if (opts.body && typeof opts.body === 'object') {
      opts.body = JSON.stringify(opts.body);
    }
    try {
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data.message || '请求失败');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      // 网络错误（离线等）
      if (e instanceof TypeError && e.message.includes('fetch')) {
        console.warn('[API] 网络不可用，离线模式');
        const err = new Error('网络不可用');
        err.offline = true;
        throw err;
      }
      throw e;
    }
  },

  // ---------- Auth ----------
  auth: {
    register(email, nickname, password) {
      return API.request('/api/auth/register', {
        method: 'POST',
        body: { email, nickname, password },
      });
    },
    login(email, password) {
      return API.request('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
    },
    logout() {
      return API.request('/api/auth/logout', { method: 'POST' });
    },
    me() {
      return API.request('/api/auth/me');
    },
    resetRequest(email) {
      return API.request('/api/auth/me', {
        method: 'POST',
        body: { email },
      });
    },
    changePassword(oldPassword, newPassword) {
      return API.request('/api/auth/me', {
        method: 'PUT',
        body: { old_password: oldPassword, new_password: newPassword },
      });
    },
  },

  // ---------- Banks ----------
  banks: {
    list() {
      return API.request('/api/banks');
    },
    create(name, isPublic = false) {
      return API.request('/api/banks', {
        method: 'POST',
        body: { name, is_public: isPublic },
      });
    },
    get(id) {
      return API.request('/api/banks/' + id);
    },
    update(id, data) {
      return API.request('/api/banks/' + id, {
        method: 'PUT',
        body: data,
      });
    },
    delete(id) {
      return API.request('/api/banks/' + id, { method: 'DELETE' });
    },
    getQuestions(id) {
      return API.request('/api/banks/' + id + '/questions');
    },
    putQuestions(id, questions) {
      return API.request('/api/banks/' + id + '/questions', {
        method: 'PUT',
        body: { questions },
      });
    },
  },

  // ---------- Users ----------
  users: {
    search(query) {
      return API.request('/api/users/search?q=' + encodeURIComponent(query));
    },
  },

  // ---------- Friends ----------
  friends: {
    list() {
      return API.request('/api/friends');
    },
    request(targetUserId) {
      return API.request('/api/friends/request', {
        method: 'POST',
        body: { target_user_id: targetUserId },
      });
    },
    accept(friendId) {
      return API.request('/api/friends/accept', {
        method: 'POST',
        body: { friend_id: friendId },
      });
    },
    reject(friendId) {
      return API.request('/api/friends/reject', {
        method: 'POST',
        body: { friend_id: friendId },
      });
    },
  },

  // ---------- Admin ----------
  admin: {
    users() {
      return API.request('/api/admin/users');
    },
    deleteUser(userId) {
      return API.request('/api/admin/users', {
        method: 'DELETE',
        body: { user_id: userId },
      });
    },
    banks() {
      return API.request('/api/admin/banks');
    },
    resetRequests() {
      return API.request('/api/admin/users?action=reset-requests');
    },
    handleResetRequest(requestId, action) {
      return API.request('/api/admin/users', {
        method: 'PUT',
        body: { request_id: requestId, action },
      });
    },
  },
};
