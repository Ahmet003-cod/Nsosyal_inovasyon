// ============================================================
// BACKEND/SERVICES/OCRSERVICE.JS
// Multimodal Vision AI & OCR Metin Ayıklama Servisi (Built-in fetch)
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Görsellerdeki haber metinlerini ve başlıkları OCR ile okur.
// ============================================================

/**
 * extractTextFromImage: Görseldeki (Base64 veya URL) Türkçe haber metinlerini OCR/Vision AI ile okur.
 */
async function extractTextFromImage(imageInput) {
  if (!imageInput || typeof imageInput !== 'string') {
    return { hasText: false, extractedText: '', summary: '' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return {
      hasText: false,
      extractedText: '',
      summary: 'OpenAI API key eksik olduğu için varsayılan metin okuma modunda çalışıldı.'
    };
  }

  console.log('📷 [MULTIMODAL OCR VISION AI] Görseldeki metinler taranıyor ve okunuyor...');

  try {
    let imageContentObj = null;
    if (imageInput.startsWith('data:image/') || imageInput.startsWith('http')) {
      imageContentObj = { type: 'image_url', image_url: { url: imageInput } };
    } else {
      imageContentObj = { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageInput}` } };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Sen gelişmiş bir OCR ve Multimodal Vision AI uzmanısın.
Görevlerin:
1. Görsel üzerindeki tüm Türkçe/İngilizce metinleri, manşetleri, haber başlıklarını ve sayısal verileri eksiksiz oku.
2. Görseldeki metin yoksa veya sadece grafik varsa nesneleri kısaca özetle.
3. Yanıtı SADECE şu JSON yapısında döndür:
{
  "hasText": true|false,
  "extractedText": "Görselden okunan tam metin",
  "summary": "Görsel içeriğinin kısa özeti"
}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Lütfen bu görseldeki tüm yazıları OCR ile harfi harfine okuyup metne dök:' },
              imageContentObj
            ]
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      const result = JSON.parse(data.choices[0].message.content);
      console.log(`✅ [OCR VISION BAŞARILI]: "${(result.extractedText || '').substring(0, 80)}..."`);
      return result;
    }
  } catch (err) {
    console.error('OCR Vision AI hatası:', err.message);
  }

  return { hasText: false, extractedText: '', summary: '' };
}

module.exports = { extractTextFromImage };
