# Node.js LTS (Uzun Vadeli Destek) tabanlı hafif Alpine Linux imajı kullanılıyor.
# Alpine imajı konteynerin boyutunu küçük tutar.
FROM node:18-alpine

# Word (.docx) raporları üreten Python scripti için gerekli Python3 ve bağımlılıklarını kuruyoruz.
# build-base, python kütüphanelerinin derlenmesi için gerekli araçları sağlar.
RUN apk add --no-cache python3 py3-pip build-base

# python-docx kütüphanesini pip aracılığıyla kur.
# --break-system-packages flagi, Alpine gibi ortamlarda pip kullanım uyarısını geçmek için kullanılır.
# Eğer ilk komut hata verirse || operatörü ile sadece normal kurulum denenir.
RUN pip install --no-cache-dir python-docx --break-system-packages || pip install --no-cache-dir python-docx

# Docker container içerisinde uygulamamızın çalışacağı dizini /app olarak belirliyoruz.
WORKDIR /app

# npm bağımlılıklarını kurmak için önce sadece package.json ve package-lock.json dosyalarını kopyalıyoruz.
# Bu adım Docker cache'ini verimli kullanmayı sağlar.
COPY package*.json ./

# Sadece production (canlı ortam) bağımlılıklarını kurarak imaj boyutunu optimize ediyoruz.
RUN npm install --production

# Kurulum sonrası projenin tüm kaynak kodlarını (backend, frontend vb.) /app dizinine kopyalıyoruz.
COPY . .

# Node.js backend sunucusunun dışarıya hizmet vereceği portu (3006) container düzeyinde açıyoruz.
EXPOSE 3006

# Container ayağa kalktığında çalıştırılacak ana komut. Sunucuyu başlatır.
CMD ["node", "backend/server.js"]
