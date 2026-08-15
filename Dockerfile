# Node.js LTS tabanlı imaj kullanılıyor
FROM node:18-alpine

# Word (.docx) raporları üreten Python scripti için Python3 ve python-docx paketleri kuruluyor
RUN apk add --no-cache python3 py3-pip build-base

# python-docx kütüphanesini kur
RUN pip install --no-cache-dir python-docx --break-system-packages || pip install --no-cache-dir python-docx

# Uygulama dizinini oluştur ve seç
WORKDIR /app

# Bağımlılıkları kopyala ve yükle
COPY package*.json ./
RUN npm install --production

# Tüm kaynak kodları kopyala
COPY . .

# Backend sunucu portu
EXPOSE 3006

# Sunucuyu başlat
CMD ["node", "backend/server.js"]
