# Збереження рекламної атрибуції Shopify

`themate-tracking.js` зберігає рекламні UTM, click ID та доступні cookie-ідентифікатори в `localStorage` під ключем `themate_tracking`, який читає форма оформлення The Mate.

Щоб підключити в Shopify:

1. У Shopify Admin відкрий **Online Store → Themes → Edit code**.
2. Додай `shopify-theme-snippets/themate-tracking.js` у папку **Assets** саме під назвою `themate-tracking.js`.
3. Додай в `layout/theme.liquid` вміст `theme-include.liquid` безпосередньо перед `</head>`.
4. Збережи тему.

Не вставляй код у вміст сторінки **Pages → Оформлення**: він там відобразиться текстом і не запуститься.
