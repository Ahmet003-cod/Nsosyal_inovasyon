# -*- coding: utf-8 -*-
import sys, json, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

test_urls = [
    ('https://www.google.com',                      'Google (Guvenli)'),
    ('https://www.github.com',                      'GitHub (Guvenli)'),
    ('http://login-bank.xyz/ziraat-aidat-iade',     'Phishing linki'),
    ('http://secure-paypal-verify.tk/login',        'Phishing TLD'),
    ('http://185.220.101.5/malware.exe',            'Malware IP linki'),
]

print('=' * 60)
print('URLBert AI URL Siniflandirici - Canli 3 Test')
print('=' * 60)

for url, desc in test_urls:
    payload = json.dumps({'url': url}).encode('utf-8')
    req = urllib.request.Request(
        'http://localhost:5001/classify',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        res = urllib.request.urlopen(req, timeout=15)
        d = json.loads(res.read().decode('utf-8'))
        icon = 'GUVENLI' if d['safe'] else 'TEHLIKELI'
        label = d.get('labelTr', d.get('label', '?'))
        risk = d.get('risk', 0)
        score = round(d.get('score', 0) * 100, 1)
        print(f'[{icon}] {desc}')
        print(f'  URL   : {url}')
        print(f'  Karar : {label} | Risk: %{risk} | Guven: %{score}')
        print()
    except Exception as e:
        print(f'HATA: {e}')
        print()

print('=' * 60)
print('Test tamamlandi!')
