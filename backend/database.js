// ============================================================
// BACKEND/DATABASE.JS - SQLite Veritabanı ve İş İlanı Tohumlama Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// 50 ADET ZENGİN TEKNOLOJİ İŞ İLANI (32 YERLİ + 18 YABANCI GLOBAL)
// ============================================================

// SQLite3 veritabanı modülünü dahil ediyoruz. Verbose modu hataları daha detaylı görmemizi sağlar.
const sqlite3 = require('sqlite3').verbose();
// Dosya yollarıyla çalışmak için path modülünü dahil ediyoruz.
const path = require('path');

// Veritabanı dosyasının tam yolunu belirliyoruz.
const dbPath = path.join(__dirname, 'database.db');
// SQLite veritabanı bağlantısını başlatıyoruz.
const db = new sqlite3.Database(dbPath, (err) => {
  // Eğer bağlantıda bir hata oluşursa konsola yazdırıyoruz.
  if (err) console.error('SQLite Veritabanı bağlantı hatası:', err.message);
  // Hata yoksa başarıyla bağlandığımızı bildiriyoruz.
  else console.log('📁 SQLite Veritabanı bağlı: backend/database.db');
});

// TABLOLARI OLUŞTUR VE YENİ SÜTUNLARI EKLE
// db.serialize, içindeki işlemlerin sırayla (senkron olarak) yapılmasını garanti eder.
db.serialize(() => {
  // TABLE 1: posts (Kullanıcı paylaşımları/haberleri)
  // posts tablosunu oluşturuyoruz. Bu tablo platformdaki gönderileri tutar.
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      category TEXT DEFAULT 'gündem',
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

  // TABLE 2: jobs (İş ilanları)
  // jobs tablosunu oluşturuyoruz. Bu tablo toplanan veya eklenen iş ilanlarını içerir.
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
      category TEXT DEFAULT 'teknoloji',
      skills TEXT,
      applicants INTEGER DEFAULT 0,
      postedAt TEXT DEFAULT 'şimdi',
      urgent INTEGER DEFAULT 0,
      isNew INTEGER DEFAULT 0,
      applyUrl TEXT,
      sourceSite TEXT,
      sourceType TEXT DEFAULT 'local',
      flag TEXT DEFAULT '🇹🇷',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sütun güncellemeleri
  // Mevcut jobs tablosuna yeni sütunlar eklemek için kullanılacak dizi
  const columnsToAdd = [
    { name: 'applyUrl', type: 'TEXT' }, // Başvuru linki
    { name: 'sourceSite', type: 'TEXT' }, // İlanın kaynağı (örn. LinkedIn)
    { name: 'sourceType', type: 'TEXT DEFAULT "local"' }, // İlanın tipi (yerli/yabancı)
    { name: 'flag', type: 'TEXT DEFAULT "🇹🇷"' } // Kaynağa göre bayrak emojisi
  ];

  // Her bir yeni sütun için ALTER TABLE sorgusu çalıştırıyoruz.
  // Eğer sütun zaten varsa hata fırlatır ama bu hataları görmezden geliyoruz.
  columnsToAdd.forEach(col => {
    db.run(`ALTER TABLE jobs ADD COLUMN ${col.name} ${col.type}`, (err) => {});
  });

  // TABLE 3: job_alerts (İş ilanı bildirim abonelikleri)
  // Kullanıcıların iş alarmı kurdukları kriterleri tutan tablo
  db.run(`
    CREATE TABLE IF NOT EXISTS job_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criteria TEXT NOT NULL,
      email TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TABLE 4: user_reports (Kullanıcı analiz ve doğrulama raporları)
  // Sistem tarafından oluşturulan gündem ve haber doğrulama raporlarını tutan tablo
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

  // TABLE 5: post_comments (Gönderi yorumları)
  // Gönderilere yapılan kullanıcı yorumlarını tutan tablo
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

  // 🔄 62 ADET TEKNOLOJİ İŞ İLANI TOHUMLAMA (13 FARKLI KARİYER KAYNAĞI)
  // jobs tablosunda belirli kaynaklardan gelen ilanların sayısını kontrol ediyoruz.
  db.get("SELECT COUNT(*) as count FROM jobs WHERE sourceSite IN ('Yenibiriş', 'Indeed Türkiye', 'İşin Olsun')", (err, row) => {
    // Eğer veritabanında yeterli ilan yoksa (count < 12), seedJobs fonksiyonunu çağırarak başlangıç verilerini yüklüyoruz.
    if (err || !row || row.count < 12) {
      console.log('🌱 62 Zengin Teknoloji İş İlanı Yenibiriş, Indeed TR, İşin Olsun dahil 13 kaynaktan veritabanına ekleniyor...');
      seedJobs();
    }
  });
});

/**
 * seedJobs fonksiyonu
 * Veritabanını başlangıç iş ilanlarıyla doldurmak için kullanılır.
 * Önce mevcut tüm iş ilanlarını siler, ardından initialJobs dizisindeki ilanları ekler.
 */
function seedJobs() {
  // Mevcut ilanları siliyoruz (Temiz bir başlangıç için)
  db.run("DELETE FROM jobs");

  // Veritabanına eklenecek olan zengin ilan verileri dizisi
  const initialJobs = [
    // ------------------------------------------------------------------------
    // 🇹🇷 YERLİ KAYNAKLAR (44 ADET TEKNOLOJİ İLANI - %100 LİNK GARANTİLİ)
    // ------------------------------------------------------------------------

    // --- 1. Yenibiriş (4 İlan - Yeni Eklenen Kaynak) ---
    {
      title: "Senior Network & Cloud Systems Engineer",
      company: "TurkNet İletişim", logo: "TN", color: "#2563EB",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "85.000 - 120.000 ₺",
      category: "cloud", skills: "Cisco,BGP,Kubernetes,Linux,Network Security", applicants: 32, postedAt: "Bugün",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.yenibiris.com/is-ilanlari?q=yazilim",
      sourceSite: "Yenibiriş", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Mobile App Lead Developer (iOS / Android)",
      company: "Sahibinden.com Tech", logo: "SH", color: "#EAB308",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "110.000 - 155.000 ₺",
      category: "yazilim", skills: "Swift,Kotlin,Flutter,CI/CD,Unit Testing", applicants: 45, postedAt: "3 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.yenibiris.com/is-ilanlari?q=yazilim",
      sourceSite: "Yenibiriş", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Fraud & Siber Güvenlik Analisti",
      company: "Hepsipay FinTech", logo: "HP", color: "#FF6000",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "90.000 - 130.000 ₺",
      category: "siber-guvenlik", skills: "Fraud Detection,SIEM,SQL,Python,Payment Security", applicants: 28, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.yenibiris.com/is-ilanlari?q=yazilim",
      sourceSite: "Yenibiriş", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Logistics Systems Software Tech Lead",
      company: "Trendyol Express Tech", logo: "TE", color: "#F27A1A",
      location: "İstanbul (Uzaktan)", type: "Tam Zamanlı", salary: "120.000 - 165.000 ₺",
      category: "yazilim", skills: "Go,Java,Kafka,Redis,Distributed Systems", applicants: 51, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.yenibiris.com/is-ilanlari?q=yazilim",
      sourceSite: "Yenibiriş", sourceType: "local", flag: "🇹🇷"
    },

    // --- 2. Indeed Türkiye (4 İlan - Yeni Eklenen Kaynak) ---
    {
      title: "Senior Python & Data Engineer",
      company: "Yemeksepeti Tech", logo: "YS", color: "#EA002A",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "95.000 - 135.000 ₺",
      category: "yapay-zeka", skills: "Python,Spark,Airflow,PostgreSQL,Snowflake", applicants: 39, postedAt: "2 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://tr.indeed.com/m/",
      sourceSite: "Indeed Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Senior C++ & Unity Game Engineer",
      company: "Peak Games", logo: "PK", color: "#111827",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "130.000 - 180.000 ₺",
      category: "yazilim", skills: "C++,Unity,OpenGL,Mobile Optimization,Algorithms", applicants: 64, postedAt: "4 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://tr.indeed.com/m/",
      sourceSite: "Indeed Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Mobile Systems & Graphics Architect",
      company: "Dream Games", logo: "DG", color: "#7C3AED",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "140.000 - 195.000 ₺",
      category: "yazilim", skills: "C#,Unity 3D,Shaders,Metal,Vulkan", applicants: 52, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://tr.indeed.com/m/",
      sourceSite: "Indeed Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "IoT & Mobility Software Developer",
      company: "Martı Tech", logo: "MT", color: "#10B981",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "85.000 - 118.000 ₺",
      category: "yazilim", skills: "Node.js,MQTT,Geospatial,React Native,AWS", applicants: 31, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://tr.indeed.com/m/",
      sourceSite: "Indeed Türkiye", sourceType: "local", flag: "🇹🇷"
    },

    // --- 3. İşin Olsun (4 İlan - Yeni Eklenen Kaynak) ---
    {
      title: "Junior Software Developer & Trainee",
      company: "Migros One Tech", logo: "MO", color: "#F97316",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı / Genç", salary: "45.000 - 65.000 ₺",
      category: "yazilim", skills: "Java,React,SQL,Git,REST API", applicants: 112, postedAt: "Bugün",
      urgent: 1, isNew: 1,
      applyUrl: "https://isinolsun.com/is-ilanlari",
      sourceSite: "İşin Olsun", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "UI/UX & Frontend Developer",
      company: "LCW Digital", logo: "LC", color: "#1D4ED8",
      location: "İstanbul (Uzaktan)", type: "Tam Zamanlı", salary: "75.000 - 105.000 ₺",
      category: "yazilim", skills: "Vue.js,Figma,CSS3,TypeScript,HTML5", applicants: 84, postedAt: "3 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://isinolsun.com/is-ilanlari",
      sourceSite: "İşin Olsun", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "React & E-Commerce Developer",
      company: "Boyner Tech", logo: "BY", color: "#E11D48",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "80.000 - 110.000 ₺",
      category: "yazilim", skills: "React.js,Next.js,Redux,GraphQL,Sass", applicants: 67, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://isinolsun.com/is-ilanlari",
      sourceSite: "İşin Olsun", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Backend Developer (.NET Core)",
      company: "Flo Digital", logo: "FL", color: "#DC2626",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "78.000 - 108.000 ₺",
      category: "yazilim", skills: "C#,.NET Core,MS SQL,Entity Framework,Docker", applicants: 59, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://isinolsun.com/is-ilanlari",
      sourceSite: "İşin Olsun", sourceType: "local", flag: "🇹🇷"
    },

    // --- 4. LinkedIn Türkiye (6 İlan) ---
    {
      title: "Kıdemli Yapay Zekâ & LLM Mühendisi",
      company: "Trendyol Tech", logo: "TY", color: "#F27A1A",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "110.000 - 150.000 ₺",
      category: "yapay-zeka", skills: "Python,PyTorch,LLM,LangChain,RAG", applicants: 42, postedAt: "2 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Trendyol%20Yaz%C4%B1l%C4%B1m",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Senior Backend Engineer (Java / Go)",
      company: "Hepsiburada Tech", logo: "HB", color: "#FF6000",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "100.000 - 140.000 ₺",
      category: "yazilim", skills: "Java,Go,Spring Boot,Kafka,PostgreSQL", applicants: 38, postedAt: "4 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Hepsiburada%20Yaz%C4%B1l%C4%B1m",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Lead Mobile Developer (Flutter / iOS)",
      company: "Getir Tech", logo: "GT", color: "#5C3EBC",
      location: "İstanbul (Uzaktan)", type: "Tam Zamanlı", salary: "105.000 - 145.000 ₺",
      category: "yazilim", skills: "Flutter,Dart,Swift,iOS,CI/CD", applicants: 29, postedAt: "6 saat önce",
      urgent: 0, isNew: 1,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Getir%20Software",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Senior DevOps & Cloud Architect",
      company: "Papara Tech", logo: "PA", color: "#111827",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "115.000 - 160.000 ₺",
      category: "cloud", skills: "Kubernetes,Docker,AWS,Terraform,Ansible", applicants: 24, postedAt: "Dün",
      urgent: 1, isNew: 0,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Papara%20Teknoloji",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Computer Vision & Görüntü İşleme Uzmanı",
      company: "Turkcell Yapay Zekâ Laboratuvarı", logo: "TK", color: "#2563EB",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "95.000 - 130.000 ₺",
      category: "yapay-zeka", skills: "OpenCV,YOLO,PyTorch,C++,TensorRT", applicants: 19, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Turkcell%20Yapay%20Zek%C3%A2",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Big Data & Platform Architect",
      company: "Insider Growth Management", logo: "IN", color: "#059669",
      location: "İstanbul (Uzaktan)", type: "Tam Zamanlı", salary: "120.000 - 165.000 ₺",
      category: "cloud", skills: "Spark,Hadoop,Scala,ClickHouse,Python", applicants: 33, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Insider%20Yaz%C4%B1l%C4%B1m",
      sourceSite: "LinkedIn Türkiye", sourceType: "local", flag: "🇹🇷"
    },

    // --- 2. İŞKUR Resmî (5 İlan - Canlı Eşleşen Arama Linkleri) ---
    {
      title: "Yapay Zekâ ve Siber Güvenlik Araştırmacısı",
      company: "TÜBİTAK BİLGEM", logo: "TÜ", color: "#DC2626",
      location: "Kocaeli / Gebze (Yerinde)", type: "Tam Zamanlı", salary: "75.000 - 95.000 ₺",
      category: "siber-guvenlik", skills: "Python,Siber Saldırı Tespiti,NLP,C++", applicants: 54, postedAt: "Bugün",
      urgent: 1, isNew: 1,
      applyUrl: "https://esube.iskur.gov.tr/IsArayan/IsIlanlari.aspx",
      sourceSite: "İŞKUR Resmî", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Komut Kontrol & Gömülü Yazılım Mühendisi",
      company: "HAVELSAN A.Ş.", logo: "HA", color: "#1E40AF",
      location: "Ankara (Yerinde)", type: "Tam Zamanlı", salary: "85.000 - 120.000 ₺",
      category: "yazilim", skills: "C++,Qt,Gömülü Linux,RTOS,Ada", applicants: 48, postedAt: "Bugün",
      urgent: 1, isNew: 1,
      applyUrl: "https://esube.iskur.gov.tr/IsArayan/IsIlanlari.aspx",
      sourceSite: "İŞKUR Resmî", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Radar ve Mikrodalga Sistem Yazılım Uzmanı",
      company: "ASELSAN A.Ş.", logo: "AS", color: "#1D4ED8",
      location: "Ankara (Yerinde)", type: "Tam Zamanlı", salary: "90.000 - 135.000 ₺",
      category: "yazilim", skills: "C++,DSP,Sinyal İşleme,FPGA,Linux", applicants: 62, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://esube.iskur.gov.tr/IsArayan/IsIlanlari.aspx",
      sourceSite: "İŞKUR Resmî", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Simülasyon ve Hava Savunma Yazılım Mühendisi",
      company: "ROKETSAN A.Ş.", logo: "RO", color: "#B91C1C",
      location: "Ankara (Yerinde)", type: "Tam Zamanlı", salary: "88.000 - 125.000 ₺",
      category: "yazilim", skills: "C++,Simulink,MATLAB,3D Graphics,OpenGL", applicants: 41, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://esube.iskur.gov.tr/IsArayan/IsIlanlari.aspx",
      sourceSite: "İŞKUR Resmî", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Uydu İletişim & Ağ Güvenliği Uzmanı",
      company: "TÜRKSAT A.Ş.", logo: "TÜR", color: "#0284C7",
      location: "Ankara (Yerinde)", type: "Tam Zamanlı", salary: "70.000 - 98.000 ₺",
      category: "siber-guvenlik", skills: "Uydu Ağları,Firewall,Cisco,Routing,SOC", applicants: 35, postedAt: "3 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://esube.iskur.gov.tr/IsArayan/IsIlanlari.aspx",
      sourceSite: "İŞKUR Resmî", sourceType: "local", flag: "🇹🇷"
    },

    // --- 3. Kariyer.net (6 İlan - Canlı Eşleşen Arama Linkleri) ---
    {
      title: "Senior C# / .NET Core Backend Architect",
      company: "Logo Yazılım", logo: "LY", color: "#7C3AED",
      location: "Gebze / Uzaktan", type: "Tam Zamanlı", salary: "90.000 - 125.000 ₺",
      category: "yazilim", skills: "C#,.NET 8,Microservices,Redis,RabbitMQ", applicants: 58, postedAt: "1 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=logo+yazilim",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "React & Node.js Lead Developer",
      company: "Softtech (Yapı Kredi Tech)", logo: "ST", color: "#2563EB",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "95.000 - 130.000 ₺",
      category: "yazilim", skills: "React,TypeScript,Node.js,GraphQL,Next.js", applicants: 45, postedAt: "3 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=softtech",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Siber Savunma ve SOC Analisti (L2)",
      company: "Akbank Teknoloji", logo: "AK", color: "#DC2626",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "85.000 - 115.000 ₺",
      category: "siber-guvenlik", skills: "Splunk,SIEM,SOAR,Sızma Testi,Threat Intel", applicants: 27, postedAt: "5 saat önce",
      urgent: 1, isNew: 1,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=akbank+teknoloji",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Cloud Native & Kubernetes Specialist",
      company: "Garanti BBVA Teknoloji", logo: "GB", color: "#059669",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "100.000 - 140.000 ₺",
      category: "cloud", skills: "Kubernetes,OpenShift,Docker,Istio,Prometheus", applicants: 31, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=garanti+teknoloji",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Otonom Sürüş Yazılım Mühendisi",
      company: "Ford Otosan R&D Tech", logo: "FO", color: "#1E40AF",
      location: "Kocaeli (Yerinde)", type: "Tam Zamanlı", salary: "90.000 - 128.000 ₺",
      category: "yapay-zeka", skills: "ROS2,C++,Python,LiDAR,Derin Öğrenme", applicants: 22, postedAt: "Dün",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=ford+otosan",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Senior Data Scientist & ML Specialist",
      company: "Sabancı Digital (SabancıDx)", logo: "DX", color: "#4F46E5",
      location: "İstanbul (Uzaktan)", type: "Tam Zamanlı", salary: "95.000 - 135.000 ₺",
      category: "yapay-zeka", skills: "Python,Scikit-Learn,LightGBM,SQL,MLOps", applicants: 39, postedAt: "2 gün önce",
      urgent: 0, isNew: 0,
      applyUrl: "https://www.kariyer.net/is-ilanlari?kw=sabanci+dx",
      sourceSite: "Kariyer.net", sourceType: "local", flag: "🇹🇷"
    },

    // --- 4. Youthall (5 İlan) ---
    {
      title: "İHA / SİHA Yapay Zekâ Staj Programı",
      company: "Baykar Teknoloji", logo: "BY", color: "#DC2626",
      location: "İstanbul (Yerinde)", type: "Staj / Genç Yetenek", salary: "35.000 - 45.000 ₺",
      category: "yapay-zeka", skills: "C++,Python,Computer Vision,ROS,Linux", applicants: 184, postedAt: "2 saat önce",
      urgent: 1, isNew: 1, applyUrl: "https://www.youthall.com/tr/search/?q=baykar+yazilim",
      sourceSite: "Youthall", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Havacılık Gömülü Yazılım Genç Talent",
      company: "TUSAŞ / TAİ", logo: "TU", color: "#0284C7",
      location: "Ankara (Yerinde)", type: "Staj / Aday Mühendis", salary: "38.000 - 48.000 ₺",
      category: "yazilim", skills: "C,C++,DO-178C,Embedded C,ARM", applicants: 142, postedAt: "Bugün",
      urgent: 1, isNew: 1, applyUrl: "https://www.youthall.com/tr/search/?q=tusas+yazilim",
      sourceSite: "Youthall", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Genç Mühendis İnovasyon Kampı",
      company: "ASELSAN A.Ş.", logo: "AS", color: "#1D4ED8",
      location: "Ankara (Yerinde)", type: "Staj Programı", salary: "35.000 - 42.000 ₺",
      category: "yazilim", skills: "Python,Java,React,Veri Yapıları,Algorithms", applicants: 210, postedAt: "Dün",
      urgent: 0, isNew: 0, applyUrl: "https://www.youthall.com/tr/search/?q=aselsan+yazilim",
      sourceSite: "Youthall", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Siber Güvenlik Genç Yetenek Programı",
      company: "HAVELSAN Akademi", logo: "HA", color: "#1E40AF",
      location: "Ankara (Yerinde)", type: "Genç Yetenek", salary: "40.000 - 52.000 ₺",
      category: "siber-guvenlik", skills: "Network,Linux,Python,Wireshark,Sızma Testi", applicants: 98, postedAt: "Dün",
      urgent: 0, isNew: 0, applyUrl: "https://www.youthall.com/tr/search/?q=havelsan+siber",
      sourceSite: "Youthall", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "GNÇ Tech Bootcamp & Software Trainee",
      company: "Turkcell Gençlik", logo: "GN", color: "#EAB308",
      location: "İstanbul (Hibrit)", type: "Bootcamp / İstihdam", salary: "45.000 - 55.000 ₺",
      category: "yazilim", skills: "Java,Spring,React,Git,SQL", applicants: 320, postedAt: "3 gün önce",
      urgent: 0, isNew: 0, applyUrl: "https://www.youthall.com/tr/search/?q=turkcell+gnc+tech",
      sourceSite: "Youthall", sourceType: "local", flag: "🇹🇷"
    },

    // --- 5. Secretcv (5 İlan - Tam Pozisyon Odaklı) ---
    {
      title: "Penetrasyon Testi ve Sızma Uzmanı",
      company: "Türk Telekom Siber Hizmetler", logo: "TT", color: "#0284C7",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "85.000 - 120.000 ₺",
      category: "siber-guvenlik", skills: "Metasploit,Burp Suite,OWASP,CEH,Python", applicants: 26, postedAt: "1 saat önce",
      urgent: 1, isNew: 1, applyUrl: "https://www.secretcv.com/is-ilanlari?q=turk+telekom+siber",
      sourceSite: "Secretcv", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "5G Ağ ve Altyapı Mühendisi",
      company: "Vodafone Türkiye", logo: "VF", color: "#E11D48",
      location: "İstanbul (Hibrit)", type: "Tam Zamanlı", salary: "90.000 - 130.000 ₺",
      category: "cloud", skills: "5G Core,OpenRAN,Kubernetes,Linux,Python", applicants: 19, postedAt: "3 saat önce",
      urgent: 1, isNew: 1, applyUrl: "https://www.secretcv.com/is-ilanlari?q=vodafone+5g",
      sourceSite: "Secretcv", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Telekomünikasyon Güvenliği Uzmanı",
      company: "Netaş Telekomünikasyon", logo: "NT", color: "#059669",
      location: "İstanbul (Yerinde)", type: "Tam Zamanlı", salary: "78.000 - 105.000 ₺",
      category: "siber-guvenlik", skills: "IPSEC,VPN,Firewall,Cisco CCNP,SOC", applicants: 22, postedAt: "Dün",
      urgent: 0, isNew: 0, applyUrl: "https://www.secretcv.com/is-ilanlari?q=netas+guvenlik",
      sourceSite: "Secretcv", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Endüstriyel IoT ve Otomasyon Yazılımcısı",
      company: "Siemens Türkiye", logo: "SI", color: "#0D9488",
      location: "Gebze (Hibrit)", type: "Tam Zamanlı", salary: "88.000 - 122.000 ₺",
      category: "yazilim", skills: "C++,Python,MQTT,OPC UA,Gömülü Linux", applicants: 31, postedAt: "2 gün önce",
      urgent: 0, isNew: 0, applyUrl: "https://www.secretcv.com/is-ilanlari?q=siemens+yazilim",
      sourceSite: "Secretcv", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Smart TV & Gömülü Linux Yazılım Uzmanı",
      company: "Vestel Elektronik R&D", logo: "VE", color: "#DC2626",
      location: "Manisa (Yerinde)", type: "Tam Zamanlı", salary: "75.000 - 108.000 ₺",
      category: "yazilim", skills: "C++,Gömülü Linux,Qt,Yocto,GStreamer", applicants: 28, postedAt: "3 gün önce",
      urgent: 0, isNew: 0, applyUrl: "https://www.secretcv.com/is-ilanlari?q=vestel+gomulu",
      sourceSite: "Secretcv", sourceType: "local", flag: "🇹🇷"
    },

    // --- 6. Softito & BTK Akademi (5 İlan - Doğrudan Kurs Linkleri) ---
    {
      title: "Yapay Zekâ ve NLP Eğitim & İş Garantili Program",
      company: "Softito Akademi", logo: "SF", color: "#7C3AED",
      location: "İstanbul / Uzaktan", type: "Eğitim + İstihdam", salary: "Ücretsiz + Burslu",
      category: "yapay-zeka", skills: "Python,Transformers,NLP,LangChain,PyTorch", applicants: 312, postedAt: "Aktif Dönem",
      urgent: 1, isNew: 1, applyUrl: "https://softito.com.tr/view/egitim/goster.php?Guid=66A65E79-C862-4AF1-B96F-27EDDD40AA9A",
      sourceSite: "Softito & BTK Akademi", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Siber Güvenlik Uzmanlık Kampı (Bootcamp)",
      company: "BTK Akademi", logo: "BT", color: "#2563EB",
      location: "Ankara / Uzaktan", type: "Eğitim + Sertifika", salary: "Ücretsiz Devlet Destekli",
      category: "siber-guvenlik", skills: "Ağ Güvenliği,Sızma Testi,Linux,Wireshark,Python", applicants: 450, postedAt: "Aktif Dönem",
      urgent: 1, isNew: 1, applyUrl: "https://www.btkakademi.gov.tr/portal/course/python-ile-yapay-zeka-ve-veri-bilimi-18751",
      sourceSite: "Softito & BTK Akademi", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Full-Stack Web & Mobil Geliştirme Eğitimi",
      company: "Softito Akademi", logo: "SF", color: "#7C3AED",
      location: "İstanbul (Hibrit)", type: "Eğitim + İstihdam", salary: "Ücretsiz Burslu",
      category: "yazilim", skills: "React,Node.js,Flutter,PostgreSQL,Git", applicants: 280, postedAt: "Aktif Dönem",
      urgent: 1, isNew: 0, applyUrl: "https://softito.com.tr/view/egitim/egitimTumuListe.php",
      sourceSite: "Softito & BTK Akademi", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Veri Bilimi ve Derin Öğrenme Eğitimi",
      company: "BTK Akademi", logo: "BT", color: "#2563EB",
      location: "Uzaktan (Online)", type: "Sertifikalı Eğitim", salary: "Ücretsiz",
      category: "yapay-zeka", skills: "Python,Pandas,TensorFlow,Machine Learning,SQL", applicants: 520, postedAt: "Aktif Dönem",
      urgent: 0, isNew: 0, applyUrl: "https://www.btkakademi.gov.tr/portal/course/python-ile-yapay-zeka-ve-veri-bilimi-18751",
      sourceSite: "Softito & BTK Akademi", sourceType: "local", flag: "🇹🇷"
    },
    {
      title: "Gömülü Sistemler ve C/C++ Geliştirme Kampı",
      company: "Softito Akademi", logo: "SF", color: "#7C3AED",
      location: "İstanbul (Yerinde)", type: "Eğitim + Staj", salary: "Ücretsiz",
      category: "yazilim", skills: "C,C++,STM32,FreeRTOS,Linux", applicants: 190, postedAt: "Aktif Dönem",
      urgent: 0, isNew: 0, applyUrl: "https://softito.com.tr/view/egitim/goster.php?Guid=66A65E79-C862-4AF1-B96F-27EDDD40AA9A",
      sourceSite: "Softito & BTK Akademi", sourceType: "local", flag: "🇹🇷"
    },

    // ------------------------------------------------------------------------
    // 🌐 YABANCI KAYNAKLAR (18 ADET GLOBAL TEKNOLOJİ İLANI)
    // ------------------------------------------------------------------------

    // --- 7. LinkedIn International (5 İlan) ---
    {
      title: "Senior Cloud Infrastructure Architect",
      company: "Google Cloud Global", logo: "GC", color: "#4285F4",
      location: "Remote (EMEA / Global)", type: "Full-Time (Remote)", salary: "$120,000 - $160,000 / yr",
      category: "cloud", skills: "GCP,Kubernetes,Terraform,Microservices,CI/CD", applicants: 68, postedAt: "5 hours ago",
      urgent: 1, isNew: 1, applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Google%20Cloud%20Architect",
      sourceSite: "LinkedIn International", sourceType: "international", flag: "🌐"
    },
    {
      title: "Lead AI & Azure Machine Learning Engineer",
      company: "Microsoft AI", logo: "MS", color: "#00A4EF",
      location: "Remote (Global)", type: "Full-Time (Remote)", salary: "$130,000 - $175,000 / yr",
      category: "yapay-zeka", skills: "PyTorch,Azure ML,MLOps,LLM,Python", applicants: 82, postedAt: "8 hours ago",
      urgent: 1, isNew: 1, applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Microsoft%20AI",
      sourceSite: "LinkedIn International", sourceType: "international", flag: "🌐"
    },
    {
      title: "Principal DevOps & Distributed Systems Engineer",
      company: "Amazon AWS", logo: "AW", color: "#FF9900",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$135,000 - $180,000 / yr",
      category: "cloud", skills: "AWS,Distributed Systems,Golang,Rust,K8s", applicants: 54, postedAt: "1 day ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.linkedin.com/jobs/search/?keywords=AWS%20DevOps",
      sourceSite: "LinkedIn International", sourceType: "international", flag: "🌐"
    },
    {
      title: "PyTorch & Generative AI Research Engineer",
      company: "Meta AI (FAIR)", logo: "ME", color: "#0668E1",
      location: "Remote (US / EU)", type: "Full-Time (Remote)", salary: "$150,000 - $210,000 / yr",
      category: "yapay-zeka", skills: "PyTorch,LLaMA,Distributed Training,C++,CUDA", applicants: 91, postedAt: "2 days ago",
      urgent: 1, isNew: 0, applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Meta%20AI",
      sourceSite: "LinkedIn International", sourceType: "international", flag: "🌐"
    },
    {
      title: "iOS Core Framework & Swift Specialist",
      company: "Apple Global", logo: "AP", color: "#000000",
      location: "Cupertino / Remote", type: "Full-Time", salary: "$140,000 - $185,000 / yr",
      category: "yazilim", skills: "Swift,SwiftUI,Metal,CoreML,iOS", applicants: 47, postedAt: "3 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.linkedin.com/jobs/search/?keywords=Apple%20iOS",
      sourceSite: "LinkedIn International", sourceType: "international", flag: "🌐"
    },

    // --- 8. RemoteOK (5 İlan) ---
    {
      title: "Lead AI Infrastructure & Prompt Engineer",
      company: "OpenAI Labs", logo: "OA", color: "#10A37F",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$140,000 - $190,000 / yr",
      category: "yapay-zeka", skills: "Python,PyTorch,Transformer,LLM Fine-Tuning,API", applicants: 95, postedAt: "1 day ago",
      urgent: 1, isNew: 1, applyUrl: "https://remoteok.com/remote-dev-jobs",
      sourceSite: "RemoteOK", sourceType: "international", flag: "🌐"
    },
    {
      title: "Claude Infrastructure & Safety Engineer",
      company: "Anthropic AI", logo: "AN", color: "#D97706",
      location: "Remote (Global)", type: "Full-Time (Remote)", salary: "$145,000 - $195,000 / yr",
      category: "yapay-zeka", skills: "Python,RLHF,Safety Tuning,PyTorch,Kubernetes", applicants: 73, postedAt: "2 days ago",
      urgent: 1, isNew: 1, applyUrl: "https://remoteok.com/remote-dev-jobs",
      sourceSite: "RemoteOK", sourceType: "international", flag: "🌐"
    },
    {
      title: "Next.js & Edge Runtime Systems Architect",
      company: "Vercel", logo: "VC", color: "#000000",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$125,000 - $165,000 / yr",
      category: "yazilim", skills: "Next.js,TypeScript,React,Rust,V8 Edge", applicants: 64, postedAt: "2 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://remoteok.com/remote-dev-jobs",
      sourceSite: "RemoteOK", sourceType: "international", flag: "🌐"
    },
    {
      title: "PostgreSQL & Open Source Database Lead",
      company: "Supabase", logo: "SB", color: "#3ECF8E",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$115,000 - $155,000 / yr",
      category: "yazilim", skills: "PostgreSQL,Elixir,Go,Database Tuning,Rust", applicants: 41, postedAt: "3 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://remoteok.com/remote-dev-jobs",
      sourceSite: "RemoteOK", sourceType: "international", flag: "🌐"
    },
    {
      title: "Open Source AI Model Optimization Lead",
      company: "Hugging Face", logo: "HF", color: "#FFD21E",
      location: "Remote (Global)", type: "Full-Time (Remote)", salary: "$130,000 - $170,000 / yr",
      category: "yapay-zeka", skills: "Python,ONNX,TensorRT,Quantization,Transformers", applicants: 88, postedAt: "4 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://remoteok.com/remote-dev-jobs",
      sourceSite: "RemoteOK", sourceType: "international", flag: "🌐"
    },

    // --- 9. Indeed International (4 İlan) ---
    {
      title: "Principal Threat Hunter & EDR Specialist",
      company: "CrowdStrike", logo: "CS", color: "#E11D48",
      location: "Remote (US / EU)", type: "Full-Time (Remote)", salary: "$95,000 - $135,000 / yr",
      category: "siber-guvenlik", skills: "Threat Hunting,Falcon Platform,Python,Incident Response", applicants: 34, postedAt: "3 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.indeed.com/jobs?q=CrowdStrike",
      sourceSite: "Indeed International", sourceType: "international", flag: "🌐"
    },
    {
      title: "Site Reliability & Observability Lead",
      company: "Datadog", logo: "DD", color: "#6366F1",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$120,000 - $160,000 / yr",
      category: "cloud", skills: "Golang,Kubernetes,eBPF,Observability,Distributed Tracing", applicants: 29, postedAt: "3 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.indeed.com/jobs?q=Datadog",
      sourceSite: "Indeed International", sourceType: "international", flag: "🌐"
    },
    {
      title: "Zero Trust Security Architect",
      company: "Cloudflare", logo: "CF", color: "#F97316",
      location: "Remote (Global)", type: "Full-Time (Remote)", salary: "$130,000 - $175,000 / yr",
      category: "siber-guvenlik", skills: "Zero Trust,Rust,DNS,BGP,DDoS Mitigation", applicants: 45, postedAt: "4 days ago",
      urgent: 1, isNew: 0, applyUrl: "https://www.indeed.com/jobs?q=Cloudflare",
      sourceSite: "Indeed International", sourceType: "international", flag: "🌐"
    },
    {
      title: "Network Security & Next-Gen Firewall Specialist",
      company: "Palo Alto Networks", logo: "PA", color: "#EF4444",
      location: "Remote (US / EU)", type: "Full-Time (Remote)", salary: "$110,000 - $150,000 / yr",
      category: "siber-guvenlik", skills: "NGFW,PAN-OS,Cloud Security,SASE,Python", applicants: 38, postedAt: "5 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.indeed.com/jobs?q=Palo+Alto+Networks",
      sourceSite: "Indeed International", sourceType: "international", flag: "🌐"
    },

    // --- 10. Glassdoor (4 İlan) ---
    {
      title: "Recommendation Engine & RecSys Specialist",
      company: "Spotify Global", logo: "SP", color: "#1DB954",
      location: "Stockholm / Remote", type: "Full-Time", salary: "€85,000 - €115,000 / yr",
      category: "yapay-zeka", skills: "Python,TensorFlow,Spark,RecSys,AB Testing", applicants: 51, postedAt: "2 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.glassdoor.com/Job/spotify-jobs-SRCH_KE0,7.htm",
      sourceSite: "Glassdoor", sourceType: "international", flag: "🌐"
    },
    {
      title: "Video Streaming & Content Delivery Lead",
      company: "Netflix Global", logo: "NX", color: "#E50914",
      location: "Los Gatos / Remote", type: "Full-Time", salary: "$160,000 - $220,000 / yr",
      category: "cloud", skills: "Java,C++,CDN,Encoding,Distributed Cache", applicants: 62, postedAt: "4 days ago",
      urgent: 1, isNew: 0, applyUrl: "https://www.glassdoor.com/Job/index.htm",
      sourceSite: "Glassdoor", sourceType: "international", flag: "🌐"
    },
    {
      title: "Financial Infrastructure & Payments API Engineer",
      company: "Stripe", logo: "ST", color: "#635BFF",
      location: "Remote (Worldwide)", type: "Full-Time (Remote)", salary: "$140,000 - $185,000 / yr",
      category: "yazilim", skills: "Ruby,Go,API Design,Distributed Consensus,Security", applicants: 77, postedAt: "5 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.glassdoor.com/Job/index.htm",
      sourceSite: "Glassdoor", sourceType: "international", flag: "🌐"
    },
    {
      title: "Autonomous Fleet & Routing Systems Architect",
      company: "Uber ATG Tech", logo: "UB", color: "#000000",
      location: "San Francisco / Remote", type: "Full-Time", salary: "$155,000 - $205,000 / yr",
      category: "yapay-zeka", skills: "C++,Go,Graph Algorithms,Geospatial,ML", applicants: 43, postedAt: "5 days ago",
      urgent: 0, isNew: 0, applyUrl: "https://www.glassdoor.com/Job/index.htm",
      sourceSite: "Glassdoor", sourceType: "international", flag: "🌐"
    }
  ];

  // Parametreli SQL sorgusu hazırlıyoruz (SQL Injection'ı önlemek için).
  const stmt = db.prepare(`
    INSERT INTO jobs (title, company, logo, color, location, type, salary, category, skills, applicants, postedAt, urgent, isNew, applyUrl, sourceSite, sourceType, flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Her bir ilan verisi için SQL sorgusunu çalıştırıyoruz.
  initialJobs.forEach(job => {
    stmt.run([
      job.title, job.company, job.logo, job.color, job.location, job.type, job.salary,
      job.category, job.skills, job.applicants, job.postedAt, job.urgent, job.isNew,
      job.applyUrl, job.sourceSite, job.sourceType, job.flag
    ]);
  });

  // Hazırlanan sorguyu sonlandırıp bellekten temizliyoruz.
  stmt.finalize();
  console.log('✅ 50 Zengin Teknoloji İş İlanı SQLite veritabanına başarıyla tohumlandı!');
}

// Tüm veritabanı operasyonlarını barındıran servis objesi
const DBService = {
  /**
   * Gönderileri (posts) veritabanından getirir.
   * En yeniden en eskiye doğru sıralar.
   */
  getPosts() {
    return new Promise((resolve, reject) => {
      // Tüm gönderileri ID'ye göre azalan sırayla çekiyoruz
      db.all("SELECT * FROM posts ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err); // Hata varsa reddet
        // Veritabanından gelen veriyi frontend'in beklediği formata dönüştürüyoruz
        const formatted = rows.map(r => ({
          ...r,
          hashtags: r.hashtags ? r.hashtags.split(',') : [], // Virgülle ayrılmış string'i diziye çevir
          isLive: Boolean(r.isLive), // 0/1 değerlerini boolean'a çevir
          isNew: Boolean(r.isNew),
          saved: Boolean(r.saved),
          liked: Boolean(r.liked)
        }));
        resolve(formatted); // Formatlanmış veriyi döndür
      });
    });
  },

  /**
   * Veritabanına yeni bir gönderi (post) ekler.
   */
  addPost(postData) {
    return new Promise((resolve, reject) => {
      // Hashtag'leri dizi formunda gelmişse string'e çeviriyoruz, yoksa varsayılan değer atıyoruz
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

  /**
   * İş ilanlarını veritabanından çeker.
   */
  getJobs() {
    return new Promise((resolve, reject) => {
      // En son eklenen ilanları en başta göstermek için azalan sıralama yapıyoruz
      db.all("SELECT * FROM jobs ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        // İlan verilerini formatlıyoruz
        const formatted = rows.map(r => ({
          ...r,
          skills: r.skills ? r.skills.split(',') : [], // Becerileri string'den diziye çevir
          urgent: Boolean(r.urgent), // 0/1 değerlerini boolean yap
          isNew: Boolean(r.isNew)
        }));
        resolve(formatted);
      });
    });
  },

  /**
   * Veritabanına yeni bir iş ilanı ekler.
   */
  addJob(jobData) {
    return new Promise((resolve, reject) => {
      // Gelen becerileri string'e dönüştürüyoruz, aksi halde varsayılan ekliyoruz
      const skillsStr = Array.isArray(jobData.skills) ? jobData.skills.join(',') : (jobData.skills || 'React,Node.js');
      // Logo gönderilmemişse şirket adının ilk 2 harfini alıyoruz
      const logo = (jobData.company || 'SY').substring(0, 2).toUpperCase();
      const color = jobData.color || '#2563EB';
      const location = jobData.location || 'İstanbul (Uzaktan)';
      const type = jobData.type || 'Tam Zamanlı';
      const salary = jobData.salary || '75.000 - 110.000 ₺';
      const category = jobData.category || 'teknoloji';
      const applicants = 1;
      const postedAt = 'şimdi';
      const urgent = jobData.urgent ? 1 : 0;
      const isNew = 1;
      const applyUrl = jobData.applyUrl || 'https://www.linkedin.com/jobs/';
      const sourceSite = jobData.sourceSite || 'LinkedIn Türkiye';
      const sourceType = jobData.sourceType || 'local';
      const flag = jobData.flag || '🇹🇷';

      const stmt = db.prepare(`
        INSERT INTO jobs (title, company, logo, color, location, type, salary, category, skills, applicants, postedAt, urgent, isNew, applyUrl, sourceSite, sourceType, flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        jobData.title, jobData.company, logo, color, location, type, salary, category,
        skillsStr, applicants, postedAt, urgent, isNew, applyUrl, sourceSite, sourceType, flag
      ], function(err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          title: jobData.title, company: jobData.company, logo, color, location, type, salary, category,
          skills: skillsStr.split(','),
          applicants, postedAt, urgent: Boolean(urgent), isNew: true,
          applyUrl, sourceSite, sourceType, flag
        });
      });
      stmt.finalize();
    });
  },

  /**
   * İş alarmı kayıtlarını (job_alerts) getirir.
   */
  getJobAlerts() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM job_alerts ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  /**
   * Yeni bir iş alarmı kaydı oluşturur.
   */
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

  /**
   * Kullanıcı ve gündem doğrulama raporlarını getirir.
   */
  getUserReports() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM user_reports ORDER BY id DESC", (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  /**
   * Sisteme yeni bir haber/gündem doğrulama raporu ekler.
   */
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

  /**
   * Belirli bir gönderiye (postId) ait yorumları getirir.
   */
  getComments(postId) {
    return new Promise((resolve, reject) => {
      // Yorumları id'ye göre artan sırada (eskiden yeniye) alıyoruz
      db.all("SELECT * FROM post_comments WHERE postId = ? ORDER BY id ASC", [postId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },

  /**
   * Bir gönderiye yeni bir yorum ekler ve gönderinin yorum sayısını artırır.
   */
  addComment(postId, commentData) {
    return new Promise((resolve, reject) => {
      // Kullanıcı bilgilerini ve yorum metnini alıyoruz (veya varsayılan değer kullanıyoruz)
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
