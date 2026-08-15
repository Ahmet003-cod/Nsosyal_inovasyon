// ============================================================
// FRONTEND/MODERATION.JS - Siber Güvenlik & URLBert AI URL Taraması & Argo Moderasyon Motoru
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// URLBert: CrabInHoney/urlbert-tiny-v4-malicious-url-classifier
// Doğruluk: %99.22 | Phishing F1: 0.9734 | Malware F1: 0.9845
// ============================================================

const ModerationEngine = {
  // Argo ve Küfür Denetimi Tek Merkezli backend/badwords.js Üzerinden Yapılmaktadır.
  // Ön Yüzde Sabit Küfür Dizisi Saklanmaz.

  extractURLs(text) {
    // 1. hxxp:// ve hxxps:// (gizlenmiş/defanged linkler) için normalizasyon
    const normalizedText = text.replace(/hxxps?:\/\//gi, (match) => match.toLowerCase().replace('hxxp', 'http'));

    // 2. Standart http/https URL'leri ve Ham IP Adresi bağlantıları (örn: 217.60.195.113/path)
    const urlRegex = /(https?:\/\/[^\s]+|(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]+)?(?:\/[^\s]*)?)/gi;
    const matches = normalizedText.match(urlRegex) || [];

    return matches.map(u => {
      if (!u.startsWith('http://') && !u.startsWith('https://')) {
        return 'http://' + u;
      }
      return u;
    });
  },

  async maskProfanityText(text) {
    try {
      const response = await fetch('/api/filter-badwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (response.ok) {
        const data = await response.json();
        return data.filteredText || text;
      }
    } catch (err) {
      console.warn('[Moderation] Badwords API yanıt vermedi.');
    }
    return text;
  },

  /**
   * classifyURLWithAI: URLBert Transformer Modeli ile URL'yi sınıflandırır.
   * Benign / Phishing / Malware / Defacement → %99.22 doğruluk
   */
  async classifyURLWithAI(url) {
    try {
      const response = await fetch('/api/classify-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) return null;
      return await response.json();

    } catch (err) {
      console.warn('[URLBert] API erişilemedi, URL güvenli kabul edildi:', err.message);
      return null; // Servis yoksa geçir (güvenli varsay)
    }
  },

  /**
   * moderate: Argo/Küfür tespiti (Backend Badwords API) + URLBert AI ile URL güvenlik taraması.
   */
  async moderate(text, bypassProfanity = false) {
    let foundProfanity = [];

    // PHASE 1: PROFANITY & SLANG CHECK (500+ Kelimelik Backend Badwords Entegrasyonu)
    try {
      const bwRes = await fetch('/api/filter-badwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(3000)
      });
      if (bwRes.ok) {
        const bwData = await bwRes.json();
        if (bwData.containsBadWord) {
          foundProfanity.push('Topluluk Kurallarına Aykırı İfade / Argo');
        }
      }
    } catch (err) {
      console.warn('[Moderation] Badwords API erişilemedi.');
    }

    if (foundProfanity.length > 0 && !bypassProfanity) {
      return {
        passed: false,
        requiresUserAction: true,
        action: 'PROFANITY_WARNING',
        phase1: { foundWords: foundProfanity }
      };
    }

    // PHASE 2: 🤖 URLBERT AI URL GÜVENLİK TARAMASI (Transformer Modeli)
    const urls = this.extractURLs(text);

    if (urls.length > 0) {
      console.log(`🤖 [URLBert AI] ${urls.length} URL bulundu, sınıflandırılıyor...`);

      for (const url of urls) {
        const result = await this.classifyURLWithAI(url);

        if (result && !result.safe) {
          const riskPercent = result.risk || 90;
          const labelTr = result.labelTr || 'Zararlı URL';
          const label = result.label || 'phishing';
          const confidence = result.score ? Math.round(result.score * 100) : riskPercent;

          console.warn(`🚨 [URLBert AI] TEHDİT TESPİT EDİLDİ: ${url} → ${labelTr} (%${confidence} güven)`);

          // Etiket bazlı tehdit mesajı
          let threatReason = '';
          let severity = '';

          if (label === 'phishing') {
            threatReason = `🎣 URLBert AI Oltalama (Phishing) Tespiti: Bu link, kişisel bilgi ve şifre çalmaya yönelik sahte bir sayfa olabilir.`;
            severity = `KRİTİK PHİSHİNG TEHDİDİ (%${confidence} Güven Skoru)`;
          } else if (label === 'malware') {
            threatReason = `☠️ URLBert AI Zararlı Yazılım (Malware) Tespiti: Bu link, cihazınıza zararlı yazılım yükleyebilir.`;
            severity = `KRİTİK MALWARE TEHDİDİ (%${confidence} Güven Skoru)`;
          } else if (label === 'defacement') {
            threatReason = `🖤 URLBert AI Sayfa Tahrif (Defacement) Tespiti: Bu link, hacklenmiş veya tahrip edilmiş bir sayfaya yönlendiriyor.`;
            severity = `YÜKSEK GÜVENLİK RİSKİ (%${confidence} Güven Skoru)`;
          } else {
            threatReason = `🚨 URLBert AI Güvenlik Tespiti: Bu link tehlikeli olarak sınıflandırıldı (${labelTr}).`;
            severity = `GÜVENLİK TEHDİDİ (%${confidence} Güven Skoru)`;
          }

          return {
            passed: false,
            requiresUserAction: false,
            action: 'SECURITY_BLOCK',
            phase2: {
              threats: [{
                domain: new URL(url).hostname,
                url: url,
                reason: threatReason,
                severity: severity,
                model: 'URLBert AI (urlbert-tiny-v4-malicious-url-classifier)',
                label: label,
                labelTr: labelTr,
                confidence: confidence
              }]
            }
          };
        }

        // Güvenli URL → devam et
        if (result && result.safe) {
          console.log(`✅ [URLBert AI] Güvenli URL: ${url.substring(0, 60)} (${result.labelTr})`);
        }
      }
    }

    return { passed: true, action: 'ALLOW' };
  }
};

if (typeof window !== 'undefined') {
  window.ModerationEngine = ModerationEngine;
}
