// ─── Supabase 設定 ─────────────────────────────────────────────
const SUPABASE_URL = 'https://cjiilnroxlawimpiayxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AtSfKddyJFuI_OCyRf61eg_d6H76fX_';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 管理者パスワード ───────────────────────────────────────────
const ADMIN_PASSWORD = 'erena';

// ─── 状態管理 ──────────────────────────────────────────────────
let currentAdminTab = 'all';

// ─── 初期化 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('admin_auth') === 'ok') {
    showAdminScreen();
  }
});

// ─── ログイン ──────────────────────────────────────────────────
function doLogin() {
  const pw = document.getElementById('login-password').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_auth', 'ok');
    showAdminScreen();
  } else {
    alert('パスワードが違います');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

function doLogout() {
  sessionStorage.removeItem('admin_auth');
  document.getElementById('admin-screen').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-password').value = '';
}

function showAdminScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-screen').classList.remove('hidden');
  loadAdminPosts('all');
}

// ─── タブ切り替え ────────────────────────────────────────────────
function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab').forEach((btn, i) => {
    const tabs = ['all', 'hire', 'work', 'closed', 'hidden'];
    btn.classList.toggle('active', tabs[i] === tab);
  });
  loadAdminPosts(tab);
}

// ─── 投稿一覧取得 ────────────────────────────────────────────────
async function loadAdminPosts(filter) {
  const list = document.getElementById('admin-post-list');
  list.innerHTML = '<div class="loading">読み込み中...</div>';

  let query = supabaseClient.from('posts').select('*').order('created_at', { ascending: false });

  if (filter === 'hire')   query = query.eq('type', 'hire').neq('status', 'hidden');
  if (filter === 'work')   query = query.eq('type', 'work').neq('status', 'hidden');
  if (filter === 'closed') query = query.eq('status', 'closed');
  if (filter === 'hidden') query = query.eq('status', 'hidden');
  if (filter === 'all')    query = query.neq('status', 'hidden');

  const { data: posts, error } = await query;

  if (error) {
    list.innerHTML = `<div class="loading">読み込みに失敗しました: ${error.message}</div>`;
    return;
  }

  if (posts.length === 0) {
    list.innerHTML = '<div class="loading">投稿がありません</div>';
    return;
  }

  list.innerHTML = posts.map(renderAdminCard).join('');
}

// ─── 管理カードHTML ──────────────────────────────────────────────
function renderAdminCard(post) {
  const date = formatDate(post.created_at);
  const typeLabel = post.type === 'hire' ? '仕事をお願いしたい' : '仕事を受けたい';
  const typeBadge = post.type === 'hire' ? 'badge-hire' : 'badge-work';

  let statusBadge = '';
  if (post.status === 'closed') statusBadge = '<span class="admin-type-badge badge-closed-admin">🤝 成約済み</span>';
  if (post.status === 'hidden') statusBadge = '<span class="admin-type-badge badge-hidden">🚫 非表示</span>';

  const cardClass = `admin-post-card ${post.type}${post.status === 'closed' ? ' closed' : ''}${post.status === 'hidden' ? ' hidden-post' : ''}`;

  return `
    <div class="${cardClass}" id="admin-card-${post.id}">
      <div class="admin-post-meta">
        <span class="admin-type-badge ${typeBadge}">${typeLabel}</span>
        ${statusBadge}
        <span style="font-size:0.8rem;color:#888">${escapeHtml(post.author_name)} ・ ${date}</span>
      </div>
      <div class="admin-post-title">${escapeHtml(post.title)}</div>
      <div class="admin-post-desc">${escapeHtml(post.description.slice(0, 150))}${post.description.length > 150 ? '…' : ''}</div>
      <div class="admin-actions">
        <button class="btn-secondary" onclick="openAdminEdit('${post.id}')">✏️ 編集</button>
        ${post.status !== 'closed' ? `<button class="btn-success" onclick="adminUpdateStatus('${post.id}', 'closed')">🤝 成約済みに</button>` : ''}
        ${post.status !== 'hidden' ? `<button class="btn-secondary" onclick="adminUpdateStatus('${post.id}', 'hidden')">🚫 非表示に</button>` : ''}
        ${post.status === 'hidden' ? `<button class="btn-secondary" onclick="adminUpdateStatus('${post.id}', 'active')">✅ 公開に戻す</button>` : ''}
        ${post.status === 'closed' ? `<button class="btn-secondary" onclick="adminUpdateStatus('${post.id}', 'active')">↩️ 公開に戻す</button>` : ''}
        <button class="btn-danger" onclick="adminDelete('${post.id}')">🗑 削除</button>
      </div>
    </div>`;
}

// ─── ステータス変更 ──────────────────────────────────────────────
async function adminUpdateStatus(postId, status) {
  const { error } = await supabaseClient.from('posts').update({ status }).eq('id', postId);
  if (error) { alert('更新に失敗しました'); return; }
  await loadAdminPosts(currentAdminTab);
}

// ─── 削除 ────────────────────────────────────────────────────────
async function adminDelete(postId) {
  if (!confirm('この投稿を削除しますか？（コメントも一緒に削除されます）')) return;
  const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
  if (error) { alert('削除に失敗しました'); return; }
  await loadAdminPosts(currentAdminTab);
}

// ─── 編集モーダル ────────────────────────────────────────────────
async function openAdminEdit(postId) {
  const { data: post, error } = await supabaseClient.from('posts').select('*').eq('id', postId).single();
  if (error) { alert('データの取得に失敗しました'); return; }

  document.getElementById('ae-id').value = post.id;
  document.getElementById('ae-type').value = post.type;
  document.getElementById('ae-author').value = post.author_name;
  document.getElementById('ae-title').value = post.title;
  document.getElementById('ae-description').value = post.description;
  document.getElementById('ae-contact').value = post.contact;
  document.getElementById('ae-status').value = post.status;

  if (post.type === 'hire') {
    document.getElementById('ae-hire-fields').classList.remove('hidden');
    document.getElementById('ae-work-fields').classList.add('hidden');
    document.getElementById('ae-budget').value = post.budget_range || '';
  } else {
    document.getElementById('ae-hire-fields').classList.add('hidden');
    document.getElementById('ae-work-fields').classList.remove('hidden');
    document.getElementById('ae-skills').value = post.skills || '';
    document.getElementById('ae-experience').value = post.experience || '';
    document.getElementById('ae-desired').value = post.desired_work || '';
  }

  document.getElementById('admin-edit-overlay').classList.remove('hidden');
}

function closeAdminEdit() {
  document.getElementById('admin-edit-overlay').classList.add('hidden');
}

async function submitAdminEdit(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '更新中...';

  const postId = document.getElementById('ae-id').value;
  const type = document.getElementById('ae-type').value;

  const updates = {
    author_name: document.getElementById('ae-author').value.trim(),
    title: document.getElementById('ae-title').value.trim(),
    description: document.getElementById('ae-description').value.trim(),
    contact: document.getElementById('ae-contact').value.trim(),
    status: document.getElementById('ae-status').value,
  };

  if (type === 'hire') {
    updates.budget_range = document.getElementById('ae-budget').value.trim() || null;
  } else {
    updates.skills = document.getElementById('ae-skills').value.trim() || null;
    updates.experience = document.getElementById('ae-experience').value.trim() || null;
    updates.desired_work = document.getElementById('ae-desired').value.trim() || null;
  }

  const { error } = await supabaseClient.from('posts').update(updates).eq('id', postId);

  btn.disabled = false;
  btn.textContent = '更新する';

  if (error) { alert('更新に失敗しました: ' + error.message); return; }

  closeAdminEdit();
  await loadAdminPosts(currentAdminTab);
}

// ─── ユーティリティ ──────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
