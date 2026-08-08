// ============================================================
// BACKEND/SERVICES/FETCHCONTENT.JS
// Canlı Web Sayfa Metni Çekici ve HTML Temizleyici Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

/**
 * fetchPageText(url):
 * Hedef web sayfasının HTML içeriğini çeker, script ve stil etiketlerini temizler,
 * paragraf metinlerini ayıklayarak yapay zekânın okuyabileceği düz metne dönüştürür.
 */
async function fetchPageText(url) {
  if (!url || !url.startsWith('http')) {
    return { ok: false, text: '', status: 400 };
  }

  console.log(`📄 [İÇERİK ÇEKİLİYOR] URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000) // 4 saniye zaman aşımı
    });

    if (!response.ok) {
      return { ok: false, text: '', status: response.status };
    }

    const html = await response.text();

    // Clean HTML: Remove scripts, styles, and tags
    let cleanText = html
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, ' ')
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, ' ')
      .replace(/<noscript\b[^<]*>([\s\S]*?)<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Return truncated text (first 1200 chars for LLM context window efficiency)
    const truncatedText = cleanText.substring(0, 1200);

    return {
      ok: truncatedText.length > 50,
      text: truncatedText,
      status: 200
    };

  } catch (e) {
    console.log(`İçerik çekme uyarısı (${url}):`, e.message);
    return { ok: false, text: '', status: 500 };
  }
}

module.exports = { fetchPageText };
