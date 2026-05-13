# Sibuyan Coconut Identification System

Modern Next.js application for coconut variety records and mock image identification focused on Sibuyan Island, Romblon.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- MongoDB with Prisma ORM
- NextAuth credentials authentication with bcrypt password hashing
- shadcn/ui-style components, lucide-react icons
- Recharts dashboard analytics
- Zustand state store
- Local image preview and Cloudinary-ready environment variables

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET`.

4. Push the MongoDB schema and seed sample Sibuyan records:

```bash
npm run prisma:push
npm run prisma:seed
```

5. Start the app:

```bash
npm run dev
```

## Seed accounts

- Admin: `admin@sibuyan.gov.ph` / `Admin12345`
- User: `user@sibuyan.gov.ph` / `User12345`

## Features

- Landing page with full-width image carousel, tropical/agricultural palette, statistics, featured varieties, and footer
- Registration and login with role-aware sessions
- Protected admin dashboard with sidebar navigation, analytics, recent varieties, users, settings, and activity logs
- Coconut variety CRUD with search, location filter, pagination, image URL persistence, upload preview, validation, and delete confirmation
- Public records browser with search and filters
- Mock identification module that stores upload metadata and identification history
- CSV and PDF export endpoints protected for admins
- Dark mode, loading skeleton, toast notifications, responsive layouts

## Production notes

- Replace the mock identification logic in `lib/mock-identification.ts` with a real ML service or model endpoint.
- Implement persistent file storage by sending uploads to Cloudinary or a private object storage bucket, then save the returned URL in Prisma.
- Rotate `NEXTAUTH_SECRET` and use MongoDB Atlas or another managed MongoDB provider for deployment.
