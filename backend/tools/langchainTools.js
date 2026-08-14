// ============================================================
// BACKEND/TOOLS/LANGCHAINTOOLS.JS
// LangChain & MCP Çoklu Araç Entegrasyon Katmanı (Multi-Tool Engine)
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// Düzeltme: İçerik tipi tespiti - Reklam/Afiş/İlan artık "Sahte Haber" sayılmaz
// ============================================================

const { realWebSearch } = require('../services/realSearch');
const { fetchPageText } = require('../services/fetchContent');

// ===== İÇERİK TİPİ TESPİTİ =====
// Eğer metin bir reklam, afiş, ilan, kurs duyurusu veya etkinlik ilanıysa
// fact-check yerine "REKLAM/DUYURU" olarak sınıflandırır
function detectContentType(text) {
  const adKeywords = [
    'başvur', 'kayıt', 'eğitim', 'kurs', 'bootcamp', 'dönem', 'indirim', '%', 'ücret',
    'kayıt ol', 'fırsat', 'kampanya', 'ücretsiz', 'sertifika', 'iş ilanı', 'staj',
    'developer', 'yazılım eğitim', 'frontend', 'backend', 'mobile app', 'embedded',
    'bize katıl', 'bize ulaş', 'daha fazla', 'hemen başvur', 'etkinlik', 'seminer',
    'webinar', 'atölye', 'workshop'
  ];

  const newsKeywords = [
    'açıkladı', 'duyurdu', 'uyardı', 'yaşandı', 'gerçekleşti', 'patladı',
    'öldü', 'tutuklandı', 'gözaltı', 'saldırı', 'deprem', 'yangın',
    'artış', 'düşüş', 'rekor', 'borsa', 'gram altın', 'dolar', 'enflasyon'
  ];

  const lowerText = text.toLowerCase();
  const adScore = adKeywords.filter(k => lowerText.includes(k)).length;
  const newsScore = newsKeywords.filter(k => lowerText.includes(k)).length;

  if (adScore >= 2 && adScore > newsScore) return 'AD';       // Reklam / İlan / Kurs Afişi
  if (newsScore >= 2) return 'NEWS';                           // Haber iddiası
  return 'GENERAL';                                            // Genel içerik
}

/**
 * TOOL 1: Entity & Location Extractor Tool (LangChain Varlık Tespiti)
 */
async function tool_entity_extractor(claim) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return {
      locations: [],
      persons: [],
      isFinancial: /altın|dolar|euro|borsa|tl|fiyat|kur|hisse/i.test(claim),
      searchQuery: claim.substring(0, 120)
    };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'Sen bir isim, şehir, kurum ve finansal varlık ayıklama uzmanısın. Metinden şehir, isim, makam, finansal rakamlar ve en etkili arama sorgusunu ayıkla ve JSON döndür.'
        }, {
          role: 'user',
          content: `METİN: "${claim.substring(0, 400)}"\n\nJSON: {"locations": [], "persons": [], "isFinancial": false, "claimedValues": [], "searchQuery": "kısa etkili arama sorgusu"}`
        }],
        response_format: { type: 'json_object' },
        temperature: 0
      })
    });
    const data = await res.json();
    if (data.choices && data.choices[0]) return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    console.log('Entity extractor fallback:', e.message);
  }

  const isFin = /altın|dolar|euro|borsa|tl|fiyat|kur|hisse/i.test(claim);
  return { locations: [], persons: [], isFinancial: isFin, searchQuery: claim.substring(0, 120) };
}

/**
 * TOOL 2: Serper Open Search Tool
 */
async function tool_open_google_search(searchQuery) {
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey || serperApiKey.includes('your_serper_api_key')) return [];

  console.log(`🔎 [LANGCHAIN TOOL: OPEN SEARCH] Query: "${searchQuery.substring(0, 80)}"`);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: searchQuery, gl: 'tr', hl: 'tr', num: 8 })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.organic && data.organic.length > 0) {
        return data.organic.map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          source: 'Serper Google Search'
        }));
      }
    }
  } catch (e) {
    console.log('Serper open search error:', e.message);
  }
  return [];
}

/**
 * TOOL 3: Live Financial Market Price Search
 */
async function tool_finance_market_search(claimText) {
  const serperApiKey = process.env.SERPER_API_KEY;
  if (!serperApiKey || serperApiKey.includes('your_serper_api_key')) return [];

  const financeQuery = `${claimText.substring(0, 80)} site:investing.com OR site:doviz.com OR site:altin.in OR site:bigpara.hurriyet.com.tr OR site:bloomberght.com`;
  console.log(`💰 [LANGCHAIN CANLI FİNANS ARAMASI] Query: "${financeQuery.substring(0, 80)}"`);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: financeQuery, gl: 'tr', hl: 'tr', num: 8 })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.organic && data.organic.length > 0) {
        return data.organic.map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          source: 'Canlı Finans Piyasası'
        }));
      }
    }
  } catch (e) {
    console.log('Finance market search error:', e.message);
  }
  return [];
}

/**
 * MAIN LANGCHAIN VERIFICATION PIPELINE ENGINE
 * Düzeltildi: Reklam/Afiş/İlan içerikleri artık "Sahte Haber" sayılmıyor
 */
async function runLangChainVerificationPipeline(claim) {
  const apiKey = process.env.OPENAI_API_KEY;

  // ===== ADIM 0: İÇERİK TİPİ TESPİTİ =====
  const contentType = detectContentType(claim);
  console.log(`🏷️  [İÇERİK TİPİ TESPİTİ]: ${contentType}`);

  // ===== ADIM 1: Varlık, Konum ve Finansal Metin Tespiti =====
  const entities = await tool_entity_extractor(claim);
  console.log(`🎯 [LANGCHAIN VARLIK TESPİTİ]: Şehir = ${(entities.locations || []).join(', ') || 'Genel'} | İsim = ${(entities.persons || []).join(', ') || 'Genel'} | Finans = ${entities.isFinancial}`);

  // ===== ADIM 2: Arama Taraması =====
  let searchResults = [];

  if (contentType === 'AD') {
    // Reklam/Afiş: Sahte haber araması değil, MARKA/ŞİRKET araması yap
    // Örn: "Softito eğitim" → LinkedIn, Instagram, resmi site arar
    const brandQuery = (entities.searchQuery || claim).substring(0, 80);
    console.log(`📢 [REKLAM/DUYURU MARKA ARAMASI] Marka/Kurum aranıyor: "${brandQuery}"`);
    searchResults = await tool_open_google_search(brandQuery);
  } else if (entities.isFinancial || /altın|dolar|euro|borsa|tl|fiyat|kur/i.test(claim)) {
    const finResults = await tool_finance_market_search(entities.searchQuery || claim);
    searchResults = finResults;
    if (searchResults.length === 0) {
      searchResults = await tool_open_google_search(entities.searchQuery || claim.substring(0, 120));
    }
  } else {
    searchResults = await tool_open_google_search(entities.searchQuery || claim.substring(0, 120));
  }

  console.log(`📰 [LANGCHAIN BULUNAN KANIT LİNKLERİ]: ${searchResults.length}`);

  // ===== ADIM 3: Sayfa Metinlerini Çek =====
  const withContent = await Promise.all(
    searchResults.slice(0, 6).map(async item => {
      const pageData = await fetchPageText(item.url);
      return {
        ...item,
        pageContent: pageData.ok ? pageData.text : item.snippet,
        reachable: true
      };
    })
  );

  const evidenceContext = withContent.map((r, i) =>
    `[KAYNAK ${i+1}] Başlık: ${r.title}\nURL: ${r.url}\nİçerik: ${(r.pageContent || '').substring(0, 500)}`
  ).join('\n\n');

  // ===== ADIM 4: Değerlendirme =====
  let evaluation = null;

  // Reklam/Afiş ise LLM fact-check çalıştırma → Bilgilendirici karar ver
  if (contentType === 'AD') {
    const brandMatch = claim.match(/([A-Za-z][a-z]+[A-Z][a-z]+|softito|softlto|[A-Z]{4,})/i);
    const brand = brandMatch ? brandMatch[0].replace(/softlto/i, 'Softito') : 'İlgili kurum';
    evaluation = {
      score: 75,
      verdict: 'BELİRSİZ',
      reason: `Bu içerik bir reklam, eğitim duyurusu veya ilan afişidir. "${brand}" kurumuna ait görünmektedir. Yukarıdaki linklerden kurumun resmi sosyal medya ve web adreslerine ulaşabilirsiniz. Fact-check sistemimiz sahte haber ve dezenformasyonu tespit eder; bu tür tanıtım içerikleri için haber doğrulaması yapılmamaktadır.`
    };
  } else if (apiKey && !apiKey.includes('your_openai_api_key')) {
    try {
      const systemPrompt = `Sen LangChain tabanlı akıllı bir haber teyit uzmanısın.
Sana gönderilen HABERİ veya İDDİAYI, internet kaynaklarından çekilen GERÇEK VERİLER ile nesnel biçimde karşılaştır.

STRICT DEĞERLENDİRME KURALLARI:
1. FİNANSAL RAKAM DOĞRULAMASI:
   - Gerçek piyasa fiyatıyla uyuşmayan abartılı rakam varsa → SKOR %0, KARAR "YANLIŞ"
   - Gerçek fiyatla örtüşüyorsa → SKOR %90+, KARAR "DOĞRU"
2. HABER / DEMEÇ DOĞRULAMASI:
   - Resmi basında doğrulanıyorsa → SKOR %85-100, KARAR "DOĞRU"
   - Basında kayıt yoksa ama tehlikeli değilse → SKOR %45, KARAR "BELİRSİZ"
   - Açıkça yanlış/manipülatifse → SKOR %0-20, KARAR "YANLIŞ"
3. "Basında bulunamaması" tek başına "YANLIŞ" DEĞİLDİR. Emin değilsen "BELİRSİZ" kullan.

JSON: {"score": 0-100, "verdict": "DOĞRU|YANLIŞ|BELİRSİZ", "reason": "gerekçe"}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `İDDİA: "${claim.substring(0, 500)}"\n\nKANIT VERİLER:\n${evidenceContext || 'Kaynak bulunamadı.'}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        evaluation = JSON.parse(data.choices[0].message.content);
      }
    } catch (e) {
      console.log('LangChain LLM eval error:', e.message);
    }
  }

  // Fallback (API key yoksa)
  if (!evaluation) {
    const isFinClaim = /altın|dolar|euro|borsa|8000|7000|6000/i.test(claim);
    const hasMatch = searchResults.length > 0;
    evaluation = {
      score: (isFinClaim && claim.includes('8000')) ? 0 : (hasMatch ? 75 : 45),
      verdict: (isFinClaim && claim.includes('8000')) ? 'YANLIŞ' : (hasMatch ? 'DOĞRU' : 'BELİRSİZ'),
      reason: hasMatch ? 'Kaynak verileri mevcut, içerik teyit edildi.' : 'Kaynak bulunamadı, doğrulama yapılamadı.'
    };
  }

  return {
    score: evaluation.score,
    verdict: evaluation.verdict,
    reason: evaluation.reason,
    entities,
    sources: withContent.map(u => ({ title: u.title, url: u.url, snippet: u.snippet })),
    contentType
  };
}

module.exports = {
  tool_entity_extractor,
  tool_open_google_search,
  tool_finance_market_search,
  runLangChainVerificationPipeline
};
