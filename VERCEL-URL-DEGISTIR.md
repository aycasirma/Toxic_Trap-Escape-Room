# Vercel URL: toxic-trap-escape-room

**Canlı adres:** https://toxic-trap-escape-room.vercel.app

*(Eski `earthquake-simulation-3-d.vercel.app` artık kullanılmıyor.)*

---

Aşağıdaki adımlar yalnızca URL’yi ilk kez ayarlarken gereklidir.

---

## Yöntem (önerilen): Eski projeyi sil, yeniden bağla

### 1) Eski projeyi sil
1. https://vercel.com/dashboard
2. **earthquake-simulation-3-d** projesine tıkla
3. **Settings** → en alta in → **Delete Project** → onayla

### 2) GitHub repo’yu yeniden import et
1. https://vercel.com/new
2. **Import Git Repository** → `Toxic_Trap-Escape-Room` seç
3. **ÖNEMLİ:** Deploy’a basmadan önce **Project Name** kutusunu bul  
   - Varsayılan `earthquake-simulation-3-d` veya benzeri olabilir — **sil**
   - Yaz: `toxic-trap-escape-room` (küçük harf, tire)
4. Framework: **Vite** (otomatik algılanmalı)
5. **Deploy**

### 3) Kontrol
Tarayıcıda aç: https://toxic-trap-escape-room.vercel.app

---

## Sık yapılan hatalar
| Hata | Sonuç |
|------|--------|
| Sadece GitHub repo adını değiştirmek | Vercel URL değişmez |
| Account Settings’te isim değiştirmek | Proje URL’si değişmez |
| Project Name’i değiştirip Deploy etmemek | Eski subdomain kalır |
| Eski projeyi silmeden yeni proje açmak | İki farklı URL, karışıklık |

---

## Hâlâ eski URL açılıyorsa
- Gizli sekme (Ctrl+Shift+N) ile dene
- Vercel’de hangi hesapla giriş yaptığını kontrol et (aycasirma)
