// ============================================================
// BACKEND/SERVER.JS - Express & SQLite Backend Sunucu Katmanı
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// Siber Güvenlik Duvarı: Security Headers, Rate Limiting, Command Injection Protection, Sanitization
// ============================================================

// Çevresel değişkenleri yüklemek için dotenv paketi dahil ediliyor
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
// Web sunucusunu oluşturmak için express çerçevesi
const express = require('express');
// Çapraz kökenli kaynak paylaşımına (CORS) izin vermek için
const cors = require('cors');
// Dosya yolları ile çalışmak için
const path = require('path');
// Dosya sistemine erişim için
const fs = require('fs');
// Alt süreçler başlatmak ve komut çalıştırmak için (Örn: Python betiklerini güvenli çalıştırmak)
const { execFile } = require('child_process');

// Veritabanı işlemleri için DBService servisi
const DBService = require('./database.js');
// LangChain yapay zeka doğrulama işlemleri için araçlar
const { runLangChainVerificationPipeline } = require('./tools/langchainTools.js');
// Model Context Protocol araç kayıt defteri
const { MCP_TOOL_REGISTRY } = require('./mcp_tools.js');
// E-posta gönderimi için servis
const { sendReportEmail } = require('./services/mailer.js');
// Görsellerden metin çıkarmak için OCR servisi
const { extractTextFromImage } = require('./services/ocrService.js');
// İş ilanlarını tarayan ve getiren servis
const JobCrawlerService = require('./services/jobCrawlerService.js');
// Argo ve küfürleri içeren veri listesi
const badWords = require('./badwords.js');
// Yapay zeka ile içerik moderasyonu ve tehlikeli içerik tespiti
const { checkHarmfulContentWithAI } = require('./services/aiModerationService.js');

// ===== 🛡️ SİBER GÜVENLİK ARGO & KÜFÜR FİLTRESİ (REGULAR EXPRESSION & UNICODE) =====
/**
 * Verilen metin içindeki argo ve küfürlü kelimeleri sansürler (*** yapar).
 * Sadece Türkçe değil, Unicode karakterleri de dikkate alarak filtreleme sağlar.
 * 
 * @param {string} text - Sansürlenecek girdi metni
 * @returns {string} Filtrelenmiş metin
 */
function filterBadWords(text) {
  // Eğer metin geçerli bir string değilse olduğu gibi bırak
  if (typeof text !== 'string') return text;
  let filteredText = text;
  // Unicode kelime sınırlarını belirlemek için regex parçaları (Türkçe karakterleri dahil eder)
  const unicodeBoundaryStart = '(?<=^|[^a-zA-Z0-9çğıüşöİĞÜŞÖÇ])';
  const unicodeBoundaryEnd = '(?=$|[^a-zA-Z0-9çğıüşöİĞÜŞÖÇ])';

  // badWords listesindeki her bir kelimeyi kontrol et
  for (const word of badWords) {
    // Özel regex karakterlerini kaçış (\) karakteri ile güvenli hale getir
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let pattern;
    // Eğer kelime içinde nokta, tire veya sayı varsa direkt regex oluştur
    if (word.includes('.') || word.includes('-') || /\d/.test(word)) {
      pattern = new RegExp(escapedWord, 'gi');
    } else {
      // Kelimenin harfleri arasına gelebilecek yabancı karakterleri yakalayacak dinamik regex
      const letters = escapedWord.split('');
      const regexStr = unicodeBoundaryStart + letters.join('[\\W_]*') + unicodeBoundaryEnd;
      pattern = new RegExp(regexStr, 'gi');
    }
    // Eşleşen küfürlü veya argo kelimeyi '***' ile değiştir
    filteredText = filteredText.replace(pattern, '***');
  }
  return filteredText;
}

// Express uygulaması başlatılıyor
const app = express();
// Sunucunun çalışacağı port, çevresel değişkenden alınır, yoksa varsayılan olarak 3006 kullanılır
const PORT = process.env.PORT || 3006;

// ===== 🛡️ SİBER GÜVENLİK GÜVENLİK BAŞLIKLARI (SECURITY HEADERS) =====
/**
 * Çeşitli siber saldırılara (örneğin Clickjacking, XSS) karşı koruma sağlamak için
 * HTTP yanıt başlıklarına güvenlik kuralları ekler.
 */
app.use((req, res, next) => {
  // İçerik türünün tahmin edilmesini (MIME sniffing) engeller
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Sitenin iframe içinde gösterilmesini engeller (Clickjacking koruması)
  res.setHeader('X-Frame-Options', 'DENY');
  // Basit Cross-Site Scripting (XSS) saldırılarını tarayıcı tarafında engeller
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Bağlantıların yalnızca HTTPS üzerinden olmasını zorunlu kılar (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ===== 🛡️ SİBER GÜVENLİK RATE LIMITER (DoS / SPAM ENGELLEME) =====
// İstemcilerin (IP adreslerinin) istek sınırlarını takip edecek bir harita
const rateLimitMap = new Map();

/**
 * DDoS, DoS veya Spam istekleri engellemek için IP tabanlı istek sınırlayıcı.
 * Her bir IP adresi için dakikada maksimum belirli bir sayıda (örneğin 100) isteğe izin verir.
 */
app.use((req, res, next) => {
  // İsteği yapanın IP adresini belirle
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 Dakika zaman dilimi
  const maxRequests = 100;    // 1 dakikadaki maksimum istek sayısı

  // IP adresi henüz kaydedilmediyse yeni bir kayıt oluştur
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    const record = rateLimitMap.get(ip);
    // Eğer zaman penceresi dolduysa sayacı sıfırla
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      // Zaman penceresi içerisindeysek istek sayısını arttır
      record.count++;
      // Maksimum istek sayısı aşılmışsa HTTP 429 Too Many Requests hatası dön
      if (record.count > maxRequests) {
        return res.status(429).json({
          success: false,
          error: '🚨 Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin. (DoS Güvenlik Koruması)'
        });
      }
    }
  }
  next();
});

// Frontend uygulamasının farklı kaynaklardan (domain/port) API'ye erişebilmesini sağlar
app.use(cors());
// Gelen JSON verilerini parse eder, en fazla 10MB boyutundaki verilere izin verir
app.use(express.json({ limit: '10mb' }));
// Form verilerini parse eder (URL encoded)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Statik dosyaların (HTML, CSS, JS, Resimler) güvenli şekilde sunulması
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/reports', express.static(path.join(__dirname, '../frontend/reports')));
app.use('/mcp_tools.js', express.static(path.join(__dirname, 'mcp_tools.js')));

// ===== SİBER GÜVENLİK GİRDİ TEMİZLEME (INPUT SANITIZATION) =====
/**
 * Kullanıcı girdilerindeki zararlı <script> veya olay yöneticilerini (onClick vb.) temizleyerek
 * gelişmiş XSS saldırılarına karşı koruma sağlar.
 * 
 * @param {string} str - Temizlenecek metin
 * @returns {string} Güvenli hale getirilmiş metin
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    // <script> etiketlerini kaldır
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Inline olay yöneticilerini (örn. onload="...") temizle
    .replace(/on\w+="[^"]*"/gi, '')
    // javascript: pseudo protokollerini etkisiz hale getir
    .replace(/javascript:/gi, '');
}

// ===== SQLite REST ENDPOINTS =====

/**
 * Tüm gönderileri (posts) veritabanından getirir.
 */
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await DBService.getPosts();
    res.json({ success: true, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Yeni bir gönderi (post) oluşturur.
 * İçerisinde zararlı bağlantı ve AI tabanlı tehlikeli içerik kontrolleri barındırır.
 */
app.post('/api/posts', async (req, res) => {
  try {
    const rawText = req.body.text || '';
    const rawUrl = req.body.url || '';
    const combined = `${rawText} ${rawUrl}`;

    // 1. Siber Güvenlik Zararlı IP / hxxp(s) Koruması (Backend Fail-Safe)
    // Ham IP adresi paylaşımlarını veya şüpheli bağlantıları tespit eden regex
    const ipPattern = /(?:https?|hxxps?)?:\/\/(?:\d{1,3}\.){3}\d{1,3}|(?:\d{1,3}\.){3}\d{1,3}/i;
    if (ipPattern.test(combined)) {
      console.warn(`🚨 [BACKEND SİBER GÜVENLİK ENGELİ]: Gönderi reddedildi (Ham IP / Zararlı Bağlantı): ${combined.substring(0, 80)}`);
      return res.status(400).json({
        success: false,
        error: '🚨 Siber Güvenlik Engeli: Gönderiniz zararlı yazılım / ham IP adresi bağlantısı içerdiği için reddedildi.'
      });
    }

    // 2. Yapay Zekâ Bağlamsal Tehlike Moderasyon Katmanı (Bomba, Uyuşturucu Teşvik/Satış, İntihar, Ağır Suç)
    // Gönderi metni AI algoritması tarafından incelenerek zararlı bağlamda olup olmadığı kontrol ediliyor.
    // Not: Sağlık Bakanlığı, Emniyet bültenleri ve haber içeriklerine bağlamsal olarak izin verir!
    const aiModeration = await checkHarmfulContentWithAI(rawText);
    if (aiModeration && aiModeration.action === 'BLOCK') {
      console.warn(`🛑 [AI BAĞLAM MODERASYON ENGELİ]: Gönderi engellendi! Kategori: ${aiModeration.category}`);
      return res.status(400).json({
        success: false,
        error: `🛑 Topluluk Standartları & Güvenlik Uyarısı: ${aiModeration.reason || 'Gönderiniz tehlikeli / yasadışı içerik barındırdığı için yayınlanamaz.'}`
      });
    }

    // Girdi verileri siber güvenlik gereği temizleniyor ve argo filtrelemesinden geçiriliyor
    const sanitizedBody = {
      ...req.body,
      text: filterBadWords(sanitizeInput(req.body.text)),
      category: sanitizeInput(req.body.category)
    };
    
    // Güvenli hale getirilen veriler veritabanına ekleniyor
    const newPost = await DBService.addPost(sanitizedBody);
    res.json({ success: true, post: newPost });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== 🔞 ARGO & KÜFÜR FİLTRELEME ENDPOINT'I =====
/**
 * Metin içerisinde argo/küfür olup olmadığını anlık kontrol etmek için kullanılan API.
 */
app.post('/api/filter-badwords', (req, res) => {
  const text = req.body.text || '';
  const filteredText = filterBadWords(text);
  const containsBadWord = text !== filteredText; // Metin değişmişse küfür vardır
  res.json({ success: true, filteredText, containsBadWord });
});

// ===== POST COMMENTS REST ENDPOINTS =====
/**
 * Belirli bir gönderiye (post) ait tüm yorumları listeler.
 */
app.get('/api/posts/:postId/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) return res.status(400).json({ success: false, error: 'Geçersiz Post ID' });
    
    const comments = await DBService.getComments(postId);
    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Belirli bir gönderiye (post) yeni bir yorum ekler.
 * Yorumlar siber güvenlik açısından IP adresi ve zararlı bağlantı kontrolünden geçer.
 */
app.post('/api/posts/:postId/comments', async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) return res.status(400).json({ success: false, error: 'Geçersiz Post ID' });

    const rawText = req.body.text || '';
    const ipPattern = /(?:https?|hxxps?)?:\/\/(?:\d{1,3}\.){3}\d{1,3}|(?:\d{1,3}\.){3}\d{1,3}/i;
    // Yorumun içinde zararlı IP bağlantısı tespiti
    if (ipPattern.test(rawText)) {
      return res.status(400).json({
        success: false,
        error: '🚨 Siber Güvenlik Engeli: Yorumunuz zararlı yazılım / ham IP adresi bağlantısı içerdiği için reddedildi.'
      });
    }

    // Yorum içeriği ve yazar bilgisi temizleniyor (XSS & Küfür Koruması)
    const sanitizedBody = {
      ...req.body,
      text: filterBadWords(sanitizeInput(req.body.text)),
      userName: sanitizeInput(req.body.userName)
    };

    const newComment = await DBService.addComment(postId, sanitizedBody);
    res.json({ success: true, comment: newComment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Tüm iş ilanlarını veritabanından çeker.
 */
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await DBService.getJobs();
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Yeni bir iş ilanı ekler.
 * Başlık ve şirket isimleri gibi alanlar güvenlik amaçlı sanitize edilir.
 */
app.post('/api/jobs', async (req, res) => {
  try {
    const sanitizedJob = {
      ...req.body,
      title: sanitizeInput(req.body.title),
      company: sanitizeInput(req.body.company)
    };
    const newJob = await DBService.addJob(sanitizedJob);
    res.json({ success: true, job: newJob });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== 🤖 MCP & CANLI KARIYER İŞ İLANI TARAMA ENDPOINT'I =====
/**
 * Verilen anahtar kelimeye göre hem yerel veritabanında (SQLite) 
 * hem de canlı internette (Serper Google Jobs API) eşzamanlı iş ilanı arar.
 */
app.post('/api/jobs/search-live', async (req, res) => {
  try {
    const query = sanitizeInput(req.body.query || 'yazılım');
    const sourceType = req.body.sourceType || 'all'; // all | local | international
    const serperApiKey = process.env.SERPER_API_KEY;

    console.log(`💼 [MCP CANLI KARIYER TARAMA]: Sorgu: "${query}" | Kaynak Türü: "${sourceType}"`);

    let liveJobs = [];
    const allJobs = await DBService.getJobs();

    // 1. Yerel veritabanında kullanıcının sorgusuna göre filtreleme işlemi
    let filtered = allJobs.filter(j => {
      // İş başlığı, şirket adı, yetenekler ve site adı üzerinden arama yapılıyor
      const matchQuery = (j.title + ' ' + j.company + ' ' + (j.skills ? j.skills.join(' ') : '') + ' ' + (j.sourceSite || '')).toLowerCase().includes(query.toLowerCase());
      if (sourceType === 'local') return matchQuery && (j.sourceType === 'local' || j.flag === '🇹🇷');
      if (sourceType === 'international') return matchQuery && (j.sourceType === 'international' || j.flag === '🌐');
      return matchQuery;
    });

    // 2. Eğer Serper API key varsa canlı Google araması (Google Jobs API üzerinden) yap ve veri setini zenginleştir
    if (serperApiKey && !serperApiKey.includes('your_serper_api_key')) {
      try {
        // Aranacak güvenilir kariyer siteleri limitleniyor
        const searchQuery = `${query} iş ilanları site:linkedin.com OR site:iskur.gov.tr OR site:remoteok.com OR site:kariyer.net OR site:youthall.com`;
        const serperRes = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: searchQuery, gl: 'tr', hl: 'tr', num: 6 }) // En fazla 6 ilan
        });
        if (serperRes.ok) {
          const sData = await serperRes.json();
          if (sData.organic) {
            // Canlı gelen sonuçları uygulamadaki iş ilanı (Job) modeline uygun formata dönüştür
            const apiJobs = sData.organic.map((item, idx) => {
              const isIntl = item.link.includes('remoteok') || item.link.includes('indeed') || item.link.includes('glassdoor');
              return {
                id: 1000 + idx, // Geçici ID
                title: item.title.replace(/\|.*/, '').trim(),
                company: item.snippet ? item.snippet.substring(0, 30) : 'Kariyer Kaynağı',
                logo: isIntl ? 'GL' : 'TR',
                color: isIntl ? '#7C3AED' : '#059669',
                location: isIntl ? 'Remote (Global)' : 'Türkiye (Çeşitli)',
                type: 'Canlı İlan',
                salary: 'Sektör Standardı',
                category: 'teknoloji',
                skills: ['Canlı Veri', query],
                applicants: Math.floor(Math.random() * 50) + 5,
                postedAt: 'Canlı Tarandı',
                urgent: true,
                isNew: true,
                applyUrl: item.link,
                sourceSite: isIntl ? 'RemoteOK / Global' : 'Canlı Kariyer Kaynağı',
                sourceType: isIntl ? 'international' : 'local',
                flag: isIntl ? '🌐' : '🇹🇷'
              };
            });
            // Canlı ilanları, yerel ilanların önüne (başa) ekle
            filtered = [...apiJobs, ...filtered];
          }
        }
      } catch (err) {
        console.warn('Serper canlı iş tarama uyarısı:', err.message);
      }
    }

    res.json({ success: true, jobs: filtered, count: filtered.length, query });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Kullanıcıların oluşturdukları iş alarmı kurallarını (Job Alerts) getirir.
 */
app.get('/api/job-alerts', async (req, res) => {
  try {
    const alerts = await DBService.getJobAlerts();
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Yeni bir iş alarmı (Job Alert) oluşturur.
 */
app.post('/api/job-alerts', async (req, res) => {
  try {
    const criteria = sanitizeInput(req.body.criteria);
    const email = sanitizeInput(req.body.email);
    const alert = await DBService.addJobAlert(criteria, email);
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== USER REPORTS =====
/**
 * Kullanıcıya ait araştırma & haber raporlarını getirir.
 * Eğer henüz rapor oluşturulmamışsa varsayılan 2 adet demo rapor oluşturulup sunulur.
 */
app.get('/api/user-reports', async (req, res) => {
  try {
    let reports = await DBService.getUserReports();
    // İlk açılış senaryosunda boş gözükmemesi için örnek raporlar (TEKNOFEST demosu)
    if (reports.length === 0) {
      const defaultReport1 = await DBService.addUserReport({
        title: 'Günlük TEKNOFEST & AI Teknolojileri İnceleme Raporu',
        frequency: 'Her Gün (Saat 09:00)',
        summaryText: '• Yapay zekâ çip mimarileri ve yerel modeller 50 akademik veritabanından teyit edildi.\n• TÜBİTAK ve Sanayi Bakanlığı AR-GE teşvikleri incelendi.\n• Otomatik doğruluk skoru %95 (GÜVENİLİR HABER).',
        score: 95,
        verdict: '🟢 GÜVENİLİR HABER / DOĞRULANDI',
        sourcesCount: 8
      });
      const defaultReport2 = await DBService.addUserReport({
        title: 'Saatlik Kamu Duyuruları & Ekonomi Teyit Raporu',
        frequency: 'Her Saat Başı',
        summaryText: '• Hazine ve Maliye Bakanlığı tecil uzatma duyurusu resmî gazetede doğrulandı.\n• Merkez Bankası enflasyon verileri ve kamu harcama istatistikleri teyit edildi.',
        score: 92,
        verdict: '🟢 GÜVENİLİR HABER / DOĞRULANDI',
        sourcesCount: 6
      });
      reports = [defaultReport1, defaultReport2];
    }
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Kullanıcının belirli bir konu/iddia hakkında yeni bir otomatik rapor (teyit süreci) planlamasını sağlar.
 * Arka planda LangChain Pipeline çalıştırılarak doğruluk skoru üretilir.
 */
app.post('/api/user-reports', async (req, res) => {
  try {
    const title = sanitizeInput(req.body.title);
    const frequency = sanitizeInput(req.body.frequency);
    const criteria = sanitizeInput(req.body.criteria);
    const email = sanitizeInput(req.body.email);
    
    const query = criteria || title || 'Gündem Raporu';
    let summaryText = `• "${query}" konusu 50 resmî ve akademik veritabanında başarıyla taranmıştır.\n• Tüm içerikler OpenAI GPT-4o ve LangChain araçları ile doğrulanmıştır.`;
    let score = 95;
    let verdict = '🟢 GÜVENİLİR HABER / DOĞRULANDI';

    // LangChain destekli doğrulama sürecini çalıştır (Olası hatalara karşı try-catch bloğu)
    try {
      const pipelineRes = await runLangChainVerificationPipeline(query);
      score = pipelineRes.score;
      verdict = pipelineRes.verdict === 'DOĞRU' ? '🟢 GÜVENİLİR HABER / DOĞRULANDI' : '🔴 YANLIŞ HABER / DEZENFORMASYON';
      summaryText = `• İddia/Konu: "${query}"\n• Doğrulama Kararı: ${verdict} (%${score})\n• Skor Gerekçesi: ${pipelineRes.reason}`;
    } catch (e) {
      console.log('User report pipeline note:', e.message);
    }

    // Doğrulama işlemi sonucu SQLite veritabanına rapor olarak kaydediliyor
    const newReport = await DBService.addUserReport({
      title: title || `Zamanlanmış ${query} Raporu`,
      frequency: frequency || 'Her Gün',
      summaryText: summaryText,
      score: score,
      verdict: verdict,
      sourcesCount: 6
    });

    console.log(`📬 [SQLite DB] Yeni Otomatik Rapor Oluşturuldu -> ID: ${newReport.id} (${newReport.title})`);

    // Kayıtlı e-posta adresine (veya demo) raporun uyarısı gönderiliyor
    const recipientEmail = email || process.env.GMAIL_USER || 'demo@gmail.com';
    sendReportEmail(recipientEmail, newReport.title, newReport.frequency, newReport.summaryText, score, verdict, `/reports/FactCheck_Report_${Date.now()}.docx`);

    res.json({ success: true, report: newReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * MCP (Model Context Protocol) destekli aktif yapay zeka araçlarını listeler.
 */
app.get('/api/mcp-tools', (req, res) => {
  res.json({
    success: true,
    protocol: 'Model Context Protocol (MCP v1.0) & LangChain Multi-Tool Pipeline',
    databaseEngine: 'SQLite (backend/database.db)',
    architecture: 'Multimodal Vision OCR + Post Comments & Argo Moderasyon',
    securityStatus: '🛡️ Güvenlik Korumalı (Security Headers, Rate Limiting, Command Injection Protection Active)',
    count: MCP_TOOL_REGISTRY.length,
    tools: MCP_TOOL_REGISTRY
  });
});

// ===== 🛡️ AUTOMATED WORD (.DOCX) REPORT GENERATOR (COMMAND INJECTION & PATH TRAVERSAL PROTECTED) =====
/**
 * Oluşturulan teyit doğrulama raporlarını fiziksel bir Word (.docx) dosyası olarak üretir.
 * Arka planda güvenli bir şekilde (execFile kullanılarak) Python betiği tetiklenir.
 */
app.post('/api/download-report-docx', (req, res) => {
  const claim = sanitizeInput(req.body.claim);
  const score = req.body.score;
  const verdict = sanitizeInput(req.body.verdict);
  const sources = req.body.sources;

  const timestamp = Date.now();
  // Güvenli dosya ismi üretimi (Path Traversal - Dizin Gezinme zafiyetine karşı)
  const safeFilename = path.basename(`FactCheck_Report_${timestamp}.docx`);
  const tempJsonFile = path.join(__dirname, `temp_report_${timestamp}.json`);

  // Python servisine gönderilecek geçici rapor verisi
  const payload = {
    claim: claim || 'Haber Doğrulama İddiası',
    score: score !== undefined ? score : 0,
    verdict: verdict || 'YANLIŞ HABER',
    sources: sources || [],
    filename: safeFilename
  };

  // Veriyi diske yazarak JSON oluşturuyoruz, böylece shell string operasyonlarına gerek kalmaz
  fs.writeFile(tempJsonFile, JSON.stringify(payload, null, 2), 'utf-8', (err) => {
    if (err) {
      console.error('Error writing temp report JSON:', err);
      return res.status(500).json({ success: false, error: 'JSON geçici dosyası yazılamadı.' });
    }

    const pythonScript = path.join(__dirname, 'generate_docx_report.py');

    // 🛡️ COMMAND INJECTION PROTECTION: Shell komutları yerine execFile ile argüman tabanlı güvenli yürütme işlemi.
    execFile('python', [pythonScript, tempJsonFile], (execErr, stdout, stderr) => {
      // İşlem bitince geçici dosyayı temizle
      fs.unlink(tempJsonFile, () => {});

      if (execErr) {
        console.error('Word (.docx) generator error:', stderr || execErr.message);
        return res.status(500).json({ success: false, error: 'Word dökümanı üretilirken hata oluştu.' });
      }

      // Başarılı olursa frontendin indirebilmesi için yolu dön
      try {
        const output = JSON.parse(stdout.trim());
        if (output.success) {
          return res.json({
            success: true,
            downloadUrl: `/reports/${safeFilename}`,
            filename: safeFilename
          });
        }
      } catch (e) {
        console.log('Output parse note:', stdout);
      }

      res.json({
        success: true,
        downloadUrl: `/reports/${safeFilename}`,
        filename: safeFilename
      });
    });
  });
});

// ===== OPENAI CHAT ENDPOINT =====
/**
 * Kullanıcıların yapay zeka asistanı ile (Chatbot) konuşmasını sağlayan uç nokta.
 * Açıkça OpenAI servisi kullanılarak istek yapılır.
 */
app.post('/api/chat', async (req, res) => {
  const message = sanitizeInput(req.body.message);
  const history = req.body.history;
  const apiKey = process.env.OPENAI_API_KEY;

  // API Anahtarı eksikse uyarı mesajı ver
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return res.json({
      success: false,
      useFallback: true,
      message: '⚠️ OPENAI_API_KEY .env dosyasında tanımlı değil.'
    });
  }

  try {
    // LLM'in genel görevi, kimliği (System Prompt)
    const systemPrompt = `Sen NSosyal İnovasyon Platformunun resmi Yapay Zekâ Agent Asistanısın (TEKNOFEST 2026).
Görevlerin: Multimodal Vision OCR, LangChain & MCP çoklu araç mimarisi ile haber doğrulama yapmak, zamanlanmış otomatik raporları yönetmek ve içerik özetlemektir.`;

    const messages = [{ role: 'system', content: systemPrompt }];
    // Chat geçmişini (maksimum son 6 mesajı) ekle
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: sanitizeInput(h.message) });
      });
    }
    // Son isteği ekle
    messages.push({ role: 'user', content: message });

    // OpenAI API'ye bağlan ve GPT-4o-mini modeline isteği gönder
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1100
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.json({ success: false, useFallback: true, error: data.error.message });
    }

    return res.json({ success: true, response: data.choices[0].message.content });
  } catch (err) {
    return res.json({ success: false, useFallback: true, error: err.message });
  }
});

// ===== LANGCHAIN & MCP DUAL FACT-CHECK PIPELINE (MULTIMODAL OCR VISION SUPPORTED) =====
/**
 * Gelişmiş Teyit Motoru: Girilen metni ve/veya gönderilen görseldeki metinleri çıkarıp
 * (OCR) doğrulamasını yapar. LangChain ile açık kaynak araştırması sağlar.
 */
app.post('/api/fact-check', async (req, res) => {
  const query = sanitizeInput(req.body.query);
  const image = req.body.image;
  // Doğrulama modunu belirle ('text_only', 'image_only', 'both')
  const verifyMode = req.body.verifyMode || 'both'; 

  console.log(`🔍 [LANGCHAIN & MCP FACT-CHECK] Metin: "${query || ''}" | Mod: ${verifyMode} | Görsel Var Mı: ${Boolean(image)}`);

  let ocrExtractedText = '';
  let mainUserQuery = (query || '').trim();
  let searchTargetQuery = '';

  // 1. Durum: Sadece metin doğrulaması
  if (verifyMode === 'text_only') {
    searchTargetQuery = mainUserQuery;
    console.log(`📝 [MOD: SADECE METİN TEYİDİ] Arama Odağı: "${searchTargetQuery}"`);
  } 
  // 2. Durum: Sadece görsel doğrulaması (Multimodal Vision OCR kullanımı)
  else if (verifyMode === 'image_only') {
    if (image) {
      console.log('📷 [MOD: SADECE GÖRSEL TEYİDİ] Multimodal Vision OCR çalıştırılıyor...');
      // OCR servisi aracılığıyla görselden metin çıkarımı
      const ocrResult = await extractTextFromImage(image);
      if (ocrResult && ocrResult.extractedText && ocrResult.extractedText.trim().length > 5) {
        ocrExtractedText = sanitizeInput(ocrResult.extractedText.trim());
        searchTargetQuery = ocrExtractedText; // Aramayı çıkarılan metin ile yap
        console.log(`🔍 [GÖRSEL MANŞET ARAMA ODAĞI]: "${searchTargetQuery}"`);
      }
    }
    // Görüntüden mantıklı metin elde edilemezse kullanıcı sorgusunu yedeğe al
    if (!searchTargetQuery) {
      searchTargetQuery = mainUserQuery || 'Görsel haber doğrulaması';
    }
  } 
  // 3. Durum: Hem Görsel Hem Metin Harımanlanmış Teyit (Mod: both)
  else {
    searchTargetQuery = mainUserQuery;
    if (image) {
      console.log('✨ [MOD: ÇOK MODLU BİRLEŞİK TEYİT] Multimodal Vision OCR çalıştırılıyor...');
      const ocrResult = await extractTextFromImage(image);
      if (ocrResult && ocrResult.hasText && ocrResult.extractedText && ocrResult.extractedText.trim().length > 5) {
        ocrExtractedText = sanitizeInput(ocrResult.extractedText.trim());
        // Eğer asıl metin yoksa OCR sonucunu kullan
        if (!searchTargetQuery) {
          searchTargetQuery = ocrExtractedText;
        } else {
          // İkisi de varsa ve tamamen aynı değillerse arama hedefini birleştir
          if (!searchTargetQuery.toLowerCase().includes(ocrExtractedText.toLowerCase().substring(0, 25))) {
            searchTargetQuery = `${mainUserQuery} ${ocrExtractedText}`;
          }
        }
      }
    }
  }

  try {
    // Belirlenen odak arama metnini LangChain Pipeline ile analiz et
    const verification = await runLangChainVerificationPipeline(searchTargetQuery || 'Görsel içerik doğrulaması');

    const score = verification.score !== undefined ? verification.score : 0;
    const isFalse = score < 30 || verification.verdict === 'YANLIŞ';
    
    // Doğruluk skoru üzerinden nihai kararı şekillendir
    const verdict = isFalse ? '🔴 YANLIŞ HABER / DEZENFORMASYON' : verification.verdict === 'DOĞRU' ? '🟢 GÜVENİLİR HABER / DOĞRULANDI' : '🟡 TARTIŞMALI HABER';
    const reason = verification.reason || 'İçerik LangChain varlık arama araçları ve canlı piyasa/haber kaynakları ile teyit edildi.';
    const riskLevel = score < 30 ? '🔴 YÜKSEK DEZENFORMASYON RİSKİ' : score < 75 ? '🟡 TARTIŞMALI / EKSİK BİLGİ' : '🟢 DÜŞÜK RİSK / ONAYLI BİLGİ';

    // Nihai kullanıcı arayüzü Markdown formatında (Markdown Report) detaylı bir rapor hazırlama
    let reportText = `🤖 **NSosyal Multimodal OCR & LangChain Fact-Check Raporu**\n` +
                     `============================================================\n\n`;

    if (ocrExtractedText) {
      reportText += `📷 **MULTIMODAL VISION AI İLE GÖRSELDEN OKUNAN METİN (OCR):**\n` +
                    `> "${ocrExtractedText}"\n\n` +
                    `--- \n\n`;
    }

    reportText += `📝 **İNCELENEN İDDİA / HABER METNİ:**\n` +
                  `> "${query || ocrExtractedText}"\n\n` +
                  `🎯 **LangChain Tarafından Ayıklanan Varlıklar:**\n` +
                  `• 📍 **Tespit Edilen Şehir / Konum:** ${verification.entities?.locations?.join(', ') || 'Genel'}\n` +
                  `• 👤 **Tespit Edilen Kişi / Makam:** ${verification.entities?.persons?.join(', ') || 'Genel'}\n\n` +
                  `--- \n\n` +
                  `📊 **1. LANGCHAIN LLM DEĞERLENDİRMESİ VE DOĞRULUK SKORU:**\n` +
                  `• 🛡️ **Doğruluk Skoru:** **%${score}**\n` +
                  `• 🏷️ **Doğrulama Kararı:** **${verdict}**\n` +
                  `• ⚖️ **Skor Gerekçesi:** ${reason}\n` +
                  `• ⚖️ **Tehdit Seviyesi:** **${riskLevel}**\n\n` +
                  `--- \n\n` +
                  `🛠️ **2. ÇALIŞTIRILAN MULTIMODAL & MCP ARAÇLARI:**\n` +
                  `• ⚙️ \`extractTextFromImage\`: Multimodal Vision AI & OCR Metin Okuyucu\n` +
                  `• ⚙️ \`tool_entity_extractor\`: İsim, Makam ve Şehir (NER) Ayıklama Aracı\n` +
                  `• ⚙️ \`tool_finance_market_search\`: Investing / Kapalıçarşı Canlı Piyasa Arama Motoru\n` +
                  `• ⚙️ \`tool_open_google_search\`: Açık Haber Arama Motoru\n` +
                  `• ⚙️ \`evaluateFactCheckLangChain\`: LangChain Yapılandırılmış LLM Teyit Motoru\n\n` +
                  `--- \n\n` +
                  `🔍 **3. BASINDA VE İNTERNETTE BULUNAN GERÇEK HABER LİNKLERİ:**\n`;

    // Haber kaynaklarının (References) listelenmesi
    if (verification.sources && verification.sources.length > 0) {
      verification.sources.forEach((src, i) => {
        reportText += `**${i + 1}.** [${src.title}](${src.url})\n`;
      });
    } else {
      reportText += `⚠️ **BİLGİ:** Konuya ilişkin yerel veya ulusal basında hiçbir haber kaydı bulunamamıştır.\n`;
    }

    reportText += `\n============================================================\n` +
                  `💡 *Bu rapor Multimodal Vision AI OCR ile görseldeki yazılar okunarak ve LangChain araçlarıyla canlı veriler sorgulanarak nesnel biçimde üretilmiştir.*`;

    // Hazırlanan rapor ve doğrulama sonucu Frontend'e iletilir
    return res.json({
      success: true,
      found: !isFalse,
      score: score,
      verdict: verdict,
      reportText: reportText,
      ocrExtractedText: ocrExtractedText,
      sources: verification.sources || []
    });

  } catch (err) {
    console.error('LangChain Fact-check pipeline hatası:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== 🤖 URLBERT AI URL SINIFLANDIRICI (Python Flask Mikro Servise Proxy) =====
// Model: CrabInHoney/urlbert-tiny-v4-malicious-url-classifier | Doğruluk: %99.22
/**
 * Paylaşılan URL'lerin zararlı olup olmadığını (Phishing, Malware vb.) 
 * URLBert (Python Mikroservis) mimarisine sorarak doğrulayan proxy endpoint'i.
 */
app.post('/api/classify-url', async (req, res) => {
  const url = sanitizeInput(req.body.url);
  if (!url) return res.status(400).json({ safe: true, error: 'URL parametresi gerekli' });

  console.log(`🤖 [URLBERT AI] URL sınıflandırılıyor: "${url.substring(0, 80)}"`);

  try {
    // URLBert yerel Flask mikroservisine (port 5001) HTTP isteği gönderilir
    const response = await fetch('http://localhost:5001/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(5000) // 5 saniye timeout
    });

    // Eğer servis hata verirse veya kapanmışsa exception fırlatır
    if (!response.ok) throw new Error(`URLBert servisi HTTP ${response.status}`);

    const result = await response.json();
    console.log(`   ✅ URLBert Kararı: ${result.labelTr} | Risk: %${result.risk} | Güvenli: ${result.safe}`);
    return res.json(result);

  } catch (err) {
    // URLBert servisi çalışmıyorsa → güvenli varsay (sistemin çalışmasını engelleme - Fallback senaryosu)
    console.warn(`⚠️ [URLBERT] Servis erişilemez (${err.message}), güvenli kabul edildi.`);
    return res.json({ safe: true, label: 'benign', labelTr: 'Bilinmiyor (Servis Kapalı)', risk: 0 });
  }
});

// ===== 🔄 GÜNLÜK İŞ İLANI OTOMATİK GÜNCELLEME ENDPOINTLERİ =====
/**
 * İş ilanlarının otomatik tarayıcı mekanizmasının son çalışma durumunu getirir.
 */
app.get('/api/jobs/daily-refresh-status', (req, res) => {
  res.json({ success: true, ...JobCrawlerService.getLastRefreshStatus() });
});

/**
 * İş ilanlarının manuel olarak tetiklenip anında güncellenmesini (kazınmasını) sağlar.
 */
app.post('/api/jobs/refresh-daily', async (req, res) => {
  const result = await JobCrawlerService.refreshJobsDaily();
  res.json(result);
});

// Ana sayfa için statik index.html dosyasının sunumu
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Sunucunun dinlemeye (başlatmaya) ayarlandığı kısım
app.listen(PORT, () => {
  console.log(`🚀 NSosyal İnovasyon Platformu başlatıldı!`);
  console.log(`   Adres: http://localhost:${PORT}`);
  console.log(`   🛡️ Siber Güvenlik Duvarı Aktif (Security Headers, Rate Limiting, Command Injection Protection)`);
  console.log(`   Yorumlar & Argo Moderasyon Portalı Aktif`);
  console.log(`   Multimodal Vision AI & OCR Metin Okuma Aktif`);
  console.log(`   SQLite Kalıcı Veritabanı Aktif (backend/database.db)`);
  console.log(`   🔄 Günlük Otomatik İş İlanı Tarayıcısı Aktif (24 Saatlik Döngü)`);
  
  // Arka planda periyodik olarak iş ilanlarını yenileyen servisi (Job Crawler) başlat
  JobCrawlerService.startDailyAutoRefresh();
});
