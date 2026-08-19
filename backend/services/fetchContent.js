// ============================================================
// BACKEND/SERVICES/FETCHCONTENT.JS
// Canlı Web Sayfa Metni Çekici ve HTML Temizleyici Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

/**
 * fetchPageText(url):
 * Hedef web sayfasının HTML içeriğini çeker, script ve stil etiketlerini temizler,
 * paragraf metinlerini ayıklayarak yapay zekânın okuyabileceği düz metne dönüştürür.
 * @param {string} url - İçeriği çekilecek web sayfasının adresi.
 * @returns {object} - Durum ve temizlenmiş metni içeren obje.
 */
async function fetchPageText(url) {
  // Geçerli bir URL değilse veya boşsa hata objesi döndür
  if (!url || !url.startsWith('http')) {
    return { ok: false, text: '', status: 400 };
  }

  // İşlemin başladığını konsola logla
  console.log(`📄 [İÇERİK ÇEKİLİYOR] URL: ${url}`);

  try {
    // Hedef URL'e GET isteği at (Sayfayı fetch ile çek)
    const response = await fetch(url, {
      headers: {
        // Gerçek bir tarayıcı gibi davranarak engellemeleri aşmak için User-Agent belirle
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000) // 4 saniye zaman aşımı (sayfa çok yavaşsa takılı kalmamak için)
    });

    // İstek başarılı değilse hata durum kodu ile dön
    if (!response.ok) {
      return { ok: false, text: '', status: response.status };
    }

    // Gelen ham HTML içeriğini al
    const html = await response.text();

    // Clean HTML: Remove scripts, styles, and tags (HTML kodlarını temizleyerek sadece saf metni bırak)
    let cleanText = html
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, ' ') // Tüm javascript kodlarını sil
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, ' ') // Tüm CSS stil kodlarını sil
      .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, ' ') // Vektör (SVG) resim kodlarını sil
      .replace(/<noscript\b[^<]*>([\s\S]*?)<\/noscript>/gi, ' ') // Noscript etiketlerini sil
      .replace(/<[^>]+>/g, ' ') // Geriye kalan tüm HTML etiketlerini sil (<div>, <p>, vs.)
      .replace(/&nbsp;/g, ' ') // HTML boşluklarını (nbsp) normal boşluğa çevir
      .replace(/&quot;/g, '"') // Tırnak işareti entity'sini normale çevir
      .replace(/&#39;/g, "'") // Tek tırnak entity'sini normale çevir
      .replace(/\s+/g, ' ') // Birden fazla yan yana olan boşlukları tek boşluğa indir
      .trim(); // Baş ve sondaki gereksiz boşlukları temizle

    // Return truncated text (first 1200 chars for LLM context window efficiency)
    // Maliyet ve LLM token sınırı optimizasyonu için metnin ilk 1200 karakterini al
    const truncatedText = cleanText.substring(0, 1200);

    return {
      ok: truncatedText.length > 50, // Temizlenen metin 50 karakterden uzunsa başarılı kabul et
      text: truncatedText, // Temizlenmiş ve kesilmiş son metin
      status: 200 // Başarılı HTTP kodu
    };

  } catch (e) {
    // Sayfa ulaşılamazsa veya zaman aşımına uğrarsa hatayı konsola bas ve hata döndür
    console.log(`İçerik çekme uyarısı (${url}):`, e.message);
    return { ok: false, text: '', status: 500 };
  }
}

// Modülü dışarı aktar
module.exports = { fetchPageText };
