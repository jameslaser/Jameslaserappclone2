# Laser Clinic — Data Export TODO

- [x] Define database schema (patients, appointment_requests, confirmed_appointments, sessions, follow_ups)
- [x] Run database migration via webdev_execute_sql
- [x] Build tRPC export router (getPatients, getAppointments, getRequests, getSessions, getFollowUps, getSummary)
- [x] Build frontend: dashboard layout with summary stat cards
- [x] Build frontend: tabbed data tables (Patients, Confirmed Appts, Requests, Sessions, Follow-Ups)
- [x] Build frontend: CSV download per table
- [x] Build frontend: print-friendly layout
- [x] Write vitest tests for export router
- [x] Save checkpoint and publish
- [x] Fix invalid DOM nesting: div inside p element in ExportDashboard
- [x] Add date range filtering to Confirmed Appointments table
- [x] Add date range filtering to Sessions table
- [x] Add passwordHash + isActive fields to users table
- [x] Add clinic_settings table
- [x] Add machines table
- [x] Build email/password login tRPC procedure
- [x] Build admin JWT session middleware
- [x] Create/update admin@jamesslaserhairremoval.com with role=admin in production DB
- [x] Build Admin Dashboard page (all stat cards)
- [x] Build Users management page
- [x] Build Patients page (all patients, no ownership filter)
- [x] Build Appointment Requests page
- [x] Build Confirmed Appointments / Schedule page
- [x] Build Sessions page
- [x] Build Machines + Machine Availability page
- [x] Build Follow-Ups page
- [x] Build Settings page (clinic name, hours, WhatsApp, location, follow-up)
- [x] Build Analytics page
- [x] Build Export/Download page
- [x] Build WhatsApp Tools page (placeholder)
- [x] Wire all tRPC admin routes with no ownership filtering
- [x] Write vitest tests for admin auth and all routers (21/21 passing)
- [x] Add notifications table to schema and run migration
- [x] Build notifications tRPC router (list, unreadCount, markRead, markAllRead, create, delete)
- [x] Build NotificationBell component with panel and unread badge
- [x] Wire NotificationBell into AdminLayout header
- [x] Auto-trigger notifications on: appointment confirmed, session completed, no-show, follow-up due
- [x] Write vitest tests for notifications router (6 tests, 27/27 total passing)
- [ ] Investigate HMS connection method (API/webhook/DB)
- [ ] Add hms_sync_log table and HMS fields to schema, run migration
- [ ] Build HMS sync service with upsert logic and duplicate prevention
- [ ] Schedule automatic sync every 5 minutes
- [ ] Build Sync Monitor admin page (status, last sync time, error log, Sync Now button)
- [ ] Connect synced HMS data to Dashboard counters, Schedule, Appointments
- [ ] Write vitest tests for HMS sync router
- [ ] Log into HMS and inspect appointment + billing data endpoints
- [ ] Add hms_appointments, hms_payments, hms_sync_log tables to schema
- [ ] Build HMS sync service (appointments + payments upsert logic)
- [ ] Build HMS Sync Monitor page (status, last sync, error log, Sync Now button)
- [ ] Build Income Dashboard page (today/month totals, paid/pending, top services, top providers, by payment method)
- [ ] Connect income data to main Dashboard and Analytics
- [ ] Add daily/monthly income summary views
- [ ] Build HMS session manager (cookie persistence, auto re-login, keep-alive every 12 min, failure detection)
- [ ] Add hms_appointments, hms_payments, hms_sync_log tables to schema and migrate
- [ ] Build HMS appointment sync service (DBAL API, upsert, scheduled every 3h)
- [ ] Build HMS revenue/payment sync service (DBAL API, upsert, scheduled every 3h)
- [ ] Build Sync Monitor page (status, last sync, error log, Sync Now button)
- [ ] Build Income Dashboard page (today/month totals, paid/pending, top services, top providers)
- [ ] Connect synced data to main Dashboard and Analytics
- [ ] Store HMS credentials securely server-side only
- [ ] Full function audit: Auth / Access
- [ ] Full function audit: Dashboard
- [ ] Full function audit: Appointments (CRUD, status, schedule)
- [ ] Full function audit: Patients (CRUD, profile, linking)
- [ ] Full function audit: Daily Schedule
- [ ] Full function audit: Live Sync (HMS session, auto re-login, 3h schedule, Sync Now)
- [ ] Full function audit: Income / Revenue
- [ ] Full function audit: Notifications
- [ ] Full function audit: Settings
- [ ] Full function audit: Error handling (console errors, dead links, broken pages)
- [ ] Fix all broken/partial items found in audit
- [ ] Retest all fixed items
- [ ] Configure VITE_API_URL, DB_URL, SESSION_SECRET environment variables properly
- [ ] Create .env.example with all required local env vars
- [ ] Create setup.sh one-command local setup script
- [ ] Create LOCAL_SETUP.md with full step-by-step instructions
- [ ] Package project as downloadable ZIP
- [ ] Create LOCAL_SETUP.md with exact run commands
- [ ] Create setup.sh one-command local setup script
- [ ] Create local-env-template.txt (env.example substitute)
- [ ] Verify clean local run in fresh directory
- [ ] Package and deliver as downloadable ZIP
- [x] Update appointment_requests schema: add gender, service, body_area, phone_number, source fields
- [x] Build public tRPC route: requests.submit (no auth)
- [x] Build public /request page with premium medical design
- [x] Update AdminRequests page: Confirm, Reschedule, Cancel, Complete, WhatsApp buttons
- [x] Wire new request submission to admin notifications

## W-List Module (HMS Mirror)
- [x] Add w_list_entries table to schema with all required fields
- [x] Add external_id, source_system, source_notes, internal_notes, branch, created_at_source, updated_at_source, last_synced_at to confirmed_appointments
- [x] Run DB migration for all new fields
- [x] Build DB helpers: upsertWListEntry, getWListEntries, getWListStats, updateWListInternalNote, updateConfirmedAppointmentInternalNote, getHmsSyncLogs
- [x] Build HMS sync service (hmsSyncService.ts): syncWListBatch + syncAppointmentsBatch — source_notes always overwritten, internal_notes never touched
- [x] Fire admin notifications: new entry created, status changed
- [x] Build tRPC wList router: list (search/filter), stats, updateInternalNote, markRemoved, ingest, syncLogs
- [x] Build tRPC appointmentNotes.updateInternal router
- [x] Build W-List admin page (/wlist): stat cards, search/filter/sort table, row-click detail panel
- [x] Show source_notes (read-only, HMS-synced) and internal_notes (editable, never overwritten) with correct labels
- [x] Add W-List widgets to Admin Dashboard
- [x] Add W-List nav item to AdminLayout sidebar
- [x] Update Schedule/AdminAppointments table: separate Source Notes and Internal Notes columns
- [x] Register /wlist route in App.tsx
- [x] Write vitest tests for W-List router (42 tests total passing)

## HMS Integration Enhancements

- [x] Add HMS_INGEST_API_KEY secret for securing the ingest endpoint
- [x] Create secured REST POST /api/hms/ingest endpoint (API key auth, accepts W-List + appointments payload)
- [x] Add GET /api/hms/status endpoint (field mapping docs, note policy)
- [x] Add server-side auto-sync scheduler (every 10 min, logs to hms_sync_log, gated by HMS_SYNC_ENABLED=true)
- [x] Add getOrCreatePatientByPhone DB helper (upsert patient from HMS data)
- [x] Wire hmsIngestEndpoint + startHmsSyncScheduler into server startup (index.ts)
- [x] Add Sync Now button to W-List page (calls /api/hms/ingest, shows created/updated/errors result badge)
- [x] Add inline internal note editing in W-List table rows (click pencil icon, Ctrl+Enter to save, no panel needed)
- [x] 42 tests passing

## Real-Time HMS Sync System
- [ ] Add HMS_USERNAME, HMS_PASSWORD, HMS_BASE_URL to Secrets
- [ ] Add hms_payments table to schema (transaction_id unique key, all revenue fields)
- [ ] Add hms_sync_status table (connection status, last sync times, error counts)
- [ ] Run DB migration for new tables
- [ ] Build HMS session manager: auto-login, cookie jar, keep-alive every 10 min, re-auth on redirect
- [ ] Build HMS data fetcher: appointments (r703), revenue (r399), W-List (OP_DBAL) with date range params
- [ ] Build backfill engine: Feb 1 2026 to present for all three data types
- [ ] Build 1-min polling scheduler for appointments + W-List
- [ ] Build 5-min polling scheduler for revenue/payments
- [ ] Upsert logic: external_id for appointments, transaction_id for payments, no duplicates
- [ ] Build tRPC sync router: syncStatus, syncLogs, triggerBackfill, triggerSync, reconnect
- [ ] Build Sync Monitoring page: connection status, last sync times, error log, manual controls
- [ ] Add Sync Monitoring nav item to AdminLayout
- [ ] Wire auto-refresh (30s polling) to Dashboard, Schedule, W-List, Income views
- [ ] Build Income Dashboard page (daily/monthly charts from hms_payments)
- [ ] Write vitest tests for sync router

## PWA (Progressive Web App)
- [x] Generate app icons: 72, 96, 128, 144, 152, 192, 384, 512px + maskable 512px + iOS 180px
- [x] Upload all 12 icons to CDN via manus-upload-file --webdev
- [x] Create manifest.json with James Laser branding (name, short_name, theme_color, display=standalone, shortcuts)
- [x] Create service worker (sw.js): app-shell cache, network-first for API, cache-first for static assets, offline fallback page
- [x] Create offline.html fallback page with James Laser branding
- [x] Register service worker in main.tsx with 60s update check
- [x] Add all PWA meta tags to index.html (iOS apple-mobile-web-app-*, Android theme-color, MS tile, favicons)
- [x] Update page title to "James Laser Hair Removal"
- [x] Create usePWAInstall hook (beforeinstallprompt, iOS detection, standalone detection)
- [x] Create PWAInstallBanner component (Install App button + iOS step-by-step dialog)
- [x] Wire PWAInstallBanner into AdminLayout header next to NotificationBell

## Appointment Request Enhancements
- [ ] Install qrcode npm package
- [ ] Build QR Code Generator page (/qr-code) in admin panel: shows QR for /request URL, download PNG, print-ready layout
- [ ] Add Arabic/English bilingual toggle to /request form with RTL layout support
- [ ] Add auto-WhatsApp confirmation after form submission (server-side message builder)

## HMS Field Mapping & Data Interpretation
- [ ] Inspect real HMS records: appointments, W-List, billing, patient details
- [ ] Capture exact field names, status codes, date formats from live HMS network responses
- [ ] Build exact field mapping document (HMS field → app field, type, transform, example)
- [ ] Update HMS sync service with precise field mapping and real status code translation
- [ ] Update UI labels to match correct HMS field meanings
- [ ] Side-by-side validation: 3+ real HMS records vs app records
- [ ] Produce and deliver field mapping report

## Bug Fixes
- [x] Fix duplicate React instance error: moved SW registration after React render in main.tsx, added resolve.dedupe + optimizeDeps to vite.config.ts, cleared Vite cache — confirmed zero errors in fresh browser session

## Vite HMR & Service Worker Fix
- [x] Add HMR config to vite.config.ts: host=0.0.0.0, port=5173, strictPort, hmr.protocol=wss, hmr.host=Manus proxy, hmr.clientPort=443
- [x] Add resolve.dedupe + React aliases to vite.config.ts to force single React instance
- [x] Rewrite main.tsx: dev-only SW unregister + cache clear, prod-only SW registration
- [x] Remove broken wouter@3.7.1 patch from package.json patchedDependencies
- [x] Full clean reinstall: rm node_modules + pnpm-lock.yaml + pnpm store prune + pnpm install
- [x] Verified: single React 19.2.4 instance, all deps share chunk-PQOTZ4DQ, zero console errors in fresh browser session

## QR Code Page & HMS Backfill Engine
- [ ] Build QR Code admin page (/qr-code): generate QR for /request URL, download PNG, print button
- [ ] Build HMS session manager: auto-login via DBAL POST, cookie jar, re-auth on expiry
- [ ] Build HMS backfill engine: appointments (r703) + revenue (r399) from Feb 1 2026 to present
- [ ] Upsert appointments by hospital_appointment_id, revenue by transaction_id/invoice_id
- [ ] Add tRPC backfill router: triggerBackfill, backfillStatus, syncLogs
- [ ] Add Sync Status admin page with backfill progress and sync logs

## Real-Time Machine Appointment Board
- [x] Extend machines table: add machine_code, machine_type, branch, availability_status, maintenance_status, color_tag fields
- [x] Create machine_appointments table (external_id, machine_id, source/sync fields, source_notes, internal_notes)
- [x] Create machine_blocks table (maintenance, admin hold, blocked time)
- [x] Create machine_sync_logs table (module_name, record_type, external_id, action_type, sync_status, error_message)
- [x] Run DB migration for all new tables
- [x] Build DB helpers: upsertMachineAppointment, getMachineAppointments, getMachineBlocks, upsertMachineBlock, getMachineStats, checkConflict, insertMachineSyncLog
- [x] Build machineSyncService.ts: upsert logic, double-booking prevention, source_notes overwrite, internal_notes preserve
- [x] Build HMS machine sync scheduler: 30-second polling, auto-reconnect, fallback to polling
- [x] Build tRPC machineAppointments router: list, stats, upsert, updateStatus, updateInternalNote, triggerSync, syncLogs
- [x] Build tRPC machineBlocks router: list, create, update, delete
- [x] Build Machine Board page (/machine-board): grid calendar (machines x time slots), per-machine list, today/upcoming views
- [x] Add live polling (30s refetchInterval) to Machine Board page
- [x] Add status badges: Confirmed, Pending, Cancelled, Arrived, No-Show, Completed, Blocked, Maintenance
- [x] Add search by patient name, filters by machine/date/status/provider/service
- [x] Add conflict detection UI: highlight overlapping slots, show warning toast
- [x] Add machine availability panel (availability strip with live dots)
- [x] Add dashboard widgets: Machine Board Today stats + Sync Health on Admin Dashboard
- [x] Add Sync Status panel: Live/Delayed/Reconnecting/Error badge, last sync time, failed count
- [x] Add admin notifications for machine events (new, reassignment, cancelled, conflict, sync failure)
- [x] Add Machine Board nav item to AdminLayout sidebar (Equipment group)
- [x] Write vitest tests for machine sync service (26 tests, 68 total passing)

## Real-Time Machine Appointment Board (duplicate — completed above)
- [x] Extend machines table
- [x] Create machine_appointments table
- [x] Create machine_blocks table
- [x] Create machine_sync_logs table
- [x] Run DB migration for all new tables
- [x] Build DB helpers for machine appointments
- [x] Build machineSyncService.ts
- [x] Build HMS machine sync scheduler (30s polling)
- [x] Build tRPC machineAppointments router
- [x] Build tRPC machineBlocks router
- [x] Build Machine Board page (/machine-board)
- [x] Add live polling (30s refetchInterval)
- [x] Add status badges and filters
- [x] Add conflict detection UI
- [x] Add dashboard widgets for machines
- [x] Add Sync Status panel
- [x] Add admin notifications for machine events
- [x] Add Machine Board nav item to AdminLayout
- [x] Write vitest tests for machine router

## Premium Medical Redesign
- [x] Global theme: CSS variables, color palette, typography, index.css
- [x] AdminLayout: navy sidebar, white cards, gray background
- [x] Restructure navigation: 10 pages in correct order
- [x] Dashboard: 8 summary cards + 5 sections
- [ ] Appointment Requests page redesign
- [ ] Confirmed Appointments page redesign
- [x] Machine Schedule board: 12PM-10PM, machine columns, auto-refresh
- [ ] Patient page: 6 tabs (Overview, Appointments, Sessions, Photos, Follow-Ups, Notes)
- [x] Settings page: 5 sections (Admin Control Map, Data & Logic, Automation, Connections, System Status)
- [ ] Sessions page redesign
- [ ] Follow-Ups page redesign
- [x] Income page created
- [x] Notifications page created
- [x] Wire all routes in App.tsx

## Mobile-First Redesign
- [x] Build MobileLayout with bottom navigation (Dashboard, Schedule, Requests, Patients, More)
- [x] Add safe area insets, FAB, live sync indicator to MobileLayout
- [x] Build mobile Schedule page: today vertical list, date navigation, appointment cards
- [x] Add sticky bottom action sheet: Arrived, Start, Complete, No-show, Cancel
- [x] Build mobile Requests page: swipe-right=confirm, swipe-left=cancel
- [x] Build mobile Patients page: fixed search bar, patient list
- [x] Build patient profile with tabs: Overview, Appointments, Sessions, Photos, Follow-Ups, Notes
- [x] Build More tab: links to all secondary pages
- [x] Update App.tsx with responsive mobile/desktop routing
- [ ] Add pull-to-refresh support
- [x] Ensure all tap targets >= 44px
- [x] Add color-coded status badges throughout

## Mobile Real-Time Sync Fix
- [x] Configure QueryClient with zero staleTime/gcTime for critical endpoints
- [x] Add 5s polling for all critical endpoints (appointments, schedule, requests, machine board)
- [x] Add refetchOnWindowFocus, refetchOnReconnect, visibility change listeners
- [x] Invalidate queries after all create/update/delete mutations
- [x] Build useSyncStatus hook with Live/Reconnecting/Offline/Last synced states
- [x] SyncStatusBar integrated into MobileLayout
- [x] Schedule, Dashboard, Requests, Machine Board update without manual refresh
- [ ] Test on iPhone Safari and Android Chrome behavior (background resume)
- [x] Production sync independent from dev-server websocket

## Auto-Translate Service
- [x] Create translations table in DB schema and run migration
- [x] Build translateService.ts: LLM-based translation (EN + AR), batch processing, retry logic
- [x] Wire translation enqueue into HMS sync pipeline (source_notes, service_name, patient_name, provider_name)
- [x] Start translate scheduler on server startup (15s processing interval)
- [x] Add translations tRPC router (forRecord query)
- [x] 68 vitest tests passing

## Data Cleanup & Real Backfill
- [ ] Purge all test/demo/seed data from all tables
- [ ] Run HMS backfill sync Feb 1 to Apr 10 for real patients and appointments
- [ ] Verify no test records remain
- [ ] Verify real-time sync remains active

## Strict Working Hours Enforcement (12:00 PM – 10:00 PM)
- [x] Create shared/workingHours.ts constants (WORK_START=12:00, WORK_END=22:00, INTERVAL=15min)
- [x] Server-side: validate appointment create/update rejects times outside 12PM–10PM
- [x] Server-side: validate machine assignment rejects times outside 12PM–10PM
- [x] HMS sync: flag out-of-range appointments as "OUTSIDE WORKING HOURS", store but hide from schedule
- [x] Machine Schedule UI: time grid 12:00 PM – 10:00 PM only (15-min intervals)
- [x] Appointment table UI: filter out-of-range appointments from main view
- [x] Daily Schedule / W-List UI: hide out-of-range times
- [x] Mobile Schedule: vertical time grid 12PM–10PM only
- [x] Mobile W-List: filter out-of-range appointments
- [x] Mobile Dashboard: respect working hours in stats
- [x] Admin Settings: add strict mode toggle (default ON)
- [ ] Admin Sync Monitor: show out-of-range flagged appointments separately
- [x] Block manual booking outside allowed time in all forms
- [x] Block editing appointment to outside allowed time

## Comprehensive Admin Settings Page (5 Sections)
- [x] Build Section 1: Admin Control Map (roles, appointment controls, machine controls, schedule controls, visibility)
- [x] Build Section 2: Data and Logic (source of truth, duplicate prevention, status mapping, schedule logic, cleanup, translation)
- [x] Build Section 3: Automation Layer (appointment, follow-up, notification, audit, safety automations)
- [x] Build Section 4: Connections (hospital system, WhatsApp, email, database, web/mobile, webhook/API)
- [x] Build Section 5: System Status (app health, sync, DB, automations, strict time, approved machines)
- [x] Add tRPC systemStatus router with real health checks
- [x] Wire settings to real app logic and workflows
- [x] Premium medical UI, phone-friendly, no blank sections

## Persist Automation Toggles to Database
- [x] Add automation_config JSON column to clinic_settings table
- [x] Update settings tRPC router to save/load automation config
- [x] Update AdminSettings UI to load toggles from DB and save on change
- [ ] Wire automation config into machineSyncService (auto-update, auto-remove cancelled, auto-tag)
- [ ] Wire automation config into notification creation (in-app, admin alerts)
- [ ] Wire automation config into audit logging (sync events, record updates, status changes)
- [ ] Wire automation config into follow-up automation
- [ ] Verify toggles persist across page reloads

## Today's Appointments Page (Admin-Only)
- [x] Build TodayAppointments page with 4 sections
- [x] Section 1: Today summary bar (total, confirmed, arrived, completed, no-show, cancelled, walk-in)
- [x] Section 2: Full appointment table with all required columns
- [x] Section 3: Machine schedule view (12PM–10PM, 4 approved machines only)
- [x] Section 4: Quick action panel (mark arrived, mark completed, mark no-show, cancel)
- [x] Admin-only access, phone-friendly, premium medical layout
- [x] Default sort by time, no duplicates, never blank
- [x] Add route to App.tsx and sidebar navigation
- [x] Live polling for real-time HMS sync updates

## Enhanced Real-Time Sync & Machine Mapping
- [x] Add machine name mapping: HMS room codes → 4 approved machines (DEKA AGAIN, CLARITY 2, GENTLE PROMAX, DUETTO MACHINE)
- [x] Flag unknown/unmapped machine names as UNMAPPED SOURCE MACHINE
- [ ] Verify HMS backfill from Feb 1 to today is complete
- [ ] Ensure 30s polling is active on all pages
- [ ] Build enhanced Sync Monitor page with all required stats and controls
- [ ] Build Today's Appointments page with summary bar, full table, machine schedule, quick actions
- [ ] Add routes and navigation for Today's Appointments and Sync Monitor

## Sync Debug Center (Admin-Only)
- [x] Build tRPC syncDebug router: status, testConnection, testDbWrite, testMachineMapping, testStatusMapping, failedRecords, rawPayload, auditTrail, triggerDateRangeSync, retryFailed, exportDebugLog
- [x] Build SyncDebugCenter page with all sections (controls, status, mapping debug, failed records, audit trail, raw payload viewer)
- [x] Add route and navigation entry

## W-List Priority Enhancement
- [ ] Reorder sidebar navigation: W-List first, then Today's Appointments, Dashboard, Patients, Machines, Settings, Sync Debug
- [ ] Reorder mobile bottom nav: W-List first with badge count
- [ ] Add W-List panel to top of Dashboard (always visible, even if zero)
- [ ] Add floating W-List button (bottom-right, all pages, mobile+desktop)
- [ ] Enhance W-List: live arrivals view with Arrived/Walk-In/Waiting/In Progress
- [ ] Add waiting time auto-timer per patient
- [ ] Add quick actions: assign machine, start session, mark completed, mark no-show, open details
- [ ] Add filters: All Active, Arrived only, Walk-In only, Assigned/Unassigned, by machine
- [ ] Add alert behavior: highlight new arrivals, NEW badge, visual pulse
- [ ] Strong color coding: Arrived=Blue, Walk-In=Purple, Waiting long=Red
- [ ] Empty state: "No active patients in W-List"
- [ ] Auto-refresh every few seconds for live updates

## W-List Date-Based Filtering
- [x] Update tRPC wList.liveList to accept date parameter (default today)
- [x] Rewrite desktop WList.tsx with date selector (Today/Yesterday/Tomorrow/Custom), stats bar, date-filtered records
- [x] Rewrite mobile MobileWList.tsx with date selector, stats bar, date-filtered records
- [x] Show only records for selected date, never mix dates
- [x] Empty state: "No W-List records for this date"

## W-List Date-Based Filtering
- [ ] Update tRPC wList.liveList to accept date parameter (default today)
- [ ] Rewrite desktop WList.tsx with date selector, stats bar, date-filtered records
- [ ] Rewrite mobile MobileWList.tsx with date selector, stats bar, date-filtered records

## Hospital Sync Notification Bell
- [x] Enhance NotificationBell with red badge, pulse animation, sync event colors
- [x] Add notification filters (All, Unread, Sync Success/Failure, Arrived, Walk-In, Cancelled, Warnings)
- [x] Link notifications to related pages (W-List, Today, Sync Debug, Machine Schedule)
- [x] Real-time polling for notification updates

## W-List Notification Sound
- [ ] Generate short alert sound (beep) as base64 data URL for W-List
- [ ] Add sound ON/OFF, volume, cooldown controls to W-List page
- [ ] Play sound when HMS sync triggers Arrived/Walk-In/new active queue event
- [ ] Highlight new row with NEW badge on sound trigger
- [ ] Anti-spam cooldown to prevent repeated sounds
- [ ] Mobile + desktop browser autoplay handling

## Big Data Storage Architecture
- [ ] Create raw_source_data table (store raw HMS payloads before processing)
- [ ] Create appointments_archive, sessions_archive, sync_logs_archive tables
- [ ] Create audit_trail table (all changes with user, action, before/after)
- [ ] Create failed_sync table (separate from machine_sync_logs)
- [ ] Add performance indexes on date, patient_id, machine_id, status, external_id
- [ ] Update machineSyncService: store raw payload first, then process/upsert
- [ ] Add archiving job: move records older than 90 days to archive tables
- [ ] Add audit hooks to upsert functions
- [ ] Verify all existing data is preserved after migration

## Responsive Design & Navigation
- [x] Make WList.tsx fully responsive (desktop table + mobile cards, same features)
- [x] Build TodayAppointments page (desktop table + mobile collapsible cards)
- [x] Build SyncDebugCenter page
- [x] Reorder navigation: Today's Appointments, Machine Schedule, W-List, All Appointments, Requests
- [x] Enhance notification bell: red badge, sync event filters, real-time polling
- [ ] Mobile bottom nav: W-List first, 1-tap access

## Wire Automation Config into Sync Service
- [x] Read automationConfig from DB in machineSyncService at sync time
- [x] Gate auto-update-from-sync: skip field updates if toggle is off
- [x] Gate auto-remove-cancelled: skip removal from active queue if toggle is off
- [x] Gate auto-tag-arrived: skip arrived tagging if toggle is off
- [x] Gate auto-tag-walk-ins: skip walk-in tagging if toggle is off
- [x] Gate in-app notifications: skip notification creation if toggle is off
- [x] Gate admin-alert-sync-failure: skip failure alert if toggle is off
- [x] Gate admin-alert-unmapped-machine: skip unmapped alert if toggle is off
- [x] Gate log-sync-events: skip sync log insertion if toggle is off
- [x] Gate log-status-changes: skip status change log if toggle is off
- [x] Gate log-machine-changes: skip machine change log if toggle is off
- [x] Write vitest tests for automation toggle gating

## UI Improvements: Sync Result Display & Walk-In Filter
- [ ] Show skippedUpdates count in SyncDebugCenter sync result panel
- [ ] Show skippedUpdates in last sync result summary (e.g. "481 fetched, 0 created, 0 updated, 481 skipped")
- [ ] Add Walk-In filter tab to Today's Appointments page
- [ ] Walk-In tab shows count badge like other status tabs
- [ ] Walk-In rows visually distinct (e.g. amber/orange accent)

## Dashboard: Enforce 4 Approved Machine Names
- [x] Seed DB with exactly 4 approved machines (DEKA AGAIN, CLARITY 2, GENTLE PROMAX, DUETTO MACHINE)
- [x] Remove/merge any extra machine records in DB that don't match the 4 approved names
- [x] Dashboard machine cards: show only 4 approved machines
- [x] Dashboard machine counters/stats: filter to 4 approved names only
- [x] Machine schedule preview: filter to 4 approved names only
- [x] Machine performance charts: use only 4 approved names
- [x] All machine filters/dropdowns: show only 4 approved names
- [x] Machine badges/labels: map to approved names before display
- [x] Hide UNMAPPED SOURCE MACHINE from all dashboard views
- [x] Verify machine mapping shared/machineMapping.ts covers all HMS codes → 4 approved names

## Walk-In Filter Tab in Today's Appointments
- [x] Add Walk-In tab to status filter tabs (alongside All, Confirmed, Arrived, Pending, Completed, Cancelled)
- [x] Walk-In tab shows count badge (number of walk-in appointments today)
- [x] Walk-In rows visually distinct: amber/orange left border + amber background tint
- [x] Walk-In filter uses visitType field (walk-in detection from sync service)
- [x] Walk-In count shown in today summary bar
- [x] Walk-In tab active state: amber color scheme matching the row styling

## Today's Appointments: Laser-Only Filter
- [ ] Add isLaserAppointment() detection function to shared/laserFilter.ts
- [ ] Add laserOnly boolean param to machineAppts.list tRPC query
- [ ] Apply laser filter server-side: service name, department, machine assignment, rawData clinic code
- [ ] Update TodayAppointments page: show only laser appointments
- [ ] Update summary bar: Total Laser, Confirmed, Arrived, Walk-In, Completed, No-Show, Cancelled, Unassigned Machine
- [ ] Add all required table columns: MRN, Gender, Laser Service, Arrival Label, Walk-In Label, Hospital Appt ID
- [ ] Update empty state: "No laser appointments for today"
- [ ] Update page subtitle to clarify laser-only scope
- [ ] W-List integration: only laser arrivals/walk-ins feed into W-List

## W-List: Date Toggle Control
- [ ] Add Yesterday / Today / Tomorrow / Custom date toggle to W-List top bar
- [ ] Default selection: Today on page load
- [ ] Custom date picker opens on Custom tap, updates W-List immediately
- [ ] Filter W-List data at query level by selected date (not just UI)
- [ ] Dynamic summary bar counts for selected date (Total, Arrived, Walk-In, Waiting)
- [ ] Waiting timer: enabled only for Today
- [ ] Real-time auto-refresh: enabled only for Today
- [ ] Sound alerts: enabled only for Today
- [ ] Static data only for non-today dates
- [ ] Visual indicator: "W-List — Today" / "W-List — Apr 5" / "W-List — Yesterday"
- [ ] Empty state: "No W-List records for this date"
- [ ] Mobile: scrollable/compact segmented control
- [ ] Desktop: horizontal toggle buttons

## Strict Exact Data Extraction from HMS
- [ ] Create raw_source_data table (raw_payload JSON, received_at, source_endpoint, request_id, hospital_appointment_id)
- [ ] Create failed_sync table (error_type, field_name, raw_value, reason, timestamp, external_id)
- [ ] Add source_machine column to machine_appointments (store raw HMS machine value before mapping)
- [ ] Add source_status column to machine_appointments (store raw HMS status before mapping)
- [ ] Add validation flags to machine_appointments: is_valid_laser, is_machine_mapped, is_status_mapped, is_time_valid, has_missing_fields
- [ ] Run DB migration for all new columns/tables
- [ ] Rewrite HMS extraction: store raw payload to raw_source_data BEFORE processing
- [ ] Strict field extraction: extract only if field exists, store NULL if missing
- [ ] Store source_machine (raw) and source_status (raw) separately from internal machine/status
- [ ] Generate validation flags per record during extraction
- [ ] Log failed extractions to failed_sync table (no crash)
- [ ] Log audit trail: raw → extracted → mapped with timestamp and result
- [ ] Expose validation flags in machineAppts.list router response
- [ ] Show validation flags in SyncDebugCenter and TodayAppointments detail view
