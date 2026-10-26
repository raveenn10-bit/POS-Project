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
      nav_audience: 'ව්‍යාපාර විසඳුම්',
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

      // AEO Direct Definition Snippet
      aeo_badge: 'AEO සෘජු පිළිතුර: Harsh Apex POS යනු කුමක්ද?',
      aeo_rank_pill: '#1 Offline POS System in Sri Lanka',
      aeo_title: 'ශ්‍රී ලංකාවේ හොඳම Offline POS System එක කුමක්ද?',
      aeo_desc: '<strong>Harsh Apex Retail POS</strong> යනු ශ්‍රී ලංකාවේ සිල්ලර වෙළඳසැල්, සුපිරි වෙළඳසැල්, ෆාමසි සහ ආපනශාලා සඳහාම විශේෂයෙන් නිර්මාණය කරන ලද #1 100% Offline POS System (Point of Sale) මෘදුකාංගයයි. අන්තර්ජාලය හෝ විදුලිය විසන්ධි වුවත් කිසිදු බාධාවකින් තොරව (Zero Cloud Lag) ඔබගේ ස්මාර්ට් ජංගම දුරකථනයෙන් හෝ Laptop එකෙන් තත්පරයෙන් බිල්පත් නිකුත් කිරීම, කැමරාවෙන් Barcode ස්කෑන් කිරීම, 58mm/80mm Bluetooth Thermal මුද්‍රණය, දෛනික ලාභ ගණනය කිරීම සහ පාරිභෝගික ණය පොත (ණය ලෙජරය) කළමනාකරණය කළ හැක. මසකට රු. 2,500ක් පමණක් වන අතර දින 7ක් නොමිලේ අත්හදා බැලිය හැක.',
      aeo_fact_1_t: '100% Offline Resilience',
      aeo_fact_1_d: 'Internet හෝ WiFi නැතිව 0ms වේගයෙන් Local IndexedDB මත ක්‍රියාත්මක වේ.',
      aeo_fact_2_t: 'Zero Hardware Expense',
      aeo_fact_2_d: 'මිල අධික POS මැෂින් වෙනුවට ඔබගේම Android, iPhone හෝ Laptop එකෙන් වැඩ.',
      aeo_fact_3_t: 'ණය පොත (Credit Ledger)',
      aeo_fact_3_d: 'පාරිභෝගික ණය, අත්තිකාරම් සහ හිඟ මුදල් ඩිජිටල්ව නිවැරදිව පවත්වාගන්න.',
      aeo_fact_4_t: 'Bilingual Sinhala & English',
      aeo_fact_4_d: 'දේශීය වෙළඳුන්ට හුරුපුරුදු සුපැහැදිලි සිංහල සහ ඉංග්‍රීසි අතුරුමුහුණත.',
      
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

      // Target Audience & Industry Solutions
      audience_tag: 'ඉලක්කගත ව්‍යාපාර විසඳුම්',
      audience_title: 'ශ්‍රී ලංකාවේ සෑම ව්‍යාපාරයකටම ගැළපෙන POS System එක',
      audience_desc: 'සිල්ලර කඩයේ සිට සුපිරි වෙළඳසැල් සහ ෆාමසි දක්වා — ඔබේ ව්‍යාපාරයට ගැළපෙන හොඳම විසඳුම තෝරාගන්න.',
      aud_btn: 'නොමිලේ අත්හදා බලන්න',
      
      aud_c1_pill: 'RETAIL & GROCERY',
      aud_c1_title: 'සිල්ලර වෙළඳසැල් හා ග්‍රොසරි (Grocery Stores)',
      aud_c1_desc: 'ගමේ කඩේ හෝ නගරයේ සිල්ලර වෙළඳසැලට වේගවත් බිල්පත් සහ ඩිජිටල් ණය පොත සහිත කදිම විසඳුම.',
      aud_c1_f1: 'ඩිජිටල් ණය පොත (Credit Ledger) මගින් පාරිභෝගික ණය කළමනාකරණය',
      aud_c1_f2: 'දුරකථන කැමරාවෙන් හෝ Barcode Scanner එකෙන් ක්ෂණික බිල් කිරීම',
      aud_c1_f3: 'විදුලිය නැතිවිටත් Phone එකෙන් හා Mini Bluetooth Printer එකෙන් බිල් මුද්‍රණය',

      aud_c2_pill: 'SUPERMARKETS',
      aud_c2_title: 'සුපිරි වෙළඳසැල් හා Marts (Supermarkets)',
      aud_c2_desc: 'දිනකට බිල්පත් සිය ගණනක් නිකුත් කරන සුපිරි වෙළඳසැල් සඳහා අධිවේගී කවුන්ටර් බිල්පත් සහ තොග පාලනය.',
      aud_c2_f1: 'අසීමිත භාණ්ඩ ප්‍රමාණයක් (Unlimited Products) කළමනාකරණය',
      aud_c2_f2: 'Low Stock Alerts මගින් භාණ්ඩ හිඟවීම් කල්තියා දැනගැනීම',
      aud_c2_f3: '80mm & 58mm කවුන්ටර් Thermal Printers සහ USB Barcode Gun සහාය',

      aud_c3_pill: 'FOOD & DINING',
      aud_c3_title: 'ආපනශාලා, කැෆේ සහ බේකරි (Restaurants & Cafes)',
      aud_c3_desc: 'කෑම ඇණවුම්, ක්ෂණික බිල්පත් නිකුත් කිරීම සහ දෛනික මුදල් ආදායම නිවැරදිව පරීක්ෂා කිරීම.',
      aud_c3_f1: 'තත්පර 3කින් Quick Cash බිල්පත් නිකුත් කිරීමේ පහසුකම',
      aud_c3_f2: 'පාරිභෝගිකයාගේ WhatsApp එකට කෙලින්ම ඩිජිටල් බිල යැවීම',
      aud_c3_f3: 'දවසේ මුළු අලෙවිය, ලාභය සහ වැඩිපුරම අලෙවි වූ කෑම වර්ග වාර්තා',

      aud_c4_pill: 'HEALTHCARE',
      aud_c4_title: 'ෆාමසි සහ බෙහෙත් ශාලා (Pharmacies)',
      aud_c4_desc: 'බෙහෙත් වර්ග දහස් ගණනක් ක්ෂණිකව සෙවීම, Barcode මගින් බිල් කිරීම සහ ආරක්ෂිත දත්ත ගබඩාව.',
      aud_c4_f1: 'ඖෂධ නාමය හෝ Barcode මගින් ක්ෂණික Search කිරීමේ හැකියාව',
      aud_c4_f2: 'නිරවද්‍ය මිල ගණන් සහ පැහැදිලි 58mm/80mm රිසිට්පත් මුද්‍රණය',
      aud_c4_f3: '100% Offline ක්‍රියාකාරීත්වය නිසා රෝගීන්ට ප්‍රමාදයකින් තොරව සේවය',

      aud_c5_pill: 'HARDWARE & TOOLS',
      aud_c5_title: 'හාඩ්වෙයාර් සහ විදුලි උපකරණ වෙළඳසැල්',
      aud_c5_desc: 'ගොඩනැගිලි ද්‍රව්‍ය, විදුලි හා ජලනල උපකරණ අලෙවිය සහ කොන්ත්‍රාත්කරුවන්ගේ ණය ගිණුම් කළමනාකරණය.',
      aud_c5_f1: 'කොන්ත්‍රාත්කරුවන්ගේ දිගුකාලීන ණය ගිණුම් නිවැරදිව පවත්වාගැනීම',
      aud_c5_f2: 'Barcode නොමැති අයිතම සඳහා Quick Search & Manual Entry පහසුකම',
      aud_c5_f3: 'දෛනික මුදල් හා ණය විකුණුම් සංසන්දනාත්මක වාර්තා',

      aud_c6_pill: 'FASHION & APPAREL',
      aud_c6_title: 'රෙදිපිළි හා විලාසිතා සාප්පු (Clothing & Boutiques)',
      aud_c6_desc: 'ඇඳුම් පැළඳුම්, සපත්තු හා ආභරණ අලෙවිසැල් සඳහා අලංකාර බිල්පත් සහ ලාභ ආන්තික ගණනය කිරීම්.',
      aud_c6_f1: 'ඇඳුම් ටැග් Barcode ක්ෂණිකව ස්කෑන් කර බිල්පත් සැකසීම',
      aud_c6_f2: 'වෙළඳසැලේ නම සහ සමාජ මාධ්‍ය සටහන් සහිත සුඛෝපභෝගී බිල්පත්',
      aud_c6_f3: 'සෑම භාණ්ඩයකම ශුද්ධ ලාභ ප්‍රතිශතය (Profit Margin) ස්වයංක්‍රීයව බලාගැනීම',

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
      screen_tab_dashboard: '📊 පාලක පුවරුව (Dashboard)',
      screen_tab_pos: '🛒 බිල්පත් නිකුත් කිරීම (Billing)',
      screen_tab_stock: '📦 භාණ්ඩ හා තොග (Products)',
      screen_tab_reports: '📈 විකුණුම් වාර්තා (Reports)',
      screen_tab_settings: '⚙️ සැකසුම් & Backup (Settings)',

      // Comparison & Small Business Benefits
      nav_compare: 'වාසි හා සැසඳීම',
      compare_tag: 'කුඩා හා නව ව්‍යාපාර සඳහා විශේෂ වාසි',
      compare_title: 'සාම්ප්‍රදායික POS මැෂින් වෙනුවට Harsh Apex POS තෝරාගත යුත්තේ ඇයි?',
      compare_desc: 'රුපියල් ලක්ෂ ගණන් වියදම් කර පැරණි POS මැෂින් ගන්නවා වෙනුවට ඔබගේම දුරකථනයෙන් හෝ ලැප්ටොප් එකෙන් මසකට රු. 2,500කට ලැබෙන සුපිරි වාසි මෙන්න.',
      vs_trad_badge: '❌ සාම්ප්‍රදායික පැරණි POS ක්‍රමය',
      vs_trad_price: 'රු. 250,000+ <span style="font-size:13px;font-weight:400;color:var(--text-dim);">මූලික වියදම</span>',
      vs_trad_sub: 'විශාල යකඩ මැෂින්, කේබල් සහ අනවශ්‍ය නඩත්තු ගාස්තු',
      vs_t1_t: 'විශාල මූලික ආයෝජනයක් අවශ්‍යයි',
      vs_t1_d: 'යන්ත්‍ර, ස්කෑනර් හා තිර සඳහා රු. 250,000 - 450,000 අතර මුදලක් ආරම්භයේදීම ගෙවිය යුතුය.',
      vs_t2_t: 'විදුලිය / අන්තර්ජාලය නැතිවිට බිල් කිරීම ඇණහිටී',
      vs_t2_d: 'Cloud-only ක්‍රම නිසා Internet drop වූ විට හෝ විදුලිය විසන්ධි වූ විට කඩේ බිල්පත් දැමීම නවතී.',
      vs_t3_t: 'වෙනම Barcode Scanner මිලදී ගත යුතුයි',
      vs_t3_d: 'Handheld Barcode Gun එකකට තවත් රු. 15,000 - 30,000ක් අමතරව වැයවේ.',
      vs_t4_t: 'සංකීර්ණයි, සේවකයන් පුහුණු කිරීම අපහසුයි',
      vs_t4_d: 'ඉංග්‍රීසි පමණක් ඇති පැරණි සංකීර්ණ UI නිසා සාමාන්‍ය සේවකයින්ට හසුරුවන්න අපහසුයි.',
      vs_t5_t: 'අධික වාර්ෂික නඩත්තු ගාස්තු (AMC)',
      vs_t5_d: 'වාර්ෂිකව රු. 50,000 - 80,000ක් නඩත්තු සඳහා ගෙවීමට සිදුවේ.',
      vs_apex_tag: '🏆 ශ්‍රී ලාංකික සිල්ලර වෙළඳුන්ගේ #1 තේරීම',
      vs_apex_price: 'රු. 2,500 <span style="font-size:14px;font-weight:600;color:var(--emerald-mint);">/ මසකට (Hardware වියදම් රු. 0යි)</span>',
      vs_apex_sub: 'ඔබේම Smart Phone එකෙන් හෝ Laptop එකෙන් 100% Offline',
      vs_a1_t: 'Hardware වියදම් රු. 0යි — ඔබේ Phone එකෙන්ම වැඩ',
      vs_a1_d: 'මිල අධික මැෂින් අවශ්‍ය නැත. ඕනෑම Android, iPhone හෝ සාමාන්‍ය Laptop එකක ස්ථාපනය කරගත හැක.',
      vs_a2_t: '100% Offline — විදුලිය හෝ Internet අවශ්‍ය නැත',
      vs_a2_d: 'Local IndexedDB දත්ත ගබඩාව නිසා Internet නැතිවුවත් 0ms වේගයෙන් බිල්පත් සහ තොග කළමනාකරණය.',
      vs_a3_t: 'Phone කැමරාවෙන්ම Barcode ස්කෑනරය',
      vs_a3_d: 'දුරකථන කැමරාවෙන් තත්පරයෙන් Barcode ස්කෑන් කරන්න. කැමති නම් USB/Wireless Scanner ද සම්බන්ධ කළ හැක.',
      vs_a4_t: 'සිංහල & English භාෂා ද්විත්වයම සහිත සරල අතුරුමුහුණත',
      vs_a4_d: 'ඕනෑම කෙනෙකුට විනාඩි 2කින් තේරුම් ගත හැක. පාරිභෝගික ණය පොත (Credit Ledger) ද ඇතුළත්ය.',
      vs_a5_t: 'දින 7ක් සම්පූර්ණයෙන්ම නොමිලේ අත්හදා බලන්න',
      vs_a5_d: 'කිසිදු පෙර ගෙවීමක් නැත. නොමිලේ ක්‍රියාත්මක කර බලා සෑහීමකට පත්වන්නේ නම් පමණක් මසකට රු. 2,500ක් ගෙවන්න.',
      vs_cta_btn: 'දැන්ම නොමිලේ අත්හදා බලන්න (7-Day Trial)',
      pillar_1_t: '90%කට වඩා මූලික මුදල් ඉතිරියක්',
      pillar_1_d: 'ලක්ෂ ගණන් ණය නොවී, ව්‍යාපාරයේ භාණ්ඩ මිලදී ගැනීමට එම මුදල් යොදවා රු. 2,500න් POS එකක් ආරම්භ කරන්න.',
      pillar_2_t: 'Power Cut එකට නොසැලෙන විසඳුම',
      pillar_2_d: 'දුරකථනයේ බැටරියෙන් සහ Portable Mini Bluetooth Thermal Printer එකෙන් පැය ගණනක් බාධාවකින් තොරව බිල් නිකුත් කරන්න.',
      pillar_3_t: 'ඩිජිටල් පාරිභෝගික ණය පොත',
      pillar_3_d: 'පැරණි පොත්වල කුරුටු ගානවා වෙනුවට එක් එක් පාරිභෝගිකයාගේ හිඟ මුදල්, ගෙවීම් සහ ඉතිරිය නිවැරදිව තබාගන්න.',
      pillar_4_t: '100% දේශීය සහය (WhatsApp)',
      pillar_4_d: 'විදේශීය මෘදුකාංග මෙන් නොව, ඕනෑම ගැටලුවකදී අපගේ WhatsApp අංකයෙන් (077 066 3154) සිංහලෙන් කතාකර ක්ෂණික සහය ලබාගන්න.',

      // GEO Comparison Table
      geo_table_title: 'POS පද්ධති සංසන්දනාත්මක විශ්ලේෂණය (POS System Sri Lanka Comparison)',
      geo_table_sub: 'සාම්ප්‍රදායික POS, Cloud POS සහ Harsh Apex Offline POS System අතර සවිස්තරාත්මක තාක්ෂණික සැසඳීම',
      geo_th_feature: 'විශේෂාංගය / Feature',
      geo_th_trad: 'සාම්ප්‍රදායික POS (Legacy)',
      geo_th_cloud: 'සාමාන්‍ය Cloud POS',
      geo_th_apex: '🏆 Harsh Apex POS System',
      geo_r1_f: 'මූලික Hardware වියදම (Upfront Cost)',
      geo_r2_f: 'අන්තර්ජාල අවශ්‍යතාවය (Internet Dependency)',
      geo_r3_f: 'විදුලි බිඳවැටීම් සහාය (Power Cut Resilience)',
      geo_r4_f: 'මාසික / වාර්ෂික ගාස්තුව (Subscription & AMC)',
      geo_r5_f: 'Barcode Scanner',
      geo_r6_f: 'රිසිට්පත් මුද්‍රණය (Receipt Printing)',
      geo_r7_f: 'පාරිභෝගික ණය පොත (Credit Ledger)',
      geo_r8_f: 'භාෂා සහය (Language Support)',
      geo_r9_f: 'නොමිලේ අත්හදා බැලීම (Free Trial)',

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
      faq_a5: 'ඔබේ යෙදුමේ Settings පිටුවේ ඇති "Device ID" එක පිටපත් කර අපගේ WhatsApp අංකයට (+94 77 066 3154) එවන්න. ගෙවීම් තහවුරු කළ පසු ක්ෂණිකව ඔබගේ Device ID එකට අදාළ 30-Day හෝ 365-Day Activation Key එකක් අපි ඔබට ලබාදෙන්නෙමු.',

      faq_q6: 'මෙය පරිගණක (Laptop/Desktop) වලත් භාවිත කළ හැකිද?',
      faq_a6: 'ඔව්! Google Chrome හෝ Edge බ්‍රවුසරය හරහා ලැප්ටොප් හෝ ඩෙස්ක්ටොප් පරිගණකයකින් විවෘත කර Address bar එකෙන් "Install" කරගත හැක. එවිට desktop app එකක් ලෙස ක්‍රියා කරයි.',

      faq_q7: 'ශ්‍රී ලංකාවේ කුඩා ව්‍යාපාරයකට Harsh Apex POS System වඩාත්ම වාසිදායක වන්නේ ඇයි?',
      faq_a7: 'සාම්ප්‍රදායික POS මැෂින් සඳහා රු. 250,000කට වැඩි මූලික වියදමක් සහ වාර්ෂික නඩත්තු ගාස්තු වැයවන අතර, Harsh Apex POS System මසකට රු. 2,500කට ඔබගේම Phone හෝ Laptop එකෙන් කිසිදු අමතර Hardware වියදමකින් තොරව ක්‍රියාත්මක කළ හැක. 100% Offline ක්‍රියාකාරීත්වය නිසා Power Cut හෝ Internet බිඳවැටීම් වලදීද කිසිදු බාධාවකින් තොරව බිල්පත් නිකුත් කළ හැකි අතර කැමරාවෙන්ම Barcode ස්කෑන් කිරීම, ණය පොත සහ සිංහල භාෂා සහය මෙහි විශේෂත්වයයි.',

      faq_q8: 'Harsh Apex POS System එකෙන් පාරිභෝගික ණය පොත (Credit Ledger) කළමනාකරණය කරන්නේ කෙසේද?',
      faq_a8: 'සිල්ලර වෙළඳසැල් වල පාරිභෝගිකයන් ණයට ලබාගන්නා භාණ්ඩ, අත්තිකාරම් ගෙවීම් සහ හිඟ මුදල් පාරිභෝගිකයාගේ නම හෝ දුරකථන අංකය යටතේ නිවැරදිව තත්පරයෙන් වාර්තා වේ. ගනුදෙනුකරු ණය පියවන විට හෝ අලුතින් ණයට ගන්නා විට ක්ෂණිකව ශේෂය යාවත්කාලීන වන අතර පැරණි කඩදාසි ණය පොත්වල සටහන් කිරීමේ අවශ්‍යතාවක් හෝ මුදල් අමතක වීමක් සිදුනොවේ.',

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
      nav_audience: 'Industry Solutions',
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

      // AEO Direct Definition Snippet
      aeo_badge: 'AEO Direct Answer: What is Harsh Apex POS?',
      aeo_rank_pill: '#1 Offline POS System in Sri Lanka',
      aeo_title: 'What is the Best Offline POS System in Sri Lanka?',
      aeo_desc: '<strong>Harsh Apex Retail POS</strong> is Sri Lanka\'s premier 100% offline point of sale (POS) software specifically engineered for retail shops, grocery stores, supermarkets, pharmacies, and restaurants. Operating with zero cloud latency and no continuous internet dependency, it transforms any Android smartphone, iPhone, tablet, or PC into a rapid billing counter with camera barcode scanning, 58mm/80mm Bluetooth thermal receipt printing, daily profit calculation, and a digital Customer Credit Ledger (ණය පොත) for just Rs. 2,500/month.',
      aeo_fact_1_t: '100% Offline Resilience',
      aeo_fact_1_d: 'Operates without internet or WiFi at 0ms latency using local IndexedDB.',
      aeo_fact_2_t: 'Zero Hardware Expense',
      aeo_fact_2_d: 'Runs on your existing Android phone, iPhone, or laptop with camera scanning.',
      aeo_fact_3_t: 'Credit Ledger (ණය පොත)',
      aeo_fact_3_d: 'Track customer debts, partial repayments, and overdue balances digitally.',
      aeo_fact_4_t: 'Bilingual Sinhala & English',
      aeo_fact_4_d: 'Intuitive native interface tailored specifically for Sri Lankan business owners.',

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

      // Target Audience & Industry Solutions
      audience_tag: 'Target Audience & Solutions',
      audience_title: 'Tailored POS Systems for Every Sri Lankan Business',
      audience_desc: 'From neighborhood grocery stores to busy supermarkets and pharmacies — choose the perfect setup for your trade.',
      aud_btn: 'Start Free Trial',

      aud_c1_pill: 'RETAIL & GROCERY',
      aud_c1_title: 'Retail & Grocery Stores (සිල්ලර කඩ)',
      aud_c1_desc: 'Fast counter billing and integrated digital credit ledger tailored for local grocery stores and village retail shops.',
      aud_c1_f1: 'Customer Credit Ledger (ණය පොත) to record customer book debts',
      aud_c1_f2: 'Instant checkout with phone camera or external barcode scanner',
      aud_c1_f3: 'Continuous billing during power outages via phone battery & Bluetooth printer',

      aud_c2_pill: 'SUPERMARKETS',
      aud_c2_title: 'Mini Supermarkets & Marts',
      aud_c2_desc: 'High-velocity billing and inventory management designed for busy retail supermarkets issuing hundreds of daily invoices.',
      aud_c2_f1: 'Manage thousands of items with unlimited product catalog',
      aud_c2_f2: 'Automated Low-Stock alerts to prevent inventory stockouts',
      aud_c2_f3: 'Full support for 80mm & 58mm counter thermal printers & laser guns',

      aud_c3_pill: 'FOOD & DINING',
      aud_c3_title: 'Restaurants, Cafes & Bakeries',
      aud_c3_desc: 'Fast order checkout, direct WhatsApp receipt dispatch, and daily revenue and top-item profit tracking.',
      aud_c3_f1: '3-second rapid cash checkout terminal',
      aud_c3_f2: 'Instant paperless receipt dispatch directly to customer WhatsApp',
      aud_c3_f3: 'Daily gross profit reports and best-selling food item analytics',

      aud_c4_pill: 'HEALTHCARE',
      aud_c4_title: 'Pharmacies & Healthcare',
      aud_c4_desc: 'Fast medicine search by name or barcode, clear thermal receipts, and completely private offline record-keeping.',
      aud_c4_f1: 'Instant product search across thousands of pharmaceuticals',
      aud_c4_f2: 'Accurate pricing and crystal-clear 58mm/80mm printed invoices',
      aud_c4_f3: 'Zero cloud lag ensures quick patient checkout at all times',

      aud_c5_pill: 'HARDWARE & TOOLS',
      aud_c5_title: 'Hardware & Electrical Stores',
      aud_c5_desc: 'Manage building supplies, tools, electrical fittings, and long-term credit accounts for local contractors.',
      aud_c5_f1: 'Accurate tracking of contractor credit ledger balances and partial payments',
      aud_c5_f2: 'Quick manual item entry and search for non-barcoded hardware items',
      aud_c5_f3: 'Comparative cash vs credit daily revenue reports',

      aud_c6_pill: 'FASHION & APPAREL',
      aud_c6_title: 'Clothing, Footwear & Boutiques',
      aud_c6_desc: 'Elegant receipt branding, garment tag barcode scanning, and automated margin calculations for fashion retailers.',
      aud_c6_f1: 'Rapid barcode scanning of garment tags and accessories',
      aud_c6_f2: 'Branded receipts featuring shop identity, telephone, and social handles',
      aud_c6_f3: 'Real-time profit margin tracking on every fashion collection',

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
      screen_tab_dashboard: '📊 Dashboard Overview',
      screen_tab_pos: '🛒 Fast Billing Terminal',
      screen_tab_stock: '📦 Products & Inventory',
      screen_tab_reports: '📈 Profit & Sales Reports',
      screen_tab_settings: '⚙️ Settings & Thermal Print',

      // Comparison & Small Business Benefits
      nav_compare: 'Benefits & Comparison',
      compare_tag: 'Special Benefits for Small Businesses',
      compare_title: 'Why Choose Harsh Apex POS Over Traditional Legacy POS?',
      compare_desc: 'Instead of spending hundreds of thousands on bulky hardware, run a lightning-fast offline POS straight from your phone or laptop for just Rs. 2,500/month.',
      vs_trad_badge: '❌ Legacy Traditional POS System',
      vs_trad_price: 'Rs. 250,000+ <span style="font-size:13px;font-weight:400;color:var(--text-dim);">Upfront Cost</span>',
      vs_trad_sub: 'Heavy metal terminals, cable clutter, and costly technician visits',
      vs_t1_t: 'Enormous Upfront Capital Required',
      vs_t1_d: 'Hardware machines, barcode guns, and cash drawers easily exceed Rs. 250,000 - 450,000 on day one.',
      vs_t2_t: 'Freezes During Power Cuts & Internet Outages',
      vs_t2_d: 'Cloud systems stop processing invoices when broadband drops or during power outages.',
      vs_t3_t: 'Must Buy Expensive Handheld Scanners',
      vs_t3_d: 'Dedicated USB laser scanner guns add an unnecessary Rs. 15,000 - 30,000 extra cost.',
      vs_t4_t: 'Clunky UI, Hard to Train Cashiers',
      vs_t4_d: 'Legacy English-only software with dozens of unnecessary screens that confuse local retail staff.',
      vs_t5_t: 'Recurring Annual Maintenance Contracts (AMC)',
      vs_t5_d: 'Forced maintenance fees of Rs. 50,000 - 80,000 every single year just to keep running.',
      vs_apex_tag: '🏆 #1 Choice for Sri Lankan Retailers',
      vs_apex_price: 'Rs. 2,500 <span style="font-size:14px;font-weight:600;color:var(--emerald-mint);">/ Month (Rs. 0 Hardware Cost)</span>',
      vs_apex_sub: 'Runs 100% Offline on Your Existing Smartphone or Laptop',
      vs_a1_t: 'Zero Hardware Cost — Uses Your Phone',
      vs_a1_d: 'No bulky hardware needed. Installs on any Android smartphone, iPhone, tablet, or Windows laptop.',
      vs_a2_t: '100% Offline — No Internet or Electricity Needed',
      vs_a2_d: 'Powered by local IndexedDB. Keep billing and tracking inventory at 0ms latency even during blackouts.',
      vs_a3_t: 'Built-in Phone Camera Barcode Scanner',
      vs_a3_d: 'Instant camera barcode & QR detection. You can also connect any USB/wireless scanner if desired.',
      vs_a4_t: 'Bilingual Sinhala & English Interface',
      vs_a4_d: 'Super-clean intuitive interface any clerk can master in 2 minutes. Includes Digital Credit Ledger (ණය පොත).',
      vs_a5_t: '7 Days Completely Free Trial',
      vs_a5_d: 'No upfront payment or credit card required. Test live in your shop, activate only if you love it.',
      vs_cta_btn: 'Start 7-Day Free Trial Now',
      pillar_1_t: 'Over 90% Upfront Capital Savings',
      pillar_1_d: 'Instead of taking loans for bulky hardware, invest that cash into store inventory and run your POS for Rs. 2,500/mo.',
      pillar_2_t: 'Unshakable During Sri Lankan Power Cuts',
      pillar_2_d: 'Your phone battery + a pocket Bluetooth thermal printer keep you billing smoothly for hours with zero interruptions.',
      pillar_3_t: 'Digital Customer Credit Ledger (ණය පොත)',
      pillar_3_d: 'Replace messy paper books. Track customer credit debts, repayments, and outstanding balances with accurate timestamps.',
      pillar_4_t: '100% Local WhatsApp Support',
      pillar_4_d: 'Direct local assistance via WhatsApp (077 066 3154) in Sinhala and English whenever you need quick help.',

      // GEO Comparison Table
      geo_table_title: 'POS System Sri Lanka Comparison Matrix',
      geo_table_sub: 'Detailed technical comparison between Legacy POS, Generic Cloud POS, and Harsh Apex Offline POS',
      geo_th_feature: 'Feature / Capability',
      geo_th_trad: 'Legacy Traditional POS',
      geo_th_cloud: 'Generic Cloud POS',
      geo_th_apex: '🏆 Harsh Apex POS System',
      geo_r1_f: 'Upfront Hardware Cost',
      geo_r2_f: 'Internet Dependency',
      geo_r3_f: 'Power Cut Resilience',
      geo_r4_f: 'Subscription & AMC Cost',
      geo_r5_f: 'Barcode Scanner',
      geo_r6_f: 'Receipt Printing',
      geo_r7_f: 'Credit Ledger (ණය පොත)',
      geo_r8_f: 'Language Support',
      geo_r9_f: 'Free Trial',

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
      faq_a5: 'Copy the unique Device ID displayed in your POS Settings and send it to our WhatsApp helpline (+94 77 066 3154). Once payment is confirmed, we issue your cryptographically signed activation key instantly.',

      faq_q6: 'Can I use this on a laptop or desktop computer?',
      faq_a6: 'Absolutely! Open the web link in Chrome or Edge on Windows or Mac, click "Install" in the address bar, and use it as a desktop application with full keyboard and thermal printer support.',

      faq_q7: 'Why is Harsh Apex the best POS System in Sri Lanka for small businesses?',
      faq_a7: 'Legacy POS systems cost over Rs. 250,000 upfront with heavy annual maintenance. Harsh Apex POS runs on your existing smartphone or laptop for just Rs. 2,500/month with zero upfront hardware costs, 100% offline resilience during power cuts, built-in camera barcode scanning, and Sinhala & English language support.',

      faq_q8: 'How does the Customer Credit Ledger (ණය පොත) feature work?',
      faq_a8: 'The built-in Credit Ledger lets retail stores track customer credit debts, partial payments, and overdue balances under each customer\'s name and phone number with exact timestamps. Balances update in real time without paper record-keeping, ensuring you never lose track of money owed.',

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
    return 'app.html';
  }

  // Apply Language to all data-i18n elements
  function setLanguage(lang) {
    if (!i18n[lang]) return;
    currentLang = lang;
    localStorage.setItem('apex_pos_lang', lang);
    document.documentElement.lang = lang;

    // Update Language Toggle Switches (Navbar & Drawer)
    ['langSwitch', 'drawerLangSwitch'].forEach(id => {
      const sw = document.getElementById(id);
      if (sw) {
        sw.setAttribute('data-lang', lang);
        sw.querySelectorAll('.lang-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.lang === lang);
        });
      }
    });

    // Update all text nodes with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18n[lang] && i18n[lang][key]) {
        if (i18n[lang][key].includes('<')) {
          el.innerHTML = i18n[lang][key];
        } else {
          el.textContent = i18n[lang][key];
        }
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

    // Refresh screens gallery if initialized
    if (window.refreshScreensGallery) {
      window.refreshScreensGallery();
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

  // --- Live App Screen Showcase Gallery with Real iPhone Screenshots ---
  const screenData = {
    dashboard: {
      img: 'screen-dashboard.jpg',
      badge: { si: '⚡ සජීවී පාලක පුවරුව (Live Dashboard)', en: '⚡ Live Business Dashboard' },
      title: { si: 'ව්‍යාපාරයේ සියලු තොරතුරු එක තිරයකින්', en: 'Complete Retail Analytics at a Glance' },
      desc: {
        si: 'දවසේ මුළු විකුණුම් (Sales), ශුද්ධ ලාභය (Gross Profit), අවසන් වෙමින් පවතින තොග (Low Stock) සහ මෑතකදී නිකුත් කළ බිල්පත් ක්ෂණිකව පරික්ෂා කරන්න.',
        en: 'Monitor daily sales revenue, gross profits, low stock alerts, quick transaction shortcuts, and real-time recent bill history on one screen.'
      },
      features: [
        { icon: '💰', title: { si: 'මුළු විකුණුම් & ලාභය', en: 'Sales & Gross Profit' }, desc: { si: 'දවසේ ආදායම සහ ලාභය සජීවීව ගණනය වේ.', en: 'Live daily revenue and net margin calculations.' } },
        { icon: '⚠️', title: { si: 'Low Stock Alerts', en: 'Low Stock Alerts' }, desc: { si: 'භාණ්ඩ අවසන් වීමට පෙර අනතුරු අඟවයි.', en: 'Instant notification before stock runs out.' } },
        { icon: '⚡', title: { si: 'Quick Sale Shortcuts', en: 'Quick Sale Shortcuts' }, desc: { si: 'වැඩිපුරම අලෙවි වන භාණ්ඩ ක්ෂණිකව බිල් කරන්න.', en: 'One-tap billing for top-selling items.' } },
        { icon: '🧾', title: { si: 'Recent Sales Log', en: 'Recent Sales Log' }, desc: { si: 'නිකුත් කළ බිල්පත් සහ මුදල්/ණය තත්ත්වය.', en: 'Audit past bills and cash/credit statuses.' } }
      ]
    },
    pos: {
      img: 'screen-billing.jpg',
      badge: { si: '🛒 තත්පරයේ බිල්පත් පද්ධතිය (Checkout Terminal)', en: '🛒 Fast Billing & Checkout' },
      title: { si: 'වේගවත් බිල්පත්, WhatsApp & Thermal මුද්‍රණය', en: 'Rapid Checkout, Thermal Print & WhatsApp' },
      desc: {
        si: 'භාණ්ඩ Search කිරීමෙන් හෝ Barcode Scanner එකෙන් Cart එකට එක් කර මුදල් හෝ ණය ලෙස බිල නිකුත් කරන්න. පාරිභෝගිකයාගේ WhatsApp අංකයට සෘජුවම බිල යැවිය හැක.',
        en: 'Fast item addition via search or camera barcode scan. Accept cash or credit, print 58mm/80mm receipts, and send digital bills directly to customer WhatsApp.'
      },
      features: [
        { icon: '💬', title: { si: 'WhatsApp Bill Sharing', en: 'WhatsApp Bill Sharing' }, desc: { si: 'දුරකථන අංකය ඇතුළත් කර WhatsApp එකට බිල යවන්න.', en: 'Enter phone number and send receipt to WhatsApp instantly.' } },
        { icon: '🖨️', title: { si: 'Thermal Receipt Print', en: 'Thermal Receipt Print' }, desc: { si: '58mm හෝ 80mm Bluetooth/USB මුද්‍රණය.', en: 'Fast print/reprint on Bluetooth and USB printers.' } },
        { icon: '💳', title: { si: 'Cash & Credit (ණය)', en: 'Cash & Credit Sales' }, desc: { si: 'අත්පිට මුදල් හෝ ණය ලෙස බිල්පත් වෙන් කරන්න.', en: 'Split transactions into cash or customer credit.' } },
        { icon: '📷', title: { si: 'Camera Barcode Scan', en: 'Camera Barcode Scan' }, desc: { si: 'දුරකථනයේ කැමරාවෙන් බාර්කෝඩ් ස්කෑන් කරන්න.', en: 'Zero equipment needed—scan with phone camera.' } }
      ]
    },
    stock: {
      img: 'screen-products.jpg',
      badge: { si: '📦 ස්මාර්ට් තොග කළමනාකරණය (Stock Catalog)', en: '📦 Inventory & Products' },
      title: { si: 'භාණ්ඩ නාමාවලිය සහ තොග පාලනය', en: 'Product Catalog & Automated Stock' },
      desc: {
        si: 'ඕනෑම භාණ්ඩයක් තත්පර 10කින් මිල, පිරිවැය, තොග ප්‍රමාණය සහ Barcode සමග එක්කරන්න. විකිණෙන විට තොග ස්වයංක්‍රීයව අඩුවේ.',
        en: 'Add products with barcode, cost price, selling price, and category in seconds. Stock automatically deducts upon every sale.'
      },
      features: [
        { icon: '🔍', title: { si: 'ක්ෂණික භාණ්ඩ සෙවුම', en: 'Instant Product Search' }, desc: { si: 'නාමය හෝ Barcode මගින් ක්ෂණිකව සොයන්න.', en: 'Find any item instantly by name or barcode.' } },
        { icon: '🏷️', title: { si: 'පිරිවැය & ලාභ ප්‍රතිශතය', en: 'Cost & Selling Margins' }, desc: { si: 'භාණ්ඩයක ලාභය නිවැරදිව කළමනාකරණය.', en: 'Keep track of unit costs and profit margins.' } },
        { icon: '📊', title: { si: 'තොග යාවත්කාලීන කිරීම්', en: 'Stock Adjustments' }, desc: { si: 'අලුත් තොග ලැබුණු විට ක්ෂණිකව සංස්කරණය.', en: 'Update inventory quantities when restocked.' } },
        { icon: '📁', title: { si: 'කාණ්ඩ (Categories)', en: 'Smart Categories' }, desc: { si: 'බීම, කෑම, සබන් ආදී වශයෙන් වර්ගීකරණය.', en: 'Organize catalog into fast-filter categories.' } }
      ]
    },
    reports: {
      img: 'screen-reports.jpg',
      badge: { si: '📈 ලාභ වාර්තා & ණය ලෙජරය (Reports & Ledger)', en: '📈 Reports & Financial Ledger' },
      title: { si: 'දෛනික ආදායම, ලාභය සහ ණය ලෙජරය', en: 'Revenue, Gross Margins & Credit Book' },
      desc: {
        si: 'දවසේ ආදායම, සම්පූර්ණ ලාභය, නිකුත් කළ බිල්පත් ගණන සහ පාරිභෝගික ණය මුදල් එක තැනකින් බලාගන්න. දිනය අනුව වාර්තා පෙරන්න.',
        en: 'Deep financial visibility: daily revenue, gross profit margin, bill counts, unpaid customer credits, and settled debts by custom date range.'
      },
      features: [
        { icon: '💵', title: { si: 'දෛනික ශුද්ධ ලාභය', en: 'Net & Gross Profit' }, desc: { si: 'කඩයේ සැබෑ ලාභය නිවැරදිව ගණනය කෙරේ.', en: 'Precise margin and profit metrics calculated locally.' } },
        { icon: '📒', title: { si: 'පාරිභෝගික ණය ලෙජරය', en: 'Customer Credit Book' }, desc: { si: 'ණයට ගත් අය සහ ගෙවූ මුදල් පැහැදිලිව.', en: 'Track outstanding balances and partial repayments.' } },
        { icon: '📅', title: { si: 'දින පෙරහන් (Date Filters)', en: 'Date Range Filters' }, desc: { si: 'ඕනෑම දවසක හෝ මාසයක වාර්තා ලබාගන්න.', en: 'Review any past date, week, or monthly cycle.' } },
        { icon: '📤', title: { si: 'Excel / CSV Export', en: 'Data Export' }, desc: { si: 'ගිණුම් කටයුතු සඳහා Backup ලබාගන්න.', en: 'Download transaction logs for accounting.' } }
      ]
    },
    settings: {
      img: 'screen-settings.jpg',
      badge: { si: '⚙️ සැකසුම් & Data Backup (Store Hardware)', en: '⚙️ Store Setup & Hardware' },
      title: { si: 'වෙළඳසැල් විස්තර, මුද්‍රණ යන්ත්‍ර & දත්ත සුරැකුම', en: 'Shop Profile, Printer & 1-Click Backup' },
      desc: {
        si: 'ඔබේ කඩයේ නම, ලිපිනය, දුරකථන අංකය සහ බිල්පතේ අගට වැටෙන පණිවිඩය සකසන්න. 58mm/80mm Thermal Printer එක සකසා තනි ක්ලික් එකෙන් Backup ලබාගන්න.',
        en: 'Configure shop identity, receipt header/footer notes, 58mm/80mm printer paper width, and download complete encrypted local backups anytime.'
      },
      features: [
        { icon: '🏪', title: { si: 'කඩයේ නම & බිල්පත් Header', en: 'Custom Receipt Header' }, desc: { si: 'ඔබේ වෙළඳසැලේ නම සහ දුරකථනය බිලට වැටේ.', en: 'Display your shop name, address, and telephone.' } },
        { icon: '🖨️', title: { si: '58mm & 80mm Printer', en: 'Thermal Printer Width' }, desc: { si: 'Mini Bluetooth හෝ Standard POS Printer.', en: 'Support for both 58mm portable and 80mm desktop printers.' } },
        { icon: '💾', title: { si: '1-Click Data Backup', en: '1-Click Local Backup' }, desc: { si: 'සියලු දත්ත දුරකථනයට Download කරගන්න.', en: 'Export full offline database file for safekeeping.' } },
        { icon: '🔑', title: { si: 'Device ID & Activation', en: 'Hardware Activation' }, desc: { si: 'දින 7ක Trial එකෙන් පසු WhatsApp මගින් සක්‍රියයි.', en: 'Offline machine license activation via WhatsApp.' } }
      ]
    }
  };

  let currentActiveScreen = 'dashboard';

  function buildScreenHtml(screenKey, lang) {
    const item = screenData[screenKey] || screenData.dashboard;
    const l = lang === 'si' ? 'si' : 'en';
    const appUrl = getAppUrl();
    const tryBtnText = l === 'si' ? 'POS එකෙහි අත්හදා බලන්න' : 'Try Feature in POS';
    const fullImgBtnText = l === 'si' ? '🔍 සම්පූර්ණ Screenshot එක බලන්න' : '🔍 View Full Screenshot';

    const featuresHtml = item.features.map(f => `
      <div class="showcase-feature-item">
        <div class="showcase-feature-icon">${f.icon}</div>
        <div class="showcase-feature-text">
          <strong>${f.title[l]}</strong>
          <span>${f.desc[l]}</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="showcase-card-grid">
        <div class="showcase-shot-col">
          <div class="showcase-device-frame">
            <img src="${item.img}" alt="${item.title[l]}" class="showcase-img" loading="lazy">
          </div>
        </div>
        <div class="showcase-detail-col">
          <div class="showcase-tag-badge">${item.badge[l]}</div>
          <h3 class="showcase-title">${item.title[l]}</h3>
          <p class="showcase-desc">${item.desc[l]}</p>
          <div class="showcase-features-list">
            ${featuresHtml}
          </div>
          <div class="showcase-actions">
            <a href="${appUrl}" class="btn btn-primary pos-launch-btn">
              <span>${tryBtnText}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z"/></svg>
            </a>
            <a href="${item.img}" target="_blank" rel="noopener" class="btn btn-secondary">
              <span>${fullImgBtnText}</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  function initScreensGallery() {
    const screenTabBtns = document.querySelectorAll('.screen-tab-btn');
    const screenContainer = document.getElementById('screenLiveContainer');

    function renderScreen(screenKey) {
      if (!screenContainer) return;
      currentActiveScreen = screenKey || currentActiveScreen;
      screenContainer.style.opacity = '0';
      setTimeout(() => {
        screenContainer.innerHTML = buildScreenHtml(currentActiveScreen, currentLang);
        screenContainer.style.opacity = '1';
      }, 150);
    }

    // Expose for language changes
    window.refreshScreensGallery = function () {
      renderScreen(currentActiveScreen);
    };

    screenTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        screenTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const screenKey = btn.getAttribute('data-screen');
        renderScreen(screenKey);
      });
    });

    // Initial render
    renderScreen('dashboard');
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

  // --- Mobile Hamburger Drawer & Layout Lock ---
  function initMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('mobileDrawerOverlay');
    const closeBtn = document.getElementById('drawerCloseBtn');

    function openDrawer() {
      if (menuBtn) menuBtn.classList.add('active');
      if (drawer) {
        drawer.classList.add('active');
        drawer.setAttribute('aria-hidden', 'false');
      }
      if (overlay) overlay.classList.add('active');
      document.body.classList.add('drawer-open');
    }

    function closeDrawer() {
      if (menuBtn) menuBtn.classList.remove('active');
      if (drawer) {
        drawer.classList.remove('active');
        drawer.setAttribute('aria-hidden', 'true');
      }
      if (overlay) overlay.classList.remove('active');
      document.body.classList.remove('drawer-open');
    }

    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (drawer && drawer.classList.contains('active')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDrawer();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', closeDrawer);
    }

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });

    // Close when clicking any nav link in the drawer
    if (drawer) {
      drawer.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          closeDrawer();
        });
      });
    }

    // Connect drawer language switch to main language system
    const drawerLangSwitch = document.getElementById('drawerLangSwitch');
    if (drawerLangSwitch) {
      drawerLangSwitch.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.lang;
          if (typeof setLanguage === 'function') {
            setLanguage(lang);
          }
        });
      });
    }

    // Guard against iOS pinch-to-zoom gesture on mobile
    document.addEventListener('gesturestart', (e) => {
      if (window.innerWidth <= 840) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturechange', (e) => {
      if (window.innerWidth <= 840) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gestureend', (e) => {
      if (window.innerWidth <= 840) e.preventDefault();
    }, { passive: false });
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
