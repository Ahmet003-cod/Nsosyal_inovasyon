# -*- coding: utf-8 -*-
# ============================================================
# BACKEND/URL_CLASSIFIER_SERVER.PY
# HuggingFace URLBert Kötü URL Sınıflandırıcı Mikro Servisi
# Model: CrabInHoney/urlbert-tiny-v4-malicious-url-classifier
# Mimarisi: Güvenilir Beyaz Liste + Defanged Threat Detector + URLBert AI Engine
# TEKNOFEST 2026 - NSosyal İnovasyon Projesi
# ============================================================

from __future__ import annotations
import sys, json, re, traceback
sys.stdout.reconfigure(encoding='utf-8')

print("🤖 [URLBert] urlbert-tiny-v4-malicious-url-classifier yükleniyor...")

from transformers import pipeline as hf_pipeline

_clf = None
try:
    _clf = hf_pipeline(
        "text-classification",
        model="CrabInHoney/urlbert-tiny-v4-malicious-url-classifier",
        tokenizer="CrabInHoney/urlbert-tiny-base-v4",
        device=-1,
        truncation=True,
        max_length=512,
    )
    _warmup = _clf("https://google.com")
    print(f"✅ [URLBert] AI Model çevrimiçi hazır! Isınma testi: {_warmup[0]['label']}")
except Exception as exc:
    print(f"⚠️ [URLBert] Çevrimiçi yükleme denendi, yerel önbellek (offline mod) kullanılıyor...")
    try:
        _clf = hf_pipeline(
            "text-classification",
            model="CrabInHoney/urlbert-tiny-v4-malicious-url-classifier",
            tokenizer="CrabInHoney/urlbert-tiny-base-v4",
            device=-1,
            truncation=True,
            max_length=512,
            local_files_only=True
        )
        _warmup = _clf("https://google.com")
        print(f"✅ [URLBert] AI Model yerel önbellekten (OFFLINE) yüklendi! Test: {_warmup[0]['label']}")
    except Exception as exc2:
        print(f"❌ [URLBert] Yükleme hatası: {exc2}")
        traceback.print_exc()

# ── GÜVENİLİR BEYAZ LİSTE (Zero False-Positive Garantisi) ───
SAFE_DOMAINS = {
    "google.com", "youtube.com", "github.com", "wikipedia.org", "gov.tr", "edu.tr",
    "instagram.com", "facebook.com", "twitter.com", "x.com", "linkedin.com", "medium.com",
    "softito.com.tr", "btkakademi.gov.tr", "udemy.com", "coursera.org", "microsoft.com",
    "apple.com", "amazon.com", "e-devlet.gov.tr", "aa.com.tr", "trthaber.com"
}

# ŞÜPHELİ UZANTILAR VE SERBEST UYGULAMA PLATFORMLARI
SUSPICIOUS_TLDS = (
    '.xyz', '.top', '.click', '.gq', '.cf', '.tk', '.ml', '.cam', '.cheap', '.zip', '.mov',
    '.online', '.site', '.tech', '.space', '.monster', '.link', '.live',
    '.lovable.app', '.ngrok-free.app', '.trycloudflare.com', '.serveo.net'
)
PHISHING_KEYWORDS = ('login-', 'bank-', 'aidat-', 'bonus-', 'airdrop-', 'free-', 'kazanc-', 'hesap-', 'guide-ai', 'bot-')

from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "ready": _clf is not None,
        "model": "urlbert-tiny-v4-malicious-url-classifier",
        "whitelistCount": len(SAFE_DOMAINS)
    })

@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json(force=True, silent=True) or {}
    url  = str(data.get("url", "")).strip()

    if not url:
        return jsonify({"error": "URL gerekli", "safe": True}), 400

    lower_url = url.lower()

    # 1. SİBER GÜVENLİK DEFANGED THREAT İNDİKATÖRÜ TESPİTİ (hxxps://, hxxp://, hXXp)
    # Bir bağlantı hxxps:// veya hxxp:// şeklinde yazılmışsa doğrudan zararlı indikatördür!
    is_defanged = bool(re.search(r'hxxps?://|hXXps?://|\[\.\]', url, re.IGNORECASE))

    # URL Normalizasyonu
    normalized_url = lower_url.replace('hxxps://', 'https://').replace('hxxp://', 'http://').replace('[.]', '.')

    # 2. BEYAZ LİSTE KONTROLÜ (Resmi ve Güvenilir Kurumlar)
    if not is_defanged:
        for safe_domain in SAFE_DOMAINS:
            if safe_domain in normalized_url:
                print(f"✅ [BEYAZ LİSTE]: {url} -> Güvenli Domain ({safe_domain})")
                return jsonify({
                    "url": url, "label": "benign", "labelTr": "Güvenli",
                    "score": 1.0, "risk": 0, "safe": True, "dangerous": False,
                    "color": "green", "source": "whitelist"
                })

    # 3. HAM IP ADRESİ KONTROLÜ (Malware & C2 Sunucu Riski - örn: 217.60.195.113/test/x86_64)
    ip_pattern = r'(?:https?://)?(?:\d{1,3}\.){3}\d{1,3}'
    if re.search(ip_pattern, normalized_url):
        print(f"🚨 [HAM IP TEHDİDİ TESPİT EDİLDİ]: {url} -> Zararlı Yazılım (Malware / C2)")
        return jsonify({
            "url": url, "label": "malware", "labelTr": "Zararlı Yazılım (Malware / C2 Sunucusu)",
            "score": 0.999, "risk": 95, "safe": False, "dangerous": True,
            "color": "red", "source": "ip_detector"
        })

    # 4. DEFANGED THREAT BİLDİRİMİ (hxxps:// biçimindeki zararlı linkler)
    if is_defanged:
        print(f"🚨 [DEFANGED TEHDİD İNDİKATÖRÜ]: {url} -> Güvenlik Tehdidi Engellendi")
        return jsonify({
            "url": url, "label": "phishing", "labelTr": "Raporlanmış Siber Tehdit Bağlantısı (Defanged Link)",
            "score": 0.985, "risk": 85, "safe": False, "dangerous": True,
            "color": "red", "source": "defanged_detector"
        })

    # 5. AI MODEL ANALİZİ (URLBert Transformer Engine + TLD Sezgisel Analiz)
    if _clf is None:
        return jsonify({"safe": True, "label": "benign", "labelTr": "Güvenli", "risk": 0})

    try:
        res = _clf(normalized_url)[0]
        label_raw = res["label"]
        score = round(res["score"], 4)

        # Şüpheli domain/uzantı + Phishing kelimesi analizi
        is_suspicious_tld = any(normalized_url.endswith(tld) or (tld + '/') in normalized_url or (tld + '?') in normalized_url for tld in SUSPICIOUS_TLDS)
        has_phish_kw = any(kw in normalized_url for kw in PHISHING_KEYWORDS)

        if label_raw == "LABEL_2":  # Zararlı Yazılım (Malware)
            label_tr = "Zararlı Yazılım (Malware)"
            risk = 95
            safe = False
        elif label_raw == "LABEL_1":  # Sayfa Tahrifatı (Defacement)
            label_tr = "Sayfa Tahrif (Defacement)"
            risk = 80
            safe = False
        elif is_suspicious_tld and has_phish_kw:
            label_tr = "Oltalama (Phishing / Şüpheli Web App)"
            risk = 90
            safe = False
        elif is_suspicious_tld:
            label_tr = "Şüpheli Uzantılı URL / Doğrulanmamış Web App"
            risk = 70
            safe = False
        else:
            label_tr = "Güvenli"
            risk = 0
            safe = True

        print(f"🤖 [URLBert AI]: {url} -> {label_raw} | {label_tr} | Risk: %{risk}")

        return jsonify({
            "url": url,
            "label": "phishing" if not safe else "benign",
            "labelTr": label_tr,
            "score": score,
            "risk": risk,
            "safe": safe,
            "dangerous": not safe,
            "color": "red" if risk >= 80 else ("orange" if risk > 0 else "green"),
            "source": "urlbert_ai"
        })

    except Exception as exc:
        traceback.print_exc()
        return jsonify({"error": str(exc), "safe": True}), 500

if __name__ == "__main__":
    print("🚀 URLBert Hibrit Güvenlik Servisi Port 5001 üzerinde başlatılıyor...")
    app.run(host="0.0.0.0", port=5001, debug=False, threaded=False, use_reloader=False)
