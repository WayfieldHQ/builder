/*
 * Plinthra — Builder integration config (classic script, loaded first).
 *
 * The forked builder runs its agentic loop through Puter.js (`puter.ai.chat`).
 * Under Puter's user-pays model the end user's Puter account is billed, so the
 * free tier costs Plinthra $0 while still running on Plinthra-branded
 * "Celestial" models.
 *
 * This file maps each Celestial to a Puter model id (verified against Puter's
 * model catalog) and exposes a small resolver the app uses to pick the model.
 * Swap the `puter` strings here whenever a better model lands — the Celestial
 * names stay stable.
 *
 * A later phase will route Pro Celestials through Plinthra's Cloudflare Worker
 * (Photons metering) instead of Puter; the shape below is designed for that.
 */
(function () {
  'use strict';

  var CELESTIALS = {
    sirius: {
      name: 'Sirius',
      symbol: '\u2726',
      tagline: 'Fast Chat',
      // Verified against https://api.puter.com/puterai/chat/models.
      puter: 'infron:qwen/qwen3.8-27b:free',
      photons: 200,
      tier: 'free',
    },
    lyra: {
      name: 'Lyra',
      symbol: '\u2645',
      tagline: 'Builder',
      // V4.1 Flash (the old '...v4-flash:free' id is not in Puter's catalog).
      puter: 'infron:deepseek/deepseek-v4.1-flash:free',
      photons: 200,
      tier: 'free',
    },
    polaris: {
      name: 'Polaris',
      symbol: '\u2727',
      tagline: 'Balanced',
      puter: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free',
      photons: 800,
      tier: 'starter',
    },
    andromedaNova: {
      name: 'Andromeda Nova',
      symbol: '\u25d0',
      tagline: 'Titan Mini',
      puter: 'openrouter:google/gemma-4-31b-it:free',
      photons: 400,
      tier: 'starter',
    },
    andromeda: {
      name: 'Andromeda',
      symbol: '\u25d1',
      tagline: 'Titan',
      puter: 'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free',
      photons: 600,
      tier: 'pro',
    },
    horizon: {
      name: 'Horizon',
      symbol: '\u25d2',
      tagline: 'Reasoning',
      // Distinct free fallback for Horizon when Plinthra isn't connected.
      puter: 'openrouter:thinkingmachines/inkling:free',
      photons: 1200,
      tier: 'pro',
    },
    singularity: {
      name: 'Singularity',
      symbol: '\u25ce',
      tagline: 'Long Memory',
      // Distinct free fallback; Pro runs on Plinthra's 262k Kimi model when
      // the bridge is connected.
      puter: 'openrouter:minimax/minimax-m3.1-flash:free',
      photons: 1200,
      tier: 'pro',
    },
  };

  var STORAGE_KEY = 'plinthra_celestial';
  var DEFAULT_KEY = 'lyra';

  function get(key) {
    return CELESTIALS[key] || null;
  }

  function current() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CELESTIALS[saved]) return saved;
    } catch (e) { /* private mode */ }
    return DEFAULT_KEY;
  }

  function set(key) {
    if (!CELESTIALS[key]) return false;
    try { localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* ignore */ }
    return true;
  }

  /** Resolve the current Celestial to the Puter model id `puter.ai.chat` expects. */
  function resolveModel(key) {
    var c = get(key || current());
    return (c && c.puter) || 'claude-opus-5-5';
  }

  /** Public (UI-safe) catalog list, ordered. */
  function list() {
    return ['sirius', 'lyra', 'polaris', 'andromedaNova', 'andromeda', 'horizon', 'singularity']
      .map(function (k) {
        var c = CELESTIALS[k];
        return { key: k, name: c.name, symbol: c.symbol, tagline: c.tagline, tier: c.tier, photons: c.photons, puter: c.puter };
      });
  }

  window.PLINTHRA = {
    CELESTIALS: CELESTIALS,
    DEFAULT_KEY: DEFAULT_KEY,
    get: get,
    set: set,
    current: current,
    resolveModel: resolveModel,
    list: list,
    // The model the app boots with.
    defaultModel: function () { return resolveModel(current()); },
  };
})();
