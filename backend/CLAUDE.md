# backend/CLAUDE.md — Backend Context

> Read this before touching any Python file. The root `CLAUDE.md` covers the full project. This file covers backend-specific patterns.

---

## What the Backend Does

FastAPI application with two responsibilities:
1. **AI orchestration** — routes requests to Anthropic / OpenAI / Google, injects context, returns responses
2. **Vector embedding** — generates embeddings for project files, stores in Supabase pgvector

The backend does **NOT** handle:
- Auth (Supabase handles it — frontend gets JWT, can pass it in Authorization header)
- CRUD for projects/tasks/files (Supabase JS client in frontend handles this directly)
- User management

---

## File Responsibilities

```
main.py         → FastAPI app, CORS middleware, router registration, health endpoint
database.py     → Supabase service-role client (singleton, bypasses RLS)
models.py       → Pydantic schemas for request validation
routers/
  ai_chat.py    → ALL logic: key resolution, RAG, provider routing, embedding
```

---

## Key Patterns

### Key Resolution (NEVER CHANGE PRIORITY ORDER)
```python
def resolve_key(provider: str, user_keys: Optional[APIKeys]) -> str:
    env_map = {"anthropic": "ANTHROPIC_API_KEY", "openai": "OPENAI_API_KEY", "google": "GEMINI_API_KEY"}
    user_key = getattr(user_keys, provider, None) if user_keys else None
    return user_key or os.getenv(env_map.get(provider, ""), "")
```
User key always wins. Server key is fallback. This is intentional.

### Provider Call Pattern (all identical shape)
```python
async def call_X(model_id, system, message, api_key) -> str:
    if not api_key:
        raise HTTPException(400, "X API key not configured.")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(URL, headers=AUTH_HEADERS, json=PAYLOAD)
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"X error: {resp.text[:300]}")
        return EXTRACT_TEXT(resp.json())
```
When adding a new provider, follow this exact shape. Never use provider SDKs — httpx only.

### RAG Pattern
```python
# 1. Embed the user query (always Google, always text-embedding-004)
embedding = await get_google_embedding(user_message, google_key)

# 2. Search pgvector (Supabase RPC)
result = supabase_client.rpc("match_project_files", {
    "query_embedding": embedding,
    "match_threshold": 0.5,   # min cosine similarity
    "match_count": 3,          # top K results
    "p_project_id": project_id,
}).execute()

# 3. Inject into system prompt (see build_system_prompt())
```
RAG uses Google embedding even when the chat model is Anthropic or OpenAI. This is correct — embedding model is separate from generation model.

### System Prompt Construction (build_system_prompt)
Order matters:
1. Base persona
2. Active file content (truncated to 4000 chars)
3. Active task description
4. RAG context (top-3 matching files)
5. Formatting instruction

Do not change this order. File content comes before RAG — it's the user's direct focus, RAG is supplementary.

---

## Adding a New AI Provider

1. Add `call_newprovider()` function following the pattern above
2. Add branch in `/api/ai/chat` endpoint:
   ```python
   elif provider == "newprovider":
       response_text = await call_newprovider(request.model_id, system, request.user_message, api_key)
   ```
3. Add env var mapping in `resolve_key()`:
   ```python
   env_map = {..., "newprovider": "NEWPROVIDER_API_KEY"}
   ```
4. Add models to `src/lib/aiModels.ts` with `provider: 'newprovider'`
5. Add key field to `APIKeys` Pydantic model in `ai_chat.py`

---

## Environment Variables

```
SUPABASE_URL              → required, Supabase project URL
SUPABASE_SERVICE_ROLE_KEY → required, bypasses RLS for embedding writes
GEMINI_API_KEY            → optional, server default for Google models
ANTHROPIC_API_KEY         → optional, server default for Anthropic models
OPENAI_API_KEY            → optional, server default for OpenAI models
```

If none of the AI keys are set server-side, users MUST provide their own via the frontend Settings modal. The backend will return HTTP 400 with a clear message.

---

## Error Handling Contract

All errors that reach the frontend should be:
- HTTP 400 for bad input / missing key (user's fault)
- HTTP 500 for provider failures (their fault)
- Always include `detail` field with human-readable message
- Never expose raw stack traces

```python
# Good
raise HTTPException(400, "Anthropic API key not configured. Add it in Settings.")

# Bad — leaks internals
raise HTTPException(500, str(e))  # avoid for user-facing errors
```

---

## Supabase Client

`database.py` exports `supabase_client` — a service-role Supabase client.

**Use it ONLY for:**
- Writing vector embeddings to `project_files.embedding`
- Reading data that needs to bypass RLS (admin operations)

**Never use it for:**
- Auth operations (use `supabase.auth` with user JWT instead)
- Regular CRUD that should respect RLS

The service role key bypasses ALL RLS policies. Wrong usage creates security holes.

---

## Deployment (Railway)

Start command:
```
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

Railway injects `$PORT` automatically. Never hardcode port 8000 in production.

Health check: `GET /health` → `{"status": "operational"}`

CORS is set to `allow_origins=["*"]` — acceptable for this assignment. In production, restrict to the Vercel frontend domain.

---

## Local Development

```bash
cd teamforge/
pip install -r backend/requirements.txt

# Set env vars
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...

uvicorn backend.main:app --reload --port 8000
```

Frontend proxies `/api/*` → `http://localhost:8000` via `vite.config.ts`. No CORS issues in local dev.

---

## Common Debugging

**"Supabase credentials missing" warning on startup**
→ Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars

**RAG returns no results**
→ Check `project_files.embedding` column is not null (files must be saved through `/api/ai/files`)
→ Lower `match_threshold` from 0.5 to 0.3 to test
→ Verify `match_project_files` RPC exists in Supabase (run `database_setup.sql`)

**HTTP 400 "API key not configured"**
→ User needs to add key in Settings modal
→ Or set server env var as fallback

**Provider returns non-200**
→ Error message includes first 300 chars of provider response
→ Check API key validity, quota, model name spelling

**Embedding dimension mismatch**
→ `text-embedding-004` outputs 768 dims — must match `vector(768)` in schema
→ If changing embedding model, recreate the column with correct dimension
