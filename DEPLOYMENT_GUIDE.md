# 🚀 Production Deployment Guide (GitHub + Supabase + Vercel)

This guide provides step-by-step instructions for uploading your **Exam Scheduler App** to **GitHub**, setting up a cloud PostgreSQL database on **Supabase**, and deploying the fullstack application to **Vercel**.

---

## 1. ⚡ Step 1: Upload Code to GitHub

Open PowerShell / Terminal in your project root directory (`Final Exam Maker`):

```bash
# 1. Initialize git repository (if not already done)
git init

# 2. Stage all files
git add .

# 3. Create initial commit
git commit -m "Initial commit - Exam Scheduler with Supabase & Vercel support"

# 4. Connect to your GitHub repository
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git

# 5. Rename branch to main and push
git branch -M main
git push -u origin main
```

---

## 2. ⚡ Step 2: Set Up Supabase Database (Cloud PostgreSQL)

1. Go to [Supabase.com](https://supabase.com) and sign in.
2. Click **New Project**, choose a project name (e.g. `exam-scheduler-db`), set a database password, and choose your region.
3. Once the project is created, click **SQL Editor** in the left sidebar.
4. Open the file [`backend/supabase_schema.sql`](file:///d:/HUE/DEVELOPED%20SOFTWARE/Final%20Exam%20Maker/backend/supabase_schema.sql) in your project, copy its contents, paste them into the Supabase SQL Editor, and click **Run**.
5. Go to **Project Settings** -> **Database** -> **Connection String** -> **URI**:
   - Copy your PostgreSQL connection URI.
   - Example URI: `postgres://postgres.[your-project-ref]:[your-password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`

---

## 3. ⚡ Step 3: Deploy to Vercel

1. Go to [Vercel.com](https://vercel.com) and sign in.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`YOUR_REPOSITORY_NAME`).
4. Under **Environment Variables**, add the following key:
   - **Key**: `DATABASE_URL`
   - **Value**: *(Paste your Supabase Connection String from Step 2)*
5. Click **Deploy**!

---

### 🎉 Features Active in Production
- **Automated SQLite / PostgreSQL Switching**:
  - Automatically connects to Supabase Cloud PostgreSQL in production via `DATABASE_URL`.
  - Falls back to local SQLite when running offline on your computer.
- **Unified Vercel Routing**:
  - Serves the high-performance Vite React UI and routes `/api/*` endpoints to Serverless Functions seamlessly.
