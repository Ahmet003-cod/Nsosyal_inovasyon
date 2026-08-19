// ============================================================
// BACKEND/CONFIG/CATEGORYDOMAINS.JS
// NSosyal İnovasyon Platformu - Genişletilmiş Kategori Haritası (Canlı Finans Entegreli)
// TEKNOFEST 2026
// ============================================================

// CATEGORY_DOMAINS: Farklı bilgi kategorilerine göre arama yapılacak güvenilir internet alan adlarını (domain) tanımlayan bir nesne.
// Bu nesne, yalan haber veya iddia doğrulama süreçlerinde aramanın hangi kaynaklarda yapılacağını belirler.
// Her kategori kendi içinde 'haber', 'akademik', 'ansiklopedi' ve 'resmi' olmak üzere alt kaynaklara ayrılmıştır.
const CATEGORY_DOMAINS = {
  // Coğrafya ve Tarih alanı ile ilgili haberleri doğrularken kullanılacak siteler
  cografya_tarih: {
    haber: ['arkeofili.com', 'nationalgeographic.com', 'trthaber.com', 'aa.com.tr'],
    akademik: ['scholar.google.com', 'dergipark.org.tr', 'jstor.org'],
    ansiklopedi: ['tr.wikipedia.org', 'en.wikipedia.org', 'britannica.com'],
    resmi: ['tkaynakkurumu.gov.tr', 'kultur.gov.tr', 'mfa.gov.tr'] // Resmi kurum kaynakları
  },
  // Bilim ve araştırma ile ilgili iddiaları doğrulamak için kaynaklar
  bilim: {
    haber: ['evrimagaci.org', 'bilimgenc.tubitak.gov.tr', 'acikbilim.com', 'webtekno.com'],
    akademik: ['scholar.google.com', 'sciencedirect.com', 'nature.com', 'dergipark.org.tr', 'arxiv.org'],
    ansiklopedi: ['tr.wikipedia.org', 'britannica.com'],
    resmi: ['tubitak.gov.tr', 'sanayi.gov.tr']
  },
  // Teknoloji dünyası, yazılım ve donanım haberlerinin doğrulanacağı siteler
  teknoloji: {
    haber: ['webtekno.com', 'shiftdelete.net', 'donanimhaber.com', 'techcrunch.com', 'bloomberght.com'],
    akademik: ['ieee.org', 'arxiv.org', 'dl.acm.org', 'scholar.google.com'],
    ansiklopedi: ['tr.wikipedia.org', 'en.wikipedia.org'],
    resmi: ['btk.gov.tr', 'sanayi.gov.tr', 'tubitak.gov.tr']
  },
  // Sağlık ve tıp ile ilgili haberlerin güvenilirliğinin ölçüleceği platformlar
  saglik: {
    haber: ['saglikaktuel.com', 'medimagazin.com.tr', 'trthaber.com'],
    akademik: ['pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'sciencedirect.com'], // Tıp literatürü veritabanları
    ansiklopedi: ['tr.wikipedia.org', 'en.wikipedia.org'],
    resmi: ['saglik.gov.tr', 'who.int'] // Sağlık Bakanlığı ve Dünya Sağlık Örgütü
  },
  // Ekonomi, borsa, altın, döviz gibi finansal verilerin canlı olarak teyit edilebileceği kaynaklar
  ekonomi: {
    haber: [
      'tr.investing.com',
      'doviz.com',
      'altin.in',
      'bigpara.hurriyet.com.tr',
      'bloomberght.com',
      'uzmanpara.milliyet.com.tr',
      'finans.mynet.com',
      'canlidoviz.com',
      'dunya.com',
      'haberturk.com'
    ],
    akademik: ['ssrn.com', 'scholar.google.com', 'dergipark.org.tr'],
    ansiklopedi: ['tr.wikipedia.org'],
    resmi: ['tcmb.gov.tr', 'tuik.gov.tr', 'borsaistanbul.com', 'resmigazete.gov.tr'] // Merkez Bankası, TÜİK, BİST
  },
  // Siyasi açıklamalar, anayasa ve resmi süreçlerle ilgili bilgi teyit kaynakları
  siyaset: {
    haber: ['aa.com.tr', 'trthaber.com', 'bbc.com', 'dw.com', 'reuters.com'],
    akademik: ['scholar.google.com'],
    ansiklopedi: ['tr.wikipedia.org'],
    resmi: ['resmigazete.gov.tr', 'tbmm.gov.tr', 'anayasa.gov.tr'] // TBMM ve Anayasa Mahkemesi
  },
  // Diğer veya belirlenemeyen genel kategoriler için yedek/genel arama kaynakları
  genel: {
    haber: ['aa.com.tr', 'trthaber.com', 'bbc.com', 'reuters.com', 'teyit.org'],
    akademik: ['scholar.google.com', 'dergipark.org.tr'],
    ansiklopedi: ['tr.wikipedia.org', 'britannica.com'],
    resmi: ['resmigazete.gov.tr', 'anayasa.gov.tr']
  }
};

// Yapılandırılmış domain listesini dışa aktarıyoruz
module.exports = { CATEGORY_DOMAINS };
