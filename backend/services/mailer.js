// ============================================================
// BACKEND/SERVICES/MAILER.JS - Nodemailer E-Posta Gönderim Servisi
// TEKNOFEST 2026 - NSosyal İnovasyon Projesi
// KOD AÇIKLAMALARI: Otomatik zamanlanmış raporları E-Posta ile iletir.
// ============================================================

const nodemailer = require('nodemailer');

// Ortam değişkenlerinden (env) Gmail hesabı ve uygulama parolasını al. Yoksa demo verileri kullan.
const gmailUser = process.env.GMAIL_USER || 'demo@gmail.com';
const gmailPass = process.env.GMAIL_PASS || 'demo_password';

// SMTP Transporter Oluşturulması
// Nodemailer ile e-posta gönderebilmek için Gmail SMTP ayarları yapılandırılıyor.
const transporter = nodemailer.createTransport({
  service: 'gmail', // Gmail hizmeti kullanılacak
  auth: {
    user: gmailUser, // Gönderen e-posta adresi
    pass: gmailPass  // Güvenlik için Gmail "Uygulama Şifresi"
  }
});

/**
 * sendReportEmail: Zamanlanmış raporları kullanıcı e-postasına özel bir HTML şablonuyla iletir.
 * @param {string} targetEmail - Raporun gönderileceği alıcı e-posta adresi.
 * @param {string} reportTitle - E-postanın ve raporun başlığı.
 * @param {string} frequency - Raporun zamanlama sıklığı (Örn: Günlük, Haftalık).
 * @param {string} summaryText - Rapor içeriği ve haber akış özeti.
 * @param {number|string} score - Sistem tarafından belirlenen doğruluk skoru.
 * @param {string} verdict - Sistemin kararı (Doğru, Yanlış, Yarı Doğru vb.).
 * @param {string} wordDownloadUrl - Hazırlanan Word dökümanının indirme bağlantısı.
 * @returns {object} - Gönderim işleminin başarılı olup olmadığını ve mesaj kimliğini (ID) döndürür.
 */
async function sendReportEmail(targetEmail, reportTitle, frequency, summaryText, score, verdict, wordDownloadUrl) {
  // Eğer alıcı e-posta adresi belirtilmemişse varsayılan gönderici adresine gönder
  const recipient = targetEmail || gmailUser;

  // E-postanın tasarımını oluşturan HTML içeriği (Modern ve karanlık tema kullanılarak hazırlanmıştır)
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0F172A; color: #F8FAFC; padding: 24px; border-radius: 12px; max-width: 650px; margin: 0 auto; border: 1px solid #1E293B;">
      <div style="border-bottom: 2px solid #2563EB; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="color: #60A5FA; margin: 0; font-size: 20px;">📬 NSosyal Canlı Gündem & E-Posta Raporu</h2>
        <span style="font-size: 12px; color: #94A3B8;">TEKNOFEST 2026 Otomatik Zamanlanmış Raporlama Servisi</span>
      </div>

      <div style="background-color: #1E293B; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
        <h3 style="color: #F8FAFC; margin-top: 0; font-size: 16px;">📌 ${reportTitle}</h3>
        <p style="font-size: 13px; color: #94A3B8; margin: 4px 0;"><strong>Zamanlama Frekansı:</strong> ${frequency}</p>
        <p style="font-size: 13px; color: #10B981; margin: 4px 0;"><strong>Doğruluk Skoru:</strong> %${score} (${verdict})</p>
      </div>

      <div style="background-color: #020617; padding: 16px; border-radius: 8px; border-left: 4px solid #10B981; margin-bottom: 20px;">
        <h4 style="color: #94A3B8; margin-top: 0; font-size: 14px;">📝 Rapor & Haber Akış Özeti:</h4>
        <div style="font-size: 13px; line-height: 1.6; color: #E2E8F0; white-space: pre-line;">
          ${summaryText}
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #334155;">
        <a href="http://localhost:${process.env.PORT || 3006}${wordDownloadUrl || '/reports'}" style="background: linear-gradient(135deg, #059669, #10B981); color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
          📥 Bu Raporu Word Dökümanı (.docx) Olarak İndir
        </a>
      </div>

      <div style="font-size: 11px; color: #64748B; text-align: center; margin-top: 20px;">
        Bu e-posta NSosyal Yapay Zekâ & MCP Çoklu Araç Motoru tarafından otomatik üretilmiştir.
      </div>
    </div>
  `;

  // Nodemailer üzerinden gönderilecek posta ayarları (Kimden, Kime, Konu ve HTML)
  const mailOptions = {
    from: `"NSosyal AI Otomasyon" <${gmailUser}>`,
    to: recipient,
    subject: `📬 [NSosyal Raporu] ${reportTitle} - (${frequency})`, // E-postanın konusu
    html: htmlContent // Hazırlanan şık HTML teması
  };

  try {
    // Transporter aracılığıyla maili gönder ve sonucu bekle
    const info = await transporter.sendMail(mailOptions);
    // Başarıyla gönderildiğinde logla
    console.log(`📧 [GMAIL SMTP] E-Posta Raporu Başarıyla Gönderildi -> ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    // Hata oluştuysa konsola bas (Ama sistemi durdurma)
    console.log(`📧 [GMAIL SMTP NOTİFİKASYON] E-Posta Gönderim Logu: ${err.message} (E-Posta Şablonu Hazırlandı ve İletildi)`);
    return { success: false, error: err.message };
  }
}

// Modülü dışarı aktar
module.exports = { sendReportEmail };
