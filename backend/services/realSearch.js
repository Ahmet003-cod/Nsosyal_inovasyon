// ============================================================
// BACKEND/SERVICES/REALSEARCH.JS
// Doğrudan Makale & Haber Linki Arama Servisi (Direct Link Engine)
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

/**
 * isDirectArticleUrl(url):
 * Linkin sadece ana sayfa (örn: https://webtekno.com) olmadığını,
 * doğrudan o habere ait spesifik bir alt sayfa/makale linki olduğunu doğrular.
 * @param {string} url - Kontrol edilecek bağlantı.
 * @returns {boolean} - Bağlantı direkt bir makaleyi gösteriyorsa true, aksi halde false.
 */
function isDirectArticleUrl(url) {
  if (!url || typeof url !== 'string') return false; // Boş veya geçersiz tür ise reddet
  try {
    const parsed = new URL(url); // URL'yi parse et (Geçersiz URL'lerde try bloğu e'ye düşer)
    const pathname = parsed.pathname; // Linkin yol (path) kısmını al
    
    // Ana sayfa veya sadece kök dizin ise doğrudan haber değildir (örn: com.tr, com.tr/, com.tr/tr vb.)
    if (!pathname || pathname === '/' || pathname === '/tr/' || pathname === '/tr' || pathname === '/index.php') {
      return false;
    }
    // Arama sayfaları veya genel kategori listeleme sayfaları ise haber içeriği barındırmaz, hariç tut
    if (pathname.includes('/arama') || pathname.includes('/search') || pathname.includes('/category')) {
      return false;
    }
    // Eğer yukarıdaki filtrelere takılmadıysa geçerli, derinlemesine (spesifik) bir haber linkidir
    return true;
  } catch (e) {
    // URL formatı bozuksa false dön
    return false;
  }
}

/**
 * realWebSearch(query, domain):
 * İddiayı alır, Serper.dev / Google üzerinden ilgili domaindeki DOĞRUDAN MAKALE LINKLERINI arar.
 * Ana sayfa linklerini filtreler, sadece spesifik haber bağlantılarını (doğrudan kanıt) döndürür.
 * @param {string} query - Aranacak iddia veya haber metni.
 * @param {string} domain - Hangi sitede arama yapılacağı (Örn: bbc.com, sozcu.com.tr)
 * @returns {Array} - Bulunan haber bağlantılarını içeren dizi objesi.
 */
async function realWebSearch(query, domain) {
  const serperApiKey = process.env.SERPER_API_KEY; // Google Serper API Anahtarını al
  // Sorgu metnini en fazla 70 karaktere kadar kes ve temizle (Çok uzun cümlelerde Google düzgün sonuç bulamayabilir)
  const cleanQuery = query.substring(0, 70).trim(); 
  // "site:" operatörünü ekleyerek sadece belirtilen domain içinde arama yapacak Google Dork formatını oluştur
  const searchQ = `${cleanQuery} site:${domain}`;

  console.log(`🔎 [DOĞRUDAN HABER LİNKİ ARAMASI] Domain: ${domain} | Query: "${cleanQuery}"`);

  // 1. YÖNTEM: CANLI SERPER.DEV GOOGLE SEARCH API (Spesifik Haber Araması)
  if (serperApiKey && !serperApiKey.includes('your_serper_api_key')) {
    try {
      // Serper.dev uç noktasına Google Arama isteği at
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey, // API Anahtarı kimlik doğrulaması
          'Content-Type': 'application/json'
        },
        // Arama sorgusu ve dil ayarları (Türkiye lokasyonu: gl='tr', hl='tr', 6 sonuç getir)
        body: JSON.stringify({ q: searchQ, gl: 'tr', hl: 'tr', num: 6 })
      });

      if (serperRes.ok) {
        const serperData = await serperRes.json();
        if (serperData.organic && serperData.organic.length > 0) {
          // Filtrele: Dönen organik sonuçlar arasında SADECE doğrudan haber/makale linklerini al
          const directLinks = serperData.organic
            .filter(item => isDirectArticleUrl(item.link)) // Ana sayfaları çöpe at
            .map(item => ({
              title: item.title,
              url: item.link,
              snippet: item.snippet || '',
              domain: domain,
              isDirectLink: true, // Direkt haber olduğunu belirten işaretleyici
              source: `Serper.dev Direct Article (${domain})`
            }));

          // Geçerli linkler varsa döndür (API başarılıysa Google News yöntemini atla)
          if (directLinks.length > 0) {
            return directLinks;
          }
        }
      }
    } catch (e) {
      console.log(`Serper direct link error for ${domain}:`, e.message);
    }
  }

  // 2. YÖNTEM (YEDEK): GOOGLE NEWS RSS İLE DOĞRUDAN HABER LINKI BULMA
  // Serper API limiti bittiyse veya sonuç bulamadıysa, Google News RSS üzerinden ücretsiz arama yapar
  try {
    // Özel karakterleri (örn. boşluk) URL encode formatına çevir (%20 vb.)
    const encodedQ = encodeURIComponent(`${cleanQuery} site:${domain}`);
    // Google Haberler RSS arama uç noktası
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQ}&hl=tr&gl=TR&ceid=TR:tr`;
    
    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (rssRes.ok) {
      const xmlText = await rssRes.text(); // RSS çıktısını XML metni olarak al
      const items = [];
      // <item> içindeki <title> ve <link> etiketlerini çekmek için Regex ifadesi (Ham XML parsing)
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g;
      let match;
      let count = 0;
      // Tüm XML'i tara ve en fazla ilk 4 sonucu çek
      while ((match = itemRegex.exec(xmlText)) !== null && count < 4) {
        // CDATA gibi xml kalıntılarını temizle ve başlığı al
        const rawTitle = match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
        const rawLink = match[2].trim();
        // Çekilen link gerçekten bir haber makalesine mi gidiyor kontrol et
        if (isDirectArticleUrl(rawLink)) {
          items.push({
            title: rawTitle,
            url: rawLink,
            snippet: rawTitle, // RSS snippet vermediği için snippet olarak da başlığı veriyoruz
            domain: domain,
            isDirectLink: true,
            source: `Google News RSS Direct Link (${domain})`
          });
          count++; // Sadece geçerli doğrudan linkleri say
        }
      }
      // Geçerli rss sonuçları varsa döndür
      if (items.length > 0) return items;
    }
  } catch (e) {
    console.log(`RSS direct link error for ${domain}:`, e.message);
  }

  // Eğer hiçbir doğrudan haber linki bulunamadıysa boş dizi döndür! (Asla sadece ana sayfa linki döndürülmez!)
  return [];
}

module.exports = { realWebSearch, isDirectArticleUrl };
