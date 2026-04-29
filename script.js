// ─── Supabase 設定 ─────────────────────────────────────────────
const SUPABASE_URL = 'https://cjiilnroxlawimpiayxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AtSfKddyJFuI_OCyRf61eg_d6H76fX_';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 状態管理 ──────────────────────────────────────────────────
let currentTab = 'hire';
let expandedPostId = null;
let pendingAuthAction = null; // { action: 'edit'|'delete'|'close', postId, editKey }

// ─── 初期化 ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPosts('hire');
});

// ─── タブ切り替え ────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  expandedPostId = null;
  document.getElementById('tab-hire').classList.toggle('active', tab === 'hire');
  document.getElementById('tab-work').classList.toggle('active', tab === 'work');
  document.body.classList.toggle('tab-work', tab === 'work');
  loadPosts(tab);
}

// ─── 投稿一覧取得・描画 ──────────────────────────────────────────
async function loadPosts(type) {
  const list = document.getElementById('post-list');
  list.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('type', type)
    .neq('status', 'hidden')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<div class="loading">読み込みに失敗しました: ${error.message}</div>`;
    return;
  }

  const countEl = document.getElementById('post-count');
  countEl.textContent = posts.length > 0 ? `${posts.length}件の投稿` : '';

  if (posts.length === 0) {
    const label = type === 'hire' ? '仕事をお願いしたい' : '仕事を受けたい';
    list.innerHTML = `
      <div class="empty-state">
        <p>📋</p>
        <p>まだ「${label}」の投稿がありません。<br>最初の投稿をしてみましょう！</p>
      </div>`;
    return;
  }

  list.innerHTML = posts.map(renderCard).join('');
}

// ─── カードHTML生成 ──────────────────────────────────────────────
function renderCard(post) {
  const date = formatDate(post.created_at);
  const excerpt = post.description.length > 120
    ? post.description.slice(0, 120) + '…'
    : post.description;
  const isClosed = post.status === 'closed';

  let badge = '';
  if (isClosed) {
    badge = `<span class="post-badge badge-closed">🤝 ご成約済み</span>`;
  } else if (post.type === 'hire' && post.budget_range) {
    badge = `<span class="post-badge badge-budget">💰 ${escapeHtml(post.budget_range)}</span>`;
  } else if (post.type === 'work' && post.skills) {
    badge = `<span class="post-badge badge-skills">🛠 ${escapeHtml(post.skills)}</span>`;
  }

  return `
    <div class="post-card${isClosed ? ' closed' : ''}" id="card-${post.id}">
      <div class="post-card-header">
        <div class="post-meta">
          <span class="post-author">${escapeHtml(post.author_name)}</span>
          <span class="post-date">${date}</span>
        </div>
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-excerpt">${escapeHtml(excerpt)}</div>
        ${badge}
      </div>
      <button class="toggle-detail-btn" onclick="togglePostDetail('${post.id}')">
        詳細・コメントを見る ▼
      </button>
      <div id="detail-${post.id}" class="post-detail hidden"></div>
    </div>`;
}

// ─── 詳細展開・折りたたみ ────────────────────────────────────────
async function togglePostDetail(postId) {
  const detailEl = document.getElementById(`detail-${postId}`);
  const btn = detailEl.previousElementSibling;

  if (!detailEl.classList.contains('hidden')) {
    detailEl.classList.add('hidden');
    btn.textContent = '詳細・コメントを見る ▼';
    expandedPostId = null;
    return;
  }

  if (expandedPostId && expandedPostId !== postId) {
    const prevDetail = document.getElementById(`detail-${expandedPostId}`);
    const prevBtn = prevDetail.previousElementSibling;
    prevDetail.classList.add('hidden');
    prevBtn.textContent = '詳細・コメントを見る ▼';
  }

  expandedPostId = postId;
  btn.textContent = '閉じる ▲';
  detailEl.innerHTML = '<div class="loading" style="padding:20px">読み込み中...</div>';
  detailEl.classList.remove('hidden');

  const { data: post, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) {
    detailEl.innerHTML = `<div class="loading">読み込みに失敗しました</div>`;
    return;
  }

  detailEl.innerHTML = renderDetailContent(post);
  await loadComments(postId);
}

// ─── 詳細内容HTML ────────────────────────────────────────────────
function renderDetailContent(post) {
  const isClosed = post.status === 'closed';
  let extra = '';

  if (post.type === 'hire' && post.budget_range) {
    extra += `
      <div class="detail-section">
        <div class="detail-label">予算感</div>
        <div class="detail-value">${escapeHtml(post.budget_range)}</div>
      </div>`;
  }
  if (post.type === 'work') {
    if (post.skills) extra += `
      <div class="detail-section">
        <div class="detail-label">スキル</div>
        <div class="detail-value">${escapeHtml(post.skills)}</div>
      </div>`;
    if (post.experience) extra += `
      <div class="detail-section">
        <div class="detail-label">経験</div>
        <div class="detail-value">${escapeHtml(post.experience)}</div>
      </div>`;
    if (post.desired_work) extra += `
      <div class="detail-section">
        <div class="detail-label">希望する仕事の種類</div>
        <div class="detail-value">${escapeHtml(post.desired_work)}</div>
      </div>`;
  }

  const actions = (post.edit_key && post.author_email) ? `
    <div class="post-actions">
      ${!isClosed ? `<button class="btn-success" onclick="requestAuth('close', '${post.id}', '${escapeHtml(post.edit_key)}', '${escapeHtml(post.author_email)}')">🤝 成約済みにする</button>` : ''}
      <button class="btn-secondary" onclick="requestAuth('edit', '${post.id}', '${escapeHtml(post.edit_key)}', '${escapeHtml(post.author_email)}')">✏️ 編集する</button>
      <button class="btn-danger" onclick="requestAuth('delete', '${post.id}', '${escapeHtml(post.edit_key)}', '${escapeHtml(post.author_email)}')">🗑 削除する</button>
    </div>` : '';

  return `
    <div class="detail-section">
      <div class="detail-label">詳細</div>
      <div class="detail-value">${escapeHtml(post.description)}</div>
    </div>
    ${extra}
    <div class="detail-section">
      <div class="detail-label">連絡先</div>
      <div class="contact-value">${linkify(post.contact)}</div>
    </div>
    ${actions}
    <div class="comments-section" id="comments-${post.id}">
      <div class="loading" style="padding:10px 0">コメントを読み込み中...</div>
    </div>`;
}

// ─── 投稿者認証 ─────────────────────────────────────────────────
function requestAuth(action, postId, editKey, authorEmail) {
  pendingAuthAction = { action, postId, editKey, authorEmail };
  const titles = { edit: '編集する', delete: '削除する', close: '成約済みにする' };
  document.getElementById('auth-modal-title').textContent = titles[action];
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-modal-overlay').classList.remove('hidden');
  document.getElementById('auth-email').focus();
}

function closeAuthModal() {
  document.getElementById('auth-modal-overlay').classList.add('hidden');
  pendingAuthAction = null;
}

function handleAuthOverlayClick(event) {
  if (event.target === document.getElementById('auth-modal-overlay')) closeAuthModal();
}

async function confirmAuth() {
  if (!pendingAuthAction) return;
  const { action, postId, editKey, authorEmail } = pendingAuthAction;
  const enteredEmail = document.getElementById('auth-email').value.trim();
  const enteredPassword = document.getElementById('auth-password').value;

  if (enteredEmail !== authorEmail || enteredPassword !== editKey) {
    alert('メールアドレスまたはパスワードが違います');
    return;
  }

  closeAuthModal();

  if (action === 'edit') await openEditModal(postId);
  if (action === 'delete') await deletePost(postId);
  if (action === 'close') await closePost(postId);
}

// ─── 成約済みにする ──────────────────────────────────────────────
async function closePost(postId) {
  const { error } = await supabaseClient
    .from('posts')
    .update({ status: 'closed' })
    .eq('id', postId);

  if (error) { alert('更新に失敗しました'); return; }
  await loadPosts(currentTab);
}

// ─── 投稿削除 ────────────────────────────────────────────────────
async function deletePost(postId) {
  if (!confirm('この投稿を削除してもよいですか？')) return;

  const { error } = await supabaseClient
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) { alert('削除に失敗しました'); return; }
  await loadPosts(currentTab);
}

// ─── 投稿編集モーダル ────────────────────────────────────────────
async function openEditModal(postId) {
  const { data: post, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) { alert('データの取得に失敗しました'); return; }

  document.getElementById('ef-id').value = post.id;
  document.getElementById('ef-title').value = post.title;
  document.getElementById('ef-description').value = post.description;
  document.getElementById('ef-contact').value = post.contact;

  if (post.type === 'hire') {
    document.getElementById('ef-hire-fields').classList.remove('hidden');
    document.getElementById('ef-work-fields').classList.add('hidden');
    document.getElementById('ef-budget').value = post.budget_range || '';
  } else {
    document.getElementById('ef-hire-fields').classList.add('hidden');
    document.getElementById('ef-work-fields').classList.remove('hidden');
    document.getElementById('ef-skills').value = post.skills || '';
    document.getElementById('ef-experience').value = post.experience || '';
    document.getElementById('ef-desired').value = post.desired_work || '';
  }

  document.getElementById('edit-modal-overlay').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal-overlay').classList.add('hidden');
}

function handleEditOverlayClick(event) {
  if (event.target === document.getElementById('edit-modal-overlay')) closeEditModal();
}

async function submitEditPost(event) {
  event.preventDefault();
  const btn = event.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '更新中...';

  const postId = document.getElementById('ef-id').value;
  const { data: post } = await supabaseClient.from('posts').select('type').eq('id', postId).single();

  const updates = {
    title: document.getElementById('ef-title').value.trim(),
    description: document.getElementById('ef-description').value.trim(),
    contact: document.getElementById('ef-contact').value.trim(),
  };

  if (post.type === 'hire') {
    updates.budget_range = document.getElementById('ef-budget').value.trim() || null;
  } else {
    updates.skills = document.getElementById('ef-skills').value.trim() || null;
    updates.experience = document.getElementById('ef-experience').value.trim() || null;
    updates.desired_work = document.getElementById('ef-desired').value.trim() || null;
  }

  const { error } = await supabaseClient.from('posts').update(updates).eq('id', postId);

  btn.disabled = false;
  btn.textContent = '更新する';

  if (error) { alert('更新に失敗しました: ' + error.message); return; }

  closeEditModal();
  await loadPosts(currentTab);
}

// ─── コメント読み込み ────────────────────────────────────────────
async function loadComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  const { data: comments, error } = await supabaseClient
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    section.innerHTML = `<div class="no-comments">コメントの読み込みに失敗しました</div>`;
    return;
  }

  const commentListHtml = comments.length === 0
    ? '<div class="no-comments">まだコメントはありません</div>'
    : comments.map(c => `
        <div class="comment-item">
          <div class="comment-meta">
            <span class="comment-author">${escapeHtml(c.author_name)}</span>
            <span class="comment-date">${formatDate(c.created_at)}</span>
          </div>
          <div class="comment-body">${escapeHtml(c.content)}</div>
        </div>`).join('');

  section.innerHTML = `
    <div class="comments-title">💬 コメント (${comments.length}件)</div>
    <div id="comment-list-${postId}">${commentListHtml}</div>
    <form class="comment-form" onsubmit="submitComment(event, '${postId}')">
      <input type="text" id="c-author-${postId}" placeholder="ニックネーム" required maxlength="50">
      <textarea id="c-body-${postId}" rows="3" placeholder="コメントを書く..." required maxlength="500"></textarea>
      <button type="submit" class="btn-comment">送信</button>
    </form>`;
}

// ─── コメント送信 ────────────────────────────────────────────────
async function submitComment(event, postId) {
  event.preventDefault();
  const authorInput = document.getElementById(`c-author-${postId}`);
  const bodyInput = document.getElementById(`c-body-${postId}`);
  const btn = event.target.querySelector('button[type="submit"]');

  const author = authorInput.value.trim();
  const content = bodyInput.value.trim();
  if (!author || !content) return;

  btn.disabled = true;
  btn.textContent = '送信中...';

  const { error } = await supabaseClient
    .from('comments')
    .insert({ post_id: postId, author_name: author, content });

  btn.disabled = false;
  btn.textContent = '送信';

  if (error) { alert('送信に失敗しました: ' + error.message); return; }

  authorInput.value = '';
  bodyInput.value = '';
  await loadComments(postId);
}

// ─── 投稿モーダル ────────────────────────────────────────────────
function openNewPostModal() {
  const hireFields = document.getElementById('hire-fields');
  const workFields = document.getElementById('work-fields');
  const title = document.getElementById('modal-title');

  if (currentTab === 'hire') {
    title.textContent = '右腕を募集する';
    hireFields.classList.remove('hidden');
    workFields.classList.add('hidden');
  } else {
    title.textContent = '仕事を探している';
    hireFields.classList.add('hidden');
    workFields.classList.remove('hidden');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-author').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('post-form').reset();
  const btn = document.getElementById('submit-btn');
  btn.disabled = false;
  btn.textContent = '投稿する';
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('modal-overlay')) closeModal();
}

// ─── 新規投稿送信 ────────────────────────────────────────────────
async function submitNewPost(event) {
  event.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = '投稿中...';

  const editKey = document.getElementById('f-editkey').value.trim();
  const postData = {
    type: currentTab,
    author_name: document.getElementById('f-author').value.trim(),
    title: document.getElementById('f-title').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    contact: document.getElementById('f-contact').value.trim(),
    status: 'active',
  };

  const email = document.getElementById('f-email').value.trim();
  if (editKey) postData.edit_key = editKey;
  if (email) postData.author_email = email;

  if (currentTab === 'hire') {
    const budget = document.getElementById('f-budget').value.trim();
    if (budget) postData.budget_range = budget;
  } else {
    const skills = document.getElementById('f-skills').value.trim();
    const experience = document.getElementById('f-experience').value.trim();
    const desired = document.getElementById('f-desired').value.trim();
    if (skills) postData.skills = skills;
    if (experience) postData.experience = experience;
    if (desired) postData.desired_work = desired;
  }

  const { error } = await supabaseClient.from('posts').insert(postData);

  if (error) {
    alert('投稿に失敗しました: ' + error.message);
    btn.disabled = false;
    btn.textContent = '投稿する';
    return;
  }

  closeModal();
  await loadPosts(currentTab);
}

// ─── ユーティリティ ──────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function linkify(str) {
  if (!str) return '';
  const escaped = escapeHtml(str);
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:inherit;word-break:break-all;">$1</a>'
  );
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
