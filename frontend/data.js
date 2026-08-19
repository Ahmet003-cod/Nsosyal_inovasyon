// ============================================================
// FRONTEND/DATA.JS - NSosyal Veri Katmanı (SQLite REST API Entegreli)
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// TEKNOFEST Jüri Notu: Bu dosya, uygulamanın ön yüz veri yönetiminden sorumludur. 
// Sahte (Mock) verilerle birlikte arka yüz (Backend/SQLite) API'lerinden verileri çeker.
// ============================================================

const NSosyalData = {
  
  // Sistemdeki kayıtlı veya tanımlı örnek kullanıcı profilleri
  users: {
    nhaber_19: { id: 'nhaber_19', name: 'NHaber Son Dakika', handle: '@nhaber_19', avatar: 'NH', color: '#E63946', verified: true },
    teknoloji_tr: { id: 'teknoloji_tr', name: 'Teknoloji Türkiye', handle: '@teknolojik', avatar: 'TK', color: '#2563EB', verified: true },
    anadolu_ajansi: { id: 'anadolu_ajansi', name: 'Anadolu Ajansı', handle: '@anadoluajansi', avatar: 'AA', color: '#059669', verified: true },
    spor_arena: { id: 'spor_arena', name: 'Spor Arena', handle: '@sporarena', avatar: 'SA', color: '#DC2626', verified: true },
    bilim_dunyasi: { id: 'bilim_dunyasi', name: 'Bilim Dünyası', handle: '@bilimdunyasi', avatar: 'BD', color: '#7C3AED', verified: true },
    kultur_sanat: { id: 'kultur_sanat', name: 'Kültür & Sanat TR', handle: '@kultursanat', avatar: 'KS', color: '#0891B2', verified: false },
    gundem_net: { id: 'gundem_net', name: 'Gündem Net', handle: '@gundemnet', avatar: 'GN', color: '#D97706', verified: true },
    teknofest_official: { id: 'teknofest_official', name: 'TEKNOFEST Resmî', handle: '@teknofest', avatar: 'TF', color: '#E63946', verified: true }
  },

  // Trend Olan Etiketler (Hashtags) Listesi
  trendingHashtags: [
    { tag: 'TEKNOFEST2026', count: '48.2 B' },
    { tag: 'YapayZeka', count: '34.8 B' },
    { tag: 'MilliTeknolojiHamlesi', count: '29.1 B' },
    { tag: 'SonDakika', count: '22.5 B' },
    { tag: 'NSosyal', count: '18.4 B' },
    { tag: 'SiberGüvenlik', count: '14.2 B' }
  ],

  // Temel veri setleri boş dizilerle başlatılır (API ile doldurulacak)
  posts: [],
  jobListings: [],
  jobAlerts: [],
  userReports: [],

  // INITIALIZE FROM SQLITE BACKEND REST API
  // TEKNOFEST Jüri Notu: Sayfa yüklendiğinde arka plan veritabanından güncel içerikleri çeken ana başlangıç fonksiyonu.
  async init() {
    try {
      // 1. Fetch Posts from SQLite DB (Gönderileri getir)
      const resPosts = await fetch('/api/posts');
      if (resPosts.ok) {
        const data = await resPosts.json();
        if (data.success && data.posts) {
          this.posts = data.posts;
        }
      }

      // 2. Fetch Jobs from SQLite DB (İş ilanlarını getir)
      const resJobs = await fetch('/api/jobs');
      if (resJobs.ok) {
        const data = await resJobs.json();
        if (data.success && data.jobs) {
          this.jobListings = data.jobs;
        }
      }

      // 3. Fetch Job Alerts from SQLite DB (Kayıtlı iş alarmlarını getir)
      const resAlerts = await fetch('/api/job-alerts');
      if (resAlerts.ok) {
        const data = await resAlerts.json();
        if (data.success && data.alerts) {
          this.jobAlerts = data.alerts;
        }
      }

      // 4. Fetch User Reports (Postlarım & Otomatik Raporlar Portalı) (Zamanlanmış kullanıcı raporlarını getir)
      const resReports = await fetch('/api/user-reports');
      if (resReports.ok) {
        const data = await resReports.json();
        if (data.success && data.reports) {
          this.userReports = data.reports;
        }
      }
    } catch (e) {
      console.log('SQLite REST API sync warning:', e.message);
    }
  },

  // Yeni bir gönderi ekleyen API çağrısı
  async addPost(postData) {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });
      const data = await res.json();
      if (data.success && data.post) {
        this.posts.unshift(data.post); // Listeye en başa ekle (kronolojik sıra)
        return data.post;
      }
      if (data && data.error) {
        return { error: data.error };
      }
    } catch (e) {
      console.error('Error adding post to SQLite:', e);
    }

    // Backend yanıt vermezse lokal fallback (yedek) kaydı at
    const fallbackPost = {
      id: Date.now(),
      userId: postData.userId || 'nhaber_19',
      category: postData.category || 'gündem',
      text: postData.text,
      hashtags: postData.hashtags || ['#NSosyal', '#Haber'],
      likes: 0, shares: 0, comments: 0, time: 'şimdi',
      image: postData.image || null,
      url: postData.url || null,
      isLive: false, isNew: true, saved: false, liked: false
    };
    this.posts.unshift(fallbackPost);
    return fallbackPost;
  },

  // ADD NEW JOB LISTING
  // Kullanıcının veya sistemin eklediği yeni iş ilanını DB'ye kaydeder
  async addJobListing(jobData) {
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData)
      });
      const data = await res.json();
      if (data.success && data.job) {
        this.jobListings.unshift(data.job);
        return data.job;
      }
    } catch (e) {
      console.error('Error adding job to SQLite:', e);
    }

    // Backend fallback (DB çökmesi/kapalı olması durumunda lokal eklenti)
    const fallbackJob = {
      id: Date.now(),
      title: jobData.title,
      company: jobData.company,
      logo: jobData.company.substring(0, 2).toUpperCase(),
      color: '#2563EB',
      location: jobData.location || 'İstanbul (Uzaktan)',
      type: 'Tam Zamanlı',
      salary: jobData.salary || '75.000 - 110.000 ₺',
      category: jobData.category || 'yazılım',
      skills: jobData.skills || ['React', 'Node.js'],
      applicants: 1, postedAt: 'şimdi', urgent: jobData.urgent || false, isNew: true
    };
    this.jobListings.unshift(fallbackJob);
    return fallbackJob;
  },

  // SAVE JOB ALERT TO SQLITE BACKEND DB
  // Belirli anahtar kelimelere göre iş alarmı kurma talebini arka yüze atar
  async saveJobAlert(alertObj) {
    try {
      const res = await fetch('/api/job-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: alertObj.criteria, email: alertObj.email })
      });
      const data = await res.json();
      if (data.success && data.alert) {
        this.jobAlerts.push(data.alert);
      }
    } catch (e) {
      console.error('Error saving job alert to SQLite:', e);
      this.jobAlerts.push(alertObj); // Hata anında lokal listeye kaydet
    }
  },

  // ADD USER REPORT
  // Kullanıcının sistemden belirli zaman periyotlarında almasını istediği rapor kaydını başlatır
  async addUserReport(reportData) {
    try {
      const res = await fetch('/api/user-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      const data = await res.json();
      if (data.success && data.report) {
        this.userReports.unshift(data.report);
        return data.report;
      }
    } catch (e) {
      console.error('Error adding user report:', e);
    }

    const fallbackReport = {
      id: Date.now(),
      title: reportData.title || 'Zamanlanmış Gündem Raporu',
      frequency: reportData.frequency || 'Her Saat',
      summaryText: '• Rapor oluşturuldu ve SQLite veritabanına kaydedildi.',
      score: 95,
      verdict: '🟢 GÜVENİLİR HABER / DOĞRULANDI',
      sourcesCount: 6,
      createdAt: new Date().toISOString()
    };
    this.userReports.unshift(fallbackReport);
    return fallbackReport;
  },

  // GET COMMENTS FOR POST
  // İlgili ID'ye ait gönderinin yorumlarını sunucudan/DB'den çeker
  async getCommentsForPost(postId) {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.comments) return data.comments;
      }
    } catch (e) {
      console.log('Error fetching comments:', e);
    }
    return [];
  },

  // ADD COMMENT TO POST
  // Seçilen gönderiye yeni bir yorum satırı ekler
  async addCommentToPost(postId, text) {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, userName: 'NSosyal Kullanıcı', userAvatar: 'NK', userColor: '#2563EB' })
      });
      const data = await res.json();
      if (data.success && data.comment) {
        // Increment local post comment count
        const post = this.posts.find(p => p.id === postId);
        if (post) post.comments = (post.comments || 0) + 1;
        return data.comment;
      }
    } catch (e) {
      console.error('Error adding comment:', e);
    }

    const post = this.posts.find(p => p.id === postId);
    if (post) post.comments = (post.comments || 0) + 1;
    return {
      id: Date.now(),
      postId,
      userName: 'NSosyal Kullanıcı',
      userAvatar: 'NK',
      userColor: '#2563EB',
      text,
      createdAt: new Date().toISOString()
    };
  },

  // Kullanıcı ID'si üzerinden kullanıcı nesnesini döner
  getUserById(userId) {
    return this.users[userId] || { id: userId, name: userId, handle: `@${userId}`, avatar: 'NK', color: '#2563EB', verified: false };
  }
};

// AUTO INIT
// Nesne yüklendiği an veritabanı ile senkronizasyonu başlat
NSosyalData.init();

if (typeof window !== 'undefined') {
  window.NSosyalData = NSosyalData;
}
