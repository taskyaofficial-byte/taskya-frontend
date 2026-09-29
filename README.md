# Taskya AI Frontend V1.4

Clean, responsive static frontend for taskya.in. Configure `config.js` before deployment.

1. `API_BASE_URL` → your Render backend. Frontend calls `POST /api/chat` with `{message, web_search, style, model}`.
2. Supabase Auth placeholders are included. Add only the public project URL + anon key; never expose service-role secrets.
3. Razorpay/PayPal placeholders are included but intentionally inactive. Real checkout/order creation should be server-side.
4. Privacy, Terms, Refund and Contact links are present in the sidebar/footer. The policy text is starter text and should be finalized before launch.
5. Guest limit is UI-only in this frontend. Enforce quotas and entitlements on the backend.
6. Deploy to Vercel/Netlify and connect `taskya.in`.

## V1.4 UI polish
- Reduced hero/logo sizing for a cleaner first viewport
- Removed duplicate large task cards; homepage uses one compact starter-chip row/grid
- Responsive sidebar: permanent on desktop, hamburger slide-out on mobile
- Mobile-first composer spacing with compact Attach/Web/Voice controls
- Desktop starter prompts stay horizontal; mobile prompts become a 2×2 grid
- Taskya Fast v1 / Taskya Pro Agent selector retained and sent to `/api/chat`
- Thinking shimmer + gradual response typing animation retained
- Original Taskya branding splash, T mark, favicon and core sections preserved
