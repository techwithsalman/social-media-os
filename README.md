# Social Media OS 🚀
> **One Content → Every Platform** | Full-Stack Multi-Platform Social Media SaaS Platform

**Social Media OS** is a modern, modular, production-ready SaaS application designed to connect multiple social networks (**Instagram, Facebook Pages, TikTok, LinkedIn, YouTube, X / Twitter**) and manage, schedule, sync, and publish media across all channels from a single unified operating center.

---

## Architecture Overview

* **Frontend**: Next.js 14/15 App Router, React 18, TypeScript, Tailwind CSS, Lucide Icons, Custom Design System.
* **Backend**: Next.js Server Route Handlers, TypeScript, Secure Cookie Sessions.
* **Database & ORM**: PostgreSQL / SQLite with Prisma ORM multi-tenant relational schema.
* **Storage**: Pluggable storage abstraction (`LocalStorageProvider` + `S3StorageProvider` for AWS S3 / Cloudflare R2).
* **Scheduling & Queues**: Background queue engine with per-platform state machine and retry lifecycle.
* **Integrations Layer**: Standalone adapter modules in `/src/integrations/*` with both `REAL_API_MODE` and `MOCK_API_MODE`.

---

## 1. How to Install Dependencies

```bash
# Clone repository and navigate to root
cd Social-Media-OS

# Install all npm dependencies
npm install

# Generate Prisma Client
npx prisma generate
```

---

## 2. How to Setup Database

Social Media OS supports two database workflows:

### A. Zero-Configuration Local Development (Default)
By default, the application uses SQLite via `DATABASE_URL="file:./dev.db"` so you can run and test everything immediately without installing external database software.

### B. PostgreSQL for Production
1. In `prisma/schema.prisma`, update the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set your PostgreSQL connection string in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/social_media_os?schema=public"
   ```

---

## 3. How to Run Database Migrations

```bash
# Push the schema changes directly to the database
npx prisma db push

# (Optional) Run database migration in production
npx prisma migrate dev --name init
```

---

## 4. How to Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

* **Quick Demo Access**: Click **1-Click Instant Demo Login** on the login page or use `demo@socialos.dev` / `demo123456`.
* **Seed Demo Accounts**: Click the **Seed Demo Data** button in the top navigation header to immediately populate 6 connected channels, upcoming scheduled posts, and activity history.

---

## 5. How to Setup Redis & Background Publishing Jobs

The queue system features dual execution modes:

1. **In-Process Database-Backed Scheduler (Local Dev)**:
   - Polls and processes due posts whenever `/api/queue/process` is invoked or via local interval triggers.
2. **Redis & BullMQ (Production Scale)**:
   - Add your Redis connection string in `.env`:
     ```env
     REDIS_URL="redis://localhost:6379"
     ```

---

## 6. How to Configure File Storage

File storage is managed via `src/lib/storage`:

* **Local Storage (Default)**: Uploads are stored in `./public/uploads` and served directly.
  ```env
  STORAGE_PROVIDER="local"
  ```
* **AWS S3 / Cloudflare R2**:
  ```env
  STORAGE_PROVIDER="s3"
  S3_BUCKET_NAME="your-bucket-name"
  S3_REGION="us-east-1"
  S3_ACCESS_KEY_ID="your-access-key"
  S3_SECRET_ACCESS_KEY="your-secret-key"
  ```

---

## 7. How to Enable Mock vs. Real Mode

Set `MOCK_API_MODE` in `.env`:

```env
# MOCK SIMULATION MODE (Default for local testing without live developer credentials)
MOCK_API_MODE="true"

# REAL API PRODUCTION MODE
MOCK_API_MODE="false"
```

In Mock Mode:
- Platform OAuth flows are simulated with realistic avatars and handles.
- Publishing returns verified simulated IDs with clear "Development Simulation" badges.
- No live developer credentials are required.

---

## 8. Social Platform Connection Guides

| Platform | Developer Portal | Supported Formats |
| :--- | :--- | :--- |
| **Instagram** | [Meta Developer Portal](https://developers.facebook.com/apps) | Photos (JPG/PNG), Reels (MP4/MOV), Carousels |
| **Facebook** | [Meta Developer Portal](https://developers.facebook.com/apps) | Page Posts, Photos, Videos, Facebook Reels |
| **TikTok** | [TikTok for Developers](https://developers.tiktok.com) | Direct Video Post (MP4/MOV/WEBM) |
| **LinkedIn** | [LinkedIn Developer Portal](https://www.linkedin.com/developers) | Posts, Single Media, Articles |
| **YouTube** | [Google Cloud Console](https://console.cloud.google.com/apis) | Videos, YouTube Shorts (MP4/MOV) |
| **X / Twitter** | [X Developer Portal](https://developer.x.com) | Tweets, Photos, Videos (up to 280 chars) |

---

## 9. Required API Permissions & Scopes

* **Instagram**: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`.
* **Facebook**: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`, `publish_video`.
* **TikTok**: `user.info.basic`, `video.upload`, `video.publish`.
* **LinkedIn**: `openid`, `profile`, `email`, `w_member_social`, `w_organization_social`.
* **YouTube**: `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.readonly`.
* **X / Twitter**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`.

---

## 10. Platform Review & Approval Requirements

1. **Meta (Instagram & Facebook)**: Requires Meta App Review for `instagram_content_publish` and `pages_manage_posts` before non-developer accounts can connect.
2. **TikTok**: Requires Content Posting API audit approval for live commercial production keys.
3. **Google (YouTube)**: Requires Google OAuth App Verification for `youtube.upload` scope.
4. **LinkedIn**: Requires Community Management API product approval.

---

## 11. How Scheduling Works

1. Users select target platforms and pick date, time, and timezone in the **Create Post** or **Bulk Upload** composer.
2. A `ContentPost` is persisted with `status: "SCHEDULED"` and a target `scheduledFor` UTC timestamp.
3. `PlatformPost` records are created for each selected channel with custom captions, hashtags, and metadata.
4. The background queue worker checks for posts where `scheduledFor <= NOW()` and initiates publishing.

---

## 12. How Publishing Jobs Work

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> QUEUED : Schedule / Post Now
    QUEUED --> PROCESSING : Worker Picked Up
    PROCESSING --> UPLOADING : Transcoding & Container Init
    UPLOADING --> PUBLISHED : Platform 200 OK
    UPLOADING --> FAILED : Platform API Error
    FAILED --> RETRYING : Retry Triggered
    RETRYING --> PROCESSING
    PUBLISHED --> [*]
```

- Each connected account runs as an **independent job**. If YouTube fails, Instagram and Facebook will still publish successfully.
- Overall status is marked `PUBLISHED`, `PARTIALLY_FAILED`, or `FAILED`.
- Full audit logs are written to `PublishingAttempt` with HTTP status codes and error messages (never exposing private access tokens).

---

## 13. How to Troubleshoot Failed Posts

1. Navigate to **Scheduled** or **Published** posts in the sidebar.
2. Review the red **Failed** badge and click to inspect the specific platform error message.
3. Check **Connected Accounts** to verify if an OAuth token expired or requires re-authentication.
4. Use **Edit & Retry** to adjust captions (e.g. 280-character limit on X) and re-trigger publishing.

---

## Project Directory Structure

```
Social-Media-OS/
├── prisma/
│   └── schema.prisma              # Relational Multi-Tenant SaaS Schema
├── public/
│   └── uploads/                   # Local file storage target
├── src/
│   ├── app/
│   │   ├── (auth)/                # Login & Signup flows
│   │   ├── (dashboard)/           # Dashboard, Composer, Calendar, Bulk, etc.
│   │   ├── api/                   # Server API Route Handlers (Auth, Posts, Queue, etc.)
│   │   ├── globals.css            # Custom SaaS Tailwind Design System
│   │   └── layout.tsx             # Root Application Layout
│   ├── components/
│   │   ├── layout/                # Sidebar, Header, Notifications Drawer, AppLayout
│   │   └── ui/                    # PlatformIcons, Modal, Badges
│   ├── integrations/              # Modular Platform Adapters
│   │   ├── instagram/             # Meta Graph API Adapter
│   │   ├── facebook/              # Meta Pages Adapter
│   │   ├── tiktok/                # TikTok Content Posting Adapter
│   │   ├── linkedin/              # LinkedIn Share Adapter
│   │   ├── youtube/               # YouTube Data API v3 Adapter
│   │   ├── x/                     # X API v2 Adapter
│   │   └── index.ts               # Master Platform Registry & Factory
│   └── lib/
│       ├── auth.ts                # Session & JWT Utilities
│       ├── crypto.ts              # AES-256 Token Encryption
│       ├── prisma.ts              # Prisma Client Singleton
│       ├── queue/                 # Publishing Engine & Worker
│       ├── seed.ts                # Realistic Demo Data Seeder
│       └── storage/               # Local & S3 Storage Abstraction
├── .env.example                   # Environment configuration template
├── package.json
└── tsconfig.json
```
