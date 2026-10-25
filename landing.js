/**
 * Harsh Apex Retail POS — Landing Page Interactive Engine
 * Bilingual (Sinhala / English), Tab Switchers, Mockups, FAQ, Animations
 */

(function () {
  'use strict';

  // If opened as an installed PWA on home screen, or explicit ?app=1, launch the POS app directly
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true || 
      new URLSearchParams(window.location.search).get('app') === '1') {
    if (!window.location.pathname.includes('app.html')) {
      window.location.replace('app.html');
      return;
    }
  }

  // --- Bilingual Dictionary ---
  const i18n = {
    si: {
      // Navbar
      nav_features: 'විශේෂාංග',
      nav_install: 'ස්ථාපනය කරන අයුරු',
      nav_screens: 'තිර දර්ශන',
      nav_pricing: 'මිල ගණන්',
      nav_faq: 'ප්‍රශ්නෝත්තර',
      nav_launch: 'POS විවෘත කරන්න',
      
      // Hero
      hero_badge: '✨ ශ්‍රී ලාංකික සිල්ලර වෙළඳසැල් සඳහාම නිර්මාණය වූ Offline Retail POS',
      hero_title_1: 'අන්තර්ජාලය නැතත්',
      hero_title_2: 'තත්පරයෙන් බිල්පත් සහ තොග කළමනාකරණය',
      hero_desc: 'ශ්‍රී ලංකාවේ සිල්ලර වෙළඳසැල්, සුපිරි වෙළඳසැල් සහ ෆාමසි සඳහාම නිපදවූ 100% Offline POS පද්ධතිය. කිසිදු Cloud ප්‍රමාදයක් නැති, දුරකථන කැමරාවෙන් Barcode ස්කෑන් කළ හැකි, 58mm/80mm Thermal Printer සහාය ඇති නවීනතම මෘදුකාංගය.',
      hero_cta_primary: 'POS එක විවෘත කරන්න',
      hero_cta_secondary: 'ස්ථාපනය කරන අයුරු (Android / iPhone)',
      trust_offline: '100% Offline වැඩ',
      trust_lag: '0ms Cloud ප්‍රමාදය',
      trust_trial: 'දින 7ක නොමිලේ පරිශීලනය',
      trust_printer: 'Bluetooth Thermal මුද්‍රණය',
      
      // Mockup Badges
      mockup_badge_offline: '100% Offline ක්‍රියාකාරීයි',
      mockup_badge_lag: '0ms ප්‍රතිචාර වේගය',
      mockup_badge_printer: 'Thermal Print: 58mm Ready',
      mockup_cart_title: 'වත්මන් බිල්පත (භාණ්ඩ 3)',
      mockup_cart_btn: '🖨️ බිල මුද්‍රණය (Rs. 1,420)',

      // Trust Stats
      stat_1_num: '100%',
      stat_1_label: 'Offline ක්‍රියාකාරීත්වය',
      stat_1_sub: 'Internet හෝ WiFi අවශ්‍ය නැත',
      stat_2_num: '0ms',
      stat_2_label: 'ප්‍රතිචාර වේගය',
      stat_2_sub: 'Zero cloud latency හෝ lag',
      stat_3_num: 'දින 7ක්',
      stat_3_label: 'නොමිලේ අත්හදා බැලීම',
      stat_3_sub: 'සියලුම පහසුකම් සහිතව',
      stat_4_num: '58 & 80',
      stat_4_label: 'Thermal මුද්‍රණය (mm)',
      stat_4_sub: 'Bluetooth & USB Printer සහාය',
      stat_5_num: '24/7',
      stat_5_label: 'WhatsApp සහය',
      stat_5_sub: 'ක්ෂණික සක්‍රිය කිරීම්',

      // Bento Features
      features_tag: 'ප්‍රමුඛ පෙළේ විශේෂාංග',
      features_title: 'ඔබේ සිල්ලර ව්‍යාපාරය දියුණු කරන නවීන මෙවලම්',
      features_desc: 'සාම්ප්‍රදායික මිල අධික POS මැෂින් වෙනුවට ඔබේ ස්මාර්ට් දුරකථනයෙන්ම හෝ පරිගණකයෙන්ම සියල්ල පාලනය කරන්න.',
      
      bento_1_title: '100% Offline බිල්පත් නිකුත් කිරීම',
      bento_1_desc: 'අන්තර්ජාලය හෝ විදුලිය විසන්ධි වුවත් ඔබේ කඩයේ විකුණුම් නතර නොවේ. සියලුම බිල්පත් සහ ගනුදෙනු දත්ත ඔබේ දුරකථනය තුළම අකුරටම සුරක්ෂිත වේ.',
      
      bento_2_title: 'දුරකථනයේ කැමරාවෙන්ම Barcode ස්කෑනරය',
      bento_2_desc: 'මිල අධික Barcode Scanner මැෂින් මිලදී ගැනීමට අවශ්‍ය නැත. දුරකථනයේ කැමරාවෙන්ම ක්ෂණිකව Barcode ස්කෑන් කර බඩු බිල් කරන්න.',
      
      bento_3_title: 'ස්මාර්ට් තොග (Stock) කළමනාකරණය',
      bento_3_desc: 'බඩු විකිණෙන විට තොග ප්‍රමාණය ස්වයංක්‍රීයව අඩුවේ. බඩු අවසන් වීමට පෙර Low Stock Alerts මගින් ඔබට කල්තියා මතක් කර දෙයි.',
      
      bento_4_title: 'දවසේ ආදායම සහ ශුද්ධ ලාභ (Profit) වාර්තා',
      bento_4_desc: 'අද දවසේ මුළු විකුණුම්, අත්පිට ලාභය, නිකුත් කළ බිල්පත් ගණන සහ වැඩිපුරම අලෙවි වූ භාණ්ඩ පිළිබඳ නිවැරදි ගණනය කිරීම් ක්ෂණිකව ලබාගන්න.',
      
      bento_5_title: 'පාරිභෝගික ණය පොත (Credit Ledger)',
      bento_5_desc: 'ණයට බඩු ගන්නා ගනුදෙනුකරුවන්ගේ ණය මුදල්, ආපසු ගෙවීම් සහ හිඟ මුදල් නිවැරදිව සටහන් කරගන්න. ණය පියවීම් ලෙජරය 100% ක්ෂණිකයි.',
      
      bento_6_title: '58mm & 80mm Thermal Receipt මුද්‍රණය',
      bento_6_desc: 'වෙළඳපොලේ ඇති ඕනෑම Mini Bluetooth හෝ USB 58mm/80mm Thermal Printer එකකින් ඔබේ කඩයේ නම සහිත අලංකාර බිල්පත් මුද්‍රණය කරන්න.',
      
      bento_7_title: 'තනි ක්ලික් එකෙන් Data Backup & Restore',
      bento_7_desc: 'ඔබේ වෙළඳසැලේ සියලුම තොරතුරු එක ක්ලික් එකකින් ඔබගේ දුරකථනයට සුරක්ෂිතව Download කර තබාගත හැක. නව දුරකථනයකට මාරුවීම විනාඩියෙන්.',

      // How to Install
      install_tag: 'ස්ථාපනය කරන අයුරු',
      install_title: 'විනාඩියකින් ඔබේ දුරකථනයට Install කරගන්න',
      install_desc: 'Google Play Store හෝ Apple App Store එකට යාමට අවශ්‍ය නැත. පහත සරල පියවර අනුගමනය කරන්න.',
      tab_android: '🤖 Android (Chrome)',
      tab_ios: '🍏 iPhone / iPad (Safari)',
      tab_pc: '💻 Windows PC / Mac',

      // Android Steps
      android_s1_t: '1. Chrome මගින් විවෘත කරන්න',
      android_s1_d: 'ඔබගේ Android දුරකථනයේ Google Chrome මගින් POS වෙබ් අඩවිය විවෘත කරන්න.',
      android_s2_t: '2. මෙනුව (⋮) ඔබන්න',
      android_s2_d: 'තිරයේ ඉහළ දකුණු කෙළවරේ ඇති තිත් 3 (Menu) අයිකනය ඔබන්න.',
      android_s3_t: '3. "Install App" තෝරන්න',
      android_s3_d: 'මෙනුවේ ඇති "Install app" හෝ "Add to Home screen" මත ක්ලික් කරන්න.',
      android_s4_t: '4. ස්ථාපනය සම්පූර්ණයි!',
      android_s4_d: 'Apex POS ඇප් අයිකනය ඔබගේ දුරකථන මුල් තිරයේ දර්ශනය වේ. දැන් ඕනෑම වෙලාවක විවෘත කළ හැක.',

      // iOS Steps
      ios_s1_t: '1. Safari මගින් විවෘත කරන්න',
      ios_s1_d: 'ඔබගේ iPhone හෝ iPad එකෙහි Safari බ්‍රවුසරය මගින් ලින්ක් එක විවෘත කරන්න.',
      ios_s2_t: '2. Share (□↑) ඔබන්න',
      ios_s2_d: 'තිරයේ පහළ ඇති Share අයිකනය (කොටුව සහ උඩ ඊතලය) ඔබන්න.',
      ios_s3_t: '3. "Add to Home Screen" ඔබන්න',
      ios_s3_d: 'පහළට Scroll කර "+" ලකුණ සහිත "Add to Home Screen" තෝරන්න.',
      ios_s4_t: '4. "Add" ඔබන්න',
      ios_s4_d: 'ඉහළ දකුණේ ඇති "Add" ඔබන්න. දැන් එය Native App එකක් මෙන් ක්‍රියා කරයි.',

      // PC Steps
      pc_s1_t: '1. Chrome හෝ Edge විවෘත කරන්න',
      pc_s1_d: 'ඔබේ පරිගණකයේ Google Chrome හෝ MS Edge මගින් පිවිසෙන්න.',
      pc_s2_t: '2. Address Bar එක බලන්න',
      pc_s2_d: 'ලිපින තීරුවේ (URL bar) දකුණු පස ඇති Install අයිකනය ක්ලික් කරන්න.',
      pc_s3_t: '3. "Install" ක්ලික් කරන්න',
      pc_s3_d: 'මතුවන තහවුරු කිරීමේ බොත්තම (Install) ක්ලික් කරන්න.',
      pc_s4_t: '4. Desktop Shortcut ලැබේ',
      pc_s4_d: 'ඩෙස්ක්ටොප් එක මත Apex POS ලාංඡනය ලැබේ. USB Printer සමගද සුපිරියට වැඩ කරයි.',

      // Showcase
      screens_tag: 'සජීවී තිර දර්ශන',
      screens_title: 'භාවිතය ඉතාම සරල, නවීන අතුරුමුහුණත',
      screens_desc: 'කිසිදු සංකීර්ණත්වයක් නැත. ඕනෑම අයෙකුට විනාඩි 2කින් වැඩ පුරුදු විය හැකි සුපැහැදිලි සිංහල/ඉංග්‍රීසි UI නිර්මාණය.',
      screen_tab_pos: '🛒 බිල්පත් නිකුත් කිරීම (POS)',
      screen_tab_stock: '📦 භාණ්ඩ හා තොග (Products)',
      screen_tab_reports: '📊 දෛනික ලාභ වාර්තා (Reports)',
      screen_tab_credit: '📒 පාරිභෝගික ණය පොත (Credit)',
      screen_tab_settings: '⚙️ සැකසුම් & මුද්‍රණ යන්ත්‍ර (Settings)',

      // Pricing
      pricing_tag: 'මිල ගණන් & සක්‍රිය කිරීම්',
      pricing_title: 'ශ්‍රී ලාංකික ව්‍යාපාර සඳහාම ගැළපෙන සාධාරණ පැකේජ',
      pricing_desc: 'කිසිදු සැඟවුණු ගාස්තුවක් නැත. දින 7ක් නොමිලේ අත්හදා බලා කැමති නම් පමණක් සක්‍රිය කරගන්න.',
      
      plan_1_name: 'නොමිලේ අත්හදා බැලීම',
      plan_1_desc: 'දින 7ක් සියලුම විශේෂාංග නොමිලේ පරිශීලනය කර බලන්න.',
      plan_1_price: '0',
      plan_1_period: '/ දින 7ක් නොමිලේ',
      plan_1_btn: 'දැන්ම පටන් ගන්න (නොමිලේ)',

      plan_2_name: 'ව්‍යාපාරික Pro බලපත්‍රය',
      plan_2_badge: 'වඩාත් ජනප්‍රියයි',
      plan_2_desc: 'සිල්ලර කඩ, සුපිරි වෙළඳසැල් සහ කුඩා ව්‍යාපාර සඳහා පූර්ණ බලපත්‍රය.',
      plan_2_price: '2,500',
      plan_2_period: '/ මාසිකව',
      plan_2_btn: 'WhatsApp මගින් ලබාගන්න',

      plan_3_name: 'වාර්ෂික සුපිරි පැකේජය',
      plan_3_desc: 'මාස 2ක් නොමිලේ ලැබෙන, මුළු අවුරුද්දටම එකවර ගෙවන පැකේජය.',
      plan_3_price: '24,000',
      plan_3_period: '/ වාර්ෂිකව (මාස 2ක් නොමිලේ)',
      plan_3_btn: 'වාර්ෂික පැකේජය ලබාගන්න',

      // FAQ
      faq_tag: 'බොහෝ දෙනෙක් අසන ප්‍රශ්න',
      faq_title: 'ඔබට දැනගැනීමට අවශ්‍ය සියල්ල',
      faq_desc: 'Apex POS පිළිබඳව නිතර අසන ප්‍රශ්න සහ ඊට පැහැදිලි පිළිතුරු.',
      
      faq_q1: 'අන්තර්ජාලය (Internet) නොමැතිව POS එක ඇත්තටම ක්‍රියාකරනවාද?',
      faq_a1: 'ඔව්, සම්පූර්ණයෙන්ම! Apex POS ක්‍රියාකරන්නේ ඔබගේ දුරකථනයේ හෝ පරිගණකයේ ඇති Local Database එකෙනි. ඒ නිසා Internet හෝ WiFi නැති වුවද බිල්පත් නිකුත් කිරීම, Barcode ස්කෑන් කිරීම, තොග අඩු වීම සහ ණය පොත සාමාන්‍ය පරිදි ක්‍රියාකරයි.',

      faq_q2: 'දුරකථනය නැතිවුණොත් හෝ අලුත් එකක් ගත්තොත් මගේ දත්ත ආරක්ෂිතද?',
      faq_a2: 'ඔබට සැකසුම් (Settings) මෙනුවට ගොස් එක ක්ලික් එකකින් මුළු වෙළඳසැලේ දත්ත Backup ෆයිල් එකක් (JSON) දුරකථනයට හෝ Google Drive එකට Save කරගත හැක. අලුත් දුරකථනයකදී Restore Backup ක්ලික් කර එම ෆයිල් එක ලබාදුන් විට සියලුම දත්ත නැවත ලැබේ.',

      faq_q3: 'කුමන ආකාරයේ Thermal Receipt Printer භාවිතා කළ හැකිද?',
      faq_a3: 'වෙළඳපොලේ ඇති ඕනෑම Standard 58mm සහ 80mm Bluetooth Thermal Mini Printer හෝ USB POS Printer එකක් භාවිතා කළ හැක. Android සහ Windows පරිගණක වලට මෙය ඉතාම පහසුවෙන් සම්බන්ධ වේ.',

      faq_q4: 'Barcode Scanner යන්ත්‍රයක් වෙනම මිලදී ගත යුතුද?',
      faq_a4: 'අවශ්‍ය නැත! ඔබගේ දුරකථනයේ හෝ ටැබ්ලට් එකෙහි කැමරාවෙන්ම Barcode ස්කෑන් කිරීමේ විශේෂාංගය මෙහි අන්තර්ගතය. කැමති නම් සාමාන්‍ය USB / Wireless Barcode Scanner එකක් වුවද පරිගණකයට හෝ OTG හරහා දුරකථනයට සම්බන්ධ කර භාවිතා කළ හැක.',

      faq_q5: 'දින 7 නොමිලේ අත්හදා බැලීමෙන් පසු සක්‍රිය කරන්නේ කෙසේද?',
      faq_a5: 'ඔබේ යෙදුමේ Settings පිටුවේ ඇති "Device ID" එක පිටපත් කර අපගේ WhatsApp අංකයට (+94 77 000 0000) එවන්න. ගෙවීම් තහවුරු කළ පසු ක්ෂණිකව ඔබගේ Device ID එකට අදාළ 30-Day හෝ 365-Day Activation Key එකක් අපි ඔබට ලබාදෙන්නෙමු.',

      faq_q6: 'මෙය පරිගණක (Laptop/Desktop) වලත් භාවිත කළ හැකිද?',
      faq_a6: 'ඔව්! Google Chrome හෝ Edge බ්‍රවුසරය හරහා ලැප්ටොප් හෝ ඩෙස්ක්ටොප් පරිගණකයකින් විවෘත කර Address bar එකෙන් "Install" කරගත හැක. එවිට desktop app එකක් ලෙස ක්‍රියා කරයි.',

      // Final CTA
      cta_banner_title: 'ඔබේ වෙළඳසැල අදම නවීන තාක්ෂණයෙන් සන්නද්ධ කරන්න',
      cta_banner_desc: 'මසකට රු. 2,500ක් වැනි සුළු මුදලකට සම්පූර්ණ Offline POS පද්ධතියක් ඔබේ සාක්කුවටම. කිසිදු මුදලක් නොගෙවා අදම දින 7ක නොමිලේ අත්හදා බලන්න.',
      cta_launch_btn: '🚀 POS එක දැන්ම විවෘත කරන්න',
      cta_whatsapp_btn: '💬 WhatsApp මගින් සම්බන්ධ වන්න',

      // Footer
      footer_about: 'ශ්‍රී ලාංකික සිල්ලර ව්‍යාපාර බලගන්වන නවීන තාක්ෂණික මෘදුකාංග විසඳුම්.',
      footer_copy: '© 2026 Harsh Apex Digital Solutions. සියලුම හිමිකම් ඇවිරිණි. ශ්‍රී ලාංකික ව්‍යාපාර වෙනුවෙන්ම ආදරයෙන් නිපදවන ලදී.',
      wa_fab_title: 'සහාය අවශ්‍යද? WhatsApp පණිවිඩයක් එවන්න'
    },

    en: {
      // Navbar
      nav_features: 'Features',
      nav_install: 'How to Install',
      nav_screens: 'Screens',
      nav_pricing: 'Pricing',
      nav_faq: 'FAQ',
      nav_launch: 'Launch POS',

      // Hero
      hero_badge: '✨ Next-Gen Offline Retail POS for Sri Lankan Businesses',
      hero_title_1: 'Run Your Store 100% Offline',
      hero_title_2: 'Lightning-Fast Billing & Inventory',
      hero_desc: 'Built specifically for Sri Lankan retail shops, supermarkets, and pharmacies. Complete zero-lag offline POS with camera barcode scanning, customer credit ledger, and instant thermal receipt printing.',
      hero_cta_primary: 'Download & Launch POS',
      hero_cta_secondary: 'Installation Guide (Android / iPhone)',
      trust_offline: '100% Offline Ready',
      trust_lag: '0ms Cloud Latency',
      trust_trial: '7-Day Free Trial',
      trust_printer: 'Bluetooth Thermal Print',

      // Mockup Badges
      mockup_badge_offline: '100% Offline Active',
      mockup_badge_lag: '0ms Response Speed',
      mockup_badge_printer: 'Thermal Print: 58mm Ready',
      mockup_cart_title: 'Active Bill (3 Items)',
      mockup_cart_btn: '🖨️ Print Receipt (Rs. 1,420)',

      // Trust Stats
      stat_1_num: '100%',
      stat_1_label: 'Offline Ready',
      stat_1_sub: 'Zero internet or WiFi dependency',
      stat_2_num: '0ms',
      stat_2_label: 'Response Speed',
      stat_2_sub: 'Zero cloud latency or lag',
      stat_3_num: '7 Days',
      stat_3_label: 'Free Trial',
      stat_3_sub: 'Full access to all features',
      stat_4_num: '58 & 80',
      stat_4_label: 'Thermal Receipt (mm)',
      stat_4_sub: 'Bluetooth & USB printer support',
      stat_5_num: '24/7',
      stat_5_label: 'WhatsApp Support',
      stat_5_sub: 'Instant license activation',

      // Bento Features
      features_tag: 'Core Capabilities',
      features_title: 'Engineered for Modern Retail Velocity',
      features_desc: 'Say goodbye to expensive legacy hardware. Run your entire retail operation straight from your smartphone, tablet, or PC.',

      bento_1_title: '100% Offline Retail Billing',
      bento_1_desc: 'Keep selling even during internet dropouts or power cuts. All customer transactions, item lists, and bills stay safely stored right on your device.',

      bento_2_title: 'Built-in Camera Barcode Scanner',
      bento_2_desc: 'Scan manufacturer barcodes and QR codes instantly using your phone camera. No bulky external handheld scanner required.',

      bento_3_title: 'Real-Time Inventory & Stock Alerts',
      bento_3_desc: 'Automated stock deduction on checkout. Receive low-stock warning banners before popular products run out of inventory.',

      bento_4_title: 'Daily Profit & Sales Analytics',
      bento_4_desc: 'Track daily gross revenue, true net profit margin, invoice count, and top 5 best-selling products at a single glance.',

      bento_5_title: 'Customer Credit Ledger (ණය පොත)',
      bento_5_desc: 'Record customer debts, partial payments, and overdue balances with exact timestamps. Never lose track of pending retail credit.',

      bento_6_title: '58mm & 80mm Thermal Receipt Printing',
      bento_6_desc: 'Print professional custom receipts with your shop name, telephone, and invoice number using any portable Bluetooth thermal printer.',

      bento_7_title: '1-Click Encrypted Backup & Restore',
      bento_7_desc: 'Export your entire store database into a single encrypted backup file. Transfer seamlessly to a new phone in under 60 seconds.',

      // How to Install
      install_tag: 'Fast Installation',
      install_title: 'Install on Your Device in 60 Seconds',
      install_desc: 'No Play Store or App Store sign-in required. Follow these frictionless browser steps to install as a native PWA.',
      tab_android: '🤖 Android (Chrome)',
      tab_ios: '🍏 iPhone / iPad (Safari)',
      tab_pc: '💻 Windows PC / Mac',

      // Android Steps
      android_s1_t: '1. Open Chrome',
      android_s1_d: 'Launch Google Chrome on your Android smartphone and open the POS web link.',
      android_s2_t: '2. Tap Menu (⋮)',
      android_s2_d: 'Tap the three vertical dots located at the top-right corner of Chrome.',
      android_s3_t: '3. Tap "Install App"',
      android_s3_d: 'Select "Install app" or "Add to Home screen" from the Chrome dropdown menu.',
      android_s4_t: '4. Instant App Launch',
      android_s4_d: 'Apex POS icon appears on your home screen. Tap to launch full screen anytime!',

      // iOS Steps
      ios_s1_t: '1. Open Safari',
      ios_s1_d: 'Open the POS URL on your iPhone or iPad using Apple Safari.',
      ios_s2_t: '2. Tap Share (□↑)',
      ios_s2_d: 'Tap the Share icon (square with upward arrow) in the bottom navigation bar.',
      ios_s3_t: '3. "Add to Home Screen"',
      ios_s3_d: 'Scroll down the share sheet and tap the "+" icon labeled "Add to Home Screen".',
      ios_s4_t: '4. Tap "Add"',
      ios_s4_d: 'Tap "Add" at the top right. Apex POS will launch as a standalone iOS app.',

      // PC Steps
      pc_s1_t: '1. Open Chrome / Edge',
      pc_s1_d: 'Open the URL in Google Chrome or Microsoft Edge on your computer.',
      pc_s2_t: '2. Address Bar Icon',
      pc_s2_d: 'Look for the "Install" computer icon on the right side of the URL bar.',
      pc_s3_t: '3. Click Install',
      pc_s3_d: 'Confirm by clicking "Install" on the browser popup dialog.',
      pc_s4_t: '4. Desktop Ready',
      pc_s4_d: 'Access Apex POS directly from your Windows desktop or Start menu with USB printer support.',

      // Showcase
      screens_tag: 'Live Screen Gallery',
      screens_title: 'Designed for High-Speed Counter Operations',
      screens_desc: 'Clean, intuitive, and distraction-free UI. Any cashier or staff member can master it in less than 5 minutes.',
      screen_tab_pos: '🛒 Billing & POS Terminal',
      screen_tab_stock: '📦 Product & Inventory',
      screen_tab_reports: '📊 Reports & Daily Profit',
      screen_tab_credit: '📒 Customer Credit Ledger',
      screen_tab_settings: '⚙️ Settings & Thermal Printer',

      // Pricing
      pricing_tag: 'Simple & Transparent',
      pricing_title: 'Founder-Friendly Pricing for Sri Lankan Retailers',
      pricing_desc: 'No hidden fees or unexpected cloud charges. Enjoy a full 7-day free trial before activating.',

      plan_1_name: '7-Day Free Trial',
      plan_1_desc: 'Full access to every feature for 7 days. Test in your store with zero risk.',
      plan_1_price: '0',
      plan_1_period: '/ 7 Days Free',
      plan_1_btn: 'Start Free Trial Now',

      plan_2_name: 'Business Pro License',
      plan_2_badge: 'MOST POPULAR',
      plan_2_desc: 'Everything required for retail grocery shops, supermarkets, and pharmacies.',
      plan_2_price: '2,500',
      plan_2_period: '/ Month',
      plan_2_btn: 'Activate on WhatsApp',

      plan_3_name: 'Annual Super Saver',
      plan_3_desc: 'Save Rs. 6,000 with our 1-year license (get 2 months completely free).',
      plan_3_price: '24,000',
      plan_3_period: '/ Year (2 Months Free)',
      plan_3_btn: 'Get Annual Deal on WhatsApp',

      // FAQ
      faq_tag: 'Frequently Asked Questions',
      faq_title: 'Got Questions? We Have Answers',
      faq_desc: 'Everything you need to know about Harsh Apex Retail POS.',

      faq_q1: 'Does it genuinely operate without an internet connection?',
      faq_a1: 'Yes, 100%! Apex POS is a Progressive Web App (PWA) with local IndexedDB storage. It runs completely offline on your device without needing mobile data or WiFi.',

      faq_q2: 'What happens to my data if I change or lose my phone?',
      faq_a2: 'You can export a secure 1-click encrypted database backup from Settings anytime. When you get a new device, simply click "Restore Backup" and your entire shop history is restored in seconds.',

      faq_q3: 'What kind of receipt printers can I connect?',
      faq_a3: 'Any standard 58mm or 80mm Bluetooth thermal printer or desktop USB receipt printer is supported. ESC/POS compatible thermal printers work seamlessly.',

      faq_q4: 'Do I need to buy a separate barcode scanner gun?',
      faq_a4: 'No! Apex POS has a built-in barcode scanner that uses your phone camera. If you already have a USB or wireless barcode scanner, you can also plug it into your computer or phone via OTG.',

      faq_q5: 'How do I activate the monthly license after the free trial?',
      faq_a5: 'Copy the unique Device ID displayed in your POS Settings and send it to our WhatsApp helpline (+94 77 000 0000). Once payment is confirmed, we issue your cryptographically signed activation key instantly.',

      faq_q6: 'Can I use this on a laptop or desktop computer?',
      faq_a6: 'Absolutely! Open the web link in Chrome or Edge on Windows or Mac, click "Install" in the address bar, and use it as a desktop application with full keyboard and thermal printer support.',

      // Final CTA
      cta_banner_title: 'Ready to Upgrade Your Retail Store Today?',
      cta_banner_desc: 'Join forward-thinking Sri Lankan retail merchants. Experience zero-lag offline billing, automated stock alerts, and thermal printing today.',
      cta_launch_btn: '🚀 Launch Apex POS Now',
      cta_whatsapp_btn: '💬 Chat on WhatsApp',

      // Footer
      footer_about: 'Cutting-edge retail technology solutions for Sri Lankan businesses.',
      footer_copy: '© 2026 Harsh Apex Digital Solutions. All Rights Reserved. Crafted with pride for Sri Lankan Retailers.',
      wa_fab_title: 'Need Assistance? Chat on WhatsApp'
    }
  };

  // State Management
  let currentLang = localStorage.getItem('apex_pos_lang') || 'si';

  // Smart App Launch URL
  function getAppUrl() {
    const isLocal = window.location.protocol === 'file:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    return isLocal ? 'app.html' : 'https://pos-project-lake.vercel.app/app.html';
  }

  // Apply Language to all data-i18n elements
  function setLanguage(lang) {
    if (!i18n[lang]) return;
    currentLang = lang;
    localStorage.setItem('apex_pos_lang', lang);
    document.documentElement.lang = lang;

    // Update Language Toggle Switch
    const langSwitch = document.getElementById('langSwitch');
    if (langSwitch) {
      langSwitch.setAttribute('data-lang', lang);
      langSwitch.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
    }

    // Update all text nodes with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18n[lang][key]) {
        el.textContent = i18n[lang][key];
      }
    });

    // Update WhatsApp links with language-specific message
    const waText = lang === 'si'
      ? encodeURIComponent('ආයුබෝවන් Harsh Apex Digital Solutions (0770663154), මට Harsh Apex Retail POS පද්ධතිය සක්‍රිය කරගැනීමට / සහාය ලබාගැනීමට අවශ්‍යයි.')
      : encodeURIComponent('Hello Harsh Apex Digital Solutions (0770663154), I would like to get assistance or activate Harsh Apex Retail POS for my store.');
    
    document.querySelectorAll('.wa-contact-link').forEach(link => {
      link.href = `https://wa.me/94770663154?text=${waText}`;
    });

    const waFab = document.getElementById('waFloatingBtn');
    if (waFab) {
      waFab.href = `https://wa.me/94770663154?text=${waText}`;
    }
  }

  // --- Initialize App URLs ---
  function initAppLinks() {
    const appUrl = getAppUrl();
    document.querySelectorAll('.pos-launch-btn').forEach(btn => {
      btn.href = appUrl;
    });
  }

  // --- How to Install Tabs ---
  function initInstallTabs() {
    const tabBtns = document.querySelectorAll('.install-tab-btn');
    const panels = document.querySelectorAll('.install-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPanel = document.getElementById(`panel-${targetTab}`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });

    // Auto-select tab based on user agent
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const iosBtn = document.querySelector('.install-tab-btn[data-tab="ios"]');
      if (iosBtn) iosBtn.click();
    } else if (/Android/i.test(ua)) {
      const androidBtn = document.querySelector('.install-tab-btn[data-tab="android"]');
      if (androidBtn) androidBtn.click();
    } else {
      const pcBtn = document.querySelector('.install-tab-btn[data-tab="pc"]');
      if (pcBtn) pcBtn.click();
    }
  }

  // --- Live App Screen Showcase Gallery ---
  const screenContentTemplates = {
    pos: `
      <div style="background:#f1f5f9;padding:16px;border-radius:12px;height:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="background:linear-gradient(135deg,#0e766e,#115e59);color:#fff;padding:14px 18px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
          <div><h3 style="margin:0;font-size:16px;font-weight:800;">Apex POS Terminal</h3><small style="opacity:0.85">Cashier: Shop Owner | Mode: 100% Offline</small></div>
          <span style="background:rgba(255,255,255,0.2);padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">🟢 Offline Ready</span>
        </div>
        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;flex:1;">
          <div style="background:#fff;padding:14px;border-radius:12px;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;">
              <input type="text" placeholder="🔍 Search or scan barcode..." value="Munchee" style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" readonly>
              <button style="background:#0f172a;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;">📷 Scan</button>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <span style="background:#0e766e;color:#fff;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:700;">All</span>
              <span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;">Biscuits</span>
              <span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;">Dairy</span>
              <span style="background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;">Beverages</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:6px;overflow-y:auto;max-height:220px;">
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:#f8fafc;border:1px solid #edf2f7;">
                <div><div style="font-weight:700;font-size:13px;">Munchee Super Cream Cracker</div><small style="color:#64748b;">Stock: 48 pcs</small></div>
                <div style="text-align:right;"><div style="font-weight:800;color:#0e766e;font-size:13px;">Rs. 140.00</div><button style="background:#e8f4f2;color:#0e766e;border:none;padding:4px 8px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">+ Add</button></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:#f8fafc;border:1px solid #edf2f7;">
                <div><div style="font-weight:700;font-size:13px;">Anchor Full Cream Milk Powder 400g</div><small style="color:#64748b;">Stock: 14 pcs</small></div>
                <div style="text-align:right;"><div style="font-weight:800;color:#0e766e;font-size:13px;">Rs. 1,120.00</div><button style="background:#e8f4f2;color:#0e766e;border:none;padding:4px 8px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">+ Add</button></div>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-radius:8px;background:#f8fafc;border:1px solid #edf2f7;">
                <div><div style="font-weight:700;font-size:13px;">Dilmah Premium Ceylon Tea 100g</div><small style="color:#64748b;">Stock: 25 pcs</small></div>
                <div style="text-align:right;"><div style="font-weight:800;color:#0e766e;font-size:13px;">Rs. 280.00</div><button style="background:#e8f4f2;color:#0e766e;border:none;padding:4px 8px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">+ Add</button></div>
              </div>
            </div>
          </div>
          <div style="background:#fff;padding:14px;border-radius:12px;border:1px solid #e2e8f0;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-weight:800;font-size:14px;border-bottom:1px solid #edf2f7;padding-bottom:8px;margin-bottom:8px;display:flex;justify-content:space-between;">
                <span>Cart (3 Items)</span>
                <span style="color:#ef4444;font-size:11px;cursor:pointer;">Clear</span>
              </div>
              <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;"><span>1x Munchee Cracker</span><strong>Rs. 140.00</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>1x Anchor Milk 400g</span><strong>Rs. 1,120.00</strong></div>
                <div style="display:flex;justify-content:space-between;"><span>1x Dilmah Tea 100g</span><strong>Rs. 280.00</strong></div>
              </div>
              <div style="border-top:1px dashed #cbd5e1;margin-top:12px;padding-top:8px;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;"><span>Subtotal:</span><span>Rs. 1,540.00</span></div>
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#10b981;"><span>Discount:</span><span>- Rs. 120.00</span></div>
                <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:900;color:#0e766e;margin-top:4px;"><span>Total:</span><span>Rs. 1,420.00</span></div>
              </div>
            </div>
            <button style="background:linear-gradient(135deg,#0e766e,#14b8a6);color:#fff;border:none;padding:12px;border-radius:10px;font-weight:800;font-size:14px;margin-top:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
              🖨️ Pay & Print Bill (Rs. 1,420)
            </button>
          </div>
        </div>
      </div>
    `,
    stock: `
      <div style="background:#f1f5f9;padding:16px;border-radius:12px;height:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">Product Catalog & Stock Management</h3><small style="color:#64748b;">48 Total Products | 3 Low Stock Warnings</small></div>
          <button style="background:#0e766e;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;">+ Add Product</button>
        </div>
        <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;flex:1;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:700;">
                <th style="padding:10px 14px;">Product Name</th>
                <th style="padding:10px;">Barcode</th>
                <th style="padding:10px;">Cost (LKR)</th>
                <th style="padding:10px;">Selling (LKR)</th>
                <th style="padding:10px;">Stock</th>
                <th style="padding:10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">Munchee Super Cream Cracker</td>
                <td style="padding:10px;font-family:monospace;color:#64748b;">4792022001124</td>
                <td style="padding:10px;">Rs. 115.00</td>
                <td style="padding:10px;font-weight:700;color:#0e766e;">Rs. 140.00</td>
                <td style="padding:10px;font-weight:700;">48 pcs</td>
                <td style="padding:10px;"><span style="background:#d1fae5;color:#065f46;padding:3px 8px;border-radius:6px;font-weight:700;font-size:10px;">In Stock</span></td>
              </tr>
              <tr style="border-bottom:1px solid #edf2f7;background:#fffbeb;">
                <td style="padding:10px 14px;font-weight:700;">Anchor Full Cream Milk Powder 400g</td>
                <td style="padding:10px;font-family:monospace;color:#64748b;">9414589002145</td>
                <td style="padding:10px;">Rs. 980.00</td>
                <td style="padding:10px;font-weight:700;color:#0e766e;">Rs. 1,120.00</td>
                <td style="padding:10px;font-weight:700;color:#b45309;">3 pcs</td>
                <td style="padding:10px;"><span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:6px;font-weight:700;font-size:10px;">⚠️ Low Stock</span></td>
              </tr>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">Dilmah Premium Ceylon Tea 100g</td>
                <td style="padding:10px;font-family:monospace;color:#64748b;">4791011500212</td>
                <td style="padding:10px;">Rs. 230.00</td>
                <td style="padding:10px;font-weight:700;color:#0e766e;">Rs. 280.00</td>
                <td style="padding:10px;font-weight:700;">25 pcs</td>
                <td style="padding:10px;"><span style="background:#d1fae5;color:#065f46;padding:3px 8px;border-radius:6px;font-weight:700;font-size:10px;">In Stock</span></td>
              </tr>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">Sunlight Lemon Soap 115g</td>
                <td style="padding:10px;font-family:monospace;color:#64748b;">8901030014521</td>
                <td style="padding:10px;">Rs. 82.00</td>
                <td style="padding:10px;font-weight:700;color:#0e766e;">Rs. 100.00</td>
                <td style="padding:10px;font-weight:700;">64 pcs</td>
                <td style="padding:10px;"><span style="background:#d1fae5;color:#065f46;padding:3px 8px;border-radius:6px;font-weight:700;font-size:10px;">In Stock</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
    reports: `
      <div style="background:#f1f5f9;padding:16px;border-radius:12px;height:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">Daily Sales & Profit Analytics</h3><small style="color:#64748b;">Today's Summary (25 Oct 2026)</small></div>
          <span style="background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">📈 Profitable Day</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">TOTAL REVENUE</span><div style="font-size:18px;font-weight:900;color:#0e766e;margin-top:2px;">Rs. 42,650</div></div>
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">NET PROFIT</span><div style="font-size:18px;font-weight:900;color:#10b981;margin-top:2px;">Rs. 8,920</div></div>
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">BILLS ISSUED</span><div style="font-size:18px;font-weight:900;color:#0284c7;margin-top:2px;">64 Bills</div></div>
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">AVG. BILL VALUE</span><div style="font-size:18px;font-weight:900;color:#f59e0b;margin-top:2px;">Rs. 666</div></div>
        </div>
        <div style="background:#fff;padding:14px;border-radius:12px;border:1px solid #e2e8f0;flex:1;">
          <div style="font-weight:800;font-size:13px;margin-bottom:8px;color:#334155;">Top Selling Items Today</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;"><span>1. Keells White Bread (450g)</span><span style="font-weight:700;">28 units / Rs. 4,480</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;"><span>2. Anchor Milk Powder 400g</span><span style="font-weight:700;">11 units / Rs. 12,320</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;"><span>3. Munchee Super Cream Cracker</span><span style="font-weight:700;">22 units / Rs. 3,080</span></div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;"><span>4. Dilmah Tea 100g</span><span style="font-weight:700;">16 units / Rs. 4,480</span></div>
          </div>
        </div>
      </div>
    `,
    credit: `
      <div style="background:#f1f5f9;padding:16px;border-radius:12px;height:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">Customer Credit Ledger (ඩිජිටල් ණය පොත)</h3><small style="color:#64748b;">Manage customer credit balances and settlements</small></div>
          <button style="background:#f59e0b;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;">+ Record Credit</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">TOTAL UNPAID CREDIT</span><div style="font-size:18px;font-weight:900;color:#b45309;margin-top:2px;">Rs. 18,450</div></div>
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">SETTLED THIS WEEK</span><div style="font-size:18px;font-weight:900;color:#10b981;margin-top:2px;">Rs. 14,200</div></div>
          <div style="background:#fff;padding:12px;border-radius:10px;border:1px solid #e2e8f0;"><span style="font-size:11px;color:#64748b;font-weight:700;">ACTIVE CUSTOMERS</span><div style="font-size:18px;font-weight:900;color:#0e766e;margin-top:2px;">8 Customers</div></div>
        </div>
        <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;flex:1;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left;">
            <thead>
              <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:700;">
                <th style="padding:10px 14px;">Customer Name</th>
                <th style="padding:10px;">Phone No</th>
                <th style="padding:10px;">Due Balance</th>
                <th style="padding:10px;">Last Purchase</th>
                <th style="padding:10px;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">K. D. Gamage (Teacher)</td>
                <td style="padding:10px;color:#64748b;">077 123 4567</td>
                <td style="padding:10px;font-weight:800;color:#b45309;">Rs. 4,250.00</td>
                <td style="padding:10px;">Yesterday</td>
                <td style="padding:10px;"><button style="background:#e8f4f2;color:#0e766e;border:none;padding:4px 10px;border-radius:6px;font-weight:700;font-size:11px;">Settle / Pay</button></td>
              </tr>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">Sunil Perera (Garage)</td>
                <td style="padding:10px;color:#64748b;">071 987 6543</td>
                <td style="padding:10px;font-weight:800;color:#b45309;">Rs. 7,800.00</td>
                <td style="padding:10px;">3 days ago</td>
                <td style="padding:10px;"><button style="background:#e8f4f2;color:#0e766e;border:none;padding:4px 10px;border-radius:6px;font-weight:700;font-size:11px;">Settle / Pay</button></td>
              </tr>
              <tr style="border-bottom:1px solid #edf2f7;">
                <td style="padding:10px 14px;font-weight:700;">Nimali Jayasuriya</td>
                <td style="padding:10px;color:#64748b;">075 444 8888</td>
                <td style="padding:10px;font-weight:800;color:#10b981;">Rs. 0.00 (Settled)</td>
                <td style="padding:10px;">Today</td>
                <td style="padding:10px;"><span style="color:#10b981;font-weight:700;font-size:11px;">✓ Cleared</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
    settings: `
      <div style="background:#f1f5f9;padding:16px;border-radius:12px;height:100%;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><h3 style="margin:0;font-size:16px;font-weight:800;color:#0f172a;">Store Settings & Thermal Receipt Setup</h3><small style="color:#64748b;">Hardware, License Status & Backup Control</small></div>
          <span style="background:#e8f4f2;color:#0e766e;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;">🔐 License: Active</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1;">
          <div style="background:#fff;padding:14px;border-radius:12px;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;">Thermal Receipt Settings</div>
            <label style="font-size:11px;font-weight:700;color:#64748b;">Shop Header Text</label>
            <input type="text" value="APEX RETAIL MART - COLOMBO" style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" readonly>
            <label style="font-size:11px;font-weight:700;color:#64748b;">Thermal Printer Width</label>
            <select style="padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;"><option>58mm Mini Bluetooth Printer (Default)</option><option>80mm Standard POS Thermal Printer</option></select>
            <button style="background:#0e766e;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:700;font-size:12px;margin-top:6px;">🖨️ Test Print Sample Slip</button>
          </div>
          <div style="background:#fff;padding:14px;border-radius:12px;border:1px solid #e2e8f0;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;">Data Security & Backup</div>
            <p style="font-size:11px;color:#64748b;margin:0;">All data is safely stored on this device. Click below to backup or restore.</p>
            <button style="background:#0284c7;color:#fff;border:none;padding:8px;border-radius:6px;font-weight:700;font-size:12px;margin-top:4px;">⬇️ Download Full Database Backup</button>
            <button style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:8px;border-radius:6px;font-weight:700;font-size:12px;">⬆️ Restore Backup File</button>
            <div style="margin-top:6px;padding:8px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-size:11px;">
              <strong>Device ID:</strong> <span style="font-family:monospace;color:#0e766e;">APX-LK-7749-8821</span>
            </div>
          </div>
        </div>
      </div>
    `
  };

  function initScreensGallery() {
    const screenTabBtns = document.querySelectorAll('.screen-tab-btn');
    const screenContainer = document.getElementById('screenLiveContainer');

    function renderScreen(screenKey) {
      if (screenContainer && screenContentTemplates[screenKey]) {
        screenContainer.style.opacity = '0';
        setTimeout(() => {
          screenContainer.innerHTML = screenContentTemplates[screenKey];
          screenContainer.style.opacity = '1';
        }, 150);
      }
    }

    screenTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        screenTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const screenKey = btn.getAttribute('data-screen');
        renderScreen(screenKey);
      });
    });

    // Initial render
    renderScreen('pos');
  }

  // --- FAQ Accordion ---
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const questionBtn = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');

      questionBtn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');

        // Close all other items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('open');
          const otherAns = otherItem.querySelector('.faq-answer');
          if (otherAns) otherAns.style.maxHeight = null;
        });

        // Toggle clicked
        if (!isOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  }

  // --- Scroll Reveal Animations ---
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-up, .reveal-fade, .reveal-scale');
    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(el => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // --- Navbar Scroll Shadow ---
  function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 30) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // --- Mobile Hamburger Menu ---
  function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');
    if (menuBtn && navLinks) {
      menuBtn.addEventListener('click', () => {
        const isVisible = navLinks.style.display === 'flex';
        navLinks.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
          navLinks.style.position = 'absolute';
          navLinks.style.top = '76px';
          navLinks.style.left = '0';
          navLinks.style.right = '0';
          navLinks.style.background = 'rgba(8, 14, 26, 0.98)';
          navLinks.style.flexDirection = 'column';
          navLinks.style.padding = '20px';
          navLinks.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        }
      });

      // Close menu when a link is clicked
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          if (window.innerWidth <= 768) {
            navLinks.style.display = 'none';
          }
        });
      });
    }
  }

  // --- PWA Native Install Prompt Hook ---
  function initPwaInstallPrompt() {
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      // Show install banner or buttons
      document.querySelectorAll('.pwa-direct-install-btn').forEach(btn => {
        btn.style.display = 'inline-flex';
        btn.addEventListener('click', async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (outcome === 'accepted') {
              btn.style.display = 'none';
            }
          }
        });
      });
    });
  }

  // --- Language Toggle Setup ---
  function initLanguageSwitcher() {
    const langSwitch = document.getElementById('langSwitch');
    if (!langSwitch) return;

    langSwitch.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosen = btn.getAttribute('data-lang');
        setLanguage(chosen);
      });
    });

    // Set initial language
    setLanguage(currentLang);
  }

  // --- DOM Ready Bootstrapper ---
  document.addEventListener('DOMContentLoaded', () => {
    initAppLinks();
    initLanguageSwitcher();
    initInstallTabs();
    initScreensGallery();
    initFaqAccordion();
    initScrollReveal();
    initNavbarScroll();
    initMobileMenu();
    initPwaInstallPrompt();
  });

})();
