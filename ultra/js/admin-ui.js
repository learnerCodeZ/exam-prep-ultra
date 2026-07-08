// 期末刷题宝典 Ultra — 管理员面板

const AdminUI = {
  // 打开管理面板
  async open() {
    const overlay = document.getElementById('adminOverlay');
    if (!overlay) return;
    if (!state.user || state.user.role !== 'admin') {
      alert('需要管理员权限');
      return;
    }
    overlay.classList.add('show');
    await AdminUI.loadUsers();
    await AdminUI.loadBanks();
    await AdminUI.loadResetRequests();
  },

  close(e) {
    if (e && e.target !== document.getElementById('adminOverlay')) return;
    document.getElementById('adminOverlay').classList.remove('show');
  },

  // 加载用户列表
  async loadUsers() {
    const tbody = document.getElementById('adminUsersBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">加载中...</td></tr>';
    try {
      const res = await API.admin.users();
      const users = res.users || [];
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">无用户</td></tr>';
        return;
      }
      tbody.innerHTML = users.map(u => `
        <tr>
          <td>${u.id}</td>
          <td>${escapeHtml(u.nickname || '-')}</td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="admin-badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role}</span></td>
          <td>${u.bank_count || 0}</td>
          <td>${u.role !== 'admin' ? `<button class="btn-admin-del" onclick="AdminUI.deleteUser('${u.id}')">删除</button>` : '-'}</td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:#f5222d">${escapeHtml(e.message)}</td></tr>`;
    }
  },

  // 加载题库列表
  async loadBanks() {
    const tbody = document.getElementById('adminBanksBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">加载中...</td></tr>';
    try {
      const res = await API.admin.banks();
      const banks = res.banks || [];
      if (banks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">无题库</td></tr>';
        return;
      }
      tbody.innerHTML = banks.map(b => `
        <tr>
          <td>${b.id}</td>
          <td>${escapeHtml(b.name)}</td>
          <td>${escapeHtml(b.owner_name || '-')}</td>
          <td>${b.is_public ? '公开' : (b.is_default ? '默认' : '私密')}</td>
          <td>${b.is_default ? '-' : `<button class="btn-admin-del" onclick="AdminUI.deleteBank('${b.id}')">删除</button>`}</td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:#f5222d">${escapeHtml(e.message)}</td></tr>`;
    }
  },

  // 加载密码重置请求
  async loadResetRequests() {
    const tbody = document.getElementById('adminResetBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">加载中...</td></tr>';
    try {
      const res = await API.admin.resetRequests();
      const requests = res.requests || [];
      if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:#999">无请求</td></tr>';
        return;
      }
      tbody.innerHTML = requests.map(r => `
        <tr>
          <td>${r.id}</td>
          <td>${escapeHtml(r.nickname || '-')}</td>
          <td>${escapeHtml(r.email)}</td>
          <td><span class="admin-badge ${r.status === 'pending' ? 'badge-pending' : r.status === 'approved' ? 'badge-admin' : 'badge-user'}">${r.status === 'pending' ? '待审批' : r.status === 'approved' ? '已同意' : '已拒绝'}</span></td>
          <td>${r.status === 'pending' ? `<button class="btn-admin-approve" onclick="AdminUI.handleReset('${r.id}','approve')">同意</button> <button class="btn-admin-reject" onclick="AdminUI.handleReset('${r.id}','reject')">拒绝</button>` : '-'}</td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:16px;color:#f5222d">${escapeHtml(e.message)}</td></tr>`;
    }
  },

  // 审批密码重置请求
  async handleReset(requestId, action) {
    const msg = action === 'approve' ? '确定同意？密码将重置为 123456。' : '确定拒绝该请求？';
    if (!confirm(msg)) return;
    try {
      await API.admin.handleResetRequest(requestId, action);
      await AdminUI.loadResetRequests();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  },

  // 删除用户
  async deleteUser(userId) {
    if (!confirm('确定删除该用户？其题库也会一并删除。')) return;
    try {
      await API.admin.deleteUser(userId);
      await AdminUI.loadUsers();
      await AdminUI.loadBanks();
    } catch (e) {
      alert(e.message || '删除失败');
    }
  },

  // 删除题库
  async deleteBank(bankId) {
    if (!confirm('确定删除该题库？')) return;
    try {
      await API.banks.delete(bankId);
      await AdminUI.loadBanks();
    } catch (e) {
      alert(e.message || '删除失败');
    }
  },
};
