// ─── Supabase 設定 ───────────────────────────────────────────
// SupabaseダッシュボードのProject Settings → API から値をコピーして貼り付けてください
const SUPABASE_URL = 'https://cjiilnroxlawimpiayxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_AtSfKddyJFuI_OCyRf61eg_d6H76fX_';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── 状態管理 ─────────────────────────────────────────────────
let currentTab = 'hire';
let expandedPostId = null;

// ─── 初期化 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPosts('hire');
});

// ─── タブ切り替え ──────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  expandedPostId = null;

  document.getElementById('tab-hire').classList.toggle('active', tab === 'hire');
  document.getElementById('tab-work').classList.toggle('active', tab === 'work');
  document.body.classList.toggle('tab-work', tab === 'work');

  loadPosts(tab);
}

// ─── 投稿一覧取得・描画 ────────────────────────────────────────
async function loadPosts(type) {
  const list = document.getElementById('post-list');
  list.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('type', type)
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

// ─── カードHTML生成 ────────────────────────────────────────────
function renderCard(post) {
  const date = formatDate(post.created_at);
  const excerpt = post.description.length > 120
    ? post.description.slice(0, 120) + '…'
    : post.description;

  let badge = '';
  if (post.type === 'hire' && post.budget_range) {
    badge = `<span class="post-badge badge-budget">💰 ${escapeHtml(post.budget_range)}</span>`;
  }
  if (post.type === 'work' && post.skills) {
    badge = `<span class="post-badge badge-skills">🛠 ${escapeHtml(post.skills)}</span>`;
  }

  return `
    <div class="post-card" id="card-${post.id}">
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

// ─── 詳細展開・折りたたみ ──────────────────────────────────────
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

// ─── 詳細内容HTML ──────────────────────────────────────────────
function renderDetailContent(post) {
  let extra = '';

  if (post.type === 'hire') {
    if (post.budget_range) {
      extra += `
        <div class="detail-section">
          <div class="detail-label">予算感</div>
          <div class="detail-value">${escapeHtml(post.budget_range)}</div>
        </div>`;
    }
  } else {
    if (post.skills) {
      extra += `
        <div class="detail-section">
          <div class="detail-label">スキル</div>
          <div class="detail-value">${escapeHtml(post.skills)}</div>
        </div>`;
    }
    if (post.experience) {
      extra += `
        <div class="detail-section">
          <div class="detail-label">経験</div>
          <div class="detail-value">${escapeHtml(post.experience)}</div>
        </div>`;
    }
    if (post.desired_work) {
      extra += `
        <div class="detail-section">
          <div class="detail-label">希望する仕事の種類</div>
          <div class="detail-value">${escapeHtml(post.desired_work)}</div>
        </div>`;
    }
  }

  return `
    <div class="detail-section">
      <div class="detail-label">詳細</div>
      <div class="detail-value">${escapeHtml(post.description)}</div>
    </div>
    ${extra}
    <div class="detail-section">
      <div class="detail-label">連絡先</div>
      <div class="contact-value">${escapeHtml(post.contact)}</div>
    </div>
    <div class="comments-section" id="comments-${post.id}">
      <div class="loading" style="padding:10px 0">コメントを読み込み中...</div>
    </div>`;
}

// ─── コメント読み込み ──────────────────────────────────────────
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

// ─── コメント送信 ──────────────────────────────────────────────
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

  if (error) {
    alert('送信に失敗しました: ' + error.message);
    return;
  }

  authorInput.value = '';
  bodyInput.value = '';
  await loadComments(postId);
}

// ─── 投稿モーダル ──────────────────────────────────────────────
function openNewPostModal() {
  const overlay = document.getElementById('modal-overlay');
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

  overlay.classList.remove('hidden');
  document.getElementById('f-author').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('post-form').reset();
  document.getElementById('submit-btn').disabled = false;
  document.getElementById('submit-btn').textContent = '投稿する';
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('modal-overlay')) {
    closeModal();
  }
}

// ─── 新規投稿送信 ──────────────────────────────────────────────
async function submitNewPost(event) {
  event.preventDefault();

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = '投稿中...';

  const postData = {
    type: currentTab,
    author_name: document.getElementById('f-author').value.trim(),
    title: document.getElementById('f-title').value.trim(),
    description: document.getElementById('f-description').value.trim(),
    contact: document.getElementById('f-contact').value.trim(),
  };

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

// ─── ユーティリティ ────────────────────────────────────────────
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
