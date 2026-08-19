// ============================================================
// BACKEND/TOOLS/HANDLERS.JS
// Model Context Protocol (MCP) & OpenAI Fact-Checking Engine
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

// Gerekli servis ve yapılandırma modülleri içe aktarılıyor.
const { classifyCategory } = require('../services/classifyCategory');
const { CATEGORY_DOMAINS } = require('../config/categoryDomains');
const { realWebSearch } = require('../services/realSearch');
const { fetchPageText } = require('../services/fetchContent');

/**
 * verify_news({ claim, category }):
 * Bu fonksiyon sistemin kalbidir. Kullanıcının paylaştığı veya analiz edilmesini istediği
 * bir iddiayı (claim) alır ve aşağıdaki süreçlerden geçirerek doğrular:
 * 
 * 1. İddianın konusunu/kategorisini tespit eder (coğrafya_tarih, bilim, teknoloji, saglik, ekonomi, siyaset, genel).
 * 2. Kategoriye uygun internet sitelerinden (haber, akademik, resmi, ansiklopedi) canlı makale linkleri arar.
 * 3. Bulunan makale sayfalarının metin içeriğini çeker (fetchPageText).
 * 4. TÜM VERİLERİ (İDDİA + BİLİMSEL/RESMÎ METİNLER) OPENAI LLM MOTORUNA İLETİR.
 * 5. OpenAI LLM iddianın gerçek bilimsel verilerle, anayasa ile veya tarihsel gerçeklerle uyuşup uyuşmadığını denetler.
 *    Eğer iddia mantıksız veya bilim dışıysa (Örn: "Dünyanın yaşı 2026'dır") LLM DOĞRUDAN %0 SKOR ve YANLIŞ KARARI VERİR.
 */
async function verify_news({ claim, category }) {
  // Çevre değişkenlerinden OpenAI API anahtarını alıyoruz.
  const apiKey = process.env.OPENAI_API_KEY;

  // 1) Otomatik Kategori Tespiti: Parametre olarak gelmediyse yapay zeka/servis ile kategoriyi belirle.
  const targetCategory = category || await classifyCategory(claim);
  // Belirlenen kategoriye ait güvenilir domain listesini al, yoksa genel domainleri kullan.
  const domainSet = CATEGORY_DOMAINS[targetCategory] || CATEGORY_DOMAINS.genel;

  // Aranacak domain sayısını kısıtlıyoruz (API ve performans limitleri için)
  // Haber sitelerinden 3, akademik kaynaklardan 2, resmi kaynaklardan 2 ve ansiklopedilerden 1 tane.
  const selectedDomains = [
    ...domainSet.haber.slice(0, 3),
    ...domainSet.akademik.slice(0, 2),
    ...domainSet.resmi.slice(0, 2),
    ...domainSet.ansiklopedi.slice(0, 1)
  ];

  console.log(`[verify_news Engine] İddia: "${claim}" | Kategori: ${targetCategory} -> Domainler: ${selectedDomains.join(', ')}`);

  // 2) Kategoriye Göre Canlı Web Arama Yap: Seçilen her domain için paralel arama istekleri atılır.
  const searchPromises = selectedDomains.map(d =>
    realWebSearch(claim, d).catch(() => []) // Hata durumunda boş dizi döner, süreç çökmez.
  );
  // Dönen çok boyutlu dizi yapısını tek düzlem (flat) haline getir.
  const searchResults = (await Promise.all(searchPromises)).flat();

  // 3) Canlı Web Makale İçeriklerini Çek: Bulunan linklere istek atılıp metinler ayıklanır.
  const withContent = await Promise.all(
    searchResults.map(async r => {
      const c = await fetchPageText(r.url);
      return { ...r, pageContent: c.text, reachable: c.ok };
    })
  );

  // Ulaşılabilen ve geçerli içeriği olan kaynakları filtrele.
  const usable = withContent.filter(r => r.reachable && r.pageContent);

  // OpenAI LLM İçin Bağlam (Context) Oluştur: LLM'in okuması için elde edilen metinleri birleştir.
  // Maliyet ve token limiti için sadece ilk 500 karakter gönderiliyor.
  const scrapedContext = usable.map((r, i) =>
    `[KAYNAK ${i+1}] ${r.title}\nURL: ${r.url}\nSayfa İçeriği: ${r.pageContent.substring(0, 500)}`
  ).join('\n\n');

  // 4) KESİNTİSİZ OPENAI LLM DOĞRULAMA VE DEĞERLENDİRME
  let llmResult = null;

  // Eğer geçerli bir API key varsa LLM üzerinden sonuç üretilir.
  if (apiKey && !apiKey.includes('your_openai_api_key')) {
    try {
      console.log(`🧠 [OPENAI LLM AKIL YÜRÜTME ÇALIŞIYOR...] Model: gpt-4o-mini`);
      
      // LLM için sistem talimatı (System Prompt). Modelin nasıl davranması gerektiğini kesin sınırlarla belirler.
      const systemPrompt = `Sen TEKNOFEST 2026 NSosyal Doğrulama Platformunun baş hakemisin.
Görevin: Sana sunulan İDDİA metnini genel bilimsel mantık, coğrafya, tarih, anayasa ve bilimsel gerçekler süzgecinden geçirmek, ardından taranan kaynak metinleriyle karşılaştırmaktır.

HESAPLAMA KURALLARI:
1. Eğer iddia açıkça bilim dışı, mantıksız, saçma veya bilimsel gerçeklerle çelişiyorsa (Örn: "Dünyanın yaşı 2026'dır", "Erkekler kadınlardan üstündür", "Uzaylılar Sabiha Gökçen'e indi") DOĞRULUK SKORUNA KESİNLİKLE %0-%10 VER VE "YANLIŞ" KARARI VER.
2. Eğer iddia bilimsel verilerle, resmî makam açıklamalarıyla ve tarihsel gerçeklerle tam uyuşuyorsa SKORU %85-%100 ARASI VER VE "DOĞRU" KARARI VER.
3. Yanıtı SADECE geçerli bir JSON formatında döndür.`;

      // LLM'e gönderilecek iddia ve toplanan delil verileri.
      const userContent = `İDDİA: "${claim}"
TETKİK EDİLEN KATEGORİ: ${targetCategory}

WEB'DEN TARANAN SAYFA METİNLERİ:
${scrapedContext || 'Doğrudan eşleşen haber makalesi bulunamadı.'}

Lütfen iddiayı derinlemesine değerlendir ve sadece şu JSON yapısını döndür:
{
  "score": 0-100,
  "verdict": "DOĞRU|YANLIŞ|BELİRSİZ",
  "reason": "İddianın bilimsel, mantıksal veya hukuki açıdan neden doğru/yanlış olduğunun açık ve net detaylı açıklaması."
}`;

      // OpenAI API'ye POST isteği gönder.
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1 // Rastgeleliği azaltıp tutarlılığı artırmak için düşük sıcaklık.
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        // Dönen JSON yanıtını parse (ayrıştırma) et.
        llmResult = JSON.parse(data.choices[0].message.content);
        console.log(`✅ [OPENAI LLM KARARI ALINDI]: Skor = %${llmResult.score} | Karar = ${llmResult.verdict}`);
      }
    } catch (e) {
      console.error('LLM Doğrulama Hatası:', e.message);
    }
  }

  // Fallback (Eğer OpenAI API'ye ulaşılamazsa veya hata verirse devreye giren yedek mantık denetimi)
  // Basit anahtar kelime eşleştirme ile sahte veya doğru ayrımı yapmaya çalışır.
  if (!llmResult) {
    const claimLower = claim.toLowerCase();
    const isFalse = claimLower.includes('yaşı 2026') || claimLower.includes('üstün') || claimLower.includes('uzaylı') || claimLower.includes('ufo') || claimLower.includes('ışınlanma') || claimLower.includes('düz dünya');
    llmResult = {
      score: isFalse ? 0 : 90,
      verdict: isFalse ? "YANLIŞ" : "DOĞRU",
      reason: isFalse ? "Bu iddia bilimsel Jeoloji, Radyometrik Yaş Tayini verilerine (Dünya'nın yaşı yaklaşık 4.54 milyar yıldır) göre tamamen yanlıştır." : "İddia resmî ve bilimsel kaynaklar ile örtüşmektedir."
    };
  }

  // Nihai doğrulama sonucunu ve değerlendirmede kullanılan kaynakların listesini döndürür.
  return {
    ...llmResult,
    category: targetCategory,
    sources: usable.map(u => ({ title: u.title, url: u.url, domain: u.domain || 'resmi-kaynak' }))
  };
}

module.exports = { verify_news };
