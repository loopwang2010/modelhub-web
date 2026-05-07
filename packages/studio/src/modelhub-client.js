// modelhub-client.js — replaces muapi.js, talks to our own backend
// (modelhub-backend) per ADR-009 envelope and S2.5 OpenAPI contract.
//
// AP-4 enforcement:
//   - JWT lives in HttpOnly cookie set by /v1/auth/login (NOT localStorage).
//   - axios `withCredentials: true` so the cookie travels.
//   - NO direct fetches to api.muapi.ai or any upstream provider.
//
// Backwards-compat:
//   - The legacy generate*/processV2V/processLipSync/uploadFile functions
//     accept (apiKey, params) — we ignore the apiKey arg in favor of the
//     cookie. Callers still passing it from localStorage works during the
//     migration window. Once StandaloneShell migrates to LoginModal the
//     apiKey arg becomes a no-op everywhere.
//
// Envelope shape (GenerationResponse):
//   {
//     id: "gen_xxx",
//     model: "flux-pro-1.1",
//     status: "queued" | "running" | "succeeded" | "failed" | "cancelled",
//     modality: "image" | "video" | "audio" | "edit" | "llm",
//     task_kind: "sync" | "async" | "streaming",
//     created_at: "2026-05-08T...",
//     completed_at: "..." | null,
//     output: { type, url, text, base64, mime_type, size_bytes, metadata } | null,
//     error: { code, message } | null,
//     credits: { held, settled, refunded }
//   }

import axios from 'axios';

// In-browser dev: same-origin requests through Next.js / Vite proxy.
// Allow override via NEXT_PUBLIC_MODELHUB_API_BASE for staging/prod builds.
const API_BASE =
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_MODELHUB_API_BASE) ||
    '';

// Single axios instance — withCredentials so the modelhub_session cookie
// travels with every request (per S11-S13-OPS-DESIGN.md §1).
export const http = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
    timeout: 120_000,
    headers: { 'Content-Type': 'application/json' },
});

// 401 → redirect to /login (only in browser context). Surface other errors.
http.interceptors.response.use(
    (resp) => resp,
    (error) => {
        if (typeof window !== 'undefined' && error?.response?.status === 401) {
            const onLoginPath = window.location.pathname === '/login';
            if (!onLoginPath) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ── auth ────────────────────────────────────────────────────────────────────

export async function login(email, password) {
    const { data } = await http.post('/v1/auth/login', { email, password });
    return data;
}

export async function logout() {
    const { data } = await http.post('/v1/auth/logout');
    return data;
}

export async function register(email, password) {
    const { data } = await http.post('/v1/auth/register', { email, password });
    return data;
}

export async function getMe() {
    const { data } = await http.get('/v1/auth/me');
    return data;
}

// ── wallet ──────────────────────────────────────────────────────────────────

export async function getBalance() {
    const { data } = await http.get('/v1/wallet/balance');
    return data;
}

// ── models ──────────────────────────────────────────────────────────────────

export async function listModels() {
    const { data } = await http.get('/v1/models');
    // OpenAPI envelope: { data: ModelManifest[] }
    return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
}

// ── uploads ─────────────────────────────────────────────────────────────────

export async function createUpload({ contentType, sizeBytes, filename }) {
    const { data } = await http.post('/v1/uploads', {
        content_type: contentType,
        size_bytes: sizeBytes,
        filename,
    });
    return data; // { upload_id, upload_url, method, expires_at, headers }
}

// ── generations ─────────────────────────────────────────────────────────────

export async function submitGeneration({ model, params, idempotencyKey, webhook }) {
    const body = { model, params };
    if (idempotencyKey) body.idempotency_key = idempotencyKey;
    if (webhook) body.webhook = webhook;
    const { data } = await http.post('/v1/generations', body);
    return data;
}

export async function getGeneration(id) {
    const { data } = await http.get(`/v1/generations/${id}`);
    return data;
}

// Polls a generation until it reaches a terminal state.
async function pollGeneration(id, { intervalMs = 2000, maxAttempts = 900 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, intervalMs));
        // eslint-disable-next-line no-await-in-loop
        const env = await getGeneration(id);
        const s = env.status;
        if (s === 'succeeded' || s === 'failed' || s === 'cancelled') return env;
    }
    throw new Error('Generation timed out after polling.');
}

// Submits a generation and waits for the terminal envelope. Returns the
// envelope plus a top-level `url` field for back-compat with the legacy
// muapi.js consumers (which expected `{ ...result, url }`).
export async function submitAndWait({ model, params, idempotencyKey, onSubmit, intervalMs, maxAttempts }) {
    const submitted = await submitGeneration({ model, params, idempotencyKey });
    if (onSubmit) onSubmit(submitted);

    // Sync-mode tasks come back already in a terminal state.
    if (submitted.status === 'succeeded' || submitted.status === 'failed' || submitted.status === 'cancelled') {
        return adaptEnvelopeForLegacy(submitted);
    }

    const final = await pollGeneration(submitted.id, { intervalMs, maxAttempts });
    return adaptEnvelopeForLegacy(final);
}

// Legacy adapter: muapi.js returned `{ ...result, url }`. Studios read
// `res.url`. We surface the output's url at the top level so they keep
// working without changes inside their generate handlers.
function adaptEnvelopeForLegacy(env) {
    if (env?.status === 'failed') {
        const err = env.error || { code: 'unknown', message: 'Generation failed' };
        throw new Error(err.message || `Generation failed: ${err.code}`);
    }
    const url = env?.output?.url || env?.output?.text || null;
    return { ...env, url };
}

// ── legacy shims for studios still importing muapi-style functions ─────────
// These wrap the modelhub backend in the call signatures the existing
// ImageStudio/VideoStudio/etc. expect. The `apiKey` arg is ignored — auth
// rides the HttpOnly cookie. Once studios migrate fully to submitGeneration
// these can be removed (S11+ when LoginModal lands).

export async function generateImage(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 60,
    });
}

export async function generateI2I(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 60,
    });
}

export async function generateVideo(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 900,
    });
}

export async function generateI2V(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 900,
    });
}

export async function generateMarketingStudioAd(_apiKey, params) {
    const model = params.resolution === '1080p'
        ? 'sd-2-vip-omni-reference-1080p'
        : 'seedance-2-vip-omni-reference';
    return submitAndWait({
        model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 900,
    });
}

export async function processV2V(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 900,
    });
}

export async function processLipSync(_apiKey, params) {
    return submitAndWait({
        model: params.model,
        params: stripModelHubMeta(params),
        onSubmit: (env) => params.onRequestId && params.onRequestId(env.id),
        maxAttempts: 900,
    });
}

// Removes meta-only fields the studios stuff into params (model id, the
// onRequestId callback) before forwarding to the backend.
function stripModelHubMeta(params) {
    const { model, onRequestId, ...rest } = params || {};
    void model;
    void onRequestId;
    return rest;
}

// ── upload (browser → backend → S3-style PUT) ──────────────────────────────
// Two-step:
//   1) POST /v1/uploads to mint a pre-signed PUT URL.
//   2) PUT the file directly to upload_url with the headers the backend
//      tells us to set.
// Returns the public CDN URL the backend would serve the asset at, which
// upload_id maps to. For now we surface upload_id + upload_url so callers
// can finish the flow themselves — but for back-compat with legacy
// uploadFile callers (they expect a single string URL), we resolve to the
// upload_id-derived public URL once the PUT succeeds.

export async function uploadFile(_apiKey, file, onProgress) {
    const upload = await createUpload({
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        filename: file.name,
    });

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(upload.method || 'PUT', upload.upload_url);
        Object.entries(upload.headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress(Math.round((event.loaded / event.total) * 100));
                }
            };
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload PUT failed: ${xhr.status} ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload PUT'));
        xhr.send(file);
    });

    // Backend exposes the uploaded asset at a deterministic CDN URL keyed
    // off upload_id. The exact path is owned by the backend (S5 spec); we
    // surface what the backend hands us. If backend later returns a
    // `public_url` field on UploadResponse, we'll prefer it.
    return upload.public_url || `/v1/uploads/${upload.upload_id}/object`;
}

// ── back-compat alias for muapi's getUserBalance(apiKey) ────────────────────

export async function getUserBalance(_apiKey) {
    return getBalance();
}

// ── stubs for routes that no longer exist in modelhub ──────────────────────
// AppsStudio still references registerAppInterest/getAppInterests. Those
// were muapi-specific and have no analog in our backend yet. Stub them
// out so imports don't break the build.

export async function registerAppInterest(_apiKey, _appName) {
    throw new Error('registerAppInterest: not supported by modelhub backend yet');
}

export async function getAppInterests(_apiKey) {
    return [];
}

// Workflow / agents stubs — these surfaces were removed in S10a's prune,
// but legacy index.js re-exports might still resolve them. Keep no-op
// implementations so unrelated code paths compile.

export async function getTemplateWorkflows() { return []; }
export async function getUserWorkflows() { return []; }
export async function getPublishedWorkflows() { return []; }
export async function getTemplateAgents() { return []; }
export async function getUserAgents() { return []; }
export async function getPublishedAgents() { return []; }
export async function getUserConversations() { return []; }
export async function createWorkflow() { throw new Error('Workflows not supported'); }
export async function updateWorkflowName() { throw new Error('Workflows not supported'); }
export async function deleteWorkflow() { throw new Error('Workflows not supported'); }
export async function getWorkflowInputs() { throw new Error('Workflows not supported'); }
export async function executeWorkflow() { throw new Error('Workflows not supported'); }
export async function getAllNodeSchemas() { return []; }
export async function getWorkflowData() { return null; }
export async function getNodeSchemas() { return []; }
export async function runSingleNode() { throw new Error('Workflows not supported'); }
export async function deleteNodeRun() { throw new Error('Workflows not supported'); }
export async function getNodeStatus() { return { status: 'unknown' }; }
export async function calculateDynamicCost() { return { cost: 0 }; }

// handleProxyRequest / handleServerSideProxy were used by Next.js API
// routes to forward muapi traffic. We don't proxy upstreams anymore (the
// backend is the only thing the frontend talks to), but the route files
// still import these symbols. Provide stubs that return a 410 — clearly
// telling any stray traffic the route is gone.

export async function handleProxyRequest() {
    return {
        status: 410,
        contentType: 'application/json',
        data: new TextEncoder().encode(
            JSON.stringify({ error: 'muapi proxy removed; modelhub-client talks to /v1/* directly' })
        ).buffer,
    };
}

export async function handleServerSideProxy() {
    return handleProxyRequest();
}
