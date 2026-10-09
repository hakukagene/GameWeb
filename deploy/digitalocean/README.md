# DigitalOcean Droplet дээр байрлуулах

Одоогийн Node.js + SQLite бүтцийг ашиглана. Docker Compose нь app болон Caddy HTTPS proxy-г асаана. Database, нүүр зураг, build, HTTPS сертификат `/srv/storyplay/` дотор хадгалагдана. Код шинэчлэх, container дахин үүсгэх, Droplet reboot хийхэд эдгээр хавтсыг устгахгүй. Droplet өөрөө устах/эвдрэх эрсдэлээс хамгаалахын тулд нөөцийг тусдаа байрлалд хуулна.

Энэ нь байрлуулахад зориулсан тохиргоо. Файл repository-д байгаагаар сервер автоматаар үүсэхгүй.

## Сервер ба хаяг

- Санал болгох эхний багц: Basic / Regular, 1 vCPU, 2 GiB RAM, 50 GiB SSD ($12/сар суурь үнэ, 2026-10-09-нд шалгасан). ZIP задлах болон HTTPS proxy-д нөөцтэй эхэлнэ; ачааллын баталгаа биш.
- Ubuntu 24.04 LTS, Singapore бүсийг эхний сонголт болгоно. Бодит үнэ/боломжийг үүсгэх дэлгэц дээр шалгана; татвар, нэмэлт үйлчилгээ тусдаа байж болно.
- SSH key ашиглана. DigitalOcean Cloud Firewall: SSH 22 зөвхөн өөрийн IP-ээс, TCP 80/443 нийтэд; 8000/8001 нийтэд нээхгүй. Өөр үйлчилгээ ажилладаг Droplet бол портуудыг эхлээд шалгана.
- Нэг бүртгэлтэй домэйны хоёр hostname хэрэгтэй: жишээ нь `example.com`, `games.example.com`. Эсвэл `shop.example.com`, `games.example.com`. Хоёуланд нь Droplet-ийн IPv4 рүү DNS A record тохируулна. AAAA record байвал зөв IPv6 рүү чиглэх ёстой.
- Эхний байршуулалтад Cloudflare ашиглавал DNS only тохируулна. Caddy нь HTTPS сертификат авч шинэчилнэ. SSL-д DNS ба 80/443 хандалт шаардлагатай.

## 1. Docker болон код

Docker Engine, Compose plugin-ийг [Docker-ийн Ubuntu заавраар](https://docs.docker.com/engine/install/ubuntu/) суулгана. Node.js-ийг host дээр тусад нь суулгахгүй; image дотор Node 24 байна.

```bash
sudo apt-get update
sudo apt-get install -y git
sudo git clone https://github.com/hakukagene/GameWeb.git /opt/GameWeb
cd /opt/GameWeb
sudo bash deploy/digitalocean/prepare.sh
```

Эхний `prepare.sh` нь тохиргооны жишээ үүсгээд зогсоно. Дараа нь:

```bash
sudo nano deploy/digitalocean/.env
```

```dotenv
SITE_HOST=example.com
GAME_HOST=games.example.com
```

Өөрийн hostname-уудаар солино. `https://` болон төгсгөлийн `/` оруулахгүй. Эдгээр нь нууц үг биш. `.env` GitHub-д орохгүй.

```bash
sudo bash deploy/digitalocean/prepare.sh
cd deploy/digitalocean
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs --tail=80 app proxy
```

`/api/health` нь database уншигдаж байгааг шалгана. Host network нь Linux Droplet-д зориулагдсан. Node зөвхөн loopback дээр сонсоно; Caddy л нийтэд хандана. App нь root биш UID 1000-аар ажиллана. `TRUST_PROXY_LOOPBACK=true`-г зөвхөн энэ Caddy тохиргоотой хэрэглэнэ: proxy нь `X-Real-IP`-г бодит клиент IP-ээр дарж бичдэг. Нэмэлт proxy/CDN оруулах бол IP итгэмжлэх тохиргоог дахин хянана.

## 2. Админ болон тоглоом

1. HTTPS сайтаа нээгээд өөрийн имэйлээр бүртгүүлнэ.
2. Сервер дээр, `/opt/GameWeb/deploy/digitalocean` хавтсаас:

```bash
sudo docker compose exec app node scripts/admin-user.mjs "YOUR_EMAIL"
```

3. `/admin` → Болзоо → Удирдах, эсвэл Шинэ тоглоом. Нүүр зураг, Ren'Py web ZIP оруулна. **ZIP GitHub-аас автоматаар ирэхгүй.**
4. Нэр/тайлбар/үнийг хадгалж, дэлгүүр дээр шинэчлэгдсэнийг шалгана.
5. Web build хэсгийн **Тоглож шалгах** товчоор админ тоглоомоо нээнэ. Энэ нь шинэ тоглох хаяг руу шилжинэ; буцах товчоор админд буцна.

Production-д `DEMO_PURCHASES=false`, `ADMIN_GAME_PREVIEW=true`. Зөвхөн админ тоглоом нээж чадна; жирийн хэрэглэгчийн хуучин demo захиалга тоглох эрх болохгүй. Бодит төлбөр болон худалдан авсан хэрэглэгчийн эрх дараагийн шатанд хийгдэнэ. Save нь браузерт хадгалагдана, cloud save хараахан биш.

Орон нутгийн database/бүх файлыг шилжүүлэх бол эхлээд эх серверийг зогсоож `data` ба `game-content` хавтсыг хамтад нь нөөцөлнө. Шинэ серверийн app-ийг зогсоож, `/srv/storyplay/data`, `/srv/storyplay/game-content` руу хуулна. Шинэ серверт аль хэдийн хэрэглэгч/өгөгдөл үүссэн бол шууд дарж бичихгүй; шилжүүлэх төлөвлөгөө тусад нь гаргана. Хуулсан файлын эзэмшигч UID/GID 1000 байх ёстой.

## 3. Нөөцлөх ба шинэчлэх

```bash
cd /opt/GameWeb
sudo bash deploy/digitalocean/backup.sh
```

Нөөцлөх үед app түр зогсоно. Database, WAL/SHM болон тоглоомын файлууд нэг архивт орно; дуусахад app дахин асна. Архив `/srv/storyplay/backups/` дотор зөвхөн root унших эрхтэй. Энэ скрипт хуучин нөөцийг устгахгүй, өөр сервер рүү илгээхгүй. Нөөцийг өөр төхөөрөмж/тусдаа storage-д хувийн байдлаар хуулж, сул дискээ хянана. Архив бүрт хэрэглэгчийн хувийн мэдээлэл орно; public repository-д оруулахгүй.

Шинэчлэхийн өмнө ZIP upload дууссаныг шалгаад:

```bash
cd /opt/GameWeb
sudo bash deploy/digitalocean/backup.sh
sudo git pull --ff-only origin main
cd deploy/digitalocean
sudo docker compose up -d --build
```

Нөөц сэргээх үед эхлээд app-ийг зогсооно. Одоогийн `data`, `game-content` хавтсыг өөр нэрээр хадгалж, баталгаажуулсан архивыг `/srv/storyplay` руу задална. Эзэмшигч UID/GID 1000-г сэргээгээд app-ийг асаана. Өөрийн серверийн нөөцөөс өөр архивыг root эрхээр задлахгүй.

## Байршуулалтын шалгалт

- Өөр төхөөрөмжөөс HTTPS дэлгүүр, бүртгэл, нэвтрэлт ажиллана.
- Админ эрхгүй хэрэглэгч `/api/admin/*` болон тоглоомын файлыг авах боломжгүй.
- Нүүр зураг, ZIP оруулаад тоглож шалгана.
- `sudo docker compose restart app` дараа хэрэглэгч, мэдээлэл, зураг, build хэвээр байна. Тоглох хуудсыг дахин нээнэ: preview ticket нь санах ойд хадгалагддаг.
- `sudo docker compose up -d --build --force-recreate` дараа өгөгдөл хэвээр байна.
- Нөөцөөс тусдаа түр хавтас руу сэргээж файлууд болон database бүтэн эсэхийг шалгана.

Үнэ: [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets). Сервер үүсгэх: [албан ёсны заавар](https://docs.digitalocean.com/products/droplets/how-to/create/).
