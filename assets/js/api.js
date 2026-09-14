const API_BASE = '/api';

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('siteclass_auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { credentials: 'include', headers, ...options });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = { _raw: rawText }; }
  if (!res.ok) {
    const detail = data.error || data._raw || `HTTP ${res.status}`;
    throw new Error(`${detail} (HTTP ${res.status})`);
  }
  return data;
}

const api = {
  register: (username, display_name, password) => apiRequest('/register.php', { method: 'POST', body: JSON.stringify({ username, display_name, password }) }),
  login: async (username, password) => {
    const data = await apiRequest('/login.php', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!data || !data.token) {
      const responseDetails = data && data._raw ? data._raw : JSON.stringify(data || {});
      console.error('SITECLASS LOGIN RESPONSE:', data);
      throw new Error(`توکن ورود دریافت نشد. پاسخ سرور: ${responseDetails}`);
    }
    localStorage.setItem('siteclass_auth_token', data.token);
    return data;
  },
  logout: async () => { try { await apiRequest('/logout.php', { method: 'POST' }); } finally { localStorage.removeItem('siteclass_auth_token'); } },
  me: () => apiRequest('/me.php'),
  sendMessage: (payload) => apiRequest('/chat-send.php', { method: 'POST', body: JSON.stringify(payload) }),
  getGroupMessages: () => apiRequest('/chat-group.php'),
  getPrivateMessages: (userId) => apiRequest(`/chat-private.php?with=${userId}`),
  getContacts: () => apiRequest('/contacts.php'),
  getSchedule: () => apiRequest('/schedule-get.php'),
  addSchedule: (payload) => apiRequest('/schedule-add.php', { method: 'POST', body: JSON.stringify(payload) }),
  getScheduleSettings: () => apiRequest('/schedule-settings-get.php'),
  setScheduleSettings: (lessons_per_day) => apiRequest('/schedule-settings-set.php', { method: 'POST', body: JSON.stringify({ lessons_per_day }) }),
  uploadFile: async (file) => { const formData = new FormData(); formData.append('file', file); const headers = {}; const token = localStorage.getItem('siteclass_auth_token'); if (token) headers.Authorization = `Bearer ${token}`; const res = await fetch(API_BASE + '/upload.php', { method: 'POST', credentials: 'include', headers, body: formData }); const rawText = await res.text(); let data = {}; try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = { _raw: rawText }; } if (!res.ok) throw new Error(data.error || data._raw || `HTTP ${res.status}`); return data; },
  getAllUploads: () => apiRequest('/uploads-list.php'),
  getOutings: () => apiRequest('/outings-list.php'),
  createOuting: (payload) => apiRequest('/outings-create.php', { method: 'POST', body: JSON.stringify(payload) }),
  addOutingAvailability: (outing_id, available_time) => apiRequest('/outings-availability.php', { method: 'POST', body: JSON.stringify({ outing_id, available_time }) }),
  addOutingComment: (outing_id, content) => apiRequest('/outings-comment.php', { method: 'POST', body: JSON.stringify({ outing_id, content }) }),
  getVideos: () => apiRequest('/videos-list.php'),
  addVideo: (payload) => apiRequest('/videos-add.php', { method: 'POST', body: JSON.stringify(payload) }),
  getDonateAccount: () => apiRequest('/settings-donate-get.php'),
  setDonateAccount: (account_number, account_name) => apiRequest('/settings-donate-set.php', { method: 'POST', body: JSON.stringify({ account_number, account_name }) }),
  getProjects: () => apiRequest('/projects-list.php'),
  createProject: (payload) => apiRequest('/projects-create.php', { method: 'POST', body: JSON.stringify(payload) }),
  getMyApiKeyStatus: (project_id) => apiRequest(`/projects-apikey-get.php?project_id=${project_id}`),
  saveMyApiKey: (project_id, api_key) => apiRequest('/projects-apikey-set.php', { method: 'POST', body: JSON.stringify({ project_id, api_key }) }),
  deleteMyApiKey: (project_id) => apiRequest('/projects-apikey-delete.php', { method: 'POST', body: JSON.stringify({ project_id }) }),
  getStudentGames: () => apiRequest('/student-games-list.php'),
  getStudentGame: (id) => apiRequest(`/student-games-get.php?id=${id}`),
  submitStudentGame: (payload) => apiRequest('/student-games-create.php', { method: 'POST', body: JSON.stringify(payload) }),
  submitGameScore: (game_key, score) => apiRequest('/game-score-submit.php', { method: 'POST', body: JSON.stringify({ game_key, score }) }),
  getLeaderboard: (game_key) => apiRequest(`/game-leaderboard.php${game_key ? '?game_key=' + game_key : ''}`),
  getProfile: () => apiRequest('/profile-get.php'),
  updateProfile: (payload) => apiRequest('/profile-update.php', { method: 'POST', body: JSON.stringify(payload) }),
  getAllUsers: () => apiRequest('/admin-users-list.php'),
  setUserRole: (user_id, role) => apiRequest('/admin-users-set-role.php', { method: 'POST', body: JSON.stringify({ user_id, role }) }),
  getSiteApiKeys: () => apiRequest('/admin-api-keys-list.php'),
  saveSiteApiKey: (payload) => apiRequest('/admin-api-keys-save.php', { method: 'POST', body: JSON.stringify(payload) }),
  setSharedMemory: (enabled) => apiRequest('/admin-api-keys-shared-memory.php', { method: 'POST', body: JSON.stringify({ enabled })),
  getLessonSubjects: () => apiRequest('/lessons-subjects-list.php'),
  createLessonSubject: (name) => apiRequest('/lessons-subjects-create.php', { method: 'POST', body: JSON.stringify({ name }) }),
  getLessonContents: (subject_id) => apiRequest(`/lessons-contents-list.php?subject_id=${subject_id}`),
  addLessonContent: (payload) => apiRequest('/lessons-contents-create.php', { method: 'POST', body: JSON.stringify(payload) }),
  getBooks: () => apiRequest('/notes-books-list.php'),
  createBook: (title, chapter_count) => apiRequest('/notes-books-create.php', { method: 'POST', body: JSON.stringify({ title, chapter_count }) }),
  getNotes: (chapter_id) => apiRequest(`/notes-list.php?chapter_id=${chapter_id}`),
  createNote: (payload) => apiRequest('/notes-create.php', { method: 'POST', body: JSON.stringify(payload) }),
  getSocialPosts: () => apiRequest('/social-posts-list.php'),
  createSocialPost: (content) => apiRequest('/social-posts-create.php', { method: 'POST', body: JSON.stringify({ content }) }),
  getBugs: () => apiRequest('/bugs-list.php'),
  createBug: (title, description) => apiRequest('/bugs-create.php', { method: 'POST', body: JSON.stringify({ title, description }) }),
  addBugComment: (bug_id, content) => apiRequest('/bugs-comment.php', { method: 'POST', body: JSON.stringify({ bug_id, content }) }),
  askCodeHelp: (code, question) => apiRequest('/projects-code-help.php', { method: 'POST', body: JSON.stringify({ code, question }) }),
  askProjectAI: (project_id, message) => apiRequest('/projects-ai-ask.php', { method: 'POST', body: JSON.stringify({ project_id, message }) }),
  getProjectCode: (project_id) => apiRequest(`/projects-code-get.php?project_id=${project_id}`),
  saveProjectCode: (project_id, code, language) => apiRequest('/projects-code-save.php', { method: 'POST', body: JSON.stringify({ project_id, code, language }) }),
};

function renderTopNav(user, activePage) {
  const baseLinks = [
    { href: 'dashboard.html', label: '🏠 خانه' }, { href: 'chat.html', label: '💬 چت' }, { href: 'schedule.html', label: '📅 برنامه' }, { href: 'lessons.html', label: '📚 دروس' }, { href: 'notes.html', label: '📝 جزوه' }, { href: 'outings.html', label: '🌳 بیرون‌رفتن' }, { href: 'games.html', label: '🎮 سرگرمی' }, { href: 'uploads.html', label: '📁 آپلودها' }, { href: 'videos.html', label: '📺 ویدیوها' }, { href: 'projects.html', label: '🧩 تکلیف' }, { href: 'account.html', label: '👤 حساب من' }, { href: 'donate.html', label: '💛 دونیت' }, { href: 'bugs.html', label: '🛠 رفع اشکال' },
  ];
  if (user.role === 'special' || user.role === 'admin') baseLinks.push({ href: 'social.html', label: '🔒 شبکهٔ اجتماعی' });
  if (user.role === 'admin') baseLinks.push({ href: 'admin.html', label: '🛡 پنل ادمین' });
  const linksHtml = baseLinks.map((l) => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<nav class="topnav" id="topnav"><button class="nav-toggle" id="nav-toggle" aria-label="منو">☰</button><div class="nav-links" id="nav-links">${linksHtml}</div><span class="spacer"></span><span class="user-name">${user.avatar_emoji || ''} ${user.display_name || user.username}</span><button class="logout" onclick="handleLogout()">خروج</button></nav>`);
  document.getElementById('nav-toggle').addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'));
}

async function handleLogout() { await api.logout(); location.href = 'login.html'; }

async function requirePageLogin(activePage) {
  try { const data = await api.me(); renderTopNav(data.user, activePage); return data.user; }
  catch (e) { localStorage.removeItem('siteclass_auth_token'); location.href = 'login.html'; return null; }
}

async function requirePageRole(activePage, allowedRoles) {
  const user = await requirePageLogin(activePage);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) { location.href = 'dashboard.html'; return null; }
  return user;
}
