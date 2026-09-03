# Graph Report - entong-chat  (2026-09-03)

## Corpus Check
- 248 files · ~224,963 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1055 nodes · 1841 edges · 149 communities (68 shown, 45 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4d61525a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReviewsSection.tsx
- App.tsx
- AdminTongCoinsPanel.tsx
- CustomerInteractiveBotStream.tsx
- What You Must Do When Invoked
- auth
- firebase.ts
- devDependencies
- AppContext.tsx
- CustomerChat.tsx
- dependencies
- InteractiveChatBot.tsx
- otpService.ts
- compilerOptions
- db
- DiscordBotListener
- LazyMessageStream.tsx
- EnhancedChatMessage.tsx
- chatService.ts
- manifest.json
- phoneUtils.ts
- FakeCollection
- components/admin/AdminChat.tsx
- chatAutoCleanupService.ts
- command
- CustomerPortal.tsx
- package.json
- storeScheduleService.ts
- graphify reference: extra exports and benchmark
- parse_ast3.cjs
- parse_ast4.cjs
- parse_ast5.cjs
- parse_debug4.cjs
- parse_ast2.cjs
- ChatInputForm.tsx
- graphify reference: query, path, explain
- get_file_content.cjs
- parse_ast.cjs
- parse_ast6.cjs
- parse_ast7.cjs
- parse_debug.cjs
- parse_debug3.cjs
- run_diagnostics.cjs
- test_parse.cjs
- find_unclosed_paren.cjs
- get_mobile_topbar.cjs
- get_mobile_topbar.js
- parse_again.cjs
- parse_jsx.cjs
- replace_mobile_topbar.cjs
- replace_topbar2.cjs
- chatDateHelper.ts
- test_parse_final.cjs
- test_parse_paren.cjs
- update_reviews_section.cjs
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- delete_use_effect.cjs
- get_lines.cjs
- get_table.cjs
- parse_ast8.cjs
- parse_debug2.cjs
- parse_jsx2.cjs
- parse_modal.cjs
- patch_exact_return.cjs
- test.cjs
- test_esbuild.cjs
- track_braces.cjs
- track_parens.cjs
- update_database_table.cjs
- add_audit_button.cjs
- add_firebase_admin.cjs
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- final_fix.cjs
- get_last_lines.cjs
- insert_audio_notification.cjs
- vite
- parse_jsx3.cjs
- Run and deploy your AI Studio app
- remove_new_option.cjs
- remove_sync.cjs
- FloatingChatButton.tsx
- AutoUpdateHandler.tsx
- test_parse5.cjs
- test_parse_again.cjs
- update_manual_wa.cjs
- update_messaging.cjs
- update_send.cjs
- update_topbar.cjs
- update_trigger.cjs
- vercel.json
- AGENTS.md
- CLAUDE.md
- .claude/CLAUDE.md
- .claude/skills/graphify/references/extraction-spec.md
- express
- firebase
- nodemailer
- puppeteer
- react
- react-dom
- @tailwindcss/vite
- @vitejs/plugin-react
- patch_catalog_standalone.sh
- patch_customer_portal.sh
- patch_hide_grid.sh
- patch_modal_classes.sh
- firebase-messaging-sw.js
- revert_git.sh
- update_app.sh
- update_app_routes.sh

## God Nodes (most connected - your core abstractions)
1. `db` - 68 edges
2. `useApp()` - 31 edges
3. `AdminPortal()` - 26 edges
4. `CustomerPortal()` - 24 edges
5. `AppProvider()` - 21 edges
6. `isJunkBotOrder()` - 17 edges
7. `CustomerChat()` - 15 edges
8. `compilerOptions` - 15 edges
9. `UserProfile` - 14 edges
10. `normalizePhone()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `generateWhatsAppOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `startServer()` --calls--> `resetPasswordWithOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `startServer()` --calls--> `verifyWhatsAppOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `MainAppRouter()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/context/AppContext.tsx
- `ManualWAOrderModalProps` --references--> `GameOrder`  [EXTRACTED]
  src/components/admin/ManualWAOrderModal.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (149 total, 45 thin omitted)

### Community 0 - "ReviewsSection.tsx"
Cohesion: 0.07
Nodes (44): AdminReviewGenerator(), QUICK_KEYWORD_PILLS, AdminReviewsManager(), LeaderboardEntry, LeaderboardSection(), getProductOrCategoryImage(), LiveTransactionsCarousel(), LiveTransactionsCarouselProps (+36 more)

### Community 1 - "App.tsx"
Cohesion: 0.07
Nodes (22): App(), CustomerNotificationBridge(), MainAppRouter(), AuthModal(), Props, ResetPasswordPage(), ResetPasswordPageProps, AutoReloadManager() (+14 more)

### Community 2 - "AdminTongCoinsPanel.tsx"
Cohesion: 0.30
Nodes (9): AdminKelolaTongCoins(), AdminKelolaTongCoinsProps, AdminTongCoinsPanel(), AdminTongCoinsPanelProps, AddTongCoinParams, mutateTongCoins(), ResolvedUser, resolveUserDocRef() (+1 more)

### Community 3 - "CustomerInteractiveBotStream.tsx"
Cohesion: 0.27
Nodes (7): CustomerInteractiveBotStream(), Props, Props, StrictOrderValidatedForm(), dispatchCatalogActionBubble(), submitFormAndRelinkOrder(), SubmitFormPayload

### Community 4 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 6 - "firebase.ts"
Cohesion: 0.07
Nodes (57): AdminPaymentPending(), AdminPaymentPendingProps, AdminPortal(), ChatInputArea, ChatListItem, getCustomerDisplayName(), getSafeInitial(), getStatusBadgeConfig() (+49 more)

### Community 7 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, esbuild, devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/express (+15 more)

### Community 8 - "AppContext.tsx"
Cohesion: 0.05
Nodes (53): CloudMonitor(), getCloudExpirationMs(), toDateTimeLocalString(), extractOrderTime(), FloatingPaymentNotifications(), FloatingPaymentNotificationsProps, VerifyEmailPage(), VerifyEmailPageProps (+45 more)

### Community 9 - "CustomerChat.tsx"
Cohesion: 0.08
Nodes (33): AttendanceDayDoc, AttendancePanel(), AttendancePanelProps, AttendanceRecord, DEFAULT_STAFF_FALLBACK, BotWelcomeOptions(), BotWelcomeOptionsProps, InteractiveBotBubble() (+25 more)

### Community 10 - "dependencies"
Cohesion: 0.10
Nodes (21): browser-image-compression, dotenv, firebase-admin, @google/genai, lucide-react, @marsidev/react-turnstile, motion, dependencies (+13 more)

### Community 12 - "otpService.ts"
Cohesion: 0.22
Nodes (16): createPasswordResetLink(), createVerificationLink(), getFirebaseAdmin(), renderPasswordResetEmailHtml(), renderVerificationEmailHtml(), sendCustomPasswordResetEmail(), sendCustomVerificationEmail(), findUserByIdentifier() (+8 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 14 - "db"
Cohesion: 0.27
Nodes (6): AdminChatHeaderProps, AdminChatInlineHeader(), db, syncOrderStatusEverywhere(), executeSetOrderHangus(), SetOrderHangusParams

### Community 15 - "DiscordBotListener"
Cohesion: 0.22
Nodes (6): DDSMonitoringParsedData, DiscordBotListener, DiscordBotLog, parseCurrencyStringToNumber(), parseDDSEmbed(), processCustomCloudWebhook()

### Community 17 - "EnhancedChatMessage.tsx"
Cohesion: 0.29
Nodes (7): ChatMessageRenderer, ChatMessageRendererProps, FormattedChatMessage(), FormattedChatMessageProps, EnhancedChatMessage, EnhancedChatMessageProps, MessageContentProps

### Community 18 - "chatService.ts"
Cohesion: 1.00
Nodes (3): formatSafeChatTime(), normalizeChatTimestamp(), subscribeToAllChats()

### Community 19 - "manifest.json"
Cohesion: 0.13
Nodes (14): background_color, categories, description, display, icons, name, orientation, scope (+6 more)

### Community 21 - "phoneUtils.ts"
Cohesion: 0.16
Nodes (20): CatalogOption, ManualWAOrderModal(), ManualWAOrderModalProps, sanitizePayload(), GuestChatForm(), GuestChatFormProps, GiftOrderFormModal(), GiftOrderFormModalProps (+12 more)

### Community 22 - "FakeCollection"
Cohesion: 0.18
Nodes (4): FakeCollection, FakePocketBase, pb, POCKETBASE_URL

### Community 23 - "components/admin/AdminChat.tsx"
Cohesion: 0.21
Nodes (9): AdminChat(), formatSimpleTime(), MemoizedChatItem, AdminChatRoom(), formatTime(), globalMemCache, MemoizedMessageBubble, formatSimpleTime() (+1 more)

### Community 25 - "command"
Cohesion: 0.17
Nodes (11): command, type, mcp, firebase, plugin, $schema, experimental:mcp, file:///C:/Users/sandi/Documents/WEB/entong-chat/.kilo/plugins/graphify.js (+3 more)

### Community 27 - "CustomerPortal.tsx"
Cohesion: 0.05
Nodes (58): content, eIdx, fs, hEnd, hStart, sIdx, AdminCatalogManager(), Toast (+50 more)

### Community 28 - "package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, clean, dev, lint, start (+2 more)

### Community 30 - "storeScheduleService.ts"
Cohesion: 0.38
Nodes (7): StoreScheduleSettingModal(), StoreOperationalBanner(), DEFAULT_SCHEDULE, evaluateStoreStatus(), getWIBCurrentTime(), StoreScheduleConfig, subscribeStoreSchedule()

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 35 - "parse_ast3.cjs"
Cohesion: 0.25
Nodes (6): code, end, fs, sourceFile, start, ts

### Community 36 - "parse_ast4.cjs"
Cohesion: 0.25
Nodes (6): code, fs, mainReturn, returnStmts, sourceFile, ts

### Community 37 - "parse_ast5.cjs"
Cohesion: 0.25
Nodes (6): code, fs, mainReturn, returnStmts, sourceFile, ts

### Community 38 - "parse_debug4.cjs"
Cohesion: 0.25
Nodes (7): allDiagnostics, code, configPath, emitResult, fs, program, ts

### Community 39 - "parse_ast2.cjs"
Cohesion: 0.29
Nodes (5): code, fs, nodesReachingEof, sourceFile, ts

### Community 40 - "ChatInputForm.tsx"
Cohesion: 0.29
Nodes (4): ChatInputForm, ChatInputFormProps, ChatSidebarItem, ChatSidebarItemProps

### Community 43 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 44 - "get_file_content.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 46 - "parse_ast.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 47 - "parse_ast6.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 48 - "parse_ast7.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 49 - "parse_debug.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 50 - "parse_debug3.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 51 - "run_diagnostics.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 54 - "test_parse.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 55 - "find_unclosed_paren.cjs"
Cohesion: 0.40
Nodes (4): code, fs, lines, stack

### Community 56 - "get_mobile_topbar.cjs"
Cohesion: 0.40
Nodes (4): content, eIdx, fs, sIdx

### Community 57 - "get_mobile_topbar.js"
Cohesion: 0.40
Nodes (4): content, eIdx, fs, sIdx

### Community 58 - "parse_again.cjs"
Cohesion: 0.40
Nodes (4): code, fs, lines, stack

### Community 59 - "parse_jsx.cjs"
Cohesion: 0.40
Nodes (4): acorn, code, fs, jsx

### Community 60 - "replace_mobile_topbar.cjs"
Cohesion: 0.40
Nodes (4): content, eIdx, fs, sIdx

### Community 61 - "replace_topbar2.cjs"
Cohesion: 0.40
Nodes (4): content, eIdx, fs, sIdx

### Community 63 - "chatDateHelper.ts"
Cohesion: 0.70
Nodes (4): format24HourTime(), formatDateDivider(), getMessageDate(), shouldShowDateDivider()

### Community 64 - "test_parse_final.cjs"
Cohesion: 0.40
Nodes (4): code, fs, lines, stack

### Community 65 - "test_parse_paren.cjs"
Cohesion: 0.40
Nodes (4): code, fs, lines, stack

### Community 66 - "update_reviews_section.cjs"
Cohesion: 0.40
Nodes (4): content, fs, matchEnd, matchStart

### Community 67 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 68 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 69 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 70 - "delete_use_effect.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 71 - "get_lines.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 72 - "get_table.cjs"
Cohesion: 0.50
Nodes (3): content, fs, sIdx

### Community 76 - "parse_ast8.cjs"
Cohesion: 0.50
Nodes (3): code, fs, stackP

### Community 77 - "parse_debug2.cjs"
Cohesion: 0.50
Nodes (3): code, fs, pos

### Community 78 - "parse_jsx2.cjs"
Cohesion: 0.50
Nodes (3): code, fs, stack

### Community 79 - "parse_modal.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 80 - "patch_exact_return.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 85 - "test.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 86 - "test_esbuild.cjs"
Cohesion: 0.50
Nodes (3): code, esbuild, fs

### Community 87 - "track_braces.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 88 - "track_parens.cjs"
Cohesion: 0.50
Nodes (3): code, fs, lines

### Community 89 - "update_database_table.cjs"
Cohesion: 0.50
Nodes (3): content, fs, sIdx

### Community 99 - "vite"
Cohesion: 0.67
Nodes (3): vite, vite, vite

## Knowledge Gaps
- **404 isolated node(s):** `$schema`, `type`, `npx`, `-y`, `firebase-tools@14.15.2` (+399 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 521 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `db` to `ReviewsSection.tsx`, `App.tsx`, `AdminTongCoinsPanel.tsx`, `CustomerInteractiveBotStream.tsx`, `auth`, `firebase.ts`, `AppContext.tsx`, `CustomerChat.tsx`, `InteractiveChatBot.tsx`, `LazyMessageStream.tsx`, `chatService.ts`, `chatUnreadService.ts`, `phoneUtils.ts`, `FakeCollection`, `components/admin/AdminChat.tsx`, `chatAutoCleanupService.ts`, `CustomerPortal.tsx`, `storeScheduleService.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `$schema`, `type`, `npx` to the rest of the system?**
  _404 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewsSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07422559906487435 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07439024390243902 - nodes in this community are weakly interconnected._
- **Should `What You Must Do When Invoked` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `firebase.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06593406593406594 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._