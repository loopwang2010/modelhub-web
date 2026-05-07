"use client";

// Studio components — pruned in S10a to drop WorkflowStudio + AgentStudio
// (those depended on Vibe-Workflow + Open-Poe-AI submodules which were
// removed because modelhub MVP doesn't ship workflows or chat agents).
//
// Remaining studios cover Sprint 1's MVP: image, video, lip-sync, cinema,
// marketing, apps, mcp-cli. ImageStudio is the primary surface for Flux
// (S7), VideoStudio for Veo3 (S8), and we'll wire GPT-image edit (S9)
// into ImageStudio's edit mode.

export { default as ImageStudio } from './components/ImageStudio';
export { default as VideoStudio } from './components/VideoStudio';
export { default as LipSyncStudio } from './components/LipSyncStudio';
export { default as CinemaStudio } from './components/CinemaStudio';
export { default as MarketingStudio } from './components/MarketingStudio';
export { default as AppsStudio } from './components/AppsStudio';
export { default as McpCliStudio } from './components/McpCliStudio';

// S10b: modelhub-client.js replaces muapi.js. It exports the same names
// the existing studio components import (generateImage, generateI2I,
// generateVideo, generateI2V, generateMarketingStudioAd, processV2V,
// processLipSync, uploadFile, getUserBalance) — those are now thin shims
// over /v1/generations + /v1/uploads + /v1/wallet/balance — plus the new
// auth shape (login/logout/register/getMe), submitGeneration/getGeneration
// for direct envelope use, and listModels/createUpload.
//
// muapi.js is intentionally NOT re-exported anymore. Anything that
// imports from 'studio' picks up modelhub-client only. The module file
// stays on disk during the migration window for reference, but is no
// longer part of the public surface.
export * from './modelhub-client';

// Live model catalog cache (fetched from /v1/models once per page load).
export { getModels, getModelsByModality, getModelByKey, clearModelsCache } from './models-cache';
