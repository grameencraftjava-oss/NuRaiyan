# Deployment & Production Hosting Guide — Nuraiyan (নূরাইয়ান)

এই ফাইলটিতে Nuraiyan সোশ্যাল নেটওয়ার্ক অনলাইনে (Railway, Render, VPS, Vercel, Supabase, Neon) হোস্ট করার সহজ ও নির্ভরযোগ্য নিয়ম দেওয়া হলো।

---

## ১. হোস্টিং আর্কিটেকচার (Best Architecture)

| কম্পোনেন্ট | প্রস্তাবিত প্ল্যাটফর্ম | ফ্রি/লো-কস্ট অপশন |
| :--- | :--- | :--- |
| **Frontend (Next.js 14)** | Vercel / Railway / Render | **Vercel** (Free, Global CDN, Best for Next.js) |
| **Backend (Express + WebSockets)** | Railway / Render / DigitalOcean / VPS | **Railway** বা **Render Web Service** (Supports WebSockets) |
| **PostgreSQL Database** | Neon / Supabase / Railway | **Neon.tech** বা **Supabase** (Free Tier PostgreSQL) |

---

## ২. ব্যাকএন্ড ডিপ্লয়মেন্ট (Railway / Render / VPS)

### Environment Variables (.env)
```env
PORT=5001
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain.vercel.app

# Database (Neon / Supabase / Railway Postgres Connection URL)
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/social_network?sslmode=require"
USE_POSTGRES=true

# Security Secrets (অনলাইনে দেওয়ার আগে রেন্ডম শক্তিশালী কি দিন)
JWT_ACCESS_SECRET="super_strong_production_access_key_min_32_chars"
JWT_REFRESH_SECRET="super_strong_production_refresh_key_min_32_chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# WebRTC STUN Server (Free Google STUN)
STUN_SERVER="stun:stun.l.google.com:19302"
```

### Build & Start Command
- **Build Command:** `npm run build` (runs `prisma generate && tsc`)
- **Start Command:** `npm start` (runs `node dist/index.js`)
- **Database Migration:** `npx prisma db push` বা `npx prisma migrate deploy`

---

## ৩. ফ্রন্টএন্ড ডিপ্লয়মেন্ট (Vercel)

### Environment Variables
```env
NEXT_PUBLIC_API_URL="https://your-backend-service.railway.app"
NEXT_PUBLIC_SOCKET_URL="https://your-backend-service.railway.app"
```

### Build Settings
- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

---

## ৪. গুরুত্বপূর্ণ সিকিউরিটি চেকলিস্ট

1. ✅ **CORS & CSRF:** ব্যাকএন্ডের `CLIENT_URL`-এ আপনার ফ্রন্টএন্ড ডোমেইন দিন (যেমন: `https://your-app.vercel.app`)। একাধিক ডোমেইন হলে কমা দিয়ে লিখুন।
2. ✅ **WebSocket Support:** ব্যাকএন্ড সার্ভার যেখানে হোস্ট করবেন সেখানে WebSockets সচল থাকতে হবে (Railway ও Render Web Service ডিফল্টভাবেই সাপোর্ট করে)।
3. ✅ **Persistent Uploads:** প্রোডাকশনে বড় ভিডিও/ছবি রাখার জন্য Cloudinary, AWS S3 বা Supabase Storage ব্যবহার করা সবচেয়ে ভালো; তবে VPS বা Railway Persistent Volume-এও লোকাল `/uploads` ফোল্ডার রাখা যায়।
