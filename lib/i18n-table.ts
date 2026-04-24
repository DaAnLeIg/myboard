import type { AppLocale } from "./locale-config";
import { LOCALE_ORDER } from "./locale-config";

export type I18nVars = Readonly<Record<string, string | number>>;

type Row = Record<AppLocale, string>;
type Entry = [string, Row];

function inter(s: string, v: I18nVars) {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? String((v as Record<string, string | number>)[k]) : `{${k}}`));
}

const L = (ru: string, en: string, cs: string, esar: string, hu: string, de: string, hi: string, ar: string): Row => ({
  ru,
  en,
  cs,
  "es-AR": esar,
  hu,
  de,
  hi,
  ar,
});

/** All UI + privacy. Order: RU, EN, CS, ES-AR, HU, DE, HI, AR. */
const ENTRIES: Entry[] = [
  [
    "load.page",
    L("Загрузка", "Loading", "Načítání", "Cargando", "Betöltés", "Laden", "लोड हो रहा है", "جارٍ التحميل"),
  ],
  [
    "locale.title",
    L("Язык", "Language", "Jazyk", "Idioma", "Nyelv", "Sprache", "भाषा", "اللغة"),
  ],
  [
    "nav.myBoard",
    L("MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard"),
  ],
  [
    "nav.newDoc",
    L("Новая работа", "New work", "Nová práce", "Nueva obra", "Új munka", "Neue Arbeit", "नया काम", "عمل جديد"),
  ],
  [
    "nav.more",
    L(
      "Ещё: поделиться, политика, сохранить, скачать",
      "More: share, privacy, save, download",
      "Více: sdílet, soukromí, uložit, stáhnout",
      "Más: compartir, privacidad, guardar, descargar",
      "Több: megosztás, adatvédelem, mentés, letöltés",
      "Mehr: teilen, Datenschutz, speichern, herunterladen",
      "और: साझा, गोपनीयता, सहेजें, डाउनलोड",
      "المزيد: مشاركة وخصوصية وحفظ وتنزيل",
    ),
  ],
  [
    "nav.library",
    L("Библиотека работ", "Works library", "Knihovna prací", "Biblioteca de obras", "Munkák könyvtára", "Werkbibliothek", "कार्य पुस्तकालय", "مكتبة الأعمال"),
  ],
  [
    "nav.undo",
    L("Отменить (до 5 шагов)", "Undo (up to 5 steps)", "Zpět (až 5 kroků)", "Deshacer (hasta 5 pasos)", "Visszavonás (max. 5 lépés)", "Rückgängig (bis zu 5 Schritte)", "पूर्ववत (5 चरण)", "تراجع (حتى 5 خطوات)"),
  ],
  [
    "room.participantsTitle",
    L("Участники в комнате", "Users in the room", "Lidé v místnosti", "En la sala", "A szobában", "Im Raum", "कमरे में उपयोगकर्ता", "في الغرفة"),
  ],
  [
    "room.participantsAria",
    L("Пользователей в сети: {a} из {b}", "Users online: {a} of {b}", "Online: {a} z {b}", "En línea: {a} de {b}", "Online: {a} / {b}", "Online: {a} von {b}", "ऑनलाइन: {a} में से {b}", "متصلون: {a} من {b}"),
  ],
  [
    "pencil.aria",
    L("Карандаш", "Pencil", "Tužka", "Lápiz", "Ceruza", "Stift", "पेंसिल", "قلم"),
  ],
  [
    "pencil.groupWidth",
    L("Толщина карандаша", "Pencil width", "Tloušťka", "Grosor", "Vastagság", "Linienstärke", "कलम की मोटाई", "سُمك الخط"),
  ],
  [
    "pencil.width",
    L("Толщина {w} px", "Width {w} px", "Tloušťka {w} px", "Grosor {w} px", "Vastagság {w} px", "Breite {w} px", "मोटाई {w} px", "سُمك {w} بكسل"),
  ],
  [
    "pencil.widthLine",
    L("Толщина линии {w} px", "Line width {w} px", "Šířka {w} px", "Grosor de línea {w} px", "Vonalvastagság {w} px", "Linienbreite {w} px", "रेखा {w} px", "عرض الخط {w} بكسل"),
  ],
  [
    "pencil.colors",
    L("Цвет карандаша", "Pencil colors", "Barvy", "Colores", "Színek", "Farben", "रंग", "ألوان"),
  ],
  [
    "pencil.swatch",
    L("Карандаш, цвет {c}", "Pencil, {c} color", "Pastelka: {c}", "Lápiz, color {c}", "Toll: {c} szín", "Stift: Farbe {c}", "पेंसिल, रंग {c}", "قلم: لون {c}"),
  ],
  [
    "color.black",
    L("чёрный", "black", "černá", "negro", "fekete", "schwarz", "काला", "أسود"),
  ],
  [
    "color.white",
    L("белый", "white", "bílá", "blanco", "fehér", "weiß", "सफ़ेद", "أبيض"),
  ],
  [
    "color.yellow",
    L("жёлтый", "yellow", "žlutá", "amarillo", "sárga", "gelb", "पीला", "أصفر"),
  ],
  [
    "color.red",
    L("красный", "red", "červená", "rojo", "piros", "rot", "लाल", "أحمر"),
  ],
  [
    "color.blue",
    L("синий", "blue", "modrá", "azul", "kék", "blau", "नीला", "أزرق"),
  ],
  [
    "color.green",
    L("зелёный", "green", "zelená", "verde", "zöld", "grün", "हरा", "أخضر"),
  ],
  [
    "eraser.aria",
    L("Ластик", "Eraser", "Guma", "Borrador", "Radír", "Radierer", "रबड़", "ممحاة"),
  ],
  [
    "settings.brush",
    L("Настройки кисти", "Brush settings", "Nastavení štětce", "Ajustes del pincel", "Ecsetbeállítások", "Pinseleinstellungen", "ब्रश सेटिंग्स", "إعدادات الفرشاة"),
  ],
  [
    "settings.widthLabel",
    L("Толщина (слайдер)", "Width (slider)", "Tloušťka (slider)", "Grosor (control)", "Vastagság (csúszka)", "Dicke (Schieberegler)", "मोटाई (स्लाइडर)", "السُمك (منزلق)"),
  ],
  [
    "settings.colorLabel",
    L("Цвет (палитра)", "Color (picker)", "Barva", "Color", "Szín", "Farbe", "रंग", "اللون"),
  ],
  [
    "text.sizeGroup",
    L("Размер текста", "Text size", "Velikost textu", "Tamaño del texto", "Szövegméret", "Textgröße", "लेखन आकार", "حجم النص"),
  ],
  [
    "text.sizeN",
    L("Размер {n} px", "Size {n} px", "Velikost {n} px", "Tamaño {n} px", "Méret {n} px", "Größe {n} px", "आकार {n} पिक्स", "الحجم {n} بكسل"),
  ],
  [
    "text.allN",
    L("Весь текст {n} px", "All text {n} px", "Celý text {n} px", "Texto a {n} px", "Teljes szöveg {n} px", "Ganzer Text {n} px", "समस्त पाठ {n} px", "النص كاملًا {n} بكسل"),
  ],
  [
    "text.newBlock",
    L("Новый абзац", "New paragraph", "Nový odstavec", "Nuevo párrafo", "Új bekezdés", "Neuer Absatz", "नया पैराग्राफ", "فقرة جديدة"),
  ],
  [
    "text.addNew",
    L("Вставить новый текст", "Insert new text", "Vložit text", "Insertar texto", "Szöveg beszúrása", "Text einfügen", "नया टेक्स्ट", "إدراج نص جديد"),
  ],
  [
    "image.add",
    L("Вставить изображение", "Insert image", "Vložit obrázek", "Insertar imagen", "Kép beillesztése", "Bild einfügen", "छवि जोड़ें", "إدراج صورة"),
  ],
  [
    "image.removeMode",
    L("Удалить изображение", "Remove image", "Odstranit obrázek", "Quitar imagen", "Kép törlése", "Bild entfernen", "छवि हटाएँ", "إزالة صورة"),
  ],
  [
    "image.removeAria",
    L("Режим удаления изображений", "Image remove mode", "Mazací mód pro obrázky", "Modo: borrar imágenes", "Képtörlés mód", "Bild-Entfernungsmodus", "छवि मिटाएं मोड", "وضع حذف الصور"),
  ],
  [
    "myBoard.hint",
    L("MyBoard: клик — инверсия, долгий — режим для глаз", "MyBoard: click invert, long press night comfort", "MyBoard: klik inverzní, dlouze noční", "MyBoard: toque inversión, mantener confort", "MyBoard: kattintás invert, hosszú éj", "MyBoard: Tipp: invertieren, lang: Augen", "MyBoard: क्लिक उल्टा, दबाकर", "MyBoard: نقرة عكسي، مطولة راحة"),
  ],
  [
    "mobile.tools",
    L("Мобильные инструменты", "Mobile tools", "Mobilní nástroje", "Herramientas móviles", "Mobil eszközök", "Mobile Werkzeuge", "मोबाइल औज़ार", "أدوات للجوال"),
  ],
  [
    "mobile.undo",
    L("Отменить", "Undo", "Zpět", "Deshacer", "Vissza", "Rückgängig", "पूर्ववत", "تراجع"),
  ],
  [
    "mobile.fab.close",
    L("Свернуть инструменты", "Collapse tools", "Skrýt", "Cerrar herramientas", "Összecsuk", "Einklappen", "औज़ार बंद", "طي الأدوات"),
  ],
  [
    "mobile.fab.open",
    L("Открыть инструменты", "Open tools", "Otevřít nástroje", "Abrir", "Eszközök", "Werkzeuge öffnen", "औज़ार खोलें", "فتح الأدوات"),
  ],
  [
    "mobile.fab.pinned",
    L("Панель закреплена", "Panel pinned", "Připnuto", "Panel fijado", "Rögzítve", "Gepinnt", "पैनल पिन", "مثبّت"),
  ],
  [
    "header.aria",
    L("Панель навигации и инструментов", "Navigation and tools", "Navigace a nástroje", "Navegación y herramientas", "Navigáció és eszközök", "Leiste: Navigation", "पट्ट: नेविगेशन", "شريط أدوات"),
  ],
  [
    "header.mainToolbar",
    L("Инструменты", "Tools", "Nástroje", "Herramientas", "Eszközök", "Werkzeuge", "औज़ार", "الأدوات"),
  ],
  [
    "nav.ariaMore",
    L("Дополнительные действия", "More actions", "Další akce", "Más acciones", "További műveletek", "Weitere Aktionen", "और क्रियाएँ", "إجراءات أخرى"),
  ],
  [
    "action.share",
    L("Поделиться", "Share", "Sdílet", "Compartir", "Megosztás", "Teilen", "साझा", "مشاركة"),
  ],
  [
    "action.privacy",
    L("Политика конфиденциальности", "Privacy policy", "Zásady ochrany soukromí", "Política de privacidad", "Adatvédelmi irányelvek", "Datenschutz", "गोपनीयता", "الخصوصية"),
  ],
  [
    "action.save",
    L("Сохранить в базу", "Save to cloud", "Uložit", "Guardar", "Mentés felhőbe", "In Cloud speichern", "क्लाउड में", "الحفظ"),
  ],
  [
    "action.saveHint",
    L("Сохранить в базу: задать название", "Save to cloud: set title", "Uložit: zadejte název", "Guardar: poner título", "Cím megadása", "Speichern: Titel", "नाम", "عنوان"),
  ],
  [
    "form.workName",
    L("Название работы", "Work title", "Název práce", "Título", "Munka címe", "Titel", "काम का नाम", "عنوان العمل"),
  ],
  [
    "form.confirm",
    L("Сохранить", "Save", "Uložit", "Guardar", "Mentés", "Speichern", "सहेजें", "حفظ"),
  ],
  [
    "form.confirmSave",
    L("Подтвердить сохранение", "Confirm save", "Potvrdit", "Confirmar", "Jóváhagyás", "Bestätigen", "पुष्टि", "تأكيد الحفظ"),
  ],
  [
    "export.aria",
    L("Скачать документ", "Download document", "Stáhnout", "Descargar", "Letöltés", "Herunterladen", "डाउनलोड", "تنزيل"),
  ],
  [
    "export.png",
    L("Скачать PNG", "Download PNG", "Stáhnout PNG", "Descargar PNG", "PNG", "PNG laden", "PNG", "تنزيل PNG"),
  ],
  [
    "export.jpg",
    L("Скачать JPG", "Download JPG", "Stáhnout JPG", "Descargar JPG", "JPG", "JPG laden", "JPG", "تنزيل JPG"),
  ],
  [
    "export.pdf",
    L("Скачать PDF", "Download PDF", "Stáhnout PDF", "Descargar PDF", "PDF", "PDF laden", "PDF", "تنزيل PDF"),
  ],
  [
    "dialog.close",
    L("Закрыть", "Close", "Zavřít", "Cerrar", "Bezárás", "Schließen", "बंद", "إغلاق"),
  ],
  [
    "dialog.closeBg",
    L("Закрыть окно", "Close", "Zavřít", "Cerrar ventana", "Ablak bezárása", "Fenster schließen", "विंडो", "إغلاق النافذة"),
  ],
  [
    "share.title",
    L("Поделиться", "Share", "Sdílet", "Compartir", "Megosztás", "Teilen", "साझा", "مشاركة"),
  ],
  [
    "share.body",
    L("Скопируйте номер комнаты и ссылку для коллег.", "Copy the room id and link for your colleagues.", "Zkopírujte číslo místnosti a odkaz.", "Copiá el número y el enlace.", "Másold a szobaazonosítót.", "Kopiere Raum-ID und Link.", "कमरा और लिंक", "انسخ رقم الغرفة والرابط"),
  ],
  [
    "share.roomLabel",
    L("Номер комнаты", "Room id", "Číslo místnosti", "Sala", "Szoba", "Raum", "कमरा", "رقم الغرفة"),
  ],
  [
    "share.copyRoom",
    L("Копировать номер", "Copy id", "Kopírovat", "Copiar", "Másolás", "Kopieren", "कॉपि", "نسخ الرقم"),
  ],
  [
    "share.inviteLabel",
    L("Ссылка-приглашение", "Invite link", "Odkaz", "Enlace", "Meghívó link", "Einladung", "आमंत्रण", "رابط دعوة"),
  ],
  [
    "share.copyLink",
    L("Копировать ссылку", "Copy link", "Kopírovat odkaz", "Copiar enlace", "Link", "Link kopieren", "लिंक", "نسخ الرابط"),
  ],
  [
    "share.roomFull",
    L("Комната заполнена (макс. {max} участников).", "The room is full (max. {max} people).", "Místnost je plná (max. {max}).", "Sala llena (máx. {max}).", "Tele van (max. {max} fő).", "Voll (max. {max}).", "कमरा भरा (अधि. {max})", "الغرفة ممتلئة (بحد {max} أشخاص)"),
  ],
  [
    "share.native",
    L("Системный «Поделиться»", "System share", "Systémové sdílení", "Compartir del sistema", "Rendszer megosztás", "System-Teilen", "सिस्टम शेयर", "مشاركة النظام"),
  ],
  [
    "share.done",
    L("Готово", "Done", "Hotovo", "Listo", "Kész", "Fertig", "ठीक", "تم"),
  ],
  [
    "share.joinText",
    L("Присоединяйся в MyBoard! {url}", "Join me on MyBoard! {url}", "Přidej se na MyBoard! {url}", "Únete a MyBoard: {url}", "MyBoard: {url}", "MyBoard: {url}", "MyBoard पर {url}", "انضم إلى MyBoard! {url}"),
  ],
  [
    "library.title",
    L("Библиотека", "Library", "Knihovna", "Biblioteca", "Könyvtár", "Bibliothek", "पुस्तकालय", "المكتبة"),
  ],
  [
    "library.sub",
    L("Сохранённые работы", "Saved works", "Uložené", "Obras", "Mentett munkák", "Gespeichert", "सहेजे", "الأعمال المحفوظة"),
  ],
  [
    "library.loadList",
    L("Загрузка списка", "Loading list", "Načítání seznamu", "Cargando", "Betöltés", "Laden", "सूची लोड", "جارٍ التحميل"),
  ],
  [
    "library.loadErr",
    L("Ошибка", "Error", "Chyba", "Error", "Hiba", "Fehler", "त्रुटि", "خطأ"),
  ],
  [
    "library.loadErrDef",
    L("Ошибка загрузки", "Load error", "Chyba", "Error de carga", "Hiba", "Fehler", "लोड", "فشل التحميل"),
  ],
  [
    "library.empty",
    L("Пока нет работ.", "No works yet.", "Zatím nic.", "Aún no hay obras.", "Még nincs.", "Noch keine.", "कुछ नहीं", "لا توجد أعمال حتى الآن."),
  ],
  [
    "library.preview",
    L("Превью", "Preview", "Náhled", "Vista previa", "Előnézet", "Vorschau", "झलक", "معاينة"),
  ],
  [
    "library.noPreview",
    L("Нет превью", "No preview", "Bez náhledu", "Sin vista", "Nincs", "Keine", "झलक नहीं", "بلا معاينة"),
  ],
  [
    "library.unnamed",
    L("Без названия", "Untitled", "Bez názvu", "Sin título", "Névtelen", "Ohne Titel", "अनाम", "بلا عنوان"),
  ],
  [
    "library.open",
    L("Открыть на холсте", "Open on board", "Otevřít", "Abrir en el lienzo", "Megnyitás", "Öffnen", "खोलें", "فتح"),
  ],
  [
    "library.openAria",
    L("Открыть «{name}»", "Open “{name}”", "Otevřít „{name}“", "Abrir “{name}”", "„{name}” megnyit", "Öffne „{name}“", "“{name}” खोलें", "فتح «{name}»"),
  ],
  [
    "library.share",
    L("Поделиться ссылкой", "Copy link", "Odkaz", "Compartir", "Link", "Teilen", "लिंक", "رابط"),
  ],
  [
    "library.shareAria",
    L("Ссылка на «{name}»", "Share “{name}”", "Sdílet {name}", "“{name}”", "„{name}”", "„{name}“", "“{name}”", "“{name}”"),
  ],
  [
    "library.delete",
    L("Удалить", "Delete", "Smazat", "Eliminar", "Törlés", "Löschen", "मिटाएँ", "حذف"),
  ],
  [
    "library.deleteAria",
    L("Удалить «{name}»", "Delete “{name}”", "Smazat {name}", "Borrar “{name}”", "„{name}” töröl", "„{name}“", "“{name}” हटाएँ", "حذف «{name}»"),
  ],
  [
    "library.closeBg",
    L("Закрыть (фон)", "Close (backdrop)", "Zavřít (pozadí)", "Cerrar (fondo)", "Bezárás (háttér)", "Schließen (Hintergrund)", "पृष्ठभूमि", "إغلاق (الخلفية)"),
  ],
  [
    "library.refresh",
    L("Обновить", "Refresh", "Obnovit", "Actualizar", "Frissít", "Aktualisieren", "रीफ्रेश", "تحديث"),
  ],
  [
    "library.refreshAria",
    L("Обновить список", "Refresh list", "Obnovit seznam", "Refrescar", "Frissítés", "Aktualisieren", "सूची", "تحديث القائمة"),
  ],
  [
    "library.deleteConfirm",
    L("Удалить «{name}»? Нельзя отменить.", "Delete “{name}”? This cannot be undone.", "Smazat „{name}“? Nelze vrátit.", "¿Borrar “{name}”? No se deshace.", "„{name}” törli? Végleges.", "„{name}“ löschen?", "“{name}” हटाएँ? वापस नहीं.", "حذف «{name}»? لا رجوع."),
  ],
  [
    "lib.shareWork",
    L("Ссылка на работу", "Link to your work", "Odkaz na práci", "Enlace a la obra", "Munka hivatkozás", "Link zum Werk", "काम लिंक", "رابط العمل"),
  ],
  [
    "lib.shareSystemTitle",
    L("MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard", "MyBoard"),
  ],
  [
    "lib.promptLink",
    L("Скопируйте ссылку", "Copy the link", "Kopie odkaz", "Copiar enlace", "Link vágólapra", "Link kopieren", "लिंक", "نسخ"),
  ],
  // Privacy
  [
    "priv.title",
    L("Политика конфиденциальности", "Privacy policy", "Zásady ochrany soukromí", "Política de privacidad", "Adatvédelmi tájékoztató", "Datenschutzhinweise", "गोपनीयता", "سياسة الخصوصية"),
  ],
  [
    "priv.appLine",
    L("MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)", "MyBoard (myboard.vercel.app)"),
  ],
  [
    "priv.back",
    L("← К доске", "← Back to board", "← Zpět na desku", "← Volver al tablero", "← Táblára", "← Zum Board", "← बोर्ड", "← عودة للوحة"),
  ],
  [
    "priv.1h",
    L("1. Общие положения", "1. General", "1. Úvod", "1. General", "1. Általános", "1. Allgemeines", "1. सामान्य", "1. أحكام عامة"),
  ],
  [
    "priv.1p",
    L(
      "Документ описывает обработку данных при использовании MyBoard (myboard.vercel.app). Пользуясь сервисом, вы соглашаетесь с настоящей политикой.",
      "This document describes data handling for MyBoard (myboard.vercel.app). By using the service, you accept this policy.",
      "Tento dokument popisuje zpracování dat u MyBoard. Použitím služby souhlasíte s těmito zásadami.",
      "Describe cómo trata la información el servicio MyBoard. Al usarlo, acepta esta política.",
      "A MyBoard (myboard.vercel.app) adatkezelését ismerteti. A használat a szabályzat elfogadását jelenti.",
      "Beschreibt die Datenverarbeitung von MyBoard. Die Nutzung setzt Ihre Zustimmung voraus.",
      "MyBoard (myboard.vercel.app) के लिए। उपयोग से सहमति।",
      "يصف التعامل مع بيانات MyBoard. الاستخدام يعني موافقتك.",
    ),
  ],
  [
    "priv.2h",
    L("2. Персональные данные", "2. Personal data", "2. Osobní údaje", "2. Datos", "2. Adatok", "2. Personenbezogene Daten", "2. निजी डेटा", "2. البيانات الشخصية"),
  ],
  [
    "priv.2p",
    L(
      "MyBoard не продаёт и не сдаёт в аренду персональные данные и не использует их для стороннего маркетинга или аналитики, если это прямо не требуется для работы сервиса.",
      "MyBoard does not sell or rent personal data, and it does not use it for third‑party marketing or analytics unless that is strictly required to provide the service.",
      "MyBoard neprodává a nepronajímá osobní údaje třetím stranám a nepoužívá je pro marketing, pokud to není pro službu nutné.",
      "MyBoard no vende ni alquila datos personales ni los usa con fines de comercio o analítica de terceros, salvo lo mínimo para operar el servicio.",
      "A MyBoard nem értékesíti a személyes adatokat, és marketingre nem adja, kivéve, ami a működéshez kell.",
      "MyBoard verkauft und vermietet keine personenbezogenen Daten; Marketing von Drittanbietern erfolgt nicht, außer was für den Dienst nötig ist.",
      "MyBoard व्यक्तिगत डाटा नहीं बेचता, जब तक कि सेवा के लिए अनिवार्य न हो।",
      "لا يبيع MyBoard البيانات ولا يؤجرها ولا يستخدم تسويقًا لجهات أخرى إلّا حسب ما تقتضيه الخدمة.",
    ),
  ],
  [
    "priv.3h",
    L("3. Техническая работа", "3. Technical operation", "3. Provoz", "3. Funcionamiento", "3. Műszaki", "3. Technischer Betrieb", "3. तकनीकी", "3. التشغيل التقني"),
  ],
  [
    "priv.3p",
    L(
      "Могут использоваться стандартные механизмы браузера, HTTPS и облачный хостинг в объёме, достаточном для работы приложения (сохранение, совместный доступ, загрузка изображений).",
      "Standard browser mechanisms, HTTPS, and cloud hosting may be used as needed to run the app (saving, collaboration, image upload).",
      "Pro běh aplikace můžete používat běžné prohlížečové mechanismy, HTTPS a hosting (ukládání, spolupráce, obrázky).",
      "Pueden usarse funciones del navegador, HTTPS e infraestructura en la nube según haga falta (guardar, colaborar, imágenes).",
      "A működéshez a böngésző, a HTTPS és a tárhely szabályos használatra kerül (mentés, kollaboráció, képek).",
      "Dazu zählen Browser, HTTPS und Hosting, soweit nötig (Speichern, Zusammenarbeit, Bild-Uploads).",
      "ऐप (सहेज, साझा, तस्वीर) के लिए ब्राउज़र, HTTPS, क्लाउड — आवश्यक सीमा।",
      "لتشغيل التطبيق قد يُستخدم متصفحك واتصال HTTPS واستضافة — بحسب الحاجة للحفظ والتعاون والصور.",
    ),
  ],
  [
    "priv.4h",
    L("4. Файлы cookie", "4. Cookies", "4. Soubory cookie", "4. Cookies", "4. Cookie-k", "4. Cookies", "4. कुकी", "4. ملفات تعريف الارتباط"),
  ],
  [
    "priv.4p",
    L(
      "Сервис не применяет кросс-сайтовое отслеживание рекламы. Могут существовать технические cookies / хранение в браузере, необходимое платформой.",
      "The service does not use cross-site ad tracking. Technical storage or browser cookies required by the platform may still exist.",
      "Aplikace nespouští reklamní sledování. Technické ukládání může vyžadovat platforma.",
      "No hay rastreo publicitario entre sitios. La plataforma puede usar almacenamiento técnico.",
      "Kereszthelyi hirdetéskövetés nincs. Technikai tárolás előfordulhat.",
      "Es findet kein seitenübergreifendes Anzeigen‑Tracking statt. Technische Speicherung kann die Plattform vorsehen.",
      "क्रॉस-साइट विज्ञापन नहीं। तकनीकी स्टोरेज संभव।",
      "لا تتتبع الإعلانات بين المواقع. قد يتطلّب النظام تخزينًا فنيًا.",
    ),
  ],
  [
    "priv.5h",
    L("5. Изменения", "5. Changes", "5. Změny", "5. Cambios", "5. Módosítás", "5. Änderungen", "5. बदलाव", "5. تغييرات"),
  ],
  [
    "priv.5p",
    L(
      "Политика может обновляться. Актуальная версия доступна на странице /privacy.",
      "This policy may be updated. The current version is always on /privacy.",
      "Můžeme pravidlo aktualizovat. Text je na /privacy.",
      "Podemos actualizar. La versión vigente está en /privacy.",
      "A szabályzat módosulhat. A /privacy oldalon érhető el.",
      "Aktuell: /privacy.",
      "नीति /privacy पर।",
      "تُحدَّث السياسة. النسخة على /privacy.",
    ),
  ],
  [
    "priv.6h",
    L("6. Контакты", "6. Contact", "6. Kontakty", "6. Contacto", "6. Elérhetőség", "6. Kontakt", "6. संपर्क", "6. اتصال"),
  ],
  [
    "priv.6p",
    L(
      "По вопросам к политике обратитесь к владельцу проекта через репозиторий или магазин приложений.",
      "For questions about this policy, contact the project owner via the repository or app store listing.",
      "Dotazy směřujte k vlastníkovi projektu dle repozitáře nebo karty aplikace.",
      "Preguntas: contacta al responsable vía repositorio o ficha de la app.",
      "Kérdés: a készítő, repo vagy app‑bolt.",
      "Kontakt über Repository oder App‑Store.",
      "प्रतिनिधि रिपो या ऐप सूची।",
      "للاستفسار تواصل عبر المستودع أو متجر التطبيقات.",
    ),
  ],
];

const built: { byLocale: Record<AppLocale, Record<string, string>> } = (() => {
  const byLocale = {} as Record<AppLocale, Record<string, string>>;
  for (const l of LOCALE_ORDER) {
    byLocale[l] = {};
  }
  for (const [k, row] of ENTRIES) {
    for (const l of LOCALE_ORDER) {
      byLocale[l]![k] = row[l];
    }
  }
  return { byLocale };
})();

function fallbackOrder(loc: AppLocale): AppLocale[] {
  if (loc === "ru") {
    return ["ru", "en"];
  }
  if (loc === "en") {
    return ["en", "ru"];
  }
  return [loc, "en", "ru"];
}

function resolveString(loc: AppLocale, key: string): string {
  for (const f of fallbackOrder(loc)) {
    const s = built.byLocale[f]![key];
    if (s) {
      return s;
    }
  }
  return key;
}

export function tImpl(loc: AppLocale, key: string, v?: I18nVars) {
  const raw = resolveString(loc, key);
  return v ? inter(raw, v) : raw;
}

export { built as I18N_BUILT };
