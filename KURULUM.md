# 🏛 AI Chief of Staff — Kurulum & Yayınlama Kılavuzu

Bu kılavuzu adım adım takip edin. Teknik bilgi gerekmez.

---

## ADIM 1 — Gerekli Hesapları Oluşturun (Ücretsiz)

Aşağıdaki 3 hesaba ihtiyacınız var:

| Servis | Ne için? | Link |
|--------|----------|------|
| **GitHub** | Kodunuzu saklar | https://github.com |
| **Supabase** | Veritabanı (görevler, donörler, vb.) | https://supabase.com |
| **Vercel** | Uygulamayı internet'e açar | https://vercel.com |

Anthropic API key için:
- https://console.anthropic.com → "API Keys" → "Create Key"
- Bu ücretlidir ama çok ucuzdur (ayda ~$5-10 yoğun kullanımda)

---

## ADIM 2 — Supabase Kurulumu

1. https://supabase.com → "Start your project" → Yeni proje oluşturun
   - Proje adı: `ai-chief-of-staff`
   - Şifre: güçlü bir şifre belirleyin (kaydedin!)
   - Bölge: `West EU (Paris)` — size en yakın

2. Proje oluşturulduktan sonra:
   - Sol menü → **SQL Editor** → "New Query"
   - `supabase_schema.sql` dosyasının içeriğini yapıştırın
   - **Run** butonuna basın
   - "Success" mesajı görmelisiniz

3. API bilgilerini alın:
   - Sol menü → **Project Settings** → **API**
   - **Project URL** → kopyalayın
   - **anon public** key → kopyalayın

---

## ADIM 3 — Ortam Değişkenlerini Ayarlayın

Proje klasöründe `.env.example` dosyasını `.env.local` olarak kopyalayın:

```bash
cp .env.example .env.local
```

`.env.local` dosyasını açın ve doldurun:

```
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co     ← Supabase'den
REACT_APP_SUPABASE_ANON_KEY=eyJhbGci...              ← Supabase'den
REACT_APP_CLAUDE_API_KEY=sk-ant-api03-...            ← Anthropic'ten
```

> ⚠️ `.env.local` dosyasını asla GitHub'a yüklemeyin!

---

## ADIM 4 — Yerel Çalıştırma (Test)

Bilgisayarınızda Node.js yüklü değilse: https://nodejs.org → "LTS" sürümü indirin.

Terminal/Komut İstemi'nde:

```bash
cd ai-cos-app
npm install
npm start
```

Tarayıcıda `http://localhost:3000` açılacak. Test edin.

---

## ADIM 5 — GitHub'a Yükleme

1. GitHub'da yeni repository oluşturun: "New" → `ai-chief-of-staff` → Private → Create

2. Terminal'de:
```bash
git init
git add .
git commit -m "Initial: AI Chief of Staff"
git remote add origin https://github.com/KULLANICI_ADI/ai-chief-of-staff.git
git push -u origin main
```

> ⚠️ `.env.local` dosyasının `.gitignore`'a eklendiğinden emin olun (zaten ekli).

---

## ADIM 6 — Vercel'e Deploy

1. https://vercel.com → "Add New Project" → GitHub'ı bağlayın
2. `ai-chief-of-staff` repository'sini seçin → Import
3. **Environment Variables** bölümüne `.env.local`'daki 3 değişkeni ekleyin:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_CLAUDE_API_KEY`
4. **Deploy** butonuna basın

5-10 dakika içinde uygulamanız canlıda olacak:
`https://ai-chief-of-staff.vercel.app`

---

## ADIM 7 — İlk Kullanım

1. Uygulamayı açın → "Hesap Oluştur" → email ve şifre ile kayıt olun
2. Email doğrulamasını yapın (Supabase gönderir)
3. Giriş yapın

**Demo verisi yüklemek için** (opsiyonel):
Supabase SQL Editor'da şunu çalıştırın:
```sql
SELECT seed_demo_data(auth.uid());
```
Bu komut WFP/OCHA/HfH/GN donörlerini ve örnek görevleri yükler.

---

## ÖZELLIKLER

| Sayfa | Ne yapar? |
|-------|-----------|
| **Dashboard** | Acil görevler, donör durumu, açık aksiyonlar — tek bakışta |
| **AI Asistan** | Claude ile sohbet — taslak, gündem, brifing, karar desteği |
| **Görevler** | Tüm deadline'lar — filtrele, güncelle, ekle |
| **Donör CRM** | WFP/OCHA/HfH/GN profilleri ve etkileşim geçmişi |
| **Toplantı Logu** | Koordinatörler/Board/1:1 toplantı aksiyonları |

---

## SORUN GİDERME

**"API key geçersiz" hatası:**
→ `.env.local` dosyasındaki key'i kontrol edin. Boşluk olmamalı.

**Supabase bağlanamıyor:**
→ URL'nin `https://` ile başladığından emin olun.

**Vercel'de env değişkenleri çalışmıyor:**
→ Vercel → Settings → Environment Variables → değişkenleri tekrar ekleyin → Redeploy.

**Demo verileri görünmüyor:**
→ Supabase SQL Editor'da `seed_demo_data` fonksiyonunu giriş yaptıktan sonra çalıştırın.

---

## GÜVENLİK NOTU

- Tüm veriler Supabase'de sizin hesabınıza özel (Row Level Security aktif)
- Claude API key'i `.env.local`'da saklı — GitHub'a gitmez
- Üretim ortamında API key'i backend'e taşımak önerilir (sonraki adım)

---

*AI Chief of Staff v1.0 — Direktör Ofisi, Uluslararası İnsani Yardım Örgütü*
