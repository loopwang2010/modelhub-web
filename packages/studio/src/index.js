"use client";

// Studio components — pruned in S10 to drop WorkflowStudio + AgentStudio
// (those depended on Vibe-Workflow + Open-Poe-AI submodules which were
// removed because modelhub MVP doesn't ship workflows or chat agents).
//
// Remaining studios cover Sprint 1's MVP: image, video, lip-sync, cinema,
// marketing, apps, mcp-cli. ImageStudio is the primary surface for Flux
// (S7), VideoStudio for Veo3 (S8), and we'll wire GPT-image edit (S9)
// into ImageStudio's edit mode in the modelhub-client swap.

export { default as ImageStudio } from './components/ImageStudio';
export { default as VideoStudio } from './components/VideoStudio';
export { default as LipSyncStudio } from './components/LipSyncStudio';
export { default as CinemaStudio } from './components/CinemaStudio';
export { default as MarketingStudio } from './components/MarketingStudio';
export { default as AppsStudio } from './components/AppsStudio';
export { default as McpCliStudio } from './components/McpCliStudio';

// muapi.js exports stay for now — they will be replaced by modelhub-client.js
// in the main S10 task (post-prune). Keeping the path so import sites in
// StandaloneShell etc. still resolve.
export * from './muapi';
