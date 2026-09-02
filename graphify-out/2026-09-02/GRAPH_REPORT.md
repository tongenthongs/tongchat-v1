# Graph Report - entong-chat  (2026-09-02)

## Corpus Check
- 253 files · ~232,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1100 nodes · 1858 edges · 170 communities (88 shown, 47 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- ReviewsSection.tsx
- App.tsx
- CustomerPortal.tsx
- AppContext.tsx
- What You Must Do When Invoked
- What You Must Do When Invoked
- AdminPortal.tsx
- devDependencies
- types.ts
- CustomerChat.tsx
- dependencies
- GiftOrdersPanel.tsx
- otpService.ts
- compilerOptions
- db
- DiscordBotListener
- orderRefund.ts
- useApp
- OrderDetail.tsx
- manifest.json
- firebase.ts
- phoneUtils.ts
- FakeCollection
- components/admin/AdminChat.tsx
- botChatService.ts
- command
- AdminTongCoinsPanel.tsx
- Catalog.tsx
- package.json
- EnhancedChatMessage.tsx
- storeScheduleService.ts
- graphify reference: extra exports and benchmark
- graphify reference: extra exports and benchmark
- AdminChatMinimalHeader.tsx
- overhaul_status_sync.cjs
- parse_ast3.cjs
- parse_ast4.cjs
- parse_ast5.cjs
- parse_debug4.cjs
- parse_ast2.cjs
- ChatInputForm.tsx
- TongCoinsPage.tsx
- OperationType
- graphify reference: query, path, explain
- get_file_content.cjs
- graphify reference: query, path, explain
- parse_ast.cjs
- parse_ast6.cjs
- parse_ast7.cjs
- parse_debug.cjs
- parse_debug3.cjs
- run_diagnostics.cjs
- AttendancePanel.tsx
- orderUtils.ts
- test_parse.cjs
- find_unclosed_paren.cjs
- get_mobile_topbar.cjs
- get_mobile_topbar.js
- parse_again.cjs
- parse_jsx.cjs
- replace_mobile_topbar.cjs
- replace_topbar2.cjs
- roomManager.ts
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
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- parse_ast8.cjs
- parse_debug2.cjs
- parse_jsx2.cjs
- parse_modal.cjs
- patch_exact_return.cjs
- InteractiveChatBot.tsx
- LazyMessageStream.tsx
- chatService.ts
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
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- vite
- parse_jsx3.cjs
- Run and deploy your AI Studio app
- remove_new_option.cjs
- remove_sync.cjs
- FloatingChatButton.tsx
- AutoUpdateHandler.tsx
- chatAutoCleanupService.ts
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
- .kiro/skills/graphify/references/extraction-spec.md
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
10. `auth` - 13 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `generateWhatsAppOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `startServer()` --calls--> `resetPasswordWithOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `startServer()` --calls--> `verifyWhatsAppOtp()`  [EXTRACTED]
  server.ts → server/otpService.ts
- `MainAppRouter()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/context/AppContext.tsx
- `AttendancePanelProps` --references--> `UserProfile`  [EXTRACTED]
  src/components/admin/AttendancePanel.tsx → src/types.ts

## Import Cycles
- None detected.

## Communities (170 total, 47 thin omitted)

### Community 0 - "ReviewsSection.tsx"
Cohesion: 0.07
Nodes (44): AdminReviewGenerator(), QUICK_KEYWORD_PILLS, AdminReviewsManager(), LeaderboardEntry, LeaderboardSection(), getProductOrCategoryImage(), LiveTransactionsCarousel(), LiveTransactionsCarouselProps (+36 more)

### Community 1 - "App.tsx"
Cohesion: 0.08
Nodes (20): App(), CustomerNotificationBridge(), MainAppRouter(), ResetPasswordPage(), ResetPasswordPageProps, VerifyEmailPage(), VerifyEmailPageProps, AutoReloadManager() (+12 more)

### Community 2 - "CustomerPortal.tsx"
Cohesion: 0.14
Nodes (17): CheckoutModal(), CheckoutModalProps, compressImageFile(), RulesAgreementModal(), RulesAgreementModalProps, SafeImage(), CustomerOrders(), CustomerOrdersProps (+9 more)

### Community 3 - "AppContext.tsx"
Cohesion: 0.16
Nodes (18): CustomerPortal(), AppContext, AppProvider(), cleanFirestorePayload(), extractGameItemsFromCatalogs(), FirestoreErrorInfo, formatDate(), handleFirestoreError() (+10 more)

### Community 4 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 5 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "AdminPortal.tsx"
Cohesion: 0.15
Nodes (16): AdminPaymentPending(), AdminPaymentPendingProps, AdminPortal(), ChatInputArea, ChatListItem, getCustomerDisplayName(), getSafeInitial(), getStatusBadgeConfig() (+8 more)

### Community 7 - "devDependencies"
Cohesion: 0.09
Nodes (23): autoprefixer, esbuild, devDependencies, autoprefixer, esbuild, tailwindcss, tsx, @types/express (+15 more)

### Community 8 - "types.ts"
Cohesion: 0.16
Nodes (19): CloudMonitor(), getCloudExpirationMs(), toDateTimeLocalString(), CustomerNotifications(), CustomerNotificationsProps, AppContextType, ActionCard, AppNotification (+11 more)

### Community 9 - "CustomerChat.tsx"
Cohesion: 0.16
Nodes (15): JokiCredentialFormMessage(), JokiCredentialFormMessageProps, Props, TwoFactorActionBubble(), CustomerChat(), CustomerChatProps, renderMessageText(), ReviewPromptCard() (+7 more)

### Community 10 - "dependencies"
Cohesion: 0.10
Nodes (21): browser-image-compression, dotenv, firebase-admin, @google/genai, lucide-react, @marsidev/react-turnstile, motion, dependencies (+13 more)

### Community 11 - "GiftOrdersPanel.tsx"
Cohesion: 0.20
Nodes (17): AddGiftOrderModalProps, formatOrderDate(), getGiftOperatingHoursInfo(), getLiveGiftStatus(), getLocalDateStr(), GiftOrder, GiftOrdersPanel(), GiftOrdersPanelProps (+9 more)

### Community 12 - "otpService.ts"
Cohesion: 0.22
Nodes (16): createPasswordResetLink(), createVerificationLink(), getFirebaseAdmin(), renderPasswordResetEmailHtml(), renderVerificationEmailHtml(), sendCustomPasswordResetEmail(), sendCustomVerificationEmail(), findUserByIdentifier() (+8 more)

### Community 13 - "compilerOptions"
Cohesion: 0.11
Nodes (18): DOM, DOM.Iterable, ES2022, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators, isolatedModules (+10 more)

### Community 14 - "db"
Cohesion: 0.17
Nodes (9): CustomerInteractiveBotStream(), Props, Props, StrictOrderValidatedForm(), auth, db, dispatchCatalogActionBubble(), submitFormAndRelinkOrder() (+1 more)

### Community 15 - "DiscordBotListener"
Cohesion: 0.22
Nodes (6): DDSMonitoringParsedData, DiscordBotListener, DiscordBotLog, parseCurrencyStringToNumber(), parseDDSEmbed(), processCustomCloudWebhook()

### Community 16 - "orderRefund.ts"
Cohesion: 0.23
Nodes (14): extractOrderTime(), FloatingPaymentNotifications(), FloatingPaymentNotificationsProps, useOrders(), extractTimeMs(), buildExpiredWarningText(), checkAndDispatchAuto2DayWarnings(), ExpirationWarningResult (+6 more)

### Community 17 - "useApp"
Cohesion: 0.16
Nodes (12): AuthModal(), Props, NOTE: In production, you'd want to configure a proper VAPID key via env vars., WebPushNotificationBanner(), CustomerSettings(), CustomerSettingsProps, GiftDeliveryModal(), GiftDeliveryModalProps (+4 more)

### Community 18 - "OrderDetail.tsx"
Cohesion: 0.21
Nodes (11): checkIsConfirmedLocally(), OrderDetail(), OrderDetailProps, GiftJoinServerBanner(), GiftJoinServerBannerProps, OrderProgressStepper(), Props, WorkerGiftCard() (+3 more)

### Community 19 - "manifest.json"
Cohesion: 0.13
Nodes (14): background_color, categories, description, display, icons, name, orientation, scope (+6 more)

### Community 20 - "firebase.ts"
Cohesion: 0.15
Nodes (11): AdminCatalogManager(), Toast, StaffInternalChat(), StaffMessage, DEFAULT_STAFF_LIST, StaffManagement(), config, firebaseConfig (+3 more)

### Community 21 - "phoneUtils.ts"
Cohesion: 0.30
Nodes (12): CatalogOption, ManualWAOrderModal(), ManualWAOrderModalProps, sanitizePayload(), getCanonicalPhone(), handlePostLoginSync(), linkGuestOrdersToAccount(), normalizePhoneVariants() (+4 more)

### Community 22 - "FakeCollection"
Cohesion: 0.18
Nodes (4): FakeCollection, FakePocketBase, pb, POCKETBASE_URL

### Community 23 - "components/admin/AdminChat.tsx"
Cohesion: 0.21
Nodes (9): AdminChat(), formatSimpleTime(), MemoizedChatItem, AdminChatRoom(), formatTime(), globalMemCache, MemoizedMessageBubble, formatSimpleTime() (+1 more)

### Community 24 - "botChatService.ts"
Cohesion: 0.26
Nodes (8): BotWelcomeOptions(), BotWelcomeOptionsProps, InteractiveBotBubble(), InteractiveBotBubbleProps, inFlightGreetingRooms, InteractiveBotType, sendBotBubble(), sendCustomerBubble()

### Community 25 - "command"
Cohesion: 0.17
Nodes (11): command, type, mcp, firebase, plugin, $schema, experimental:mcp, file:///C:/Users/sandi/Documents/WEB/entong-chat/.kilo/plugins/graphify.js (+3 more)

### Community 26 - "AdminTongCoinsPanel.tsx"
Cohesion: 0.30
Nodes (9): AdminKelolaTongCoins(), AdminKelolaTongCoinsProps, AdminTongCoinsPanel(), AdminTongCoinsPanelProps, AddTongCoinParams, mutateTongCoins(), ResolvedUser, resolveUserDocRef() (+1 more)

### Community 27 - "Catalog.tsx"
Cohesion: 0.26
Nodes (10): Catalog(), CatalogProps, isProductAvailable(), checkIsGamepassOpen(), GIFT_OPERATIONAL_HOURS, isGiftClosedTime(), isProductGamepass(), isProductGift() (+2 more)

### Community 28 - "package.json"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, clean, dev, lint, start (+2 more)

### Community 29 - "EnhancedChatMessage.tsx"
Cohesion: 0.29
Nodes (7): ChatMessageRenderer, ChatMessageRendererProps, FormattedChatMessage(), FormattedChatMessageProps, EnhancedChatMessage, EnhancedChatMessageProps, MessageContentProps

### Community 30 - "storeScheduleService.ts"
Cohesion: 0.38
Nodes (7): StoreScheduleSettingModal(), StoreOperationalBanner(), DEFAULT_SCHEDULE, evaluateStoreStatus(), getWIBCurrentTime(), StoreScheduleConfig, subscribeStoreSchedule()

### Community 31 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 32 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 33 - "AdminChatMinimalHeader.tsx"
Cohesion: 0.36
Nodes (5): AdminChatHeaderProps, AdminChatInlineHeader(), syncOrderStatusEverywhere(), executeSetOrderHangus(), SetOrderHangusParams

### Community 34 - "overhaul_status_sync.cjs"
Cohesion: 0.25
Nodes (6): content, eIdx, fs, hEnd, hStart, sIdx

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

### Community 41 - "TongCoinsPage.tsx"
Cohesion: 0.33
Nodes (6): formatTransactionDate(), PRESET_AMOUNTS, TongCoinsPage(), TongCoinsPageProps, CoinTransaction, TONGCOINS_TOS

### Community 42 - "OperationType"
Cohesion: 0.29
Nodes (7): OperationType, CREATE, DELETE, GET, LIST, UPDATE, WRITE

### Community 43 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 44 - "get_file_content.cjs"
Cohesion: 0.33
Nodes (4): code, fs, sourceFile, ts

### Community 45 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

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

### Community 52 - "AttendancePanel.tsx"
Cohesion: 0.33
Nodes (5): AttendanceDayDoc, AttendancePanel(), AttendancePanelProps, AttendanceRecord, DEFAULT_STAFF_FALLBACK

### Community 53 - "orderUtils.ts"
Cohesion: 0.67
Nodes (4): dispatchAutoChatMessage(), getDynamicQuickReply(), handleUpdateOrderStatusWithAutoBot(), markOrderAsHangus()

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

### Community 62 - "roomManager.ts"
Cohesion: 0.50
Nodes (4): ensureDirectRoomExists(), fetchRoomWithSafeFallback(), initializeAndSubscribeRoom(), RoomData

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

### Community 73 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 74 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 75 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

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

### Community 83 - "chatService.ts"
Cohesion: 1.00
Nodes (3): formatSafeChatTime(), normalizeChatTimestamp(), subscribeToAllChats()

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
- **443 isolated node(s):** `$schema`, `type`, `npx`, `-y`, `firebase-tools@14.15.2` (+438 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 568 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `db` connect `db` to `ReviewsSection.tsx`, `App.tsx`, `CustomerPortal.tsx`, `AppContext.tsx`, `AdminPortal.tsx`, `types.ts`, `CustomerChat.tsx`, `GiftOrdersPanel.tsx`, `orderRefund.ts`, `useApp`, `OrderDetail.tsx`, `firebase.ts`, `phoneUtils.ts`, `FakeCollection`, `components/admin/AdminChat.tsx`, `botChatService.ts`, `AdminTongCoinsPanel.tsx`, `Catalog.tsx`, `storeScheduleService.ts`, `AdminChatMinimalHeader.tsx`, `TongCoinsPage.tsx`, `AttendancePanel.tsx`, `orderUtils.ts`, `roomManager.ts`, `InteractiveChatBot.tsx`, `LazyMessageStream.tsx`, `chatService.ts`, `chatUnreadService.ts`, `chatAutoCleanupService.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `useApp()` connect `useApp` to `ReviewsSection.tsx`, `App.tsx`, `CustomerPortal.tsx`, `AppContext.tsx`, `AdminPortal.tsx`, `types.ts`, `CustomerChat.tsx`, `TongCoinsPage.tsx`, `OrderDetail.tsx`, `Catalog.tsx`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `$schema`, `type`, `npx` to the rest of the system?**
  _443 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReviewsSection.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07422559906487435 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07965860597439545 - nodes in this community are weakly interconnected._
- **Should `CustomerPortal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1354679802955665 - nodes in this community are weakly interconnected._
- **Should `What You Must Do When Invoked` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._