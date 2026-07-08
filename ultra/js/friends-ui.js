// 期末刷题宝典 Ultra — 好友管理弹窗

const FriendsUI = {
  // 打开好友弹窗
  async open() {
    const overlay = document.getElementById('friendsOverlay');
    if (!overlay) return;
    if (!state.user) {
      AuthUI.open();
      return;
    }
    overlay.classList.add('show');
    await FriendsUI.loadFriends();
  },

  close(e) {
    if (e && e.target !== document.getElementById('friendsOverlay')) return;
    document.getElementById('friendsOverlay').classList.remove('show');
  },

  // 加载好友列表和待处理请求
  async loadFriends() {
    const listEl = document.getElementById('friendsList');
    const pendingEl = document.getElementById('pendingList');
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999">加载中...</div>';
    pendingEl.innerHTML = '';

    try {
      const res = await API.friends.list();
      // 好友列表
      const friends = res.friends || [];
      if (friends.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999">暂无好友</div>';
      } else {
        listEl.innerHTML = friends.map(f => `
          <div class="friend-item">
            <div class="friend-avatar">${(f.nickname || f.email || '?')[0].toUpperCase()}</div>
            <div class="friend-info">
              <div class="friend-name">${escapeHtml(f.nickname || f.email)}</div>
              <div class="friend-email">${escapeHtml(f.email)}</div>
            </div>
          </div>`).join('');
      }
      // 待处理请求
      const pending = res.pending || [];
      if (pending.length > 0) {
        pendingEl.innerHTML = '<div class="friends-section-label">待处理请求</div>' +
          pending.map(f => `
            <div class="friend-item pending-item">
              <div class="friend-avatar">${(f.nickname || f.email || '?')[0].toUpperCase()}</div>
              <div class="friend-info">
                <div class="friend-name">${escapeHtml(f.nickname || f.email)}</div>
              </div>
              <div class="friend-actions">
                <button class="btn-accept" onclick="FriendsUI.accept('${f.id}')">接受</button>
                <button class="btn-reject" onclick="FriendsUI.reject('${f.id}')">拒绝</button>
              </div>
            </div>`).join('');
      }
    } catch (e) {
      listEl.innerHTML = `<div style="text-align:center;padding:20px;color:#f5222d">${escapeHtml(e.message)}</div>`;
    }
  },

  // 搜索用户
  async search() {
    const query = document.getElementById('friendSearchInput').value.trim();
    const resultEl = document.getElementById('friendSearchResult');
    if (!query) { resultEl.innerHTML = ''; return; }

    resultEl.innerHTML = '<div style="padding:8px;color:#999;font-size:13px">搜索中...</div>';
    try {
      const res = await API.users.search(query);
      const users = res.users || [];
      if (users.length === 0) {
        resultEl.innerHTML = '<div style="padding:8px;color:#999;font-size:13px">未找到用户</div>';
      } else {
        resultEl.innerHTML = users.map(u => `
          <div class="friend-item search-result-item">
            <div class="friend-avatar">${(u.nickname || u.email || '?')[0].toUpperCase()}</div>
            <div class="friend-info">
              <div class="friend-name">${escapeHtml(u.nickname || u.email)}</div>
              <div class="friend-email">${escapeHtml(u.email)}</div>
            </div>
            <button class="btn-add-friend" onclick="FriendsUI.sendRequest('${u.id}')">添加</button>
          </div>`).join('');
      }
    } catch (e) {
      resultEl.innerHTML = `<div style="padding:8px;color:#f5222d;font-size:13px">${escapeHtml(e.message)}</div>`;
    }
  },

  // 发送好友请求
  async sendRequest(targetId) {
    try {
      const res = await API.friends.request(targetId);
      if (res.auto_accepted) {
        alert('对方曾向你发送过请求，已自动成为好友！');
      } else {
        alert('好友请求已发送，等待对方接受');
      }
      await FriendsUI.loadFriends();
      document.getElementById('friendSearchResult').innerHTML = '';
      document.getElementById('friendSearchInput').value = '';
    } catch (e) {
      alert(e.message || '发送失败');
    }
  },

  // 接受请求
  async accept(friendId) {
    try {
      await API.friends.accept(friendId);
      await FriendsUI.loadFriends();
    } catch (e) {
      alert(e.message || '接受失败');
    }
  },

  // 拒绝请求
  async reject(friendId) {
    try {
      await API.friends.reject(friendId);
      await FriendsUI.loadFriends();
    } catch (e) {
      alert(e.message || '拒绝失败');
    }
  },
};
