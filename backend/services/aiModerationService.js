// ============================================================
// BACKEND/SERVICES/AIMODERATIONSERVICE.JS
// Bağlamsal Yapay Zekâ İçerik ve İleri Tehlike Moderasyon Motoru
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// 
// MANTIĞI: Düz kelime engeli yerine İÇERİĞİN BAĞLAMINI analiz eder.
// - "Sağlık Bakanlığı uyuşturucuyla mücadele duyurusu" veya "Narkotik operasyonu haberi" → İZİN VERİR (ALLOW)
// - "Uyuşturucu yapımı/satışı/özendiriciliği" veya "Bomba imalat tarifi" → ENGELLER (BLOCK)
// ============================================================

/**
 * checkHarmfulContentWithAI: Metnin bağlamını OpenAI GPT-4o-mini ile derinlemesine analiz eder.
 * @param {string} text - Analiz edilecek kullanıcı metni.
 * @returns {object} - İzin/Engel durumu, kategori ve açıklama içeren sonuç nesnesi.
 */
async function checkHarmfulContentWithAI(text) {
  // Eğer metin boşsa, string değilse veya çok kısaysa varsayılan olarak güvenli kabul et
  if (!text || typeof text !== 'string' || text.trim().length < 5) {
    return { isHarmful: false, action: 'ALLOW', category: 'TEMIZ', reason: '' };
  }

  // OpenAI API anahtarını çevre değişkenlerinden al
  const apiKey = process.env.OPENAI_API_KEY;
  // Eğer API anahtarı yoksa veya geçersizse işlemi atla ve metne izin ver
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return { isHarmful: false, action: 'ALLOW', category: 'TEMIZ', reason: '' };
  }

  // Konsolda analiz işleminin başladığını bildir
  console.log('🛡️ [AI BAĞLAM MODERASYONU] Metnin tehlike ve bağlam seviyesi taranıyor...');

  try {
    // OpenAI API'sine istek gönder
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      // API'ye gönderilecek veri gövdesi (model, sistem promptu, kullanıcı metni)
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Performanslı ve ekonomik mini model
        messages: [
          {
            role: 'system',
            content: `Sen gelişmiş bir Sosyal Medya Siber Güvenlik ve İleri Bağlamsal Moderasyon Uzmanısın.

GÖREVİN:
Kullanıcının paylaştığı metnin BAĞLAMINI (context) derinlemesine inceleyerek YASADIŞI/TEHLİKELİ bir eylem mi yoksa KAMUSAL/HABER/SAĞLIK BİLGİLENDİRMESİ mi olduğunu ayırt etmektir.

🚫 REDDEDİLECEK VE ENGELLENECEK TEHLİKELİ İÇERİKLER (action: "BLOCK"):
1. BOMBA / PATLAYICI / SİLAH YAPIMI: Ev yapımı patlayıcı, bomba yapım tarifi, molotof imalatı, illegal silah üretimi/satışı.
2. UYUŞTURUCU ÖZENDİRİCİLİĞİ VEYA SATIŞI: Uyuşturucu madde kullanımını öven, kullanımını teşvik eden, satın alma/temin etme yollarını tarif eden veya satışını yapan içerikler.
3. İNTİHAR VE KENDİNE ZARAR VERME: İntihara teşvik eden, yöntem gösteren veya kendine zarar vermeyi öven içerikler.
4. ŞİDDET VE İLLEGAL SUÇ TEŞVİKİ: Suç işlemeye açıkça çağrı yapan, organize suç örgütlerini öven ve saldırı planı içeren metinler.

✅ İZİN VERİLECEK GÜVENLİ VE BAĞLAMSAL İÇERİKLER (action: "ALLOW"):
1. KAMU / SAĞLIK BİLGİLENDİRMELERİ: Sağlık Bakanlığı, Emniyet, Yeşilay veya resmi kurumların uyuşturucu ve bağımlılıkla mücadele haberleri/duyuruları. (Örn: "Sağlık Bakanlığı uyuşturucuyla mücadele için yeni merkez açtı")
2. EMNİYET VE POLİS HABERLERİ: Narkotik operasyonları, polis haberleri, çete çökertme bültenleri. (Örn: "Polis narkotik operasyonunda uyuşturucu çetesini çökertti")
3. AKADEMİK / FARKINDALIK VE BİLGİLENDİRME: Bağımlılığın zararlarını anlatan, kamu bilincini artıran eğitim veya tıbbi makaleler.

ÇIKTI FORMATI (SADECE ŞU JSON YAPISINI DÖNDÜR):
{
  "isHarmful": true|false,
  "action": "BLOCK" | "ALLOW",
  "category": "BOMBA_VE_PATLAYICI" | "UYUSTURUCU_TEŞVIK_SATIS" | "INTIHAR_ZARAR" | "ILLEGAL_SUC" | "TEMIZ",
  "reason": "Kullanıcıya gösterilecek kısa Türkçe engel gerekçesi"
}`
          },
          {
            role: 'user',
            // Analiz edilecek metin (ilk 500 karakter sınırlandırılarak maliyet/zaman tasarrufu)
            content: `İNCELENECEK METİN: "${text.substring(0, 500)}"`
          }
        ],
        response_format: { type: 'json_object' }, // API'nin kesinlikle JSON dönmesini sağlar
        temperature: 0.1 // Kararlılığı artırmak için düşük rastgelelik
      })
    });

    // İstek başarılı olduysa
    if (response.ok) {
      const data = await response.json(); // Yanıtı JSON formatında ayrıştır
      if (data.choices && data.choices[0]) {
        // OpenAI modelinden dönen yanıtın içeriğini ayrıştır
        const result = JSON.parse(data.choices[0].message.content);
        
        // Eğer içerik tehlikeli bulunduysa (BLOCK) konsola uyarı bas
        if (result.action === 'BLOCK') {
          console.warn(`🚨 [AI TEHLİKELİ İÇERİK ENGELİ]: Kategori: ${result.category} | Gerekçe: ${result.reason}`);
        } else {
          // Güvenliyse (ALLOW) onay mesajı bas
          console.log(`✅ [AI BAĞLAM MODERASYONU ONAYLADI]: İçerik kamu/sağlık/haber bağlamında güvenli bulundu.`);
        }
        return result; // Ayrıştırılmış sonucu geri döndür
      }
    }
  } catch (err) {
    // API hatası veya ağ bağlantı sorunu olursa hatayı yakala ve konsola yazdır
    console.error('AI Moderation hatası:', err.message);
  }

  // İstek başarısız olduysa veya hata alındıysa güvenli varsayılan sonucu döndür (Kullanıcıyı engellememek için)
  return { isHarmful: false, action: 'ALLOW', category: 'TEMIZ', reason: '' };
}

// Modülü dışarı aktar
module.exports = { checkHarmfulContentWithAI };
