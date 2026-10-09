# STORYPLAY / GameWeb

Монгол хэл дээрх Ren’Py тоглоомын дэлгүүр. Энэ шатанд хэрэглэгчийн бүртгэл, нэвтрэлт, серверт хадгалагддаг **туршилтын** сан, захиалгын түүх болон админ удирдлага ажиллана.

## DigitalOcean дээр байрлуулах — v0.5.0

[Droplet байршуулалтын заавар](deploy/digitalocean/README.md): Docker Compose, HTTPS, байнгын database/game-content хадгалалт, дахин асаалт болон нөөцлөх скрипт. Production-д админ **Тоглож шалгах** товчоор build-ээ шалгаж болно; бодит худалдан авсан хэрэглэгчийн эрх хараахан холбогдоогүй. Эдгээр файлыг татах нь өөрөө cloud сервер үүсгэхгүй.

## Админ удирдлага — v0.4.0

Серверээ зогсоогоод шинэ код татна. Өмнө бүртгүүлсэн өөрийн имэйлд админ эрх олгоно:

```powershell
cd Z:\Web\GameWeb
git pull origin main
npm.cmd run admin:set -- "your@email.com"
npm.cmd start
```

`your@email.com`-ийг **website дээр бүртгүүлсэн имэйлээрээ** солино. Бүртгэлгүй бол эхлээд серверээ асааж website-ийн **Нэвтрэх → Бүртгүүлэх** хэсэгт бүртгүүлнэ. Анхны хэрэглэгч автоматаар админ болохгүй. Нууц үг эсвэл админ эрхийг браузераас олгох боломжгүй.

Нэвтрээд **Удирдлага** холбоос эсвэл **http://localhost:8000/admin**-ыг нээнэ. Эрх олгосны дараа Ctrl+F5 дарж шинэчилнэ. Админ эрхийг авах: `npm.cmd run admin:set -- "your@email.com" user`.

- **Тоглоомууд → Удирдах**: нэр, нүүрэн дээрх нэр, төрөл, тайлбар, үнэ (бүхэл төгрөг), хувилбар, нийтлэх төлөвийг засна. Үнэ нь дэлгүүр дээр харагдана; бодит мөнгө авахгүй.
- **Нүүр зураг**: PNG/JPG/WebP, 5 MB хүртэл. Файлыг сонгоод **Зураг оруулах** дарна.
- **Шинэ тоглоом**: давхцахгүй ID (жишээ: `my-game`), нэр, тайлбараа бөглөөд баруун талын **Нүүр зураг**, **Тоглоомын web build → Web ZIP** хэсгээс файлуудаа шууд сонгоно. **Тоглоом үүсгэх** эсвэл **Тоглоом үүсгээд файлуудыг оруулах** товч нь мэдээлэл болон сонгосон файлуудыг хамт хадгална. Зураг, ZIP-гүй ноорог үүсгэж дараа нь нэмж болно. **Дэлгүүрт нийтлэх** сонголт сонгосон файлууд амжилттай орсны дараа хэрэгжинэ. Upload алдаа гарвал тоглоом ноорог хэвээр хадгалагдана; дахин тоглоом үүсгэхгүйгээр дутуу файлаа оруулна.
- **Web build**: Ren’Py web ZIP болон хувилбарыг сонгоод **Build оруулах** дарна. 512 MB хүртэл ZIP, задлагдсан нийт хэмжээ 1 GB, нэг файл 128 MB хүртэл. Шифрлэсэн ZIP болон ZIP64 дэмжихгүй. Upload явц, шалгалтын төлөв дэлгэцэд харагдана.
- **Хэрэглэгчид**: нэр/имэйлээр хайх, эрх, бүртгэлийн огноо, захиалгын тоог харах. Нууц үг, session token буцаахгүй.
- **Захиалгууд**: хэрэглэгч, тоглоомоор хайх/шүүх; огноо, тухайн үед хадгалсан дүн, туршилтын төлөв харах. 25 мөрөөр хуудаслагдана. Дүн нь бодит орлого биш.

Шинэ build-ийг тусдаа `game-content/releases/<game-id>/<build-id>/` хавтсанд шалгаж задална. Зөвхөн бүрэн амжилттай болсны дараа database дахь идэвхтэй хувилбар солигдоно. Эвдэрсэн ZIP эсвэл upload тасрахад хуучин build хэвээр үлдэнэ. Өмнө эхэлсэн тоглолт тухайн хуучин build-ээ ашиглана; шинээр тоглоом нээхэд шинэ хувилбар орно. Хуучин хувилбаруудыг автоматаар устгахгүй; хадгалах дискний хэмжээг тооцно. Админд хувилбарын түүх харагдана, буцааж идэвхжүүлэх товч энэ шатанд ороогүй.

Өмнө командаар оруулсан `game-content/bolzoo/` шууд ажиллана, дахин ZIP оруулах шаардлагагүй. Админаас шинэ build оруулсны дараа идэвхтэй build нь database-аас сонгогдоно. Тэр үед `import:bolzoo` командаар хуучин хавтсыг солих нь идэвхтэй build-ийг өөрчлөхгүй; админ upload-аа ашиглана.

Ноорог тоглоом дэлгүүрийн каталогоос нуугдана. Өмнө сандаа нэмсэн хэрэглэгчийн сангаас устахгүй. Нэг тоглоомын мэдээллийг хоёр цонхноос зэрэг засвал хуучирсан засварыг сервер буцааж, дахин шинэчлэхийг хүснэ. Save-ийн нийцэл нь Ren’Py тоглоомын кодоос хамаарна; шинэ build save хөрвүүлэлт автоматаар хийхгүй.

Бүртгэл, захиалга болон өмнөх Болзоо файлыг хадгалж database-ийг автоматаар шинэчилнэ. Нөөцлөхдөө серверээ зогсоож **data болон game-content** хавтсыг хамтад нь хуулна. Эдгээр нь GitHub-д орохгүй. `DB_PATH` эсвэл `.env` ашигладаг бол админ команд мөн адил тохиргоотой ажиллах ёстой:

```powershell
node --env-file=.env scripts/admin-user.mjs "your@email.com"
```

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
- Үнийг админаас тохируулна; бодит төлбөр холбогдоогүй.
- Тоглоомын 84 MB архив, 187 файл **GitHub-д орохгүй**. Private тоглоомын файлыг public кодын repository-д нийтлэхгүй. `game-content/` болон `*-web.zip` ignored.
- Энэ build сервер ассан компьютер дээр байх ёстой. Шинэ clone бүрт ZIP импортлоно. Сервер байршуулахдаа тусдаа private content storage-д шилжүүлнэ.
- Тоглох хүсэлт 60 секундийн нэг удаагийн ticket ашиглана. Тоглоомын файл бүрд 4 цагийн preview grant болон үндсэн нэвтрэлтийн session шалгана. Гарахад дараагийн файл хүсэлт хаагдана; аль хэдийн браузерт ачаалсан өгөгдлийг буцааж устгах DRM биш.
- Ren’Py код нь дэлгүүрээс өөр origin-д iframe дотор ажиллана. WebAssembly MIME, media Range requests дэмжинэ. PWA service worker бүртгэл/түгээлтийг идэвхгүй болгосон; offline cache-аар эрхийн шалгалт алгасахгүй.
- Development + demo горимд туршилтын сангаар тоглоно. Production-д `ADMIN_GAME_PREVIEW=true` үед зөвхөн админ **Тоглож шалгах** товчоор нээнэ; HTTPS ба тусдаа game hostname шаардлагатай. Production-д demo захиалга тоглох эрх болохгүй. Бодит төлбөрийн эрх дараагийн шатанд хийгдэнэ.
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

- `users`: ID, нэр, имэйл, эрх (`user`/`admin`), санамсаргүй salt болон scrypt password hash.
- `sessions`: cookie token-ий SHA-256 hash, хэрэглэгч, 7 хоногийн дуусах хугацаа.
- `games`: нэр, тайлбар, үнэ, зураг, нийтлэх төлөв, идэвхтэй build бүхий каталог.
- `game_builds`: шалгагдсан build-ийн хувилбар, файл, хэмжээ, SHA-256, оруулсан админ болон огноо.
- `demo_orders`: хэрэглэгч бүрийн давхардахгүй туршилтын захиалга. **Төлөгдсөн эрхийн хүснэгт биш.**

## Файлууд

- `server/index.mjs`: сервер эхлүүлэх тохиргоо
- `server/app.mjs`: auth, API, static файл үйлчлэх
- `server/database.mjs`: schema migration, хадгалагддаг каталог
- `server/admin.mjs`: админ API, upload ба хайлт
- `server/build-import-worker.mjs`: ZIP шалгах worker
- `scripts/admin-user.mjs`: одоо байгаа бүртгэлд админ эрх олгох
- `dist/admin.html`, `dist/admin.js`, `dist/admin.css`: админ интерфэйс
- `server/catalog.mjs`: анхны каталогийн seed; ажиллаж байгаа үнийг админаас засна
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
| `ADMIN_GAME_PREVIEW` | Default `false`; админд build тоглож шалгах боломж нээнэ |
| `TRUST_PROXY_LOOPBACK` | Default `false`; loopback Caddy proxy-гийн дарж бичсэн `X-Real-IP`-г ашиглана |

Production үед demo-г `true` болговол сервер асахгүй. Production session cookie нь `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` prefix-тэй. Хөгжүүлэлтийн HTTP cookie мөн HttpOnly, SameSite=Strict. Нэвтрэлтээр session шинэчлэгдэж, гарахад хүчингүй болно. Өөрчлөлт хийдэг API нь яг зөв `Origin` шаарддаг. Auth/metadata нь JSON, upload нь raw binary body авна. Нууц үг браузерийн storage-д хадгалагдахгүй.

## Тоглоомын API

- `POST /api/games/:id/launch` — нэвтэрсэн, туршилтын сандаа нэмсэн, build импортлосон үед нэг удаагийн тоглох URL буцаана.
- `GET /api/games/:id/cover` — каталогийн нүүр зураг.
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

## Админ API

Бүх `/api/admin/*` API нь серверээс олгосон админ эрхтэй session шаарддаг.

| Method | Path | Зориулалт |
| --- | --- | --- |
| GET | `/api/admin/summary` | Тоглоом, хэрэглэгч, туршилтын захиалгын тоо |
| GET / POST | `/api/admin/games` | Бүх тоглоом харах / шинэ тоглоом үүсгэх |
| POST | `/api/admin/games/:id` | Мэдээлэл шинэчлэх; `revision` шаардлагатай |
| POST | `/api/admin/games/:id/cover` | Raw PNG/JPG/WebP upload |
| GET | `/api/admin/games/:id/builds` | Хувилбарын түүх |
| POST | `/api/admin/games/:id/builds?version=1.0` | Raw ZIP upload; нэг удаад нэг build |
| GET | `/api/admin/users?page=1&q=` | Хэрэглэгч хайх, 25 мөрөөр хуудаслах |
| GET | `/api/admin/orders?page=1&q=&gameId=` | Захиалга хайх, тоглоомоор шүүх |

## Шалгах

```powershell
npm.cmd run check
npm.cmd test
```

Админ эрх, хуучин database шилжүүлэх, каталог хадгалах, үнэ, draft, зураг/ZIP upload, эвдэрсэн шинэчлэлтийн хамгаалалт болон олон тоглоомын эрхийн тусгаарлалтыг мөн шалгана.

Тестүүд түр database ашигладаг; таны `data` хавтсыг өөрчлөхгүй. Бүртгэл, буруу нууц үг, хэрэглэгч хоорондын тусгаарлалт, session, logout, expiration, restart, давхардсан захиалга, үнэ өөрчлөх оролдлого, origin, rate limit, production тохиргоог шалгана.

## Дараагийн хөгжүүлэлт ба хязгаарлалт

- Бодит мөнгө, төлбөрийн provider, webhook/receipt баталгаажуулалт холбогдоогүй. Demo захиалга **төлбөртэй эрх үүсгэхгүй**. Оруулсан тоглоомуудын development preview тоглуулах нөхцөл болж ашиглагдана.
- Болзоо web build импорт болон development player холбогдсон. Админ каталог, зураг/build upload, хэрэглэгч/захиалгын жагсаалт холбогдсон. Cloud save болон Android/iOS апп хараахан холбогдоогүй.
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
