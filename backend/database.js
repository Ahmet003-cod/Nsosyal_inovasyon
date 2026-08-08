// ============================================================
// BACKEND/DATABASE.JS - SQLite Veritabanı Servis Katmanı
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Sunum ve Jüri Soru-Cevapları İçin Detaylandırılmıştır
// ============================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

/**
 * DB SERIALIZATION & TABLE CREATION
 */
db.serialize(() => {
  // TABLE 1: posts
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      category TEXT NOT NULL,
      text TEXT NOT NULL,
      hashtags TEXT,
      likes INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      time TEXT DEFAULT 'şimdi',
      image TEXT,
      url TEXT,
      isLive INTEGER DEFAULT 0,
      isNew INTEGER DEFAULT 0,
      saved INTEGER DEFAULT 0,
      liked INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLE 2: jobs
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      logo TEXT,
      color TEXT DEFAULT '#2563EB',
      location TEXT,
      type TEXT DEFAULT 'Tam Zamanlı',
      salary TEXT,
      category TEXT DEFAULT 'yazılım',
      skills TEXT,
      applicants INTEGER DEFAULT 0,
      postedAt TEXT DEFAULT 'şimdi',
      urgent INTEGER DEFAULT 0,
      isNew INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLE 3: job_alerts
  db.run(`
    CREATE TABLE IF NOT EXISTS job_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criteria TEXT NOT NULL,
      email TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLE 4: user_reports (POSTLARIM & ZAMANLANMIŞ OTOMATİK RAPORLAR PORTALI)
  db.run(`
    CREATE TABLE IF NOT EXISTS user_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      frequency TEXT DEFAULT 'Her Saat',
      summaryText TEXT NOT NULL,
      score INTEGER DEFAULT 95,
      verdict TEXT DEFAULT 'GÜVENİLİR HABER',
      sourcesCount INTEGER DEFAULT 6,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLE 5: post_comments (YORUMLAR VE ARGO MODERASYONLU ETKİLEŞİM TABLOSU)
  db.run(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      postId INTEGER NOT NULL,
      userName TEXT DEFAULT 'NSosyal Kullanıcı',
      userAvatar TEXT DEFAULT 'NK',
      userColor TEXT DEFAULT '#2563EB',
      text TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const DBService = {
  getPosts() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM posts ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        const formatted = rows.map(r => ({
          ...r,
          hashtags: r.hashtags ? r.hashtags.split(',') : [],
          isLive: Boolean(r.isLive),
          isNew: Boolean(r.isNew),
          saved: Boolean(r.saved),
          liked: Boolean(r.liked)
        }));
        resolve(formatted);
      });
    });
  },

  addPost(postData) {
    return new Promise((resolve, reject) => {
      const hashtagsStr = Array.isArray(postData.hashtags) ? postData.hashtags.join(',') : (postData.hashtags || '#NSosyal,#Haber');
      const stmt = db.prepare(`
        INSERT INTO posts (userId, category, text, hashtags, likes, shares, comments, time, image, url, isLive, isNew, saved, liked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const userId = postData.userId || 'nhaber_19';
      const category = postData.category || 'gündem';
      const text = postData.text;
      const likes = 0, shares = 0, comments = 0;
      const time = 'şimdi';
      const image = postData.image || null;
      const url = postData.url || null;
      const isLive = 0, isNew = 1, saved = 0, liked = 0;

      stmt.run([userId, category, text, hashtagsStr, likes, shares, comments, time, image, url, isLive, isNew, saved, liked], function(err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          userId, category, text,
          hashtags: hashtagsStr.split(','),
          likes, shares, comments, time, image, url,
          isLive: false, isNew: true, saved: false, liked: false
        });
      });
      stmt.finalize();
    });
  },

  getJobs() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        const formatted = rows.map(r => ({
          ...r,
          skills: r.skills ? r.skills.split(',') : [],
          urgent: Boolean(r.urgent),
          isNew: Boolean(r.isNew)
        }));
        resolve(formatted);
      });
    });
  },

  addJob(jobData) {
    return new Promise((resolve, reject) => {
      const skillsStr = Array.isArray(jobData.skills) ? jobData.skills.join(',') : (jobData.skills || 'React,Node.js');
      const logo = (jobData.company || 'SY').substring(0, 2).toUpperCase();
      const color = '#2563EB';
      const location = jobData.location || 'İstanbul (Uzaktan)';
      const type = 'Tam Zamanlı';
      const salary = jobData.salary || '75.000 - 110.000 ₺';
      const category = jobData.category || 'yazılım';
      const applicants = 1;
      const postedAt = 'şimdi';
      const urgent = jobData.urgent ? 1 : 0;
      const isNew = 1;

      const stmt = db.prepare(`
        INSERT INTO jobs (title, company, logo, color, location, type, salary, category, skills, applicants, postedAt, urgent, isNew)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([jobData.title, jobData.company, logo, color, location, type, salary, category, skillsStr, applicants, postedAt, urgent, isNew], function(err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          title: jobData.title, company: jobData.company, logo, color, location, type, salary, category,
          skills: skillsStr.split(','),
          applicants, postedAt, urgent: Boolean(urgent), isNew: true
        });
      });
      stmt.finalize();
    });
  },

  getJobAlerts() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM job_alerts ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  addJobAlert(criteria, email = null) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare("INSERT INTO job_alerts (criteria, email) VALUES (?, ?)");
      stmt.run([criteria, email], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, criteria, email });
      });
      stmt.finalize();
    });
  },

  getUserReports() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM user_reports ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  addUserReport(reportData) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO user_reports (title, frequency, summaryText, score, verdict, sourcesCount)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const title = reportData.title || 'Zamanlanmış Gündem ve Doğrulama Raporu';
      const frequency = reportData.frequency || 'Her Saat';
      const summaryText = reportData.summaryText || 'Rapor metni oluşturuldu.';
      const score = reportData.score !== undefined ? reportData.score : 95;
      const verdict = reportData.verdict || 'GÜVENİLİR HABER / DOĞRULANDI';
      const sourcesCount = reportData.sourcesCount || 6;

      stmt.run([title, frequency, summaryText, score, verdict, sourcesCount], function(err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          title, frequency, summaryText, score, verdict, sourcesCount,
          createdAt: new Date().toISOString()
        });
      });
      stmt.finalize();
    });
  },

  // 9. GET COMMENTS FOR A POST
  getComments(postId) {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM post_comments WHERE postId = ? ORDER BY id ASC", [postId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  // 10. ADD COMMENT FOR A POST
  addComment(postId, commentData) {
    return new Promise((resolve, reject) => {
      const userName = commentData.userName || 'NSosyal Kullanıcı';
      const userAvatar = commentData.userAvatar || 'NK';
      const userColor = commentData.userColor || '#2563EB';
      const text = commentData.text;

      const stmt = db.prepare(`
        INSERT INTO post_comments (postId, userName, userAvatar, userColor, text)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run([postId, userName, userAvatar, userColor, text], function(err) {
        if (err) return reject(err);
        
        const newCommentId = this.lastID;
        // Increment post comments count
        db.run("UPDATE posts SET comments = comments + 1 WHERE id = ?", [postId]);

        resolve({
          id: newCommentId,
          postId, userName, userAvatar, userColor, text,
          createdAt: new Date().toISOString()
        });
      });
      stmt.finalize();
    });
  }
};

module.exports = DBService;
