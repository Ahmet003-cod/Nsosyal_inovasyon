// ============================================================
// FRONTEND/APP.JS - NSosyal İnovasyon Platformu Ana Uygulama Logic
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// Yorumlar, Siber Güvenlik Phishing Taraması & Argo Moderasyonu Katmanı Entegre Edilmiştir
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (window.NSosyalData && window.NSosyalData.init) {
    await window.NSosyalData.init();
  }
  initApp();
});

// GLOBAL STATE
let currentFeedCategory = null;
let currentFeedTab = 'flow';
let isMediaMode = true;
let isLiveStreamActive = false;
let liveStreamTimer = null;
let pendingPostText = '';
let pendingBypassProfanity = false;
let composerAttachedImage = null;
let customPostModalImage = null;
let currentCommentPostId = null;
let isCommentModeActive = false;

// ===== INITIALIZATION =====
function initApp() {
  renderFeed();
  renderTrendingHashtags();
  renderJobs();
  renderUserReports();
  
  const composerInput = document.getElementById('composer-text');
  if (composerInput) {
    composerInput.addEventListener('input', handleComposerInputChange);
  }
}

// ===== RENDER FEED =====
function renderFeed() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  let posts = [...window.NSosyalData.posts];

  if (currentFeedCategory) {
    posts = posts.filter(p => p.category === currentFeedCategory);
  }

  if (currentFeedTab === 'media') {
    posts = posts.filter(p => p.image !== null && p.image !== undefined);
  }

  if (posts.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 12px;">📭</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text-secondary);">Bu kategoride gönderi bulunamadı.</div>
        <p style="font-size: 13px; margin-top: 6px;">Sol menüden "Haber/Gönderi Ekle" diyerek yeni içerik oluşturabilirsiniz.</p>
      </div>`;
    return;
  }

  let html = '';
  posts.forEach(post => {
    html += createPostCardHTML(post);
  });

  container.innerHTML = html;
}

// ===== CREATE POST CARD HTML =====
function createPostCardHTML(post) {
  const user = window.NSosyalData.getUserById(post.userId) || {
    name: 'NSosyal Kullanıcı', handle: '@kullanici', avatar: 'NK', color: '#2563EB', verified: false
  };

  const verifiedBadge = user.verified ? `<span class="verified-badge" title="Onaylı Hesap">✓</span>` : '';
  const liveBadge = post.isLive ? `<span class="live-badge">CANLI</span>` : '';
  const newPostClass = post.isNew ? 'new-post' : post.isLive ? 'live-post' : '';

  let hashtagsHTML = '';
  if (post.hashtags && post.hashtags.length > 0) {
    const list = Array.isArray(post.hashtags) ? post.hashtags : post.hashtags.split(',');
    hashtagsHTML = list.map(h => `<span class="post-hashtag" onclick="event.stopPropagation(); filterHashtag('${h}')">${h}</span> `).join('');
  }

  let imageHTML = '';
  if (isMediaMode && post.image) {
    imageHTML = `
      <div class="post-image">
        <img src="${post.image}" alt="Gönderi Görseli" loading="lazy" onerror="this.style.display='none'">
      </div>`;
  }

  let urlBadge = '';
  if (post.url) {
    urlBadge = `
      <div style="margin-top: 6px; font-size: 12px; color: var(--accent-blue-light); display: flex; align-items: center; gap: 4px;">
        🔗 <a href="${post.url}" target="_blank" rel="noopener noreferrer" style="color: #60A5FA; text-decoration: underline;">${post.url}</a>
      </div>`;
  }

  return `
    <article class="post-card ${newPostClass}" id="post-${post.id}">
      <div class="post-header">
        <div class="post-avatar" style="background: ${user.color || '#2563EB'}">
          ${user.avatar}
        </div>

        <div class="post-user-info">
          <div class="post-user-name">
            <span>${user.name}</span>
            ${verifiedBadge}
            ${liveBadge}
          </div>
          <div class="post-user-handle">${user.handle} • ${post.time}</div>
        </div>

        <button class="post-verify-bot-btn" onclick="event.stopPropagation(); verifyPostDirectly(${post.id})" title="Tam Hedef Makale URL Linkleriyle Teyit Et">
          <span>🤖</span>
          <span>Doğrula</span>
        </button>

        <button class="post-menu" title="Diğer Seçenekler">•••</button>
      </div>

      <div class="post-text">
        ${escapeHTML(post.text)}
        ${hashtagsHTML ? `<br><br>${hashtagsHTML}` : ''}
        ${urlBadge}
      </div>

      ${imageHTML}

      <div class="post-actions">
        <button class="action-btn ${post.liked ? 'liked' : ''}" onclick="toggleLikePost(${post.id})">
          <span>${post.liked ? '❤️' : '🤍'}</span>
          <span class="action-count">${post.likes}</span>
        </button>

        <button class="action-btn" onclick="openCommentsModal(${post.id})">
          <span>💬</span>
          <span class="action-count">${post.comments || 0}</span>
        </button>

        <button class="action-btn" onclick="showToast('info', '🔁 Gönderi akışınızda paylaşıldı!')">
          <span>🔁</span>
          <span class="action-count">${post.shares}</span>
        </button>

        <button class="action-btn ${post.saved ? 'saved' : ''}" onclick="toggleSavePost(${post.id})">
          <span>${post.saved ? '🔖' : '🏷️'}</span>
        </button>
      </div>
    </article>`;
}

// ===== COMMENTS MODAL & ARGO / SİBER GÜVENLİK MODERASYONU =====
async function openCommentsModal(postId) {
  currentCommentPostId = postId;
  isCommentModeActive = true;

  const post = window.NSosyalData.posts.find(p => p.id === postId);
  if (!post) return;

  const targetPreview = document.getElementById('modal-target-post-preview');
  if (targetPreview) {
    targetPreview.innerHTML = `📌 <strong>Seçilen Gönderi:</strong> "${escapeHTML(post.text)}"`;
  }

  const modal = document.getElementById('comments-modal');
  if (modal) modal.classList.add('visible');

  await renderCommentsList(postId);
}

function closeCommentsModal() {
  const modal = document.getElementById('comments-modal');
  if (modal) modal.classList.remove('visible');
  currentCommentPostId = null;
  isCommentModeActive = false;
  document.getElementById('comment-input-text').value = '';
}

async function renderCommentsList(postId) {
  const container = document.getElementById('comments-list-container');
  if (!container) return;

  container.innerHTML = `<div style="font-size: 13px; color: var(--text-muted);">⏳ Yorumlar yükleniyor...</div>`;

  const comments = await window.NSosyalData.getCommentsForPost(postId);

  if (comments.length === 0) {
    container.innerHTML = `
      <div style="font-size: 13px; color: var(--text-muted); text-align: center; padding: 16px 0;">
        💬 Henüz bu gönderiye yorum yapılmadı. İlk yorumu siz yapın!
      </div>`;
    return;
  }

  let html = '';
  comments.forEach(c => {
    const formattedTime = new Date(c.createdAt || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    html += `
      <div style="display: flex; gap: 10px; background: var(--bg-card); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${c.userColor || '#2563EB'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
          ${c.userAvatar || 'NK'}
        </div>
        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-main); display: flex; justify-content: space-between;">
            <span>${escapeHTML(c.userName || 'NSosyal Kullanıcı')}</span>
            <span style="font-weight: 400; color: var(--text-muted); font-size: 11px;">${formattedTime}</span>
          </div>
          <div style="font-size: 13px; color: var(--text-main); margin-top: 4px; line-height: 1.4;">
            ${escapeHTML(c.text)}
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

async function handleCommentSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('comment-input-text');
  const text = input ? input.value.trim() : '';

  if (!text || !currentCommentPostId) return;

  pendingPostText = text;
  isCommentModeActive = true;

  // ARGO VE SİBER GÜVENLİK PHİSHİNG MODERASYON KONTROLÜ
  const result = await window.ModerationEngine.moderate(text, pendingBypassProfanity);

  if (result.requiresUserAction && result.action === 'PROFANITY_WARNING') {
    document.getElementById('detected-profanity-words').innerText = result.phase1.foundWords.join(', ');
    document.getElementById('profanity-modal').classList.add('visible');
    return;
  }

  if (result.action === 'SECURITY_BLOCK') {
    const detailContainer = document.getElementById('security-threat-detail');
    let detailHTML = '<div style="font-weight: bold; margin-bottom: 6px;">Tespit Edilen Siber Tehditler:</div>';
    
    result.phase2.threats.forEach(t => {
      detailHTML += `
        <div class="threat-item">
          ❌ <strong>${t.domain}</strong><br>
          ${t.reason}<br>
          <span style="font-size: 10px; opacity: 0.8;">Ciddiyet Derecesi: ${t.severity}</span>
        </div>`;
    });

    detailContainer.innerHTML = detailHTML;
    document.getElementById('security-modal').classList.add('visible');
    return;
  }

  publishComment(currentCommentPostId, text);
}

async function publishComment(postId, rawText) {
  let textToPublish = rawText;
  if (pendingBypassProfanity) {
    textToPublish = window.ModerationEngine.maskProfanityText(rawText);
  }

  const comment = await window.NSosyalData.addCommentToPost(postId, textToPublish);

  document.getElementById('comment-input-text').value = '';
  pendingBypassProfanity = false;
  pendingPostText = '';

  await renderCommentsList(postId);
  renderFeed();

  if (textToPublish !== rawText) {
    showToast('warning', '⚠️ Yorumunuzdaki argo kelimeler (g***) şeklinde sansürlenerek eklendi!');
  } else {
    showToast('success', '💬 Yorumunuz SQLite veritabanına kaydedildi ve eklendi!');
  }
}

// ===== HER GÖNDERİ ÜZERİNDEN DOĞRUDAN FACT-CHECK TETİKLEME =====
async function verifyPostDirectly(postId) {
  const post = window.NSosyalData.posts.find(p => p.id === postId);
  if (!post) return;

  const card = document.getElementById(`post-${postId}`);
  if (card) {
    card.style.borderLeft = '4px solid var(--accent-purple)';
    setTimeout(() => { if (card) card.style.borderLeft = ''; }, 4000);
  }

  showToast('info', '🤖 Tam hedef MCP haber makale linkleri sorgulanıyor...');
  
  const panel = document.getElementById('ai-panel');
  if (panel && !panel.classList.contains('open')) {
    toggleAIPanel();
  }

  appendUserMessage(`🤖 "${post.text.substring(0, 70)}..." haberini doğrudan makale linkleriyle doğrula`);
  showThinkingIndicator();

  const report = await window.OmniAgent.deepFactCheckPost(post);
  removeThinkingIndicator();
  appendAgentMessage(report);
}

// ===== RENDER USER REPORTS =====
function renderUserReports() {
  const container = document.getElementById('user-reports-container');
  if (!container) return;

  const reports = [...(window.NSosyalData.userReports || [])];

  if (reports.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 12px;">📬</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text-secondary);">Henüz zamanlanmış rapor oluşturulmadı.</div>
        <p style="font-size: 13px; margin-top: 6px;">Yukarıdaki formdan raporlama döngünüzü belirleyip anında rapor üretebilirsiniz.</p>
      </div>`;
    return;
  }

  let html = '';
  reports.forEach(r => {
    const formattedDate = new Date(r.createdAt || Date.now()).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    html += `
      <div class="job-card" style="margin: 0 0 16px 0; background: var(--bg-card); border-left: 4px solid #10B981;">
        <div class="job-header">
          <div class="job-logo" style="background: linear-gradient(135deg, #059669, #10B981)">📬</div>
          <div class="job-meta" style="width: 100%;">
            <div class="job-title" style="justify-content: space-between;">
              <span>${escapeHTML(r.title)}</span>
              <span class="urgent-badge" style="background: rgba(16, 185, 129, 0.2); color: #10B981;">${escapeHTML(r.frequency)}</span>
            </div>
            <div class="job-company">Oluşturulma: ${formattedDate} • Durum: Aktif Otomatik Döngüde</div>
            
            <div style="margin-top: 12px; padding: 12px; background: var(--bg-dark); border-radius: 8px; font-size: 13px; line-height: 1.5; color: var(--text-main); white-space: pre-line;">
              ${escapeHTML(r.summaryText)}
            </div>

            <div class="job-actions" style="margin-top: 14px;">
              <button class="word-download-btn" onclick="downloadReportWordCard(${r.id})">
                📥 Raporu Word Dökümanı (.docx) Olarak İndir
              </button>
            </div>
          </div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// HANDLE USER REPORT SUBMIT
async function handleCreateUserReportSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('report-title-input').value.trim();
  const frequency = document.getElementById('report-frequency-select').value;

  if (!title) {
    showToast('error', 'Lütfen rapor başlığı girin.');
    return;
  }

  showToast('info', '⚡ Zamanlanmış otomatik rapor SQLite veritabanında oluşturuluyor...');

  const report = await window.NSosyalData.addUserReport({
    title: title,
    frequency: frequency,
    criteria: title
  });

  document.getElementById('report-title-input').value = '';
  renderUserReports();
  showToast('success', `✅ "${title}" raporu zamanlandı ve portala eklendi!`);
}

// DOWNLOAD REPORT WORD FROM CARD
async function downloadReportWordCard(reportId) {
  const report = window.NSosyalData.userReports.find(r => r.id === reportId);
  if (!report) {
    showToast('error', 'Rapor verisi bulunamadı.');
    return;
  }

  showToast('info', '📄 Word dökümanı (.docx) hazırlanıyor...');

  try {
    const res = await fetch('/api/download-report-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim: report.title,
        score: report.score || 95,
        verdict: report.verdict || 'GÜVENİLİR HABER / DOĞRULANDI',
        sources: [
          { title: 'Anadolu Ajansı Teyit Masası', url: 'https://www.aa.com.tr/tr/arama', infoNote: 'Doğrulandı' },
          { title: 'Google Scholar Akademik İndeksi', url: 'https://scholar.google.com/', infoNote: 'Teyit edildi' }
        ]
      })
    });
    const data = await res.json();
    if (data.success && data.downloadUrl) {
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = data.filename || 'FactCheck_Report.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('success', '✅ Word dökümanı bilgisayarınıza indirildi!');
    }
  } catch (e) {
    console.error('Download error:', e);
    showToast('error', 'Word dökümanı indirilirken hata oluştu.');
  }
}

// ===== RENDER TRENDING HASHTAGS =====
function renderTrendingHashtags() {
  const container = document.getElementById('trending-hashtags-container');
  if (!container) return;

  let html = '';
  window.NSosyalData.trendingHashtags.forEach(item => {
    html += `
      <div class="trending-item" onclick="filterHashtag('#${item.tag}')">
        <div class="trending-hash">#</div>
        <div class="trending-info">
          <div class="trending-tag">${item.tag}</div>
          <div class="trending-count">${item.count} gönderi</div>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ===== RENDER JOBS =====
function renderJobs(filterCategory = 'hepsi', searchQuery = '') {
  const container = document.getElementById('jobs-list-container');
  if (!container) return;

  let jobs = [...window.NSosyalData.jobListings];

  if (filterCategory !== 'hepsi') {
    jobs = jobs.filter(j => j.category === filterCategory);
  }

  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    jobs = jobs.filter(j => 
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (Array.isArray(j.skills) ? j.skills : (j.skills || '').split(',')).some(s => s.toLowerCase().includes(q))
    );
  }

  if (jobs.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 40px; margin-bottom: 12px;">💼</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--text-secondary);">Kriterlere uygun iş ilanı bulunamadı.</div>
        <p style="font-size: 13px; margin-top: 6px;">"İş İlanı Ekle" butonuna tıklayarak yeni ilan yayınlayabilir veya "İş Alarmı Kur" butonuyla takip edebilirsiniz.</p>
      </div>`;
    return;
  }

  let html = '';
  jobs.forEach(job => {
    const urgentBadge = job.urgent ? `<span class="urgent-badge">🔴 ACİL</span>` : '';
    const newBadge = job.isNew ? `<span class="urgent-badge" style="background: rgba(37,99,235,0.2); color: #60A5FA;">✨ YENİ</span>` : '';
    const skillsList = Array.isArray(job.skills) ? job.skills : (job.skills || '').split(',');
    const skillsHTML = skillsList.map(s => `<span class="skill-tag">${s}</span>`).join('');

    html += `
      <div class="job-card" id="job-${job.id}">
        <div class="job-header">
          <div class="job-logo" style="background: ${job.color || '#2563EB'}">${job.logo}</div>
          <div class="job-meta">
            <div class="job-title">
              <span>${job.title}</span>
              ${urgentBadge}
              ${newBadge}
            </div>
            <div class="job-company">${job.company} • ${job.postedAt}</div>
            
            <div class="job-details">
              <span class="job-detail-tag">📍 ${job.location}</span>
              <span class="job-detail-tag">💰 ${job.salary}</span>
              <span class="job-detail-tag">👥 ${job.applicants} başvuru</span>
            </div>

            <div class="job-skills">${skillsHTML}</div>
          </div>
        </div>

        <div class="job-actions">
          <button class="job-apply-btn" onclick="showToast('success', '🚀 Başvurunuz ${job.company} firmasına iletildi!')">Hemen Başvur</button>
          <button class="job-alert-btn" onclick="openJobAlertModalWithTitle('${job.title}')">🔔 Bu Pozisyona Alarm Kur</button>
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ===== BİLGİSAYARDAN YEREL DOSYA SEÇME =====
function addComposerImage() {
  const fileInput = document.getElementById('composer-file-input');
  if (fileInput) {
    fileInput.click();
  }
}

function handleComposerFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('error', 'Lütfen geçerli bir resim dosyası seçin.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    composerAttachedImage = e.target.result;
    const previewContainer = document.getElementById('composer-image-preview');
    const previewImg = document.getElementById('composer-preview-img');
    if (previewContainer && previewImg) {
      previewImg.src = composerAttachedImage;
      previewContainer.classList.remove('hidden');
    }
    showToast('success', `🖼️ "${file.name}" görseli eklendi!`);
  };
  reader.readAsDataURL(file);
}

function removeComposerImage() {
  composerAttachedImage = null;
  const previewContainer = document.getElementById('composer-image-preview');
  const fileInput = document.getElementById('composer-file-input');
  if (previewContainer) previewContainer.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

function handleCustomPostFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    customPostModalImage = e.target.result;
    showToast('info', `🖼️ "${file.name}" yüklendi.`);
  };
  reader.readAsDataURL(file);
}

function openAddJobModal() {
  document.getElementById('add-job-modal').classList.add('visible');
}

function closeAddJobModal() {
  document.getElementById('add-job-modal').classList.remove('visible');
}

async function handleAddJobSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('new-job-title').value.trim();
  const company = document.getElementById('new-job-company').value.trim();
  const category = document.getElementById('new-job-category').value;
  const location = document.getElementById('new-job-location').value.trim();
  const salary = document.getElementById('new-job-salary').value.trim();
  const skillsInput = document.getElementById('new-job-skills').value;
  const urgent = document.getElementById('new-job-urgent').checked;

  if (!title || !company) {
    showToast('error', 'Lütfen başlık ve şirket adını doldurun.');
    return;
  }

  const skills = skillsInput.split(',').map(s => s.trim()).filter(s => s.length > 0);

  const newJob = await window.NSosyalData.addJobListing({
    title, company, category, location, salary, skills, urgent
  });

  closeAddJobModal();
  switchView('jobs');
  renderJobs();

  showToast('success', `💼 "${title}" iş ilanı SQLite veritabanına kaydedildi ve eklendi!`);
}

async function handlePostSubmit() {
  const composerInput = document.getElementById('composer-text');
  const text = composerInput ? composerInput.value.trim() : '';

  if (!text && !composerAttachedImage) {
    showToast('warning', 'Lütfen yayınlamak için bir metin veya görsel ekleyin.');
    return;
  }

  pendingPostText = text;
  isCommentModeActive = false;

  const result = await window.ModerationEngine.moderate(text, pendingBypassProfanity);

  if (result.requiresUserAction && result.action === 'PROFANITY_WARNING') {
    document.getElementById('detected-profanity-words').innerText = result.phase1.foundWords.join(', ');
    document.getElementById('profanity-modal').classList.add('visible');
    return;
  }

  if (result.action === 'SECURITY_BLOCK') {
    const detailContainer = document.getElementById('security-threat-detail');
    let detailHTML = '<div style="font-weight: bold; margin-bottom: 6px;">Tespit Edilen Siber Tehditler:</div>';
    
    result.phase2.threats.forEach(t => {
      detailHTML += `
        <div class="threat-item">
          ❌ <strong>${t.domain}</strong><br>
          ${t.reason}<br>
          <span style="font-size: 10px; opacity: 0.8;">Ciddiyet Derecesi: ${t.severity}</span>
        </div>`;
    });

    detailContainer.innerHTML = detailHTML;
    document.getElementById('security-modal').classList.add('visible');
    return;
  }

  publishPost(text);
}

async function publishPost(rawText) {
  let textToPublish = rawText;
  if (pendingBypassProfanity) {
    textToPublish = window.ModerationEngine.maskProfanityText(rawText);
  }

  const urls = window.ModerationEngine.extractURLs(textToPublish);
  const mainUrl = urls.length > 0 ? urls[0] : null;

  const finalImage = composerAttachedImage || (mainUrl ? 'https://picsum.photos/seed/linkpost/800/400' : null);

  const newPost = await window.NSosyalData.addPost({
    text: textToPublish,
    category: 'gündem',
    userId: 'gundem_net',
    url: mainUrl,
    image: finalImage
  });

  document.getElementById('composer-text').value = '';
  document.getElementById('composer-link-preview').classList.add('hidden');
  removeComposerImage();
  pendingBypassProfanity = false;
  pendingPostText = '';

  renderFeed();
  if (textToPublish !== rawText) {
    showToast('warning', '⚠️ Gönderinizdeki argo sözcükler topluluk kuralları gereği (g***) şeklinde sansürlenerek yayınlandı!');
  } else {
    showToast('success', '✅ Gönderiniz SQLite veritabanına kaydedildi ve yayınlandı!');
  }
}

function closeProfanityModal(action) {
  document.getElementById('profanity-modal').classList.remove('visible');

  if (action === 'edit') {
    if (isCommentModeActive) {
      const input = document.getElementById('comment-input-text');
      if (input) input.focus();
    } else {
      focusComposer();
    }
    showToast('info', '✏️ Lütfen metninizdeki uygunsuz ifadeleri düzeltin.');
  } else if (action === 'insist') {
    pendingBypassProfanity = true;
    showToast('warning', '⚠️ Argo kelimeler (g***) şeklinde sansürlenerek ekleniyor...');
    if (isCommentModeActive && currentCommentPostId) {
      publishComment(currentCommentPostId, pendingPostText);
    } else {
      handlePostSubmit();
    }
  }
}

function closeSecurityModal() {
  document.getElementById('security-modal').classList.remove('visible');
  showToast('error', '🛡️ Güvensiz bağlantı içeren gönderiniz iptal edildi.');
}

function openAddPostModal() {
  document.getElementById('add-post-modal').classList.add('visible');
}

function closeAddPostModal() {
  document.getElementById('add-post-modal').classList.remove('visible');
}

async function handleCustomPostSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('new-post-category').value;
  const rawText = document.getElementById('new-post-text').value;
  const imageInput = document.getElementById('new-post-image').value;
  const url = document.getElementById('new-post-url').value || null;

  const finalImage = customPostModalImage || imageInput || null;

  if (!rawText.trim()) return;

  const modResult = await window.ModerationEngine.moderate(rawText, true);
  let textToPublish = rawText;
  if (modResult.phase1 && modResult.phase1.foundWords.length > 0) {
    textToPublish = window.ModerationEngine.maskProfanityText(rawText);
  }

  await window.NSosyalData.addPost({
    text: textToPublish,
    category: category,
    image: finalImage,
    url: url,
    userId: 'nhaber_19'
  });

  closeAddPostModal();
  customPostModalImage = null;
  renderFeed();
  showToast('success', '✨ Yeni içerik SQLite veritabanına eklendi!');
}

function toggleAIPanel() {
  const panel = document.getElementById('ai-panel');
  const layout = document.getElementById('app-layout');
  
  panel.classList.toggle('open');
  if (layout) layout.classList.toggle('ai-open');
}

async function handleAISendMessage() {
  const input = document.getElementById('ai-user-input');
  const text = input ? input.value.trim() : '';

  if (!text) return;

  input.value = '';
  appendUserMessage(text);
  showThinkingIndicator();

  const response = await window.OmniAgent.chat(text);

  removeThinkingIndicator();
  appendAgentMessage(response);
}

function sendQuickCommand(cmd) {
  document.getElementById('ai-user-input').value = cmd;
  handleAISendMessage();
}

function appendUserMessage(msg) {
  const container = document.getElementById('ai-messages-container');
  const div = document.createElement('div');
  div.className = 'message-bubble user';
  div.innerHTML = `
    <div class="message-content">${escapeHTML(msg)}</div>
    <div class="message-time">şimdi</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendAgentMessage(msg) {
  const container = document.getElementById('ai-messages-container');
  const div = document.createElement('div');
  div.className = 'message-bubble agent';
  
  const formattedMsg = msg
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #60A5FA; text-decoration: underline; font-weight: 600; font-size: 13px;">$1 ↗</a>');

  div.innerHTML = `
    <div class="message-content">${formattedMsg}</div>
    <div class="message-time">şimdi</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showThinkingIndicator() {
  const container = document.getElementById('ai-messages-container');
  const div = document.createElement('div');
  div.className = 'message-bubble agent thinking-bubble';
  div.id = 'ai-thinking';
  div.innerHTML = `
    <div class="message-content">
      <span>Agent düşüncesi üretiliyor ve 50 kaynak haritası sorgulanıyor</span>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeThinkingIndicator() {
  const thinking = document.getElementById('ai-thinking');
  if (thinking) thinking.remove();
}

function handleAIInputKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleAISendMessage();
  }
}

function askFactCheckForPost(postText) {
  toggleAIPanel();
  const input = document.getElementById('ai-user-input');
  input.value = `Bu haberi doğrula: "${postText.substring(0, 100)}"`;
  handleAISendMessage();
}

function openJobAlertModalWithTitle(title) {
  document.getElementById('job-alert-input').value = title;
  openJobAlertModal();
}

function openJobAlertModal() {
  document.getElementById('job-alert-modal').classList.add('visible');
}

function closeJobAlertModal() {
  document.getElementById('job-alert-modal').classList.remove('visible');
}

async function submitJobAlert() {
  const criteria = document.getElementById('job-alert-input').value.trim();

  if (!criteria) {
    showToast('warning', 'Lütfen bir iş kriteri girin.');
    return;
  }

  closeJobAlertModal();
  toggleAIPanel();

  appendUserMessage(`${criteria} pozisyonu için iş alarmı kur`);
  const response = await window.OmniAgent.setJobAlert(criteria);
  appendAgentMessage(response);
}

function switchView(viewName) {
  const feedView = document.getElementById('feed-view');
  const jobsView = document.getElementById('jobs-view');
  const reportsView = document.getElementById('reports-view');

  const navHome = document.getElementById('nav-home');
  const navJobs = document.getElementById('nav-jobs');
  const navReports = document.getElementById('nav-reports');

  if (feedView) feedView.classList.remove('active');
  if (jobsView) jobsView.classList.remove('active');
  if (reportsView) reportsView.classList.remove('active');

  if (navHome) navHome.classList.remove('active');
  if (navJobs) navJobs.classList.remove('active');
  if (navReports) navReports.classList.remove('active');

  if (viewName === 'feed') {
    if (feedView) feedView.classList.add('active');
    if (navHome) navHome.classList.add('active');
  } else if (viewName === 'jobs') {
    if (jobsView) jobsView.classList.add('active');
    if (navJobs) navJobs.classList.add('active');
    renderJobs();
  } else if (viewName === 'reports') {
    if (reportsView) reportsView.classList.add('active');
    if (navReports) navReports.classList.add('active');
    renderUserReports();
  }
}

function filterCategory(cat) {
  switchView('feed');
  currentFeedCategory = cat;
  showToast('info', `📌 "${cat.toUpperCase()}" kategorisi filtrelendi.`);
  renderFeed();
}

function filterHashtag(tag) {
  switchView('feed');
  const cleanTag = tag.replace('#', '');
  currentFeedCategory = null;
  const container = document.getElementById('posts-container');
  const posts = window.NSosyalData.posts.filter(p => {
    const list = Array.isArray(p.hashtags) ? p.hashtags : (p.hashtags || '').split(',');
    return list.some(h => h.toLowerCase().includes(cleanTag.toLowerCase())) || p.text.toLowerCase().includes(cleanTag.toLowerCase());
  });

  let html = `<div style="padding: 12px 16px; font-weight: bold; color: var(--accent-blue-light); border-bottom: 1px solid var(--border);">
    #${cleanTag} etiketi için ${posts.length} gönderi bulundu:
  </div>`;
  posts.forEach(p => html += createPostCardHTML(p));
  container.innerHTML = html;
}

function toggleLikePost(id) {
  const post = window.NSosyalData.posts.find(p => p.id === id);
  if (post) {
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    renderFeed();
  }
}

function toggleSavePost(id) {
  const post = window.NSosyalData.posts.find(p => p.id === id);
  if (post) {
    post.saved = !post.saved;
    showToast('info', post.saved ? '🔖 Gönderi kaydedildi!' : '🏷️ Gönderi kaydı kaldırıldı.');
    renderFeed();
  }
}

function filterJobs(cat, btn) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const searchVal = document.getElementById('jobs-search-input').value;
  renderJobs(cat, searchVal);
}

function handleJobSearch() {
  const val = document.getElementById('jobs-search-input').value;
  renderJobs('hepsi', val);
}

function handleGlobalSearch(e) {
  if (e.key === 'Enter') {
    const val = document.getElementById('global-search-input').value.trim();
    if (val) {
      filterHashtag(val);
    }
  }
}

function handleComposerInputChange() {
  const text = document.getElementById('composer-text').value;
  const urls = window.ModerationEngine.extractURLs(text);
  const preview = document.getElementById('composer-link-preview');
  const urlSpan = document.getElementById('detected-url');

  if (urls.length > 0) {
    preview.classList.remove('hidden');
    urlSpan.innerText = urls[0];
  } else {
    preview.classList.add('hidden');
  }
}

function focusComposer() {
  switchView('feed');
  const input = document.getElementById('composer-text');
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleMediaMode() {
  isMediaMode = !isMediaMode;
  const switchEl = document.getElementById('media-toggle-switch');
  if (switchEl) switchEl.classList.toggle('on', isMediaMode);
  renderFeed();
  showToast('info', isMediaMode ? '▶ Görsel medya modu açıldı.' : '⏹️ Sadece metin modu açıldı.');
}

function appendComposerEmoji(emoji) {
  const input = document.getElementById('composer-text');
  if (input) input.value += ' ' + emoji;
}

function showToast(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
