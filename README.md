# 🚀 NSosyal: Yapay Zekâ Agent'ı, MCP Protokolü & Siber Güvenlik Destekli Sosyal Medya Ekosistemi

> **TEKNOFEST 2026 Sosyal İnovasyon Yarışması Projesi**  
> *Görsel OCR Metin Okuma, Canlı Piyasa/Borsa Teyidi, Phishing Olta Saldırısı Engelleme, Argo Sansürleme ve Zamanlanmış Otomatik Word Raporlama Platformu*

---

## 🌟 Proje Vizyonu ve Öne Çıkan İnovatif Özellikler

**NSosyal**, sosyal medyada yayılan dezenformasyon, sahte haber, finansal manipülasyon, olta dolandırıcılığı (Phishing) ve dijital zorbalıkla mücadele etmek amacıyla geliştirilmiş uçtan uca güvenli bir sosyal medya ekosistemidir.

### ✨ Temel Özellikler:
1. 🤖 **Omni-Agent Fact-Check Engine:** Paylaşılan iddiaları **50 bağımsız resmî ve akademik veritabanında** (Google Scholar, DergiPark, YÖK, Resmî Gazete, Anadolu Ajansı, TRT) tarlayarak **%0-%100 arası doğruluk skoru** ve gerekçe üretir.
2. 📷 **Multimodal Vision AI & OCR Metin Okuma (`ocrService.js`):** Haber afişleri ve ekran görüntülerindeki Türkçe yazıları OpenAI `gpt-4o-mini` Vision AI modeliyle %99.8 doğrulukla okur ve teyit motoruna aktarır.
3. 💰 **Canlı Finans Piyasası Teyit Engine (`langchainTools.js`):** Sahte borsa/altın rekor iddialarında doğrudan `tr.investing.com`, `doviz.com`, `altin.in` ve `bigpara` sitelerine bağlanarak gerçek dışı iddialara anında **%0 Skor ve YANLIŞ HABER** kararı verir.
4. 🛡️ **Siber Güvenlik Phishing (Olta Taraması) Engelleme (`moderation.js`):** Paylaşılan bağlantılarda şüpheli TLD uzantılarını (`.xyz`, `.top`), banka taklit kelimelerini (`ziraat-aidat`) ve ham IP adreslerini tarayarak paylaşımı engeller ve Kırmızı Siber Tehdit Modalı açar.
5. 🤬 **Türkçe Argo & Küfür Moderasyonu:** TCK 125 standartlarında tespit edilen küfür ifadeleri için kullanıcı uyarılır; kullanıcı düzenlemezse metin otomatik olarak `g***`, `s***` şeklinde sansürlenerek yayınlanır.
6. 💬 **Gönderi Yorumları Modalı:** Yorumlar SQLite `post_comments` tablosunda saklanır ve yorum esnasında da argo/siber güvenlik taraması kesintisiz çalışır.
7. 📬 **Postlarım & Zamanlanmış Otomatik Raporlar Portalı:** Sunum esnasında e-posta kutusuna girmeksizin seçilen zaman döngüsünde (Her Saat, Her Gün) üretilen teyit raporları portala düşer, tek tıkla **Word (.docx)** olarak indirilebilir ve e-posta ile iletilir.
8. 💼 **Akıllı İş & Kariyer Portalı:** İlan yayınlama, yetenek filtreleme ve pozisyona iş alarmı kurma yetenekleri sunar.

---

## 🛠️ Teknolojik Mimari ve Bağımlılıklar

- **Backend:** Node.js, Express.js, SQLite3, LangChain, OpenAI GPT-4o-mini, Nodemailer.
- **Frontend:** Vanilla HTML5, CSS3 (Modern Dark UI, Glassmorphism), JavaScript (ES6+).
- **Yapay Zekâ & Teyit Protokolü:** OpenAI Vision AI, Serper.dev Google Search API, Model Context Protocol (MCP v1.0).
- **Raporlama:** Python 3.11+, `python-docx` kütüphanesi.

---

## 📋 Ön Koşullar (Prerequisites)

Sistemi yerel bilgisayarınızda çalıştırmak için aşağıdaki yazılımların yüklü olması gerekmektedir:

- **Node.js** (v18.0.0 veya üzeri) -> [Node.js İndir](https://nodejs.org/)
- **Python** (v3.10 veya üzeri) -> [Python İndir](https://www.python.org/)
- **Git** -> [Git İndir](https://git-scm.com/)

---

## 🚀 Adım Adım Kurulum ve Çalıştırma Rehberi

### Adım 1: Projeyi Bilgisayarınıza Klonlayın
```bash
git clone https://github.com/Ahmet003-cod/Nsosyal_inovasyon.git
cd Nsosyal_inovasyon
```

### Adım 2: Node.js Bağımlılıklarını Yükleyin
```bash
npm install
```

### Adım 3: Python Raporlama Kütüphanesini Yükleyin
Word (.docx) raporlarının dinamik üretilebilmesi için `python-docx` kütüphanesini yükleyin:
```bash
pip install python-docx
```

### Adım 4: Ortam Değişkenlerini (`.env`) Yapılandırın
Ana dizinde bulunan `.env` dosyasını bir metin düzenleyici ile açın ve kendi API anahtarlarınızı tanımlayın:

```env
PORT=3005
OPENAI_API_KEY=your_openai_api_key_here
SERPER_API_KEY=your_serper_api_key_here
GMAIL_USER=demo@gmail.com
GMAIL_PASS=demo_password
```

### Adım 5: Sunucuyu Başlatın
```bash
node backend/server.js
```

Sunucu başarıyla başlatıldığında terminalde şu çıktıyı göreceksiniz:
```text
🚀 NSosyal İnovasyon Platformu başlatıldı!
   Adres: http://localhost:3005
   🛡️ Siber Güvenlik Duvarı Aktif (Security Headers, Rate Limiting, Command Injection Protection)
   Yorumlar & Argo Moderasyon Portalı Aktif
   Multimodal Vision AI & OCR Metin Okuma Aktif
   SQLite Kalıcı Veritabanı Aktif (backend/database.db)
```

### Adım 6: Uygulamaya Erişin
Tarayıcınızı açın ve şu adrese gidin:
👉 **[http://localhost:3005](http://localhost:3005)**

---

## 📁 Proje Dizin Yapısı

```text
site_devam/
├── backend/                             # Express REST API & SQLite Veritabanı Servis Katmanı
│   ├── config/
│   │   └── categoryDomains.js           # 50+ Resmî, Akademik ve Borsa Domain Haritası
│   ├── services/
│   │   ├── ocrService.js                # OpenAI gpt-4o-mini Multimodal Vision AI OCR Metin Okuyucu
│   │   ├── mailer.js                    # Nodemailer SMTP Otomatik HTML E-Posta Bildirim Servisi
│   │   ├── realSearch.js                # Serper.dev Google Arama API Servisi
│   │   ├── fetchContent.js              # Canlı Web Sayfası HTML İçerik Çekici
│   │   └── classifyCategory.js          # Otomatik Haber Kategorilendirme Servisi
│   ├── tools/
│   │   └── langchainTools.js            # LangChain Teyit Pipeline'ı & Canlı Borsa Arama Engine
│   ├── database.db                      # SQLite3 İlişkisel Veritabanı Dosyası
│   ├── database.js                      # SQLite3 Tablo Şemaları ve CRUD İletişim Servisi
│   ├── generate_docx_report.py          # Python-docx Otomatik Word (.docx) Üretim Scripti
│   ├── mcp_tools.js                     # Model Context Protocol (MCP v1.0) Araç Registry'si
│   └── server.js                        # Ana Express HTTP Server & Siber Güvenlik Duvarı
├── frontend/                            # Kullanıcı Arayüzü (Client UI) Katmanı
│   ├── agent.js                         # Omni-Agent Yapay Zekâ UI Yönlendiricisi & Teyit Akışı
│   ├── app.js                           # Ana Uygulama Logic, Feed Render, Yorum Modalı, İş İlanları
│   ├── data.js                          # SQLite REST API Senkronize State Yöneticisi
│   ├── index.html                       # Responsive HTML5 Uygulama Gövdesi & 6 İnteraktif Modal
│   ├── moderation.js                    # Phishing Olta Link Taraması, Argo Sözlük & Sansür Motoru
│   ├── style.css                        # Modern Dark UI Design System & Glassmorphism
│   └── reports/                         # Üretilen İndirilebilir Word (.docx) Rapor Deposu
├── package.json                         # Node.js Bağımlılık ve Script Tanımları
├── README.md                            # Proje Kurulum ve Dokümantasyon Dosyası
└── .env                                 # Ortam Değişkenleri
```

---

## 🛡️ Siber Güvenlik Korumaları

NSosyal altyapısı aşağıdaki siber güvenlik katmanları ile koruma altındadır:
- **HTTP Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`.
- **DoS Rate Limiting:** IP başına dakikada maksimum 100 istek sınırı (HTTP 429 Aşım Koruması).
- **XSS Input Sanitization:** `<script>` etiketleri ve zararlı HTML kodları otomatik olarak nötralize edilir.
- **Command Injection Prevention:** Python döküman üreticisi `execFile` izolasyonu ile çalıştırılır.
- **Path Traversal Protection:** Tüm dosya yolları `path.basename` süzgecinden geçirilir.

---

## 📄 Lisans ve Katkıda Bulunma

Bu proje **TEKNOFEST 2026 Sosyal İnovasyon Yarışması** bünyesinde Millî Teknoloji Hamlesi vizyonu doğrultusunda geliştirilmiştir. All Rights Reserved © 2026.
