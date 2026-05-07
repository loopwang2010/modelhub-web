// models-cache.js — fetch-once cache for the backend's model catalog.
//
// Replaces the static muapi-derived arrays in models.js for any consumer
// that wants the live, admin-toggleable catalog from /v1/models. The
// existing arrays in models.js stay in place during the migration window
// because dozens of helper functions
// (getAspectRatiosForModel/getResolutionsForModel/getQualityFieldForModel
// /...) still resolve from them. Once each studio has been ported to
// consume input_schema directly from a ModelManifest, we can drop the
// static catalog entirely.

import { listModels } from './modelhub-client';

let cachePromise = null;

/**
 * Returns the live model catalog. Fetched once per page load; subsequent
 * calls return the cached promise so concurrent callers share one request.
 *
 * @returns {Promise<Array<{key: string, name: string, modality: string, task_kind: string, input_schema: object, price_formula: string, examples?: Array, tags?: Array, order?: number}>>}
 */
export async function getModels() {
    if (cachePromise) return cachePromise;
    cachePromise = listModels().catch((err) => {
        cachePromise = null; // allow retry on next call after a failure
        throw err;
    });
    return cachePromise;
}

/**
 * Forces the next getModels() call to refetch. Use after admin actions
 * (model toggle, etc.) or in tests.
 */
export function clearModelsCache() {
    cachePromise = null;
}

/**
 * Filters cached models by modality. Async because it awaits the underlying
 * fetch on cold start.
 *
 * @param {'image' | 'video' | 'audio' | 'edit' | 'llm'} modality
 */
export async function getModelsByModality(modality) {
    const all = await getModels();
    return all.filter((m) => m.modality === modality);
}

/**
 * Returns the full ModelManifest by key, or null if not found.
 */
export async function getModelByKey(key) {
    const all = await getModels();
    return all.find((m) => m.key === key) || null;
}
