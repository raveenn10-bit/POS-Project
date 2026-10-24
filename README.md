# Harsh Apex Retail POS — Android & iPhone SaaS PWA

## What it does
Products, stock, billing, receipts, daily reports, shop details, JSON export/import. The app now has a server-side 7-day trial and Rs. 2,500 monthly license gate. POS data remains local on each device; the license is checked online.

## Subscription setup

The included `api/` folder is for Vercel Functions. The payment backend uses Supabase REST and PayHere without exposing secrets in the browser.

1. Create a Supabase project and run `supabase-schema.sql` in its SQL editor.
2. Create a PayHere merchant account and enable Checkout API / notification URL access. PayHere account approval and merchant settings are required before taking real payments.
3. Deploy this folder as a Vercel project with these environment variables:

   - `APP_URL` — deployed HTTPS URL, for example `https://pos.yourdomain.com`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only secret
   - `PAYHERE_MERCHANT_ID`
   - `PAYHERE_MERCHANT_SECRET` — server-only secret

4. In PayHere, make sure the notification URL is `https://YOUR-DOMAIN/api/payhere-notify`.
5. Open the deployed HTTPS URL. A new device receives 7 days free. After the trial, the customer pays Rs. 2,500 and the verified callback activates another 30 days.

For production, keep the Supabase service-role key and PayHere merchant secret only in Vercel environment variables. Never put them in `app.js` or the public repository.

## Publish for everyone to install
1. Deploy the **contents** of this folder (index.html at the website root) to a public HTTPS static host such as Netlify or Vercel.
2. Share the deployed HTTPS URL with shop owners. Each device stores **its own separate data**.
3. **Android:** Open URL in Chrome. Tap **Install App** if shown, otherwise Chrome **⋮ → Install app** or **Add to Home screen**. Confirm installation.
4. **iPhone:** Open URL in Safari. Tap **Share → Add to Home Screen → Add**.
5. Open the installed app while online once, then test offline by enabling airplane mode. Add test products and test a bill before business use.

No APK or App Store submission is required for this PWA. Install availability and menu labels depend on browser and OS version. A website URL is necessary: sharing the ZIP directly does not install the app.

## Backups & important limitations
- POS data is stored in browser localStorage on that specific device and website origin. It **does not sync** between phones or with other users. License records and payments are stored server-side.
- Export backups regularly from Settings and store copies outside the phone. Clearing site data, uninstalling, browser eviction, or device loss may erase data.
- Import replaces the existing dataset: back up first.
- PDF receipt uses the system print/save flow. Receipt share uses the supported system share UI.
- Gross profit is not net profit. No refunds, taxes, credit sales, scanner, Bluetooth printer, or multi-user access.
- localStorage is a basic MVP approach and not a reliable production-grade database. Before broad retail distribution, migrate to IndexedDB, validate imports, test on target devices and implement a backup strategy.
- Service workers require HTTPS (or localhost); opening index.html from Files does not install an offline PWA.
