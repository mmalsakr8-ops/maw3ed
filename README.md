# Maw3ed | موعد

منصة حجز مطاعم على Cloudflare Workers + D1.

## الملفات
- worker.js
- schema.sql
- wrangler.json
- README.md

## قاعدة البيانات
- الاسم: maw3ed-db
- ID: 74a8e883-df12-40e7-98b1-a1f6246fb4fa
- Binding: DB

## المزايا
- تسجيل مطعم وتسجيل دخول.
- تجربة مجانية 14 يومًا.
- رابط عام مستقل لكل مطعم: `/r/<slug>`.
- بيانات المطعم والشعار والغلاف والعنوان والهاتف وواتساب ومواعيد العمل.
- إدارة الطاولات والسعة.
- صفحة حجز للعميل.
- منع الحجز إذا كانت صفحة المطعم منتهية.
- حالات الحجز: pending / confirmed / completed / cancelled / rejected.
- لوحة إدارة Super Admin لتجديد الاشتراك شهرًا أو سنة.
- اشتراك شهري افتراضي 500 جنيه وسنوي 5000 جنيه (القيمة قابلة للتعديل لاحقًا).

## النشر
1. ضع الملفات الأربعة في جذر مستودع `mmalsakr8-ops/maw3ed`.
2. احذف `wrangler.toml` القديم إن كان موجودًا.
3. تأكد أن `wrangler.json` هو ملف الإعداد الوحيد.
4. في Cloudflare Worker اجعل Deploy command: `npx wrangler deploy`.
5. Deploy.
6. اختبر `https://maw3ed.mmalsakr8.workers.dev/health`.
7. افتح `/register` وأنشئ حساب مطعم.
8. افتح `/dashboard`، أكمل بيانات المطعم وأضف الطاولات.
9. افتح رابط `/r/<slug>` وجرّب حجزًا.

## D1
الكود ينشئ الجداول تلقائيًا عند أول طلب، لذلك لا يلزم تشغيل `schema.sql` يدويًا لكي يبدأ الـWorker. ملف `schema.sql` موجود كمرجع وإعداد يدوي بديل.

## Super Admin
النسخة لا تنشئ حساب Super Admin بكلمة مرور ثابتة. بعد إنشاء أول حساب اختبار، يمكن تغيير دوره في D1 إلى `super_admin` من Console لأغراض الاختبار فقط:

```sql
UPDATE users SET role='super_admin' WHERE email='YOUR_EMAIL';
```

بعدها يمكن فتح `/dashboard` بنفس الحساب لإدارة التجديد.

## ملاحظات قبل الإنتاج
قبل الاستخدام التجاري الفعلي أضف rate limiting، CSRF protection، hashing قوي لكلمات المرور مثل PBKDF2/Argon2 عبر خدمة مناسبة، audit log، صلاحيات أدق، نظام دفع، وإرسال WhatsApp/SMS.
