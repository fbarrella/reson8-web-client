/**
 * Vendored snapshot — DO NOT hand-edit beyond this header.
 * Source: reson8/packages/shared-types/src/index.ts
 * Source repo version: 1.4.1
 * Source commit: 8ccd0cc78921ef3f8042b79e3650496a06444767
 * Copied: 2026-08-14
 */

/**
 * @reson8/shared-types
 *
 * Shared type definitions for the Reson8 platform.
 * Consumed by both the server and client workspaces.
 */

export * from "./socket-events.js";
export * from "./models.js";

// Explicitly export enums to ensure tsx/ESM resolves them correctly
export { PermissionFlags, ChannelType } from "./models.js";
