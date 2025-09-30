# Maaş Hesaplama Uygulaması

Bu uygulama, özel sektör çalışanları için maaş hesaplama yapar.

## 🚀 Deploy Edilmiş Versiyon
**Backend API ile çalışır** → [Vercel'e Deploy Et](https://vercel.com/import/project?template=https://github.com/ushaula/maas_hesaplama)

**Fallback (GitHub Pages)** → [https://ushaula.github.io/maas_hesaplama](https://ushaula.github.io/maas_hesaplama)

## 📦 Deploy Talimatları

### Vercel Deploy (Önerilen - Backend API çalışır)
1. [vercel.com](https://vercel.com) → Sign up with GitHub
2. "Import Project" → Bu repository'yi seç
3. Deploy → Otomatik build yapar
4. Backend API aktif olur ✅

### GitHub Pages (Fallback - Sadece frontend)
1. Repository Settings → Pages
2. Source: Deploy from a branch → main
3. Sadece frontend çalışır, backend yok ⚠️

## 📋 Özellikler  
- **🔒 Backend API**: Hesaplama formülleri gizli
- **📱 Responsive**: Mobil uyumlu tasarım
- **⚡ Fast**: CDN ile hızlı yükleme
- **🎯 Accurate**: 2024-2025 vergi dilimli hesaplama
- **💰 Comprehensive**: BES, sağlık sigortası, performans primi

## 🛠️ Teknolojiler
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js Serverless Functions
- **Deployment**: Vercel (önerilen) veya GitHub Pages
- **Version**: 2.2.0

## 📱 Kullanım
1. Brüt maaşınızı girin
2. Yıl, BES durumu, sigorta tipini seçin  
3. Hesapla butonuna tıklayın
4. Aylık detayları ve yıllık toplamları görün

## 🏗️ Development
```bash
# Local development
git clone https://github.com/ushaula/maas_hesaplama.git
cd maas_hesaplama
# index.html'i browser'da aç (API olmadan çalışır)
```

## ⚠️ Disclaimer
Bu hesaplamaların resmi bir geçerliliği yoktur. Sadece referans amaçlıdır.