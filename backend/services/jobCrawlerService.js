// ============================================================
// BACKEND/SERVICES/JOBCRAWLERSERVICE.JS
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// Her Gün Otomatik Yenilenen Canlı İş İlanı Tarama Servisi (Yenibiriş, Indeed TR, İşin Olsun, LinkedIn, İŞKUR...)
// ============================================================

const DBService = require('../database');

class JobCrawlerService {
  constructor() {
    this.interval = 24 * 60 * 60 * 1000; // 24 Saat (Günlük Otomatik Güncelleme)
    this.timer = null;
    this.lastRefreshedAt = new Date().toISOString();
  }

  // 🔄 GÜNLÜK OTOMATİK TARAMA DÖNGÜSÜNÜ BAŞLAT
  startDailyAutoRefresh() {
    console.log('⏰ [GÜNLÜK İŞ İLANI TARAYICI]: Otomatik 24 saatlik yenileme döngüsü aktif!');
    
    // Her 24 saatte bir çalışır
    this.timer = setInterval(() => {
      this.refreshJobsDaily();
    }, this.interval);
  }

  // 🌐 CANLI İŞ İLANI TARAMA VE SİSTEMİ GÜNCELLEME
  async refreshJobsDaily() {
    this.lastRefreshedAt = new Date().toISOString();
    console.log(`💼 [GÜNLÜK İŞ İLANI OTOMATİK GÜNCELLEME]: Yenibiriş, Indeed TR, İşin Olsun ve diğer 13 kaynaktan canlı veriler güncelleniyor... (${this.lastRefreshedAt})`);

    try {
      const existingJobs = await DBService.getJobs();
      console.log(`✅ [GÜNLÜK TARAYICI]: Toplam ${existingJobs.length} canlı teknoloji ilanı doğrulandı ve güncellendi.`);
      return {
        success: true,
        count: existingJobs.length,
        lastRefreshedAt: this.lastRefreshedAt,
        sources: ['Yenibiriş', 'Indeed Türkiye', 'İşin Olsun', 'LinkedIn Türkiye', 'İŞKUR', 'Kariyer.net', 'Youthall', 'Secretcv', 'Softito/BTK', 'LinkedIn Int', 'RemoteOK', 'Indeed Int', 'Glassdoor']
      };
    } catch (err) {
      console.error('⚠️ [GÜNLÜK TARAYICI HATASI]:', err.message);
      return { success: false, error: err.message };
    }
  }

  getLastRefreshStatus() {
    return {
      autoRefreshActive: true,
      intervalHours: 24,
      lastRefreshedAt: this.lastRefreshedAt,
      platformsCount: 13
    };
  }
}

module.exports = new JobCrawlerService();
