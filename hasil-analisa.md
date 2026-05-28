# Vanguarch Tunnel — Status Analisa

> Terakhir diperbarui: 2026-05-28 (App version upgrade to 2.4.0)
> Versi app: 2.4.0

---

## 📊 Scorecard

```
Layer 1  Core Tunnel          ██████░░░░  ~60%
Layer 2  Inspector & Analytics█████████░  ~85%
Layer 3  UX & Polish          ████░░░░░░  ~35%
Layer 4  Cloudflare Ecosystem ░░░░░░░░░░   ~0%
Layer 5  Code Health          ██████░░░░  ~55%
─────────────────────────────────────────────
Overall                       ██████░░░░  ~52%
```

---

## Layer 1 — Core Tunnel

| Status | Fitur |
|:---:|---|
| ✅ | Start / Stop tunnel |
| ✅ | Restart tunnel (1-click, store + DashboardView) |
| ✅ | Saved Presets |
| ✅ | Cloud Tunnel list (Cloudflare API) |
| ✅ | Orphaned tunnel detection + force-stop (wmic/pkill fallback) |
| ✅ | Session History (persist, HistoryView, clear) |
| ✅ | Quick Share (static file server) |
| ✅ | Local Projects auto-discovery |
| ❌ | Auto-start on boot (Windows registry / macOS LaunchAgent) |
| ❌ | Export / Import preset (JSON backup & restore) |
| ❌ | Custom ingress rules (satu tunnel → banyak service/path) |
| ✅ | Tunnel health auto-monitor (ping periodik, bukan manual) |
| ❌ | Scheduled tunnel (start jam 9, stop jam 6) |

---

## Layer 2 — Inspector & Analytics

| Status | Fitur |
|:---:|---|
| ✅ | Request capture via proxy inspector |
| ✅ | Response view (headers + body) |
| ✅ | Request Replay — quick (1-click) + Edit & Replay (edit method/path/headers/body) |
| ✅ | Auto-select hasil replay (tidak perlu cari manual) |
| ✅ | Search / filter inspector (path, method, status, tunnel name) |
| ✅ | Filter tabs: All / 2xx / Errors / Pending + badge count |
| ✅ | JSON auto-format + copy button untuk request & response body |
| ✅ | Analytics dashboard (time series, status codes, method breakdown) |
| ✅ | Per-tunnel request counter (badge di Active Tunnels) |
| ✅ | Requests per Tunnel chart |
| ✅ | Top Endpoints + Top Error Endpoints |
| ✅ | User Agent / Client breakdown |
| ✅ | Time range filter (30m / 1h / 6h / All) |
| ✅ | Clear analytics data |
| ✅ | Ping / Health Check manual per tunnel |
| ✅ | OS Notifications saat tunnel connected |
| ✅ | Copy URL button (Active Tunnels) |
| ❌ | Mock / Intercept response (return custom response tanpa hit server) |
| ❌ | Error alerting (notif kalau error rate > X%) |
| ✅ | Bandwidth meter ↑↓ (inspector-based estimate + cloudflared metrics bila tersedia, speed realtime, error count) |
| ❌ | Export log ke `.csv` / `.json` |

---

## Layer 3 — UX & Polish

| Status | Fitur |
|:---:|---|
| ✅ | Error boundary per-tab (auto-reset saat ganti tab, recover + reload) |
| ✅ | Confirm modal saat exit dengan tunnel aktif |
| ✅ | Cooldown indicator setelah stop tunnel (60s) |
| ✅ | Splash screen saat loading |
| ✅ | Tray icon + hide to tray |
| ❌ | Keyboard shortcuts (Ctrl+N = new tunnel, Ctrl+S = stop all, dll) |
| ❌ | Command palette (Ctrl+K) |
| ❌ | Onboarding / first-run wizard |
| ✅ | Offline state handling (banner + pre-flight check sebelum start tunnel) |
| ✅ | Konfirmasi sebelum Stop All (ConfirmModal + jumlah tunnel aktif ditampilkan) |
| ❌ | Drag & drop reorder presets |
| ❌ | Dark / Light theme toggle (sekarang hardcode dark) |

---

## Layer 4 — Cloudflare Ecosystem

| Status | Fitur |
|:---:|---|
| ❌ | Cloudflare Access / Zero Trust policies |
| ❌ | DNS record management |
| ❌ | Multiple account support |
| ❌ | Warp connector setup |
| ❌ | Custom error pages per tunnel |

---

## Layer 5 — Code Health

| Status | Item |
|:---:|---|
| ✅ | Error boundary di React tree |
| ✅ | `@types/react` 19 installed (React 19 tidak bundled types) |
| ✅ | Orphaned process kill (Rust wmic/pkill fallback) |
| ✅ | 2 pre-existing TS error fixed — `ManualTunnel.tsx` (`id` di Omit), `PresetList.tsx` (`cn` not found) |
| ❌ | Unit / integration test |
| ❌ | cloudflaredPath tidak divalidasi saat app start |
| ❌ | Auto-update mechanism |

---

## 🎯 Prioritas Selanjutnya

### 🔴 Quick wins — effort rendah, impak tinggi

| No | Fitur | Estimasi |
|---|---|---|
| 1 | **Export / Import preset JSON** | ~2 jam |
| 2 | ~~**Konfirmasi sebelum Stop All**~~ | ✅ Done |
| 3 | ~~**Bandwidth meter UI**~~ | ✅ Done |
| 4 | **Auto-start on boot toggle** | ~3 jam |
| 5 | ~~**Fix 2 pre-existing TS error**~~ | ✅ Done |

### 🟡 Medium effort — nilai tinggi

| No | Fitur | Estimasi |
|---|---|---|
| 6 | **Tunnel health auto-monitor** | ~1 hari *(ping periodik + notif kalau down)* |
| 7 | **Export log** ke `.csv` / `.json` | ~3 jam |
| 8 | **Custom ingress rules** | ~2 hari |
| 9 | **Error alerting** | ~1 hari |
| 10 | ~~**Offline state handling**~~ | ✅ Done |

### 🔵 Visi jangka panjang

| No | Fitur |
|---|---|
| 11 | Mock / Intercept response |
| 12 | Keyboard shortcuts + Command palette |
| 13 | Multi-account Cloudflare |
| 14 | Cloudflare Access / Zero Trust integration |
| 15 | Team config sharing (sync presets via file/URL) |
| 16 | Dark / Light theme toggle |
| 17 | Unit / integration test |
