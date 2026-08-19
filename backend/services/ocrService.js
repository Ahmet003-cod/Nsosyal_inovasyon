// ============================================================
// BACKEND/SERVICES/OCRSERVICE.JS
// Hibrit OCR Mimarisi: Birincil OpenAI GPT-4o Vision AI + Yedek Tesseract.js Motoru
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Görsellerdeki haber metinlerini ve paragraf içeriklerini okur.
// OpenAI API limiti dolduğunda sistem engellenmez, otomatik Tesseract.js yerel OCR devreye girer.
// ============================================================

const Tesseract = require('tesseract.js'); // Yerel yedek OCR kütüphanesi

/**
 * fallbackTesseractOCR: Vision AI limiti dolduğunda, API hatasında veya bağlantı kesintisinde 
 * devreye giren yerel Tesseract OCR motoru. Görüntüyü çevrimdışı ve ücretsiz işler.
 * @param {string|Buffer} imageInput - Base64 veya URL formatındaki görsel girdisi.
 * @returns {object} - Görüntüden çekilen metni ve durumu içeren sonuç nesnesi.
 */
async function fallbackTesseractOCR(imageInput) {
  // Kullanıcıya ve konsola yedeğe geçildiğini bildir
  console.log('🔄 [YEDEK OCR MOTORU DEVREDE]: Vision AI limiti/bağlantısı aşıldı! Tesseract.js yerel OCR motoru çalıştırılıyor...');

  try {
    let processInput = imageInput;
    // Eğer görsel base64 veri URL'si formatındaysa onu temizleyip Buffer objesine dönüştür
    if (imageInput.startsWith('data:image/')) {
      // Base64 formatını Tesseract'ın anlayacağı tampon (Buffer) verisine dönüştür
      processInput = Buffer.from(imageInput.split(',')[1], 'base64');
    }

    // Tesseract kütüphanesini kullanarak görseldeki metinleri oku (Türkçe ve İngilizce destekli)
    const result = await Tesseract.recognize(processInput, 'tur+eng', {
      logger: () => {} // Console loglarını susturmak için boş fonksiyon
    });

    // Sonuçtan metni al, eğer yoksa boş string bırak
    const text = (result && result.data && result.data.text) ? result.data.text.trim() : '';

    // Eğer okunan metin 5 karakterden uzunsa başarılı kabul et
    if (text.length > 5) {
      console.log(`✅ [YEDEK TESSERACT OCR BAŞARILI]: "${text.substring(0, 80).replace(/\n/g, ' ')}..."`);
      return {
        hasText: true,
        extractedText: text, // Görüntüden çıkarılan ham metin
        summary: 'Vision AI limiti dolduğu için yerel Tesseract.js OCR motoru ile paragraflar başarıyla okundu.'
      };
    }
  } catch (err) {
    // Tesseract'ta da hata alınırsa uyar
    console.warn('⚠️ [TESSERACT YEDEK OCR UYARISI]:', err.message);
  }

  // Eğer hiçbir metin okunamadıysa veya hata alındıysa boş dön
  return {
    hasText: false,
    extractedText: '',
    summary: 'Görselde okunabilir metin paragrafı bulunamadı.'
  };
}

/**
 * extractTextFromImage: Görseldeki (Base64 veya URL) haber metinlerini ve paragrafları okuyan ana fonksiyon.
 * Birincil: OpenAI GPT-4o Vision AI (Çok başarılı, arka planı ayıklar, akıllı okur)
 * İkincil (Yedek): Tesseract.js (Limit bittiğinde veya API çöktüğünde engellenmeyi önler)
 * @param {string} imageInput - Base64 veya URL formatındaki resim.
 * @returns {object} - Görüntüden çıkarılan içerik ve özet bilgisi.
 */
async function extractTextFromImage(imageInput) {
  // Resim girdisi boş veya geçersizse işlemi iptal et
  if (!imageInput || typeof imageInput !== 'string') {
    return { hasText: false, extractedText: '', summary: '' };
  }

  const apiKey = process.env.OPENAI_API_KEY; // OpenAI API anahtarını al
  // Eğer API anahtarı yoksa veya varsayılan "your_openai_api_key" değerindeyse hiç beklemeden yedek sisteme (Tesseract) geç
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    // API Key yoksa doğrudan yerel Tesseract OCR motoruna geç
    return await fallbackTesseractOCR(imageInput);
  }

  console.log('📷 [HİBRİT OCR - BİRİNCİL KATMAN] OpenAI GPT-4o Vision AI ile görsel taranıyor...');

  try {
    let imageContentObj = null;
    // OpenAI Vision API için görsel URL mi yoksa base64 mü kontrol edilip formatlanıyor
    if (imageInput.startsWith('data:image/') || imageInput.startsWith('http')) {
      imageContentObj = { type: 'image_url', image_url: { url: imageInput } };
    } else {
      // Çıplak base64 gelirse başına gerekli tagleri ekle
      imageContentObj = { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageInput}` } };
    }

    // Gelişmiş okuma ve özet çıkarma için OpenAI API'ye istek gönderiliyor
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Vision özellikli ekonomik ve hızlı model
        messages: [
          {
            role: 'system',
            // Yapay zekaya nasıl davranması gerektiğine dair kurallar (Prompt)
            content: `Sen gelişmiş bir OCR ve Multimodal Vision AI uzmanısın.
Görevlerin:
1. Görsel üzerindeki SADECE tipografik olarak yazılmış Türkçe/İngilizce metinleri, manşetleri, haber başlıklarını ve sayısal verileri harfi harfine "extractedText" alanına aktar.
2. Görseldeki arka plan nesnelerini (örneğin "basın toplantısı", "mikrofonlar", "konuşan kişi") sakın "extractedText" alanına ekleme! Sadece tipografik haber yazılarını oku.
3. Görselde herhangi bir haber yazısı/metni yazmıyorsa "hasText": false ve "extractedText": "" döndür.
4. Yanıtı SADECE şu JSON yapısında döndür:
{
  "hasText": true|false,
  "extractedText": "Görsel üzerindeki gerçek haber metni / manşet (yazı yoksa boş bırak)",
  "summary": "Görselin kısa görsel özeti (ör: Basın toplantısı fotoğrafı)"
}`
          },
          {
            role: 'user',
            // Kullanıcı talebi ve resim gönderiliyor
            content: [
              { type: 'text', text: 'Lütfen bu görseldeki tüm yazıları ve paragrafları OCR ile harfi harfine okuyup metne dök:' },
              imageContentObj
            ]
          }
        ],
        response_format: { type: 'json_object' }, // Dönüş tipi kesinlikle JSON olmalı
        temperature: 0.1 // Rastgeleliği azalt, halüsinasyonları önle
      })
    });

    // Eğer istek başarısız olduysa (Örn: kota doldu) yedek OCR motoruna geç!
    if (!response.ok) {
      console.warn(`⚠️ [VISION AI LİMİT/KOTA UYARISI]: HTTP ${response.status} - Yerel Tesseract OCR yedek motoruna geçiliyor...`);
      return await fallbackTesseractOCR(imageInput);
    }

    const data = await response.json(); // Başarılı cevabı JSON olarak çözümle
    if (data.choices && data.choices[0]) {
      // AI'ın döndürdüğü JSON metnini parse et
      const result = JSON.parse(data.choices[0].message.content);
      console.log(`✅ [VISION AI OCR BAŞARILI]: "${(result.extractedText || '').substring(0, 80).replace(/\n/g, ' ')}..."`);
      return result; // Sonucu geri döndür
    }
  } catch (err) {
    console.error('Vision AI hatası:', err.message);
  }

  // Herhangi bir beklenmedik hata durumunda (Kota aşımı, internet kesintisi vb.) engellenmemek için Tesseract yerel OCR'ı son çağrı olarak çalıştır
  return await fallbackTesseractOCR(imageInput);
}

module.exports = { extractTextFromImage };
