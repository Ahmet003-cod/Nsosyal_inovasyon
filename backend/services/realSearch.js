// ============================================================
// BACKEND/SERVICES/REALSEARCH.JS
// Doğrudan Makale & Haber Linki Arama Servisi (Direct Link Engine)
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

/**
 * isDirectArticleUrl(url):
 * Linkin sadece ana sayfa (örn: https://webtekno.com) olmadığını,
 * doğrudan o habere ait spesifik bir alt sayfa/makale linki olduğunu doğrular.
 */
function isDirectArticleUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    // Ana sayfa veya sadece kök dizin ise doğrudan haber değildir
    if (!pathname || pathname === '/' || pathname === '/tr/' || pathname === '/tr' || pathname === '/index.php') {
      return false;
    }
    // Arama sayfaları veya genel kategoriler ise hariç tut
    if (pathname.includes('/arama') || pathname.includes('/search') || pathname.includes('/category')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * realWebSearch(query, domain):
 * İddiayı alır, Serper.dev / Google üzerinden ilgili domaindeki DOĞRUDAN MAKALE LINKLERINI arar.
 * Ana sayfa linklerini filtreler, sadece spesifik haber bağlantılarını döndürür.
 */
async function realWebSearch(query, domain) {
  const serperApiKey = process.env.SERPER_API_KEY;
  const cleanQuery = query.substring(0, 70).trim();
  const searchQ = `${cleanQuery} site:${domain}`;

  console.log(`🔎 [DOĞRUDAN HABER LİNKİ ARAMASI] Domain: ${domain} | Query: "${cleanQuery}"`);

  // 1. CANLI SERPER.DEV GOOGLE SEARCH API (Spesifik Haber Araması)
  if (serperApiKey && !serperApiKey.includes('your_serper_api_key')) {
    try {
      const serperRes = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: searchQ, gl: 'tr', hl: 'tr', num: 6 })
      });

      if (serperRes.ok) {
        const serperData = await serperRes.json();
        if (serperData.organic && serperData.organic.length > 0) {
          // Filtrele: Sadece doğrudan haber/makale linklerini al
          const directLinks = serperData.organic
            .filter(item => isDirectArticleUrl(item.link))
            .map(item => ({
              title: item.title,
              url: item.link,
              snippet: item.snippet || '',
              domain: domain,
              isDirectLink: true,
              source: `Serper.dev Direct Article (${domain})`
            }));

          if (directLinks.length > 0) {
            return directLinks;
          }
        }
      }
    } catch (e) {
      console.log(`Serper direct link error for ${domain}:`, e.message);
    }
  }

  // 2. GOOGLE NEWS RSS İLE DOĞRUDAN HABER LINKI BULMA
  try {
    const encodedQ = encodeURIComponent(`${cleanQuery} site:${domain}`);
    const rssUrl = `https://news.google.com/rss/search?q=${encodedQ}&hl=tr&gl=TR&ceid=TR:tr`;
    
    const rssRes = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (rssRes.ok) {
      const xmlText = await rssRes.text();
      const items = [];
      const itemRegex = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/g;
      let match;
      let count = 0;
      while ((match = itemRegex.exec(xmlText)) !== null && count < 4) {
        const rawTitle = match[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
        const rawLink = match[2].trim();
        if (isDirectArticleUrl(rawLink)) {
          items.push({
            title: rawTitle,
            url: rawLink,
            snippet: rawTitle,
            domain: domain,
            isDirectLink: true,
            source: `Google News RSS Direct Link (${domain})`
          });
          count++;
        }
      }
      if (items.length > 0) return items;
    }
  } catch (e) {
    console.log(`RSS direct link error for ${domain}:`, e.message);
  }

  // Eğer hiçbir doğrudan haber linki bulunamadıysa boş dizi döndür! (Jenerik ana sayfa linki döndürme!)
  return [];
}

module.exports = { realWebSearch, isDirectArticleUrl };
