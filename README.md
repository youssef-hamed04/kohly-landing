# كحلي / Kohly

صفحة تسويقية ثابتة بالعربية والإنجليزية، دون بناء أو اعتماديات محلية. افتح المجلد بأي خادم ملفات ثابتة (مثل `npx serve .` إذا كان متاحًا)، ثم افتح `/` للعربية و`/en/` للإنجليزية. لا يلزم تشغيل npm أو تثبيت حزم للمشروع؛ يمكن أيضًا استخدام `python -m http.server 8000`.

Static Arabic and English landing pages, with no build step or local dependencies. Preview with any static server, for example `python -m http.server 8000` or `npx serve .` if available. Visit `/` for Arabic and `/en/` for English.

## التعديل والنشر / Edit and publish

الموقع منشور على GitHub Pages مجانًا، ولا يعتمد على أي اشتراك آخر:

- العربية: https://youssef-hamed04.github.io/kohly-landing/
- English: https://youssef-hamed04.github.io/kohly-landing/en/
- الكود / Code: https://github.com/youssef-hamed04/kohly-landing

1. عدّل الملفات بأي محرر (مثل VS Code).
2. للمعاينة، شغّل `python -m http.server 8000` داخل المجلد وافتح `http://localhost:8000`. فتح `index.html` مباشرة بالنقر المزدوج لن يشغّل الجافاسكريبت، لأن المتصفح يمنع ملفات `type="module"` من `file://`.
3. للنشر، نفّذ من داخل المجلد:

   ```sh
   git add -A
   git commit -m "وصف التعديل"
   git push
   ```

   أي push إلى فرع `main` ينشر الموقع تلقائيًا خلال دقيقة أو اثنتين. أول مرة سيطلب Git تسجيل الدخول إلى GitHub.

إذا ضاع المجلد، يمكن تنزيل نسخة جديدة بالأمر `git clone https://github.com/youssef-hamed04/kohly-landing.git`.

The site is hosted on GitHub Pages and does not depend on any other subscription. Edit the files, preview with a local server (module scripts do not run from `file://`), then commit and `git push` to `main`. Pages redeploys within a minute or two. If this folder is lost, clone the repository again.

- **الاسم / Brand:** ابحث عن `كحلي` و`Kohly` في `index.html` و`en/index.html`، بما فيها بيانات الرأس. Replace these plain-text names in both pages, including metadata.
- **التواصل / Contact:** غيّر `hello@example.com` ورقم الهاتف ورابط `wa.me` والمكان وروابط التواصل الاجتماعي في الصفحتين. Update the contact details, social URLs, and form `data-mailto` in both pages.
- **الفريق / Team:** استبدل `اسم العضو` و`Member name` في قسم `#team`. توجد تعليقات لاستبدال الرموز بصور حقيقية. Replace the member names; photo replacement comments specify dimensions and alternative text.
- **الأعمال / Work:** عدّل البلاطات في `#work` في الصفحتين؛ أضف الصور الحقيقية وبيانات المشاريع مكان العناصر النائبة. Replace the project placeholders and categories in both pages; image comments include dimensions, alt text and lazy loading.
- **النموذج / Form:** ضع رابط الخدمة في `data-endpoint` وفي `action` في الصفحتين لدعم الإرسال مع JavaScript وبدونه. يقبل المسار طلب POST من FormData ويعيد حالة HTTP ناجحة. عند ترك الرابط فارغًا، يفتح JavaScript تطبيق البريد برسالة جاهزة؛ دون JavaScript يرسل النموذج إلى الصفحة الحالية، لذا يلزم إعداد endpoint لاستقبال الطلبات فعليًا. Set both `data-endpoint` and `action` to a POST endpoint for enhanced and native submission. With an empty endpoint, JavaScript prepares a mailto draft. Without JavaScript, the default form posts to the current page; configure an endpoint to actually receive submissions. Localized status text lives in `assets/js/main.js`.
- **Three.js:** الإصدار `0.187.0` مثبت في import map داخل رأس كل صفحة. غيّره في الصفحتين معًا. The pinned Three.js version is in each page's import map. Scene geometry and motion live in `assets/js/hero3d.js`; only core Three.js is used. An SVG remains available when loading or WebGL fails, or data saving is enabled.
- **التصميم / Styling:** الألوان والخطوط في `:root` داخل `assets/css/styles.css`. Color and font tokens are shared by both directions. Reduced-motion preferences disable 3D motion. The only additional conditional third-party script is the requested Popover polyfill for browsers lacking native support; fonts come from Google Fonts.

3D geometry note: the four brand swatches retain their specified size and spacing, but start at x = -0.18 instead of 0.05 so their final edge stays inside the required x = 1.8 content boundary.

التحقق / Syntax checks:

```sh
node --check assets/js/main.js
node --check assets/js/hero3d.js
```
