# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

AI数班 — an automotive industry digital employee management console prototype. The deliverable is a self-contained single-page HTML demo (~25k lines) served via a local HTTP server, with external JS/CSS modules in `assets/`.

## Directory Layout

| Path | Contents |
|------|----------|
| `app/` | The runnable deliverable — HTML prototypes plus every runtime asset they load |
| `docs/prd/` | Product requirement documents |
| `docs/reviews/` | Review and meeting notes. `转写稿` = raw recording transcript, `总结` = written summary |
| `docs/reference/` | Standalone reference pages (message types, module map) |
| `design-system/` | Design tokens (`MASTER.md`) and per-page specs |
| `archive/` | Superseded snapshots kept for reference. Nothing here is loaded at runtime |

## Running the Demo

```bash
cd app && python3 -m http.server 4175
# Then open: http://127.0.0.1:4175/AI数班-AI军团原型.html#dashboard
```

The HTML file must stay in the same directory as `assets/` — it references resources by relative path. Both live in `app/`, so they move together. No build step, no bundler, no package manager.

## Architecture

### Routing

Hash-based SPA routing (`#dashboard`, `#plaza`, `#conversation`, `#live`, `#results`). Each hash corresponds to a section rendered inline in the single HTML file. Route switching is handled via `data-route` attributes on nav links and a `hashchange` listener.

### Code Organization

| File | Role |
|------|------|
| `app/AI数班-AI军团原型.html` | Main app: all markup, inline styles (~7k lines CSS), inline scripts for routing/dashboard/conversation/results/live |
| `app/AI数班-V1.4-直播场控专家-原型.html` | Standalone live-control (直播场控专家) prototype page |
| `app/assets/ai-office-enhancement.js` | Digital office scene: chibi employee rendering, status management, hiring state, onboarding, side-panel interactions |
| `app/assets/ai-office-enhancement.css` | Styles for the enhanced office scene |
| `app/assets/ai-office-visual-system.css` | Design token overrides for the office module |
| `app/assets/ai-office-chibi.bundle.js` | Chibi character sprite/animation engine |
| `app/assets/results-prospect-dashboard.js/css` | Results center (成果中心) prospect dashboard module |
| `app/assets/demo-v57-legacy-v40-v66/` | Older demo version embedded as an iframe for the backward-compatible live view |
| `app/数班-用户服务协议.md`, `app/数班-隐私政策.md` | Legal pages, linked from the login/registration screen via relative `href` |

### State Management

- All state is client-side via `localStorage` (hired employees, reservations, statuses).
- Key functions: `hiredSet()`, `reservedSet()`, `getStatus(id)`, `setStatus(id, status)`, `persistHires()`.
- Demo uses mock data; no backend API.

### Key Conventions in the HTML

- Utility function `$()` is `document.querySelector`; `$$()` is `querySelectorAll`.
- Toast notifications via global `showToast(title, message)`.
- Employees are identified by string IDs (e.g. `"xu-dou"`, `"lead-hunter"`), defined in an `employees` object.
- Conversation system uses `data-conversation-agent` attributes and pre-scripted replies in `conversationReplies`.

## Design System

Canonical reference: `design-system/MASTER.md`. Key rules:

- Canvas `#F6F7F7`, content surface `#FFFFFF`, primary action `#111111`, AI/小班 accent `#7359B5`.
- Spacing grid: 4/8/12/16/24/32px only. Card radius 8px, modal radius 12px.
- Minimum text size 12px. Body 13–14px.
- Page-level design specs live in `design-system/pages/` (dashboard, plaza, results, live).

## Product Terminology

| Term | Meaning |
|------|---------|
| 小班 | The central AI assistant / dispatcher that routes user requests to specific digital employees |
| 数字员工 | AI-driven digital employee assigned to a specific role |
| 岗位 | Job position (主号获客专家, 副号获客专家, 客服专员, 短视频运营专员) |
| 人才广场 | Talent marketplace where users hire digital employees |
| 成果中心 | Results center — read-only records (潜客/线索/内容效果) |
| 雇佣 | Hire (activate a digital employee) |
| 潜客 | Prospect / potential customer |
| 线索 | Lead (qualified prospect who provided contact info) |
| 留资 | Lead capture (user leaves contact information) |

## Working with the Codebase

- The main HTML file is large. When editing, target specific sections by searching for route names or section headings.
- Enhancement modules in `app/assets/` are IIFEs that attach to the global scope — they expect the main HTML's DOM structure and global functions to exist.
- All PRD and design documents are in Chinese (Markdown). The current product version focus is the results center refactor and talent plaza.
- Commit messages use conventional commits in English (`feat:`, `fix:`, `chore:`, `style:`).
