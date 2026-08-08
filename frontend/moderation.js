// ============================================================
// FRONTEND/MODERATION.JS - Siber Güvenlik & Phishing Olta Taraması & Argo Moderasyon Motoru
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Siber Güvenlik Phishing (Olta Dolandırıcılığı) Link Taraması & Argo Sansürleme
// ============================================================

const ModerationEngine = {
  // Deep Search ile Derlenen Kapsamlı Türkçe Argo, Küfür ve Hakaret Sözlüğü
  profanityList: [
    'salak', 'aptal', 'gerzek', 'gerizekalı', 'sahtekar', 'dolandırıcı', 'hırsız', 'şerefsiz',
    'yavşak', 'ibne', 'kahpe', 'göt', 'piç', 'hıyar', 'amk', 'amq', 'amsk', 'yarak', 'yarrak',
    'daşşak', 'taşak', 'yarram', 'götüm', 'götveren', 'puşt', 'gavat', 'pislik', 'dangalak',
    'yosma', 'kaltak', 'sürtük', 'kancık', 'zibidi', 'pezevenk', 'çulsuz', 'mala bak', 'hıyar'
  ],

  // SİBER GÜVENLİK PHİSHİNG (OLTA DOLANDIRICILIĞI) ALARM DOMAİNLERİ VE ANAHTAR KELİMELERİ
  phishingDomains: [
    'bit.ly/phish', 'login-bank.xyz', 'free-crypto-giveaway.net', 'kazanc-garanti.com', 'scam-site.org',
    'ziraat-aidat-iade.com', 'garanti-bonus-kazan.top', 'e-devlet-destek-iade.xyz', 'papara-hediye.click',
    'binance-airdrop-giveaway.net', 'turktelekom-fatura-indirim.site', 'enpara-guvenlik-giris.tech'
  ],

  // YÜKSEK RİSKLİ ŞÜPHELİ TLD UZANTILARI
  suspiciousTLDs: ['.xyz', '.top', '.click', '.gq', '.cf', '.tk', '.ml', '.cam', '.cheap', '.work', '.fit', '.zip', '.mov'],

  // PHİSHİNG BİLDİRİM VE HESAP ÇALMA ANAHTAR KELİME KOMBİNASYONLARI
  phishingKeywords: [
    'login-bank', 'aidat-iade', 'kazanc-garanti', 'free-crypto', 'airdrop-bonus', 'hesap-dogrulama',
    'kimlik-guncelleme', 'papara-bonus', 'kredi-kart-aidat', 'ziraat-guvenlik', 'hesap-kilitlendi',
    'sifre-yenile-onay', 'banka-giris-guncelle'
  ],

  extractURLs(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    return text.match(urlRegex) || [];
  },

  /**
   * maskProfanityText: Argo ve küfür sözcüklerini 'g**', 'a**' şeklinde sansürler.
   */
  maskProfanityText(text) {
    let masked = text;
    this.profanityList.forEach(word => {
      const regex = new RegExp(`\\b${this.escapeRegExp(word)}\\b|${this.escapeRegExp(word)}`, 'gi');
      masked = masked.replace(regex, (match) => {
        if (match.length <= 2) return match[0] + '*';
        return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
      });
    });
    return masked;
  },

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * moderate: Gönderi ve Yorumlardaki Argo, Küfür ve Siber Güvenlik / Phishing Tehditlerini Tarlar.
   */
  async moderate(text, bypassProfanity = false) {
    const foundProfanity = [];
    const foundThreats = [];

    // PHASE 1: PROFANITY & SLANG CHECK
    const lowerText = text.toLowerCase();
    this.profanityList.forEach(w => {
      if (lowerText.includes(w.toLowerCase())) {
        if (!foundProfanity.includes(w)) {
          foundProfanity.push(w);
        }
      }
    });

    if (foundProfanity.length > 0 && !bypassProfanity) {
      return {
        passed: false,
        requiresUserAction: true,
        action: 'PROFANITY_WARNING',
        phase1: { foundWords: foundProfanity }
      };
    }

    // PHASE 2: CYBER SECURITY & PHISHING LINK CHECK (SİBER OLTA TARAMASI)
    const urls = this.extractURLs(text);
    urls.forEach(url => {
      const lowerUrl = url.toLowerCase();

      // 1. Bilinen Phishing Domain Kontrolü
      this.phishingDomains.forEach(domain => {
        if (lowerUrl.includes(domain.toLowerCase())) {
          foundThreats.push({
            domain: domain,
            url: url,
            reason: '🚨 Siber Güvenlik Alarmı: Veritabanında Kayıtlı Zararlı Phishing (Olta Dolandırıcılığı) Linki Tespiti',
            severity: 'KRİTİK SİBER TEHDİT (%100 RİSK)'
          });
        }
      });

      // 2. Şüpheli TLD Uzantısı ve Olta Kelimesi Analizi
      this.suspiciousTLDs.forEach(tld => {
        if (lowerUrl.includes(tld)) {
          this.phishingKeywords.forEach(kw => {
            if (lowerUrl.includes(kw)) {
              foundThreats.push({
                domain: url,
                url: url,
                reason: `🚨 Siber Güvenlik Alarmı: Şüpheli Uzantı (${tld}) ve Banka/Hesap Çalma Kelimesi (${kw}) Tespiti`,
                severity: 'YÜKSEK PHİSHİNG RİSKİ (%98 RİSK)'
              });
            }
          });
        }
      });

      // 3. Ham IP Adresi İçeren Link Taraması (Örn: http://192.168.1.1/login)
      const ipPattern = /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i;
      if (ipPattern.test(url)) {
        foundThreats.push({
          domain: url,
          url: url,
          reason: '🚨 Siber Güvenlik Alarmı: Gizlenmiş Ham IP Adresi Bağlantısı (Kötü Amaçlı Yazılım / Malware Riski)',
          severity: 'KRİTİK SİBER TEHDİT (%99 RİSK)'
        });
      }
    });

    if (foundThreats.length > 0) {
      return {
        passed: false,
        requiresUserAction: false,
        action: 'SECURITY_BLOCK',
        phase2: { threats: foundThreats }
      };
    }

    return { passed: true, action: 'ALLOW' };
  }
};

if (typeof window !== 'undefined') {
  window.ModerationEngine = ModerationEngine;
}
