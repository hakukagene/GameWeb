# STORYPLAY

Монгол хэл дээрх Ren’Py тоглоомын дэлгүүрийн интерфэйсийн туршилтын хувилбар.

## Ажиллуулах

Python суулгасан компьютер дээр repository-ийн хавтсаас:

```sh
python -m http.server 8000 --directory dist
```

Windows дээр `python` ажиллахгүй бол `py` ашиглана. Browser дээр http://localhost:8000 нээнэ.

## Файлууд

- `dist/index.html` — үндсэн хуудас
- `dist/style.css` — responsive загвар
- `dist/app.js` — каталог, хайлт, ангилал, дэлгэрэнгүй, туршилтын захиалга, миний сан
- `dist/*.jpg`, `dist/*.webp` — жишээ нүүр зургууд

## Одоогийн хязгаарлалт

Жишээ тоглоом, үнэ ашигласан. Бодит төлбөр, нэвтрэлт, database, Ren’Py runtime болон Android/iOS апп холбогдоогүй. Миний сан нь зөвхөн тухайн хуудсын санах ойд хадгалагдаж, refresh хийхэд арилна. Туршилтын захиалга мөнгө суутгахгүй.

GitHub-д код оруулсан нь website-ийн автомат deployment холболт үүсгэхгүй.

## Зургийн эх сурвалж

Зургууд нь жишээ контент, тоглоомын жинхэнэ assets биш.

- Train: https://unsplash.com/photos/a-train-traveling-down-train-tracks-at-night-TGNnKydr2lI
- City (AI illustration): https://src.fanchai.app/image-model/seedream-4-5/prompt-cyberpunk.webp
- Mountain (AI illustration): https://www.publicdomainpictures.net/en/view-image.php?image=694279&picture=misty-mountain-valley

Арилжааны хувилбарт өөрийн тоглоомын зөвшөөрөлтэй зургуудаар солино.
