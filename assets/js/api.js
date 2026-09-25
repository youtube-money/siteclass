const API_BASE = '/api';

function mediaProxyUrl(value, fileId = '') {
  const raw = String(value || '').trim();
  if (raw && /\/api\/google-file\.php\?id=/i.test(raw)) return raw;
  const m = raw.match(/drive\.google\.com\/(?:file\/d\/|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]+)/i);
  if (m) return API_BASE + '/google-file.php?id=' + encodeURIComponent(m[1]);
  if (fileId) return API_BASE + '/google-file.php?id=' + encodeURIComponent(fileId);
  return raw;
}


async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('siteclass_auth_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { credentials: 'include', headers, ...options });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = { _raw: rawText }; }
  if (!res.ok) { const detail = data.error || data._raw || `HTTP ${res.status}`; throw new Error(`${detail} (HTTP ${res.status})`); }
  return data;
}

function uploadDriveChunk(uploadId, file, start, end, onProgress, token) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('uploadId', uploadId);
    form.append('start', String(start));
    form.append('end', String(end));
    form.append('total', String(file.size));
    form.append('chunk', file.slice(start, end + 1), file.name);
    xhr.open('POST', `${API_BASE}/upload-chunk.php`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && typeof onProgress === 'function') onProgress(e.loaded, end - start + 1);
    };
    xhr.onerror = () => reject(new Error('ارتباط با سرور آپلود قطع شد. دوباره امتحان کن.'));
    xhr.ontimeout = () => reject(new Error('ارسال این بخش بیشتر از زمان مجاز طول کشید.'));
    xhr.onload = () => {
      let data = {};
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (_) {}
      if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data);
      else reject(new Error(data.error || `ارسال بخش فایل ناموفق بود (HTTP ${xhr.status})`));
    };
    xhr.send(form);
  });
}

async function uploadFileDirectToDrive(file, onProgress) {
  if (!file || !file.size) throw new Error('فایل نامعتبره.');
  const max = 1024 * 1024 * 1024;
  if (file.size > max) throw new Error('حجم فایل بیشتر از ۱ گیگابایت است.');
  const token = localStorage.getItem('siteclass_auth_token');
  if (!token) throw new Error('نشست ورود منقضی شده؛ دوباره وارد شو.');

  const startRes = await fetch(API_BASE + '/upload-session.php', {
    method:'POST', credentials:'include',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({name:file.name,mimeType:file.type||'application/octet-stream',size:file.size})
  });
  const startText = await startRes.text(); let startData={};
  try{startData=startText?JSON.parse(startText):{};}catch(_){startData={_raw:startText};}
  if(!startRes.ok||!startData.uploadId){
    if(startData.reauthorize && startData.connectUrl){
      const go = confirm('اتصال Google Drive منقضی یا لغو شده است. الان دوباره Google Drive را متصل کنیم؟');
      if(go) location.href = startData.connectUrl;
    }
    throw new Error(startData.error||startData._raw||`شروع آپلود ناموفق بود (HTTP ${startRes.status})`);
  }

  const chunkSize = 8 * 1024 * 1024;
  let driveFile = null;
  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(file.size - 1, start + chunkSize - 1);
    const result = await uploadDriveChunk(startData.uploadId, file, start, end, (loaded) => {
      if (typeof onProgress === 'function') onProgress(Math.min(99, Math.round(((start + loaded) / file.size) * 100)));
    }, token);
    if (result.complete) { driveFile = result.file; break; }
  }
  if (!driveFile || !driveFile.id) throw new Error('آپلود Google Drive کامل نشد.');
  const finalize = await apiRequest('/upload-finalize.php',{method:'POST',body:JSON.stringify({fileId:driveFile.id,filename:file.name,size:file.size,mimeType:file.type||'application/octet-stream'})});
  if(typeof onProgress==='function')onProgress(100);
  return finalize;
}

const api = {
  register:(username,display_name,password)=>apiRequest('/register.php',{method:'POST',body:JSON.stringify({username,display_name,password})}),
  login:async(username,password)=>{const data=await apiRequest('/login.php',{method:'POST',body:JSON.stringify({username,password})});if(!data||!data.token){const d=data&&data._raw?data._raw:JSON.stringify(data||{});console.error('SITECLASS LOGIN RESPONSE:',data);throw new Error(`توکن ورود دریافت نشد. پاسخ سرور: ${d}`);}localStorage.setItem('siteclass_auth_token',data.token);return data;},
  logout:async()=>{try{await apiRequest('/logout.php',{method:'POST'});}finally{localStorage.removeItem('siteclass_auth_token');}},
  me:()=>apiRequest('/me.php'), sendMessage:p=>apiRequest('/chat-send.php',{method:'POST',body:JSON.stringify(p)}), getGroupMessages:async()=>{const d=await apiRequest('/chat-group.php');(d.messages||[]).forEach(m=>m.media_url=mediaProxyUrl(m.media_url));return d;}, getPrivateMessages:async id=>{const d=await apiRequest(`/chat-private.php?with=${id}`);(d.messages||[]).forEach(m=>m.media_url=mediaProxyUrl(m.media_url));return d;}, getContacts:()=>apiRequest('/contacts.php'),
  getSchedule:()=>apiRequest('/schedule-get.php'), addSchedule:p=>apiRequest('/schedule-add.php',{method:'POST',body:JSON.stringify(p)}), getScheduleSettings:()=>apiRequest('/schedule-settings-get.php'), setScheduleSettings:n=>apiRequest('/schedule-settings-set.php',{method:'POST',body:JSON.stringify({lessons_per_day:n})}),
  uploadFile:(file,onProgress)=>uploadFileDirectToDrive(file,onProgress), getAllUploads:async()=>{const d=await apiRequest('/uploads-list.php');(d.uploads||[]).forEach(u=>u.direct_link=mediaProxyUrl(u.direct_link,u.drive_file_id));return d;}, getOutings:()=>apiRequest('/outings-list.php'), createOuting:p=>apiRequest('/outings-create.php',{method:'POST',body:JSON.stringify(p)}), addOutingAvailability:(outing_id,available_time)=>apiRequest('/outings-availability.php',{method:'POST',body:JSON.stringify({outing_id,available_time})}), addOutingComment:(outing_id,content)=>apiRequest('/outings-comment.php',{method:'POST',body:JSON.stringify({outing_id,content})}),
  getVideos:()=>apiRequest('/videos-list.php'), addVideo:p=>apiRequest('/videos-add.php',{method:'POST',body:JSON.stringify(p)}), getDonateAccount:()=>apiRequest('/settings-donate-get.php'), setDonateAccount:(account_number,account_name)=>apiRequest('/settings-donate-set.php',{method:'POST',body:JSON.stringify({account_number,account_name})}),
  getProjects:()=>apiRequest('/projects-list.php'), createProject:p=>apiRequest('/projects-create.php',{method:'POST',body:JSON.stringify(p)}), getMyApiKeyStatus:id=>apiRequest(`/projects-apikey-get.php?project_id=${id}`), saveMyApiKey:(project_id,api_key)=>apiRequest('/projects-apikey-set.php',{method:'POST',body:JSON.stringify({project_id,api_key})}), deleteMyApiKey:id=>apiRequest('/projects-apikey-delete.php',{method:'POST',body:JSON.stringify({project_id:id})}),
  getStudentGames:()=>apiRequest('/student-games-list.php'), getStudentGame:id=>apiRequest(`/student-games-get.php?id=${id}`), submitStudentGame:p=>apiRequest('/student-games-create.php',{method:'POST',body:JSON.stringify(p)}), submitGameScore:(game_key,score)=>apiRequest('/game-score-submit.php',{method:'POST',body:JSON.stringify({game_key,score})}), getLeaderboard:game_key=>apiRequest(`/game-leaderboard.php${game_key?'?game_key='+encodeURIComponent(game_key):''}`),
  getProfile:()=>apiRequest('/profile-get.php'), updateProfile:p=>apiRequest('/profile-update.php',{method:'POST',body:JSON.stringify(p)}), getAllUsers:()=>apiRequest('/admin-users-list.php'), setUserRole:(user_id,role)=>apiRequest('/admin-users-set-role.php',{method:'POST',body:JSON.stringify({user_id,role})}), getSiteApiKeys:()=>apiRequest('/admin-api-keys-list.php'), saveSiteApiKey:p=>apiRequest('/admin-api-keys-save.php',{method:'POST',body:JSON.stringify(p)}), setSharedMemory:enabled=>apiRequest('/admin-api-keys-shared-memory.php',{method:'POST',body:JSON.stringify({enabled})}),
  getLessonSubjects:()=>apiRequest('/lessons-subjects-list.php'), createLessonSubject:name=>apiRequest('/lessons-subjects-create.php',{method:'POST',body:JSON.stringify({name})}), getLessonContents:subject_id=>apiRequest(`/lessons-contents-list.php?subject_id=${subject_id}`), addLessonContent:p=>apiRequest('/lessons-contents-create.php',{method:'POST',body:JSON.stringify({subject_id:p.subject_id,content:p.content})}), getBooks:()=>apiRequest('/notes-books-list.php'), createBook:(title,chapter_count)=>apiRequest('/notes-books-create.php',{method:'POST',body:JSON.stringify({title,chapter_count})}), getNotes:chapter_id=>apiRequest(`/notes-list.php?chapter_id=${chapter_id}`), createNote:p=>apiRequest('/notes-create.php',{method:'POST',body:JSON.stringify(p)}),
  getSocialPosts:async()=>{const d=await apiRequest('/social-posts-list.php');(d.posts||[]).forEach(p=>p.media_url=mediaProxyUrl(p.media_url));return d;}, createSocialPost:(content,media_url='',media_type='')=>apiRequest('/social-posts-create.php',{method:'POST',body:JSON.stringify({content,media_url:mediaProxyUrl(media_url),media_type})}), getBugs:()=>apiRequest('/bugs-list.php'), createBug:(title,description)=>apiRequest('/bugs-create.php',{method:'POST',body:JSON.stringify({title,description})}), addBugComment:(bug_id,content)=>apiRequest('/bugs-comment.php',{method:'POST',body:JSON.stringify({bug_id,content})}), askCodeHelp:(code,question)=>apiRequest('/projects-code-help.php',{method:'POST',body:JSON.stringify({code,question})}), askProjectAI:(project_id,message)=>apiRequest('/projects-ai-ask.php',{method:'POST',body:JSON.stringify({project_id,message})}), getProjectCode:project_id=>apiRequest(`/projects-code-get.php?project_id=${project_id}`), saveProjectCode:(project_id,code,language)=>apiRequest('/projects-code-save.php',{method:'POST',body:JSON.stringify({project_id,code,language})})
};

function renderTopNav(user,activePage){const baseLinks=[{href:'dashboard.html',label:'🏠 خانه'},{href:'chat.html',label:'💬 چت'},{href:'schedule.html',label:'📅 برنامه'},{href:'lessons.html',label:'📚 دروس'},{href:'notes.html',label:'📝 جزوه'},{href:'outings.html',label:'🌳 بیرون‌رفتن'},{href:'games.html',label:'🎮 سرگرمی'},{href:'uploads.html',label:'📁 آپلودها'},{href:'videos.html',label:'📺 ویدیوها'},{href:'projects.html',label:'🧩 تکلیف'},{href:'account.html',label:'👤 حساب من'},{href:'donate.html',label:'💛 دونیت'},{href:'bugs.html',label:'🛠 رفع اشکال'}];baseLinks.push({href:'social.html',label:'📸 شبکهٔ اجتماعی'});if(user.role==='admin')baseLinks.push({href:'admin.html',label:'🛡 پنل ادمین'});const linksHtml=baseLinks.map(l=>`<a href="${l.href}" class="${activePage===l.href?'active':''}">${l.label}</a>`).join('');document.body.insertAdjacentHTML('afterbegin',`<nav class="topnav" id="topnav"><button class="nav-toggle" id="nav-toggle" aria-label="منو">☰</button><div class="nav-links" id="nav-links">${linksHtml}</div><span class="spacer"></span><span class="user-name">${user.avatar_emoji||''} ${user.display_name||user.username}</span><button class="logout" onclick="handleLogout()">خروج</button></nav>`);document.getElementById('nav-toggle').addEventListener('click',()=>document.getElementById('nav-links').classList.toggle('open'));}
async function handleLogout(){await api.logout();location.href='login.html';}
async function requirePageLogin(activePage){try{const data=await api.me();renderTopNav(data.user,activePage);return data.user;}catch(e){localStorage.removeItem('siteclass_auth_token');location.href='login.html';return null;}}
async function requirePageRole(activePage,allowedRoles){const user=await requirePageLogin(activePage);if(!user)return null;if(!allowedRoles.includes(user.role)){location.href='dashboard.html';return null;}return user;}
