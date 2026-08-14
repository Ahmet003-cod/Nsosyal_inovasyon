// ============================================================
// BACKEND/SERVICES/OCRSERVICE.JS
// Hibrit OCR Mimarisi: Birincil OpenAI GPT-4o Vision AI + Yedek Tesseract.js Motoru
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Görsellerdeki haber metinlerini ve paragraf içeriklerini okur.
// OpenAI API limiti dolduğunda sistem engellenmez, otomatik Tesseract.js yerel OCR devreye girer.
// ============================================================

const Tesseract = require('tesseract.js');

/**
 * fallbackTesseractOCR: Vision AI limiti dolduğunda veya API hatasında devreye giren yerel Tesseract OCR motoru.
 */
async function fallbackTesseractOCR(imageInput) {
  console.log('🔄 [YEDEK OCR MOTORU DEVREDE]: Vision AI limiti/bağlantısı aşıldı! Tesseract.js yerel OCR motoru çalıştırılıyor...');

  try {
    let processInput = imageInput;
    if (imageInput.startsWith('data:image/')) {
      // Base64 formatını Tesseract'a ver
      processInput = Buffer.from(imageInput.split(',')[1], 'base64');
    }

    const result = await Tesseract.recognize(processInput, 'tur+eng', {
      logger: () => {}
    });

    const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';

    if (text.length > 5) {
      console.log(`✅ [YEDEK TESSERACT OCR BAŞARILI]: "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
      return {
        hasText: true,
        extractedText: text,
        summary: 'Vision AI limiti dolduğu için yerel Tesseract.js OCR motoru ile paragraflar başarıyla okundu.'
      };
    }
  } catch (err) {
    console.warn('⚠️ [TESSERACT YEDEK OCR UYARISI]:', err.message);
  }

  return {
    hasText: false,
    extractedText: '',
    summary: 'Görselde okunabilir metin paragrafı bulunamadı.'
  };
}

/**
 * extractTextFromImage: Görseldeki (Base64 veya URL) haber metinlerini ve paragrafları okur.
 * Birincil: OpenAI GPT-4o Vision AI
 * İkincil (Yedek): Tesseract.js (Limit bittiğinde engellenmeyi önler)
 */
async function extractTextFromImage(imageInput) {
  if (!imageInput || typeof imageInput !== 'string') {
    return { hasText: false, extractedText: '', summary: '' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    // API Key yoksa doğrudan yerel Tesseract OCR motoruna geç
    return await fallbackTesseractOCR(imageInput);
  }

  console.log('📷 [HİBRİT OCR - BİRİNCİL KATMAN] OpenAI GPT-4o Vision AI ile görsel taranıyor...');

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
1. Görsel üzerindeki tüm Türkçe/İngilizce metinleri, manşetleri, paragraf haber yazılarını ve sayısal verileri eksiksiz oku.
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
              { type: 'text', text: 'Lütfen bu görseldeki tüm yazıları ve paragrafları OCR ile harfi harfine okuyup metne dök:' },
              imageContentObj
            ]
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.warn(`⚠️ [VISION AI LİMİT/KOTA UYARISI]: HTTP ${response.status} - Yerel Tesseract OCR yedek motoruna geçiliyor...`);
      return await fallbackTesseractOCR(imageInput);
    }

    const data = await response.json();
    if (data.choices && data.choices[0]) {
      const result = JSON.parse(data.choices[0].message.content);
      console.log(`✅ [VISION AI OCR BAŞARILI]: "${(result.extractedText || '').substring(0, 80).replace(/\n/g, ' ')}..."`);
      return result;
    }
  } catch (err) {
    console.error('Vision AI hatası:', err.message);
  }

  // Herhangi bir hata durumunda (Kota aşımı, internet kesintisi vb.) engellenmemek için Tesseract yerel OCR'ı çalıştır
  return await fallbackTesseractOCR(imageInput);
}

module.exports = { extractTextFromImage };
