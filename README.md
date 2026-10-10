# 🚀 Nexus Panel — High-Performance Xray Proxy Control Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Language-Go%201.24-00ADD8?style=for-the-badge&logo=go&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-Tailwind%20%2B%20Alpine.js-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Core-Xray--core-2A2F35?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Database-Embedded%20SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

---

## 🌟 نبذة عن المشروع (About Nexus Panel)

**Nexus Panel** هي لوحة تحكم سحابية صناعية فائقة السرعة وخفيفة جداً لإدارة خادم البروكسي الشهير **Xray-core** على سيرفرات الـ VPS. صُممت اللوحة بتصميم داكن فاخر (**Industrial Dark Mode**) مع واجهة زجاجية مستوحاة من أفضل تصاميم الشبكات الاحترافية، وتعتمد على باينري أحادي مكتوب بلغة **Go** ومدمج معه واجهة الويب بالكامل داخل الـ Binary (`Embedded Web Assets`) ليعمل بأقل استهلاك ممكن للذاكرة والـ CPU وبدون الحاجة لـ Node.js أو Nginx.

---

## ✨ المميزات الرئيسية (Core Features)

### 1. إدارة احترافية للمنافذ والـ Inbounds
* **دعم كافة البروتوكولات الحديثة:** VLESS, VMess, Trojan, Shadowsocks 2022.
* **أنظمة النقل المتقدمة (Transport Streams):** TCP, WebSocket, HTTPUpgrade, gRPC, XHTTP.
* **الأمان العالي:** دعم كامل لـ **VLESS REALITY** مع توليد تلقائي للـ Keys و ShortID، بالإضافة إلى TLS 1.3 المتقدم مع شهادات ACME/Let's Encrypt أو شهادات مخصصة.
* **حماية تضارب المنافذ في الوقت الفعلي (Real-Time Port Conflict Guard):**
  * فحص ذكي للمنافذ والـ IP و Layer 4 Transport (TCP vs UDP).
  * تنبيه فوري باللون الأحمر داخل الفورم عند إدخال منفذ مشغول لمنع أي توقف أو أخطاء تشغيل للـ Kernel.
  * زر حفظ تفاعلي يتحول إلى `"Port Occupied"` ويمنع الحفظ الخاطئ.

### 2. جدول عملاء بقوة 3X-UI وأفضل (Industrial Clients Management)
* **إحصائيات حية بالبطاقات العلوية:** Clients, Online, Ended, Depleting, Disabled, Active.
* **فلاتر وبحث فوري:** تصفية فورية بالبريد الإلكتروني، UUID، أو الحالة.
* **ترتيب متقدم:** الترتيب حسب الأقدم، الأحدث، أعلى استهلاك، أو الرصيد المتبقي.
* **عدادات حقيقية لحجم الاستهلاك:** مراقبة دقيقة للـ Upload و Download والتنبيه عند اقتراب انتهاء الجيجابايت مع مؤشر استهلاك شريطي ملون.
* **توليد روابط واشتراكات و QR Code:** استخراج روابط الاتصال وتوليد QR Code فوري للمسح من تطبيقات الهاتف (v2rayNG, Streisand, Shadowrocket, Sing-box).

### 3. تكامل مباشر وتحديثات من لوحة التحكم (Direct VPS Upgrades)
* **تحديث Xray-core:** جلب أحدث إصدار رسمي مباشرة من مستودع `XTLS/Xray-core` مع زر ترقية فوري دون الحاجة لدخول SSH.
* **تحديث لوحة Nexus:** فحص وإشعار بالتحديثات من مستودع اللوحة [`ADEL-MAHMOUD10/Nexus-panel`](https://github.com/ADEL-MAHMOUD10/Nexus-panel).
* **معلومات النظام الحي:** مراقبة استهلاك المعالج (CPU)، الذاكرة (RAM)، الترافيك الصادر والوارد (Bandwidth Traffic Graphs)، والـ Uptime.

### 4. واجهة خالية تماماً من نوافذ المتصفح الافتراضية
* تم استبدال جميع استدعاءات `alert()` و `confirm()` بنافذة مخصصة **Custom Glassmorphic Dark Modal** مع تلوين ديناميكي للأخطار (Red للعمليات الحساسة و Cyan لعمليات التحديث).

---

## 🖥️ متطلبات التشغيل (System Requirements)

* **أنظمة التشغيل المدعومة:** Ubuntu 20.04+, Debian 11+, CentOS 8+, AlmaLinux, RockyLinux.
* **المعمارية (Architecture):** `amd64` (x86_64) أو `arm64` (aarch64).
* **الموارد الأدنى:** 512MB RAM و 1 vCPU (اللوحة تستهلك أقل من 30MB RAM فقط في حالة الخمول).

---

## ⚡ التثبيت السريع على الـ VPS (1-Click Install)

قم بتسجيل الدخول إلى سيرفر الـ VPS الخاص بك كـ **root** ثم نفّذ الأمر التالي:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/ADEL-MAHMOUD10/Nexus-panel/main/install.sh)
```

> **ملاحظة:** سيقوم السكربت تلقائياً بتثبيت أحدث نسخة من `Xray-core`، وبناء خدمة `Systemd`، وضبط كل شيء ليعمل تلقائياً عند إعادة تشغيل السيرفر.

### بيانات الدخول الافتراضية:
* **رابط اللوحة:** `http://YOUR_SERVER_IP:8443`
* **اسم المستخدم (Username):** `admin`
* **كلمة المرور (Password):** `admin`

---

## 🛠️ سطر أوامر الإدارة (Terminal CLI Tool)

يأتي مع اللوحة سكربت إدارة طرفي تفاعلي. يمكنك كتابة هذا الأمر في أي وقت داخل الـ Terminal:

```bash
nexus
```

تفتح لك قائمة تفاعلية غنية تتضمن الخيارات التالية:
```text
  [1]  Start Nexus Panel         (بدء تشغيل اللوحة)
  [2]  Stop Nexus Panel          (إيقاف اللوحة)
  [3]  Restart Nexus Panel       (إعادة تشغيل اللوحة)
  [4]  Panel Status              (عرض حالة الخدمة)
  [5]  View Live Logs            (مشاهدة سجلات السيرفر المباشرة)
  [6]  Change Panel Port         (تغيير بورت الدخول)
  [7]  Reset Admin Credentials   (إعادة تعيين اسم المستخدم وكلمة السر)
  [8]  Update/Install SSL Cert   (استخراج شهادة SSL مجانية عبر ACME)
  [9]  Check & Upgrade Panel     (تحديث اللوحة لأحدث إصدار)
  [10] Check & Upgrade Xray-core (تحديث نواة Xray)
  [11] Uninstall Nexus Panel     (إلغاء التثبيت وحذف الملفات)
```

---

## 🏗️ البناء اليدوي من المصدر (Build from Source)

إذا كنت ترغب في تشغيل أو بناء اللوحة بنفسك من الكود المصدري:

### المتطلبات:
* تثبيت **Go 1.24+**
* تثبيت `git`

### خطوات البناء:

1. **استنساخ المستودع:**
   ```bash
   git clone https://github.com/ADEL-MAHMOUD10/Nexus-panel.git
   cd Nexus-panel
   ```

2. **تنزيل حزم Go وتجميع الباينري:**
   * **على نظام Linux:**
     ```bash
     CGO_ENABLED=0 go build -ldflags="-s -w" -o nexus ./cmd/server
     ```
   * **على نظام Windows:**
     ```powershell
     go build -v -o nexus_server.exe ./cmd/server
     ```

3. **التشغيل المباشر:**
   ```bash
   ./nexus
   ```
   أو على Windows:
   ```powershell
   .\nexus_server.exe
   ```

---

## 📂 هيكلة المشروع (Project Structure)

```text
nexus/
├── cmd/
│   └── server/          # نقطة انطلاق التطبيق وإدارة أوامر الـ CLI (main.go)
├── internal/
│   ├── api/             # مسارات الـ REST API والمصادقة وإدارة الحسابات
│   ├── crypto/          # توليد مفاتيح REALITY والتشفير
│   ├── database/        # قاعدة بيانات SQLite المدمجة وفحص تضارب المنافذ
│   ├── subscription/    # توليد روابط vless:// وروابط الاشتراكات
│   └── xray/            # متحكم Xray عبر gRPC وتوليد config.json ومراقبة الترافيك
├── web/                 # ملفات الواجهة المدمجة (TailwindCSS, Alpine.js, QRCode)
├── scripts/
│   └── nexus.sh         # أداة التحكم السريعة عبر الـ Terminal
├── install.sh           # سكربت التثبيت السحابي بنقرة واحدة
└── go.mod
```

---

## 🛡️ أمان السيرفر والجدار الناري (Firewall Setup)

تأكد من فتح المنافذ التالية على جدار الحماية (UFW أو Security Groups):
```bash
# منفذ لوحة التحكم (الافتراضي: 8443)
ufw allow 8443/tcp

# منافذ البروكسي العامة (مثل 443 و 80)
ufw allow 443/tcp
ufw allow 443/udp
ufw allow 80/tcp

# تفعيل الجدار الناري
ufw enable
```

---

## 📄 الترخيص (License)

هذا المشروع مرخص تحت رخصة **MIT**. يمكنك استخدامه، تعديله، وتطويره بحرية.
جميع الحقوق محفوظة للمطور [ADEL-MAHMOUD10](https://github.com/ADEL-MAHMOUD10).
