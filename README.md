# STORYPLAY / GameWeb

Монгол хэл дээрх Ren’Py тоглоомын дэлгүүр. Энэ шатанд хэрэглэгчийн бүртгэл, нэвтрэлт, серверт хадгалагддаг **туршилтын** сан болон захиалгын түүх ажиллана.

## Windows дээр ажиллуулах

Node.js 24.x суулгаад PowerShell-оо шинээр нээнэ (хамгийн багадаа Node 22.13 шаардлагатай).

```powershell
cd Z:\Web\GameWeb
git pull origin main
node --version
npm.cmd start
```

Browser: **http://localhost:8000**. Terminal-ийг ажиллаж байх хугацаанд нээлттэй байлгана. Зогсоох: Ctrl+C.

`npm start` ч ашиглаж болно. PowerShell `npm.ps1` хориглосон бол `npm.cmd start` нь execution policy өөрчлөхгүй ажиллана. `node` танигдахгүй бол Node.js суулгалтаа шалгаад terminal-аа дахин нээнэ. Python хэрэггүй, тусдаа npm package суулгах шаардлагагүй.

Анхны таталт:

```powershell
git clone https://github.com/hakukagene/GameWeb.git
cd GameWeb
npm.cmd start
```

Энэ хувилбарыг `http.server`, Live Server, файл дээр давхар дарах эсвэл зөвхөн `dist` хавтас байрлуулах аргаар ажиллуулахад backend холбогдохгүй. **npm start** нь frontend болон API-г хамтад нь үйлчилнэ.

## Туршиж үзэх дараалал

1. Баруун дээд талын **Нэвтрэх → Бүртгүүлэх** дээр нэр, имэйл, 10–128 тэмдэгттэй нууц үг оруулна.
2. Тоглоом сонгоод **Худалдан авахыг турших → Туршилтаар сандаа нэмэх** дарна.
3. **Миний сан** дээр орж, browser-оо refresh хийхэд тоглоом үлдсэнийг шалгана.
4. Баруун дээд нэр дээр дарж туршилтын захиалгын түүхийг үзнэ.
5. Гараад өөр бүртгэлээр нэвтрэхэд тусдаа сан харагдана. Өмнөх бүртгэлээр дахин нэвтрэхэд өөрийн сан буцаж гарна.
6. Серверээ зогсоож дахин асаасан ч ижил database ашиглаж байвал бүртгэл, сан хадгалагдана.

## Өгөгдөл

Анхны асаалтаар `data/storyplay.sqlite` автоматаар үүснэ. Энэ файл болон SQLite-ийн WAL/SHM файлууд GitHub-д орохгүй. Нөөцлөхдөө серверээ зогсоож `data` хавтсыг бүхэлд нь хуулна. Өөр компьютероос харахад нэг төв сервер, ижил database-д холбогдох шаардлагатай; хоёр локал серверийн өгөгдөл автоматаар нийлэгдэхгүй.

Хүснэгтүүд:

- `users`: ID, нэр, имэйл, санамсаргүй salt болон scrypt password hash.
- `sessions`: cookie token-ий SHA-256 hash, хэрэглэгч, 7 хоногийн дуусах хугацаа.
- `games`: серверийн үнэ бүхий жишээ каталог.
- `demo_orders`: хэрэглэгч бүрийн давхардахгүй туршилтын захиалга. **Төлөгдсөн эрхийн хүснэгт биш.**

## Файлууд

- `server/index.mjs`: сервер эхлүүлэх тохиргоо
- `server/app.mjs`: auth, SQLite, API, static файл үйлчлэх
- `server/catalog.mjs`: жишээ тоглоомын каталог, серверийн үнэ
- `dist/`: website-ийн интерфэйс, зураг
- `tests/auth-library.test.mjs`: API integration tests
- `.env.example`: тохиргооны жишээ

## Тохиргоо

Тохиргоог environment variable-аар өгнө. `.env` ашиглах бол `.env.example`-ийг `.env` болгон хуулж, `node --env-file=.env server/index.mjs` ажиллуулна. `npm start` нь `.env`-ийг автоматаар уншихгүй.

| Нэр | Анхны утга / зориулалт |
| --- | --- |
| `PORT` | `8000` |
| `HOST` | `127.0.0.1`; зөвхөн өөрийн компьютер |
| `APP_ORIGIN` | `http://localhost:8000`; browser дээр нээх яг тэр origin, ардаа `/` үгүй |
| `DB_PATH` | `./data/storyplay.sqlite`; тогтмол хадгалалттай байрлал |
| `NODE_ENV` | `production` үед HTTPS origin заавал шаардлагатай |
| `DEMO_PURCHASES` | Development үед default `true`; production үед default `false` |

Production үед demo-г `true` болговол сервер асахгүй. Production session cookie нь `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` prefix-тэй. Хөгжүүлэлтийн HTTP cookie мөн HttpOnly, SameSite=Strict. Нэвтрэлтээр session шинэчлэгдэж, гарахад хүчингүй болно. Өөрчлөлт хийдэг API нь яг зөв `Origin` болон JSON body шаарддаг. Нууц үг браузерийн storage-д хадгалагдахгүй.

## API

| Method | Path | Зориулалт |
| --- | --- | --- |
| GET | `/api/games` | Каталог |
| GET | `/api/me` | Нэвтэрсэн хэрэглэгч, demo тохиргоо |
| POST | `/api/auth/register` | `{name,email,password}` |
| POST | `/api/auth/login` | `{email,password}` |
| POST | `/api/auth/logout` | `{}` |
| GET | `/api/library` | Өөрийн demoGameIds; paidGameIds одоогоор хоосон |
| GET | `/api/orders` | Өөрийн туршилтын түүх |
| POST | `/api/demo-orders` | Зөвхөн `{gameId}`; үнэ серверээс авна |

## Шалгах

```powershell
npm.cmd run check
npm.cmd test
```

Тестүүд түр database ашигладаг; таны `data` хавтсыг өөрчлөхгүй. Бүртгэл, буруу нууц үг, хэрэглэгч хоорондын тусгаарлалт, session, logout, expiration, restart, давхардсан захиалга, үнэ өөрчлөх оролдлого, origin, rate limit, production тохиргоог шалгана.

## Дараагийн хөгжүүлэлт ба хязгаарлалт

- Бодит мөнгө, төлбөрийн provider, webhook/receipt баталгаажуулалт холбогдоогүй. Demo захиалга **тоглох/татах бодит эрх үүсгэхгүй**.
- Ren’Py тоглоомын build, cloud save, админ, Android/iOS апп хараахан холбогдоогүй.
- Имэйл баталгаажуулах, нууц үг сэргээх үйлчилгээ хараахан байхгүй.
- Энэ нь нэг Node process + локал SQLite бүхий MVP. Олон instance-д shared database болон төвлөрсөн rate limiter хэрэгтэй. Одоогийн auth rate limiter нь process memory болон шууд холбогч IP ашигладаг; reverse proxy-ийн ард бүх хэрэглэгч нэг IP гэж тоологдож болно.
- Нийтэд ажиллуулахын өмнө HTTPS reverse proxy, тогтмол диск, backup, email/reset, production тохиргоо шаардлагатай. App Store / Play Billing дараагийн шатанд тусдаа интеграцтай байна.
- GitHub шинэчлэлт нь өмнө үүсгэсэн `chatgpt.site` demo-г автоматаар шинэчлэхгүй. Энэ Node backend тусдаа сервер дээр ажиллана.

## Зургийн эх сурвалж

Зургууд нь жишээ контент, тоглоомын жинхэнэ assets биш.

- Train: https://unsplash.com/photos/a-train-traveling-down-train-tracks-at-night-TGNnKydr2lI
- City (AI illustration): https://src.fanchai.app/image-model/seedream-4-5/prompt-cyberpunk.webp
- Mountain (AI illustration): https://www.publicdomainpictures.net/en/view-image.php?image=694279&picture=misty-mountain-valley

Арилжааны хувилбарт өөрийн тоглоомын зөвшөөрөлтэй зургуудаар солино.
