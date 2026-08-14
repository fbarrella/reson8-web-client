# Reson8 Web Client

[![Version](https://img.shields.io/badge/version-unreleased-lightgrey.svg)](#)

A mobile-first, fully responsive Progressive Web App client for [Reson8](../reson8) — a self-hosted voice & text communication server. Built with React, TypeScript, and Vite. This is an independent client for the existing `reson8` server; it does not modify the server or its protocol.

**Status:** Planning. No application code yet — see `app-planning/` for the full Product Requirements Document set before writing any implementation code. Versioning starts at `0.1.0` once Phase 1 scaffolds the project (see `CLAUDE.md` → Versioning).

## Planning documents

Start with [`app-planning/00-master-prd.md`](app-planning/00-master-prd.md) for the product vision, tech stack, architecture, and cross-cutting design decisions (mobile-first responsive strategy, PWA scope, identity model, non-goals). It links out to one PRD per implementation phase:

1. `01-phase1-foundation-connection.md` — scaffold, PWA shell, design system, connect flow, channel tree, presence
2. `02-phase2-voice-core.md` — mediasoup voice engine, mute/deafen/PTT, reconnection resilience
3. `03-phase3-advanced-voice-channel-mgmt.md` — noise gate, per-user volume, channel CRUD/reorder
4. `04-phase4-text-chat-messaging.md` — chat, uploads, emoji, custom emoji, pinned messages
5. `05-phase5-direct-messages-social.md` — DMs, online users, Nudge
6. `06-phase6-admin-moderation.md` — roles, emoji approval, kick/ban, server settings
7. `07-phase7-pwa-platform-polish.md` — installability, update flow, accessibility/performance gates, device testing, deployment

Each phase is independently demoable against a real `reson8` server and builds on the ones before it.
