# STORYPLAY / GameWeb

Монгол хэл дээрх Ren’Py тоглоомын дэлгүүр. Энэ шатанд хэрэглэгчийн бүртгэл, нэвтрэлт, серверт хадгалагддаг **туршилтын** сан болон захиалгын түүх ажиллана.

## Болзоо тоглоом оруулах

`NewProject-1.0-web.zip`-ийг GameWeb хавтсандаа хуулна. ZIP-ийг урьдчилан задлах шаардлагагүй. Сервер ассан бол Ctrl+C дарж зогсоогоод:

```powershell
cd Z:\Web\GameWeb
git pull origin main
npm.cmd run import:bolzoo -- ".\NewProject-1.0-web.zip"
npm.cmd start
```

Эсвэл ZIP-ийн бүтэн замыг өгч болно:

```powershell
npm.cmd run import:bolzoo -- "C:\Users\YOUR_NAME\Downloads\NewProject-1.0-web.zip"
```

Importer нь бүх файлыг `game-content/bolzoo/` руу задална. Файл бүрийн checksum, нийт хэмжээ, замыг шалгана. ZIP64, шифрлэсэн ZIP дэмжихгүй. Байгаа `bolzoo` хавтсыг дарж бичихгүй; шинэ build оруулахын өмнө хуучин хавтсыг backup байрлал руу зөөж хадгална. Буруу ZIP-ийг хэсэгчлэн идэвхжүүлэхгүй.

Windows эсвэл mapped drive дээр хавтасны `rename` үйлдэл `EPERM`, `EACCES`, `EBUSY`, `EXDEV` алдаа өгвөл importer шалгагдсан файлуудыг шинэ хавтас руу хуулж суулгана. Бүх файл хуулсны дараа `index.html`-ийг идэвхжүүлдэг тул дутуу хуулсан тоглоом нээгдэхгүй. Амжилттай үед `installation: 'copy'` гэж гарч болно. Файл бичих эрх өөрөө хаалттай бол хуулалт мөн алдаа өгнө.

Хуучин importer дээр `EPERM ... rename ... -> ...bolzoo` гарсан бол серверээ Ctrl+C дарж зогсоогоод, `git pull origin main` ажиллуулж дээрх импорт командыг дахин өгнө. `already exists` гарвал байгаа `game-content/bolzoo` хавтсаа эхлээд backup байрлал руу зөөнө.

**http://localhost:8000 → Нэвтрэх → Болзоо → Туршилтын санд нэмэх → Тоглох.**

Нэг `npm start` командаар дэлгүүр (8000), тусдаа тоглоомын сервер (8001) зэрэг асна. 8001-ийг шууд нээх биш дэлгүүрийн **Тоглох** товчийг ашиглана. Хоёр порт өөр апп ашиглаж байвал өөр порт сонгож `.env.example`-ийн `APP_ORIGIN`, `GAME_ORIGIN`-ийг тааруулна.

- Каталог дээр тоглоомын нэр **Болзоо**, хувилбар 1.0 байна.
- Build-ийн `school_gate.webp`-ийг дэлгүүрийн түр нүүр зурагт ашиглана; байхгүй үед жишээ зураг гарна.
- Үнэ одоогоор **туршилтын горим**; бодит борлуулах үнэ тогтоогоогүй.
- Тоглоомын 84 MB архив, 187 файл **GitHub-д орохгүй**. Private тоглоомын файлыг public кодын repository-д нийтлэхгүй. `game-content/` болон `*-web.zip` ignored.
- Энэ build сервер ассан компьютер дээр байх ёстой. Шинэ clone бүрт ZIP импортлоно. Сервер байршуулахдаа тусдаа private content storage-д шилжүүлнэ.
- Тоглох хүсэлт 60 секундийн нэг удаагийн ticket ашиглана. Тоглоомын файл бүрд 4 цагийн preview grant болон үндсэн нэвтрэлтийн session шалгана. Гарахад дараагийн файл хүсэлт хаагдана; аль хэдийн браузерт ачаалсан өгөгдлийг буцааж устгах DRM биш.
- Ren’Py код нь дэлгүүрээс өөр origin-д iframe дотор ажиллана. WebAssembly MIME, media Range requests дэмжинэ. PWA service worker бүртгэл/түгээлтийг идэвхгүй болгосон; offline cache-аар эрхийн шалгалт алгасахгүй.
- **Зөвхөн development + demo горимд тоглоно.** Production-д үнэгүй demo эрхээр энэ build нээгдэхгүй. Бодит төлбөрийн эрх дараагийн шатанд хийгдэнэ.
- Save/Load нь Ren’Py-ийн браузерийн хадгалалт. Cloud save болон account тусгаарласан save биш; нэг браузерийг хоёр хэрэглэгч хуваалцвал game save хамт харагдаж болно. Origin-оо солих, browser storage цэвэрлэхэд save нөлөөлнө. Ren’Py цэсийн Import/Export Saves ашиглаж болно.
- Browser дотор Python `requests`, `threading`, зарим видео функц дэмжигдэхгүй. Платформ холбогдсон ч тоглоомын ийм функцүүдэд тусдаа web тохируулга шаардагдаж болно.

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

## Тоглоомын API

- `POST /api/games/bolzoo/launch` — нэвтэрсэн, туршилтын сандаа нэмсэн, build импортлосон үед нэг удаагийн тоглох URL буцаана.
- `GET /api/games/bolzoo/cover` — каталогийн нүүр зураг.
- `GET /api/games` дотор `playable` нь build импортлогдсон болон preview идэвхтэй эсэхийг заана.

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

- Бодит мөнгө, төлбөрийн provider, webhook/receipt баталгаажуулалт холбогдоогүй. Demo захиалга **төлбөртэй эрх үүсгэхгүй**. Болзоо-д development preview тоглуулах нөхцөл болж ашиглагдана.
- Болзоо web build импорт болон development player холбогдсон. Cloud save, админ, Android/iOS апп хараахан холбогдоогүй.
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
