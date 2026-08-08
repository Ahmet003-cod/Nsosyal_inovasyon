// ============================================================
// BACKEND/SERVICES/CLASSIFYCATEGORY.JS
// OpenAI LLM Haber & İddia Sınıflandırma Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// ============================================================

const { CATEGORY_DOMAINS } = require('../config/categoryDomains');

async function classifyCategory(claim) {
  const apiKey = process.env.OPENAI_API_KEY;
  const categories = Object.keys(CATEGORY_DOMAINS).filter(c => c !== 'genel');

  // Fallback keyword classification
  const claimLower = (claim || '').toLowerCase();
  if (claimLower.includes('dünya') || claimLower.includes('yaş') || claimLower.includes('coğrafya') || claimLower.includes('tarih') || claimLower.includes('jeoloji') || claimLower.includes('nüfus') || claimLower.includes('kıta')) return 'cografya_tarih';
  if (claimLower.includes('yapay zeka') || claimLower.includes('çip') || claimLower.includes('yazılım') || claimLower.includes('donanım')) return 'teknoloji';
  if (claimLower.includes('aşı') || claimLower.includes('virüs') || claimLower.includes('sağlık') || claimLower.includes('hastalık')) return 'saglik';
  if (claimLower.includes('enflasyon') || claimLower.includes('merkez bankası') || claimLower.includes('faiz') || claimLower.includes('ekonomi')) return 'ekonomi';
  if (claimLower.includes('seçim') || claimLower.includes('bakan') || claimLower.includes('hükümet') || claimLower.includes('anayasa')) return 'siyaset';
  if (claimLower.includes('uzay') || claimLower.includes('fizik') || claimLower.includes('tübitak') || claimLower.includes('akademik') || claimLower.includes('evren') || claimLower.includes('gezegen')) return 'bilim';

  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return 'genel';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `Sen bir içerik sınıflandırma uzmanısın. Kullanıcının gönderdiği haberi/iddiayı incele ve şu kategorilerden BİRİNE ata: ${categories.join(', ')}, genel.`
        }, {
          role: 'user',
          content: `Aşağıdaki haberi/iddiayı sınıflandır. Sadece kategori adını küçük harfle yaz:
HABER: "${claim}"`
        }],
        temperature: 0
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      const result = data.choices[0].message.content.trim().toLowerCase();
      console.log(`🏷️ [Kategori Tespiti]: "${claim.substring(0, 40)}..." -> [${result}]`);
      return CATEGORY_DOMAINS[result] ? result : 'genel';
    }
  } catch (e) {
    console.log('Kategori sınıflandırma uyarısı:', e.message);
  }

  return 'genel';
}

module.exports = { classifyCategory };
