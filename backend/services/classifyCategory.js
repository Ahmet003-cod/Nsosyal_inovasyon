// ============================================================
// BACKEND/SERVICES/CLASSIFYCATEGORY.JS
// OpenAI LLM Haber & İddia Sınıflandırma Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

const { CATEGORY_DOMAINS } = require('../config/categoryDomains');

/**
 * classifyCategory: Verilen bir metni (haber/iddia) belirli kategorilerden birine sınıflandırır.
 * Hem basit anahtar kelime eşleştirme (fallback) hem de OpenAI kullanarak analiz yapar.
 * @param {string} claim - Sınıflandırılacak metin.
 * @returns {string} - Bulunan veya varsayılan kategori adı.
 */
async function classifyCategory(claim) {
  // OpenAI API anahtarını al
  const apiKey = process.env.OPENAI_API_KEY;
  
  // 'genel' hariç geçerli tüm kategori isimlerini diziye çek
  const categories = Object.keys(CATEGORY_DOMAINS).filter(c => c !== 'genel');

  // Fallback keyword classification (Yedek Anahtar Kelime Sınıflandırması)
  // AI çağrısına gerek kalmadan belirgin anahtar kelimelerle hızlı sınıflandırma yapar.
  const claimLower = (claim || '').toLowerCase(); // Metni küçük harfe çevir
  
  // Coğrafya ve Tarih kontrolü
  if (claimLower.includes('dünya') || claimLower.includes('yaş') || claimLower.includes('coğrafya') || claimLower.includes('tarih') || claimLower.includes('jeoloji') || claimLower.includes('nüfus') || claimLower.includes('kıta')) return 'cografya_tarih';
  
  // Teknoloji kontrolü
  if (claimLower.includes('yapay zeka') || claimLower.includes('çip') || claimLower.includes('yazılım') || claimLower.includes('donanım')) return 'teknoloji';
  
  // Sağlık kontrolü
  if (claimLower.includes('aşı') || claimLower.includes('virüs') || claimLower.includes('sağlık') || claimLower.includes('hastalık')) return 'saglik';
  
  // Ekonomi kontrolü
  if (claimLower.includes('enflasyon') || claimLower.includes('merkez bankası') || claimLower.includes('faiz') || claimLower.includes('ekonomi')) return 'ekonomi';
  
  // Siyaset kontrolü
  if (claimLower.includes('seçim') || claimLower.includes('bakan') || claimLower.includes('hükümet') || claimLower.includes('anayasa')) return 'siyaset';
  
  // Bilim kontrolü
  if (claimLower.includes('uzay') || claimLower.includes('fizik') || claimLower.includes('tübitak') || claimLower.includes('akademik') || claimLower.includes('evren') || claimLower.includes('gezegen')) return 'bilim';

  // Eğer API anahtarı yoksa yedek yöntemlere rağmen sonuç bulunamadıysa 'genel' dön
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return 'genel';
  }

  try {
    // Daha karmaşık veya anahtar kelimeye uymayan metinleri sınıflandırmak için OpenAI API isteği
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Performanslı ve ekonomik model
        messages: [{
          role: 'system',
          // Sisteme tüm kategori isimleri veriliyor
          content: `Sen bir içerik sınıflandırma uzmanısın. Kullanıcının gönderdiği haberi/iddiayı incele ve şu kategorilerden BİRİNE ata: ${categories.join(', ')}, genel.`
        }, {
          role: 'user',
          // Kullanıcı metni veriliyor ve sadece kategori ismini küçük harfle dönmesi isteniyor
          content: `Aşağıdaki haberi/iddiayı sınıflandır. Sadece kategori adını küçük harfle yaz:
HABER: "${claim}"`
        }],
        temperature: 0 // Net ve kesin sonuç dönmesi için 0 temperature
      })
    });

    const data = await response.json(); // Yanıtı jsona çevir
    if (data.choices && data.choices[0]) {
      // AI'ın döndürdüğü sonucu temizle ve küçük harfe al
      const result = data.choices[0].message.content.trim().toLowerCase();
      // Konsola sınıflandırma logu bas
      console.log(`🏷️ [Kategori Tespiti]: "${claim.substring(0, 40)}..." -> [${result}]`);
      
      // Eğer dönen sonuç geçerli kategorilerimizden biriyse (CATEGORY_DOMAINS içinde varsa) onu dön, yoksa 'genel' dön
      return CATEGORY_DOMAINS[result] ? result : 'genel';
    }
  } catch (e) {
    // API veya bağlantı hatası
    console.log('Kategori sınıflandırma uyarısı:', e.message);
  }

  // Herhangi bir hata durumunda varsayılan kategori olarak 'genel' dön
  return 'genel';
}

// Modülü dışarı aktar
module.exports = { classifyCategory };
