/**
 * @file Entrypoint for the system.
 *
 * Responsible for setting up hooks and system-wide config/globals.
 */

// ============================================================================
// LIBRARIES
// ============================================================================
// import './lib/pug';

// ============================================================================
// HOOKS
// ============================================================================
import "./hooks/devModeReady";
import "./hooks/settings";
import "./hooks/init.mjs";
import "./hooks/init.combat.mjs";
import "./hooks/updateGameTime";

console.info(`======================================
BASIC ADVENTURE GAMING SYSTEM
Ready!
======================================`);
