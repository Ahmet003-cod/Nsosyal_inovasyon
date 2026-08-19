# -*- coding: utf-8 -*-
# ============================================================
# BACKEND/URL_CLASSIFIER_SERVER.PY
# HuggingFace URLBert Kötü URL Sınıflandırıcı Mikro Servisi
# Model: CrabInHoney/urlbert-tiny-v4-malicious-url-classifier
# Mimarisi: Güvenilir Beyaz Liste + Defanged Threat Detector + URLBert AI Engine
# TEKNOFEST 2026 - NSosyal İnovasyon Projesi
#
# Açıklama: Bu dosya, sisteme gelen URL'leri analiz ederek zararlı veya 
# oltalama (phishing) olup olmadığını tespit eden yapay zeka destekli bir 
# mikro servistir. Flask kullanılarak geliştirilmiştir.
# ============================================================

from __future__ import annotations
import sys, json, re, traceback

# Konsol çıktılarını UTF-8 formatında yapılandırıyoruz, Türkçe karakter sorunlarını önler.
sys.stdout.reconfigure(encoding='utf-8')

print("🤖 [URLBert] urlbert-tiny-v4-malicious-url-classifier yükleniyor...")

# Hugging Face (transformers) kütüphanesinden model yükleyiciyi içeri aktarıyoruz.
from transformers import pipeline as hf_pipeline

# _clf (classifier), yapay zeka modelimizi tutacak global değişkendir.
_clf = None
try:
    # 1. Aşama: Yapay Zeka Modelini Çevrimiçi Olarak Yükleme
    # Hugging Face kütüphanesinden text-classification (metin sınıflandırma) pipeline'ı oluşturuyoruz.
    _clf = hf_pipeline(
        "text-classification",
        model="CrabInHoney/urlbert-tiny-v4-malicious-url-classifier", # Zararlı URL tespit modelimiz
        tokenizer="CrabInHoney/urlbert-tiny-base-v4", # URL'leri modelin anlayacağı formata çeviren bileşen
        device=-1, # İşlemlerin CPU üzerinde yapılacağını belirtir (-1). GPU için 0 vb. seçilir.
        truncation=True, # 512 karakterden uzun URL'leri sınırda keser
        max_length=512, # Modelin alabileceği maksimum token uzunluğu
    )
    # Model yüklendikten sonra "https://google.com" ile örnek bir çıkarım yaparak modelin ilk ısınmasını (warmup) sağlıyoruz.
    _warmup = _clf("https://google.com")
    print(f"✅ [URLBert] AI Model çevrimiçi hazır! Isınma testi: {_warmup[0]['label']}")
except Exception as exc:
    # Eğer internet bağlantısı yoksa veya sunucu erişilemezse, çevrimdışı (offline) modda deneme yapılıyor.
    print(f"⚠️ [URLBert] Çevrimiçi yükleme denendi, yerel önbellek (offline mod) kullanılıyor...")
    try:
        # Model dosyaları sunucuda (önbellekte) varsa oradan okumasını sağlıyoruz (local_files_only=True).
        _clf = hf_pipeline(
            "text-classification",
            model="CrabInHoney/urlbert-tiny-v4-malicious-url-classifier",
            tokenizer="CrabInHoney/urlbert-tiny-base-v4",
            device=-1,
            truncation=True,
            max_length=512,
            local_files_only=True # Sadece daha önceden indirilmiş olan dosyaları kullan.
        )
        # Çevrimdışı model için de ısınma (warmup) testi yapıyoruz.
        _warmup = _clf("https://google.com")
        print(f"✅ [URLBert] AI Model yerel önbellekten (OFFLINE) yüklendi! Test: {_warmup[0]['label']}")
    except Exception as exc2:
        # Model ne online ne de offline yüklenebilirse hata mesajını ekrana yazdırıyoruz.
        print(f"❌ [URLBert] Yükleme hatası: {exc2}")
        traceback.print_exc() # Hatanın detaylı yığıt izini (stack trace) yazdır.

# ── GÜVENİLİR BEYAZ LİSTE (Zero False-Positive Garantisi) ───
# Bu kümede bulunan alan adları, sistem tarafından doğrudan "Güvenli" olarak işaretlenir.
# Amaç, bilinen popüler ve resmi sitelerde modelin yanlış pozitif (false-positive) vermesini tamamen önlemektir.
SAFE_DOMAINS = {
    "google.com", "youtube.com", "github.com", "wikipedia.org", "gov.tr", "edu.tr",
    "instagram.com", "facebook.com", "twitter.com", "x.com", "linkedin.com", "medium.com",
    "softito.com.tr", "btkakademi.gov.tr", "udemy.com", "coursera.org", "microsoft.com",
    "apple.com", "amazon.com", "e-devlet.gov.tr", "aa.com.tr", "trthaber.com"
}

# ŞÜPHELİ UZANTILAR VE SERBEST UYGULAMA PLATFORMLARI
# Zararlı yazılımların veya sahte sitelerin sık kullandığı uzantılar listesi.
SUSPICIOUS_TLDS = (
    '.xyz', '.top', '.click', '.gq', '.cf', '.tk', '.ml', '.cam', '.cheap', '.zip', '.mov',
    '.online', '.site', '.tech', '.space', '.monster', '.link', '.live',
    '.lovable.app', '.ngrok-free.app', '.trycloudflare.com', '.serveo.net'
)

# Oltalama saldırılarında URL içinde sıkça rastlanan kelime kalıpları (Örn: banka, bedava kazanç vb.)
PHISHING_KEYWORDS = ('login-', 'bank-', 'aidat-', 'bonus-', 'airdrop-', 'free-', 'kazanc-', 'hesap-', 'guide-ai', 'bot-')

# Flask web kütüphanesini içe aktarıyoruz
from flask import Flask, request, jsonify

# Flask uygulamasını başlatıyoruz
app = Flask(__name__)

# ==========================================
# API Endpoint: /health
# ==========================================
# Sistemin ve yapay zeka modelinin düzgün çalışıp çalışmadığını kontrol etmek için 
# kullanılan sağlık (healthcheck) endpoint'idir.
@app.route("/health")
def health():
    return jsonify({
        "status": "ok", # Servis çalışıyor
        "ready": _clf is not None, # AI modeli başarıyla yüklendi mi?
        "model": "urlbert-tiny-v4-malicious-url-classifier", # Kullanılan yapay zeka modeli
        "whitelistCount": len(SAFE_DOMAINS) # Beyaz listedeki domain sayısı
    })

# ==========================================
# API Endpoint: /classify
# ==========================================
# İstemciden (uygulamadan) gelen URL'i alıp, çeşitli güvenlik katmanlarından ve AI modelinden geçirerek
# URL'nin zararlı mı yoksa güvenli mi olduğunu JSON formatında döndürür.
@app.route("/classify", methods=["POST"])
def classify():
    # İstek gövdesinden (body) JSON verisini güvenli bir şekilde çekiyoruz
    data = request.get_json(force=True, silent=True) or {}
    url  = str(data.get("url", "")).strip() # URL bilgisini alıp boşlukları temizliyoruz

    # URL boş gönderildiyse HTTP 400 Bad Request hatası döndürüyoruz
    if not url:
        return jsonify({"error": "URL gerekli", "safe": True}), 400

    # Karşılaştırmaları daha tutarlı yapmak için URL'i tamamen küçük harflere çeviriyoruz
    lower_url = url.lower()

    # 1. SİBER GÜVENLİK DEFANGED THREAT İNDİKATÖRÜ TESPİTİ (hxxps://, hxxp://, hXXp)
    # Siber güvenlik uzmanları tarafından zararlı olduğu bilinen bağlantılar 
    # yanlışlıkla tıklanmamaları için "hxxps://" veya "[.]" formatında paylaşılır. 
    # Bir bağlantı bu formattaysa doğrudan zararlı (indicator of compromise) kabul ederiz!
    is_defanged = bool(re.search(r'hxxps?://|hXXps?://|\[\.\]', url, re.IGNORECASE))

    # Analizi devam ettirebilmek adına (domain tespiti vs.) defanged URL'i orijinal haline (normalize) döndürüyoruz
    normalized_url = lower_url.replace('hxxps://', 'https://').replace('hxxp://', 'http://').replace('[.]', '.')

    # 2. BEYAZ LİSTE KONTROLÜ (Resmi ve Güvenilir Kurumlar)
    # Eğer URL bir tehdit indikatörü (defanged) içermiyorsa beyaz listeye bakıyoruz.
    if not is_defanged:
        for safe_domain in SAFE_DOMAINS:
            # Eğer analiz edilen URL, güvenilir domainlerden birini barındırıyorsa
            if safe_domain in normalized_url:
                print(f"✅ [BEYAZ LİSTE]: {url} -> Güvenli Domain ({safe_domain})")
                # Yapay zeka maliyetinden kurtulup doğrudan "Güvenli" (benign) yanıtını dönüyoruz.
                return jsonify({
                    "url": url, "label": "benign", "labelTr": "Güvenli",
                    "score": 1.0, "risk": 0, "safe": True, "dangerous": False,
                    "color": "green", "source": "whitelist"
                })

    # 3. HAM IP ADRESİ KONTROLÜ (Malware & C2 Sunucu Riski - örn: 217.60.195.113/test/x86_64)
    # Normal web siteleri isim(domain) kullanır. URL eğer direkt IP adresiyse (örn: http://192.168.1.1) 
    # bu durum Command & Control (C2) sunucusu veya Malware dağıtım noktası riski taşır.
    ip_pattern = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'
    if re.search(ip_pattern, normalized_url):
        print(f"🚨 [HAM IP TEHDİDİ TESPİT EDİLDİ]: {url} -> Zararlı Yazılım (Malware / C2)")
        return jsonify({
            "url": url, "label": "malware", "labelTr": "Zararlı Yazılım (Malware / C2 Sunucusu)",
            "score": 0.999, "risk": 95, "safe": False, "dangerous": True,
            "color": "red", "source": "ip_detector"
        })

    # 4. DEFANGED THREAT BİLDİRİMİ (hxxps:// biçimindeki zararlı linkler)
    # 1. Adımda tespit ettiğimiz defanged formatlı linkler için zararlı uyarısını burada kesinleştirip döndürüyoruz.
    if is_defanged:
        print(f"🚨 [DEFANGED TEHDİD İNDİKATÖRÜ]: {url} -> Güvenlik Tehdidi Engellendi")
        return jsonify({
            "url": url, "label": "phishing", "labelTr": "Raporlanmış Siber Tehdit Bağlantısı (Defanged Link)",
            "score": 0.985, "risk": 85, "safe": False, "dangerous": True,
            "color": "red", "source": "defanged_detector"
        })

    # 5. AI MODEL ANALİZİ (URLBert Transformer Engine + TLD Sezgisel Analiz)
    # Eğer yapay zeka modeli başlatılamadıysa geçici olarak güvenli yanıtı döneriz (fail-open yaklaşımı)
    if _clf is None:
        return jsonify({"safe": True, "label": "benign", "labelTr": "Güvenli", "risk": 0})

    try:
        # URLBert modelimizi çalıştırarak URL'den tahmin (inference) alıyoruz.
        res = _clf(normalized_url)[0]
        label_raw = res["label"] # Modelin orijinal etiketi
        score = round(res["score"], 4) # Modelin karardan eminlik derecesi (Güven skoru)

        # Sezgisel Analiz: URL'nin sonunda şüpheli TLD (.xyz, .tk vb.) var mı?
        is_suspicious_tld = any(normalized_url.endswith(tld) or (tld + '/') in normalized_url or (tld + '?') in normalized_url for tld in SUSPICIOUS_TLDS)
        # URL'de phishing(oltalama) kelimesi geçiyor mu?
        has_phish_kw = any(kw in normalized_url for kw in PHISHING_KEYWORDS)

        # Modelden gelen ham etiketlerin (LABEL_X) risk derecelerini hesaplıyoruz.
        if label_raw == "LABEL_2":  # LABEL_2: URLBert modelinde zararlı yazılımlar için üretilmiş sınıftır.
            label_tr = "Zararlı Yazılım (Malware)"
            risk = 95
            safe = False
        elif label_raw == "LABEL_1":  # LABEL_1: Sayfa tahrifatı veya zararlı aktivite göstergesi.
            label_tr = "Sayfa Tahrif (Defacement)"
            risk = 80
            safe = False
        elif is_suspicious_tld and has_phish_kw:
            # Model yakalayamasa bile hem riskli uzantı hem riskli kelime varsa Oltalama (Phishing) olarak işaretle.
            label_tr = "Oltalama (Phishing / Şüpheli Web App)"
            risk = 90
            safe = False
        elif is_suspicious_tld:
            # Sadece şüpheli uzantı kullanıyorsa orta derecede riskli sınıfına alıyoruz.
            label_tr = "Şüpheli Uzantılı URL / Doğrulanmamış Web App"
            risk = 70
            safe = False
        else:
            # Hiçbir risk faktörü uymuyorsa, Güvenli olarak nitelendiriyoruz.
            label_tr = "Güvenli"
            risk = 0
            safe = True

        # Analiz sonucunu terminale (log olarak) yazdırıyoruz. TEKNOFEST sunumunda jürinin görmesi için etkilidir.
        print(f"🤖 [URLBert AI]: {url} -> {label_raw} | {label_tr} | Risk: %{risk}")

        # Nihai sonucu istemci uygulamaya JSON olarak döndürüyoruz.
        return jsonify({
            "url": url,
            "label": "phishing" if not safe else "benign",
            "labelTr": label_tr,
            "score": score,
            "risk": risk,
            "safe": safe, # Genel güvenlilik durumu
            "dangerous": not safe,
            "color": "red" if risk >= 80 else ("orange" if risk > 0 else "green"), # Risk seviyesine göre görselleştirme rengi
            "source": "urlbert_ai" # Sonucun yapay zeka motorundan geldiğini bildiriyoruz
        })

    except Exception as exc:
        # Analiz sırasında herhangi bir sunucu hatası (ör. modelin çökmesi) olursa yakalanır.
        traceback.print_exc()
        return jsonify({"error": str(exc), "safe": True}), 500

# Script doğrudan çalıştırılırsa Flask sunucusunu başlat.
if __name__ == "__main__":
    print("🚀 URLBert Hibrit Güvenlik Servisi Port 5001 üzerinde başlatılıyor...")
    # host="0.0.0.0" tüm ağ arayüzlerinden isteklere açık olduğunu ifade eder.
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=False, use_reloader=False)
