// 期末刷题宝典 Ultra — 登录/注册弹窗

const AuthUI = {
  // 打开认证弹窗（默认显示登录 tab）
  open(tab = 'login') {
    const overlay = document.getElementById('authOverlay');
    if (!overlay) return;
    AuthUI.switchTab(tab);
    overlay.classList.add('show');
  },

  close(e) {
    if (e && e.target !== document.getElementById('authOverlay')) return;
    document.getElementById('authOverlay').classList.remove('show');
    AuthUI.clearForm();
  },

  switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    document.getElementById('authLoginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('authRegisterForm').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('authResetForm').style.display = tab === 'reset' ? 'block' : 'none';
    AuthUI.clearError();
  },

  clearForm() {
    const ids = ['loginEmail', 'loginPassword', 'regEmail', 'regNickname', 'regPassword', 'regPassword2', 'resetEmail'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    AuthUI.clearError();
  },

  showError(msg) {
    const el = document.getElementById('authError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  },

  clearError() {
    const el = document.getElementById('authError');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  },

  // 登录
  async handleLogin() {
    AuthUI.clearError();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { AuthUI.showError('请填写邮箱和密码'); return; }

    try {
      const res = await API.auth.login(email, password);
      // 登录成功，通知 app.js
      window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
      AuthUI.close();
    } catch (e) {
      AuthUI.showError(e.message || '登录失败');
    }
  },

  // 注册
  async handleRegister() {
    AuthUI.clearError();
    const email = document.getElementById('regEmail').value.trim();
    const nickname = document.getElementById('regNickname').value.trim();
    const password = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;

    if (!email || !nickname || !password) { AuthUI.showError('请填写所有字段'); return; }
    if (password.length < 6) { AuthUI.showError('密码至少6位'); return; }
    if (password !== password2) { AuthUI.showError('两次密码不一致'); return; }

    try {
      const res = await API.auth.register(email, nickname, password);
      // 注册成功自动登录，通知 app.js
      window.dispatchEvent(new CustomEvent('auth:login', { detail: res.user }));
      AuthUI.close();
    } catch (e) {
      AuthUI.showError(e.message || '注册失败');
    }
  },

  // 登出
  async handleLogout() {
    try {
      await API.auth.logout();
    } catch (e) {
      // 即使登出 API 失败也清除本地状态
      console.warn('Logout API error:', e.message);
    }
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },

  // 找回密码
  async handleResetRequest() {
    AuthUI.clearError();
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) { AuthUI.showError('请输入邮箱'); return; }

    try {
      await API.auth.resetRequest(email);
      alert('找回请求已提交，请等待管理员审批。审批通过后密码将重置为 123456。');
      AuthUI.close();
      AuthUI.switchTab('login');
    } catch (e) {
      AuthUI.showError(e.message || '提交失败');
    }
  },
};
