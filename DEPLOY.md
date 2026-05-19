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

## Step 2 — Backend on Render (10 min)

1. Push project to GitHub (include `backend/` and `render.yaml`)
2. Go to [render.com](https://render.com) → New → **Blueprint**
3. Connect this repo — Render auto-detects `render.yaml`
4. When prompted for secret values, enter:

**Environment Variables:**
```
SUPABASE_URL              = https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJ...  (service_role key from Step 1)
GEMINI_API_KEY            = AIzaSy...        (optional — Google API key)
OPENAI_API_KEY            = sk-...           (optional)
ANTHROPIC_API_KEY         = sk-ant-...       (optional)
```

5. Deploy → wait for green checkmark
6. Copy the Render URL: `https://creat-studio-api.onrender.com`
7. Test: open `https://creat-studio-api.onrender.com/health` → should return `{"status":"operational"}`

> **Note:** Render free web services sleep after 15 min inactivity. First request after sleep takes ~30s. Upgrade to paid Render instance for always-on behavior.

---

## Step 3 — Frontend on Vercel (5 min)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select same repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`

**Set Environment Variables:**
```
VITE_SUPABASE_URL      = https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJ...  (anon public key from Step 1)
VITE_API_URL           = https://creat-studio-api.onrender.com  (Render URL from Step 2)
```

6. Deploy → wait for green checkmark
7. Open the Vercel URL → should see login screen

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
→ Check `VITE_API_URL` in Vercel matches Render URL exactly (no trailing slash)
→ Check Render service is deployed and healthy at `/health`
→ Check CORS — backend has `allow_origins=["*"]`

### Login fails with "Invalid credentials"
→ Supabase Email auth must be enabled: Authentication → Providers → Email → Enable

### "Supabase credentials missing" in Render logs
→ Set `SUPABASE_URL` (not `VITE_SUPABASE_URL`) in Render env vars

### Real-time not working
→ Enable Realtime for `tasks` and `project_files` tables in Supabase

### 404 on Vercel page refresh
→ `vercel.json` must have the SPA rewrite rule — already included in project

### RLS blocking queries
→ Check user is authenticated (JWT valid)
→ Test in Supabase SQL editor: `SET LOCAL role = authenticated; SELECT * FROM tasks;`
→ Check `is_admin()` function exists (from database_setup.sql)

### Render service is slow to respond
→ Render free tier sleeps after 15 min. First request wakes it. Use paid tier for production.
