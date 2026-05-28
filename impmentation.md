# Features 1-6 Implementation Plan

## Feature Breakdown

### 1. OS Notifications (Tunnel Connected)
- **Approach**: Use Tauri's `emit` to send a custom event `tunnel-connected` from the store. On the frontend, listen and use the browser's `Notification API` (works in Tauri WebView without a plugin).
- **Files**: `useTunnelStore.ts`, `App.tsx`
- **Note**: No new Rust/Cargo dependency needed — `window.Notification` is available inside Tauri WebView.

### 2. Copy URL Button (Active Tunnels Widget)
- **Approach**: Add a clipboard copy button next to public domain in DashboardView.
- **Files**: `DashboardView.tsx`

### 3. Restart Tunnel (1-Click)
- **Approach**: Add `restartTunnel(tunnelName)` helper to `useTunnelStore` that calls `stopTunnel` then `startTunnel` with the stored config.
- **Files**: `useTunnelStore.ts`, `DashboardView.tsx`

### 4. Tunnel Session History
- **Approach**: Add a `history: SessionRecord[]` array to `useTunnelStore` (persisted). Each record captures: name, localUrl, publicDomain, startedAt, stoppedAt, durationMs.
- **Display**: New lightweight `HistoryView.tsx` component + sidebar nav item.
- **Files**: `types.ts`, `useTunnelStore.ts`, `HistoryView.tsx`, `App.tsx`

### 5. Requests Counter per Tunnel
- **Approach**: `useInspectorStore` logs already have URL paths. We derive a `requestsByTunnel` map by matching log hostnames to active tunnel `publicDomain`. Display as a badge in DashboardView Active Tunnels rows.
- **Files**: `DashboardView.tsx`

### 6. Ping / Health Check
- **Approach**: Add a `ping_url` Rust command using `reqwest`. Returns `{ status: u16, ok: bool, latency_ms: u64 }`. Button in DashboardView Active Tunnels row triggers it and shows result inline.
- **Files**: `system.rs`, `main.rs`, `DashboardView.tsx`

## Execution Order
1. Types → 2. Store (restart + history) → 3. Rust (ping_url) → 4. DashboardView (copy, restart, counter, ping) → 5. HistoryView → 6. App.tsx (history nav + notifications)
