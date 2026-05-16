import json
import os
from typing import AsyncIterator, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from backend.models import APIKeys, ChatRequest, FileSaveRequest

router = APIRouter()


# ── Key resolution: user-provided key takes priority over server env ───────────
def resolve_key(provider: str, user_keys: Optional[APIKeys]) -> str:
    env_map = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "google": "GEMINI_API_KEY",
    }
    user_key = getattr(user_keys, provider, None) if user_keys else None
    return user_key or os.getenv(env_map.get(provider, ""), "")


# ── Build system prompt from context ──────────────────────────────────────────
def build_system_prompt(req: ChatRequest, rag_context: str = "") -> str:
    parts = [
        "You are an expert AI Developer Assistant embedded in a developer workspace. "
        "You help with code, tasks, and project decisions."
    ]
    if req.active_file_content:
        parts.append(f"\n## Active File Content:\n```\n{req.active_file_content[:4000]}\n```")
    if req.active_task:
        parts.append(f"\n## Active Task:\n{req.active_task}")
    if rag_context:
        parts.append(f"\n## Relevant Project Context (RAG):\n{rag_context}")
    parts.append("\nBe concise, precise, and use code blocks when relevant.")
    return "\n".join(parts)


# ── RAG: query Supabase vector search ─────────────────────────────────────────
async def get_rag_context(project_id: str, query_embedding: list) -> tuple[str, list]:
    try:
        from backend.database import supabase_client
        result = supabase_client.rpc("match_project_files", {
            "query_embedding": query_embedding,
            "match_threshold": 0.5,
            "match_count": 3,
            "p_project_id": project_id,
        }).execute()
        if result.data:
            rag_text = ""
            files_used = []
            for match in result.data:
                rag_text += f"File: {match.get('name')}\n{match.get('content', '')[:800]}\n---\n"
                files_used.append(match.get("name", ""))
            return rag_text, files_used
    except Exception as e:
        print(f"RAG warning: {e}")
    return "", []


# ── Google embedding ───────────────────────────────────────────────────────────
async def get_google_embedding(text: str, api_key: str) -> list:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json={"model": "models/text-embedding-004", "content": {"parts": [{"text": text[:8000]}]}},
        )
        if resp.status_code == 200:
            return resp.json()["embedding"]["values"]
    return []


# ── Provider call functions (non-streaming) ────────────────────────────────────
async def call_anthropic(model_id: str, system: str, message: str, api_key: str) -> str:
    if not api_key:
        raise HTTPException(400, "Anthropic API key not configured. Add it in Settings.")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model_id,
                "max_tokens": 2048,
                "system": system,
                "messages": [{"role": "user", "content": message}],
            },
        )
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Anthropic error: {resp.text[:300]}")
        return resp.json()["content"][0]["text"]


async def call_openai(model_id: str, system: str, message: str, api_key: str) -> str:
    if not api_key:
        raise HTTPException(400, "OpenAI API key not configured. Add it in Settings.")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": model_id,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": message},
                ],
                "max_tokens": 2048,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"OpenAI error: {resp.text[:300]}")
        return resp.json()["choices"][0]["message"]["content"]


async def call_google(model_id: str, system: str, message: str, api_key: str) -> str:
    if not api_key:
        raise HTTPException(400, "Google API key not configured. Add it in Settings.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            json={
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"parts": [{"text": message}]}],
                "generationConfig": {"maxOutputTokens": 2048},
            },
        )
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"Google error: {resp.text[:300]}")
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


# ── SSE helpers ────────────────────────────────────────────────────────────────
def _sse_token(token: str) -> str:
    return f"data: {json.dumps({'token': token})}\n\n"


def _sse_done() -> str:
    return f"data: {json.dumps({'done': True})}\n\n"


def _sse_error(msg: str) -> str:
    return f"data: {json.dumps({'error': msg})}\n\n"


# ── Provider streaming generators ─────────────────────────────────────────────
async def stream_anthropic(model_id: str, system: str, message: str, api_key: str) -> AsyncIterator[str]:
    if not api_key:
        yield _sse_error("Anthropic API key not configured. Add it in Settings.")
        return
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model_id,
                "max_tokens": 2048,
                "system": system,
                "messages": [{"role": "user", "content": message}],
                "stream": True,
            },
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield _sse_error(f"Anthropic error: {body.decode()[:300]}")
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                        if event.get("type") == "content_block_delta":
                            token = event["delta"].get("text", "")
                            if token:
                                yield _sse_token(token)
                    except json.JSONDecodeError:
                        pass
    yield _sse_done()


async def stream_openai(model_id: str, system: str, message: str, api_key: str) -> AsyncIterator[str]:
    if not api_key:
        yield _sse_error("OpenAI API key not configured. Add it in Settings.")
        return
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "content-type": "application/json"},
            json={
                "model": model_id,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": message},
                ],
                "max_tokens": 2048,
                "stream": True,
            },
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield _sse_error(f"OpenAI error: {body.decode()[:300]}")
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        event = json.loads(data)
                        token = event["choices"][0]["delta"].get("content", "")
                        if token:
                            yield _sse_token(token)
                    except (json.JSONDecodeError, KeyError, IndexError):
                        pass
    yield _sse_done()


async def stream_google(model_id: str, system: str, message: str, api_key: str) -> AsyncIterator[str]:
    if not api_key:
        yield _sse_error("Google API key not configured. Add it in Settings.")
        return
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:streamGenerateContent?alt=sse&key={api_key}"
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            url,
            json={
                "system_instruction": {"parts": [{"text": system}]},
                "contents": [{"parts": [{"text": message}]}],
                "generationConfig": {"maxOutputTokens": 2048},
            },
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield _sse_error(f"Google error: {body.decode()[:300]}")
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    try:
                        event = json.loads(line[6:])
                        token = event["candidates"][0]["content"]["parts"][0].get("text", "")
                        if token:
                            yield _sse_token(token)
                    except (json.JSONDecodeError, KeyError, IndexError):
                        pass
    yield _sse_done()


# ── Main chat endpoint (non-streaming) ────────────────────────────────────────
@router.post("/chat")
async def ai_chat(request: ChatRequest, authorization: Optional[str] = Header(None)):
    provider = request.provider.lower()
    api_key = resolve_key(provider, request.api_keys)

    rag_context, rag_files = "", []
    if request.project_id and request.project_id != "demo":
        try:
            google_key = resolve_key("google", request.api_keys)
            if google_key:
                embedding = await get_google_embedding(request.user_message, google_key)
                if embedding:
                    rag_context, rag_files = await get_rag_context(request.project_id, embedding)
        except Exception as e:
            print(f"Embedding/RAG skipped: {e}")

    system = build_system_prompt(request, rag_context)

    try:
        if provider == "anthropic":
            response_text = await call_anthropic(request.model_id, system, request.user_message, api_key)
        elif provider == "openai":
            response_text = await call_openai(request.model_id, system, request.user_message, api_key)
        elif provider == "google":
            response_text = await call_google(request.model_id, system, request.user_message, api_key)
        else:
            raise HTTPException(400, f"Unknown provider: {provider}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    return {
        "response": response_text,
        "model": request.model_id,
        "provider": provider,
        "rag_used": bool(rag_files),
        "rag_files": rag_files,
    }


# ── Streaming chat endpoint (SSE) ─────────────────────────────────────────────
@router.post("/chat/stream")
async def ai_chat_stream(request: ChatRequest, authorization: Optional[str] = Header(None)):
    provider = request.provider.lower()
    api_key = resolve_key(provider, request.api_keys)

    rag_context, rag_files = "", []
    if request.project_id and request.project_id != "demo":
        try:
            google_key = resolve_key("google", request.api_keys)
            if google_key:
                embedding = await get_google_embedding(request.user_message, google_key)
                if embedding:
                    rag_context, rag_files = await get_rag_context(request.project_id, embedding)
        except Exception as e:
            print(f"Embedding/RAG skipped: {e}")

    system = build_system_prompt(request, rag_context)

    async def generate():
        # First event carries RAG metadata so the frontend can show context badges
        yield f"data: {json.dumps({'meta': {'rag_used': bool(rag_files), 'rag_files': rag_files}})}\n\n"

        if provider == "anthropic":
            async for chunk in stream_anthropic(request.model_id, system, request.user_message, api_key):
                yield chunk
        elif provider == "openai":
            async for chunk in stream_openai(request.model_id, system, request.user_message, api_key):
                yield chunk
        elif provider == "google":
            async for chunk in stream_google(request.model_id, system, request.user_message, api_key):
                yield chunk
        else:
            yield _sse_error(f"Unknown provider: {provider}")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── File save + vector embedding ──────────────────────────────────────────────
@router.post("/files")
async def save_file_with_embedding(
    request: FileSaveRequest, authorization: Optional[str] = Header(None)
):
    try:
        from backend.database import supabase_client

        # User-provided key takes priority over server env var
        google_key = request.google_key or os.getenv("GEMINI_API_KEY", "")
        embedding = None
        if google_key and request.content.strip():
            embedding = await get_google_embedding(request.content, google_key)

        file_data = {
            "project_id": request.project_id,
            "file_name": request.file_name,
            "path": request.path or f"src/{request.file_name}",
            "content": request.content,
            "updated_at": "now()",
        }
        if embedding:
            file_data["embedding"] = embedding

        if request.file_id:
            supabase_client.table("project_files").update(file_data).eq("id", request.file_id).execute()
        else:
            supabase_client.table("project_files").insert(file_data).execute()

        return {"status": "success", "embedded": bool(embedding)}
    except Exception as e:
        raise HTTPException(500, f"File save failed: {str(e)}")
