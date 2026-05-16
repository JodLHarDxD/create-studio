# DEPLOY.md — Exact Deployment Guide

> Follow in order. Each step depends on the previous.

---

## Step 1 — Supabase Setup (5 min)

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Wait for project to provision (~2 min)
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Paste entire contents of `database_setup.sql`
6. Click **Run** (or Ctrl+Enter)
7. Verify: green success message, no red errors

**Collect these values (Settings → API):**
```
Project URL:     https://xxxxxxxxxxxx.supabase.co
anon public:     eyJhbGciOiJ...  (long JWT)
service_role:    eyJhbGciOiJ...  (different long JWT — keep secret)
```

**Enable Realtime (Settings → API → Replication):**
- Enable for tables: `tasks`, `project_files`

---

## Step 2 — Backend on Railway (10 min)

1. Push project to GitHub (include the `backend/` folder)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects Python from `requirements.txt`
5. Set start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
   - Settings → Deploy → Start Command

**Set Environment Variables (Settings → Variables):**
```
SUPABASE_URL              = https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJ...  (service_role key from Step 1)
GEMINI_API_KEY            = AIzaSy...        (optional — Google API key)
```

6. Deploy → wait for green checkmark
7. Copy the Railway URL: `https://your-app.railway.app`
8. Test: open `https://your-app.railway.app/health` → should return `{"status":"operational"}`

---

## Step 3 — Frontend on Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select same repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

**Set Environment Variables:**
```
VITE_SUPABASE_URL     = https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJ...  (anon public key from Step 1)
VITE_API_URL          = https://your-app.railway.app  (Railway URL from Step 2)
```

6. Deploy → wait for green checkmark
7. Open the Vercel URL → should see Kinetix OS login screen

---

## Step 4 — First Login (2 min)

1. Open Vercel URL
2. Click **Register**
3. Enter email, password, full name
4. Select role: **Admin** (for yourself)
5. Click Create Account
6. You're in — you'll see the IDE workspace with demo seed data

**Create a team member:**
1. Register a second account with role **Member**
2. Log in as member → verify they can only see their assigned tasks

---

## Step 5 — Configure AI (1 min)

1. In the workspace, click the **gear icon** in the top right of the AI Chat panel
2. Enter your API key(s):
   - Anthropic: `sk-ant-...`
   - OpenAI: `sk-...`
   - Google: `AIzaSy...`
3. Click **Save Configuration**
4. Select a model from the dropdown
5. Send a message — AI should respond

---

## Verification Checklist

After deployment, verify each:

```
[ ] /health returns 200
[ ] Login page loads on Vercel URL
[ ] Register creates user (check Supabase Auth → Users)
[ ] Profile created in Supabase profiles table
[ ] Tasks visible after login
[ ] Task status can be updated
[ ] File opens in Monaco editor
[ ] AI chat responds (after adding API key)
[ ] Model switching works mid-conversation
[ ] Dashboard shows charts (admin login)
[ ] Member login shows only own tasks
```

---

## Troubleshooting

### "Failed to fetch" on AI chat
→ Check `VITE_API_URL` in Vercel matches Railway URL exactly (no trailing slash)
→ Check Railway is deployed and healthy at `/health`
→ Check CORS — Railway backend has `allow_origins=["*"]`

### Login fails with "Invalid credentials"
→ Supabase Email auth must be enabled: Authentication → Providers → Email → Enable

### "Supabase credentials missing" in Railway logs
→ Set `SUPABASE_URL` (not `VITE_SUPABASE_URL`) in Railway env vars

### Real-time not working
→ Enable Realtime for `tasks` and `project_files` tables in Supabase

### 404 on Vercel page refresh
→ `vercel.json` must have the SPA rewrite rule — already included in project

### RLS blocking queries
→ Check user is authenticated (JWT valid)
→ Test in Supabase SQL editor: `SET LOCAL role = authenticated; SELECT * FROM tasks;`
→ Check `is_admin()` function exists (from database_setup.sql)

---

## Railway → Render Migration (if Railway unavailable)

1. Go to [render.com](https://render.com) → New Web Service
2. Connect GitHub repo
3. Runtime: Python 3
4. Build command: `pip install -r backend/requirements.txt`
5. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
6. Set same env vars as Railway
7. Update `VITE_API_URL` in Vercel to new Render URL

Note: Render free tier sleeps after 15min inactivity. Use Koyeb.com for always-on free tier.
