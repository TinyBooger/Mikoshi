
```
Mikoshi-MonoRepo
├─ backend
│  ├─ database.py
│  ├─ Dockerfile
│  ├─ init_db.py
│  ├─ logs
│  │  └─ error.log
│  ├─ models.py
│  ├─ README.md
│  ├─ requirements.txt
│  ├─ routes
│  │  ├─ admin.py
│  │  ├─ alipay.py
│  │  ├─ audit_log.py
│  │  ├─ auth.py
│  │  ├─ character.py
│  │  ├─ character_assistant.py
│  │  ├─ chat.py
│  │  ├─ error_log.py
│  │  ├─ exp.py
│  │  ├─ invitation.py
│  │  ├─ notification.py
│  │  ├─ persona.py
│  │  ├─ problem_report.py
│  │  ├─ scene.py
│  │  ├─ search.py
│  │  ├─ tags.py
│  │  ├─ user.py
│  │  └─ wechat_pay.py
│  ├─ schemas.py
│  ├─ server.py
│  ├─ static
│  ├─ test_captcha_config.py
│  ├─ update_chat.py
│  └─ utils
│     ├─ alipay_utils.py
│     ├─ audit_logger.py
│     ├─ AUDIT_LOGGING.md
│     ├─ badge_system.py
│     ├─ captcha_utils.py
│     ├─ chat_history_utils.py
│     ├─ chat_utils.py
│     ├─ cloudinary_utils.py
│     ├─ common_words.txt
│     ├─ common_words_zh.txt
│     ├─ content_censor.py
│     ├─ content_review_queue.py
│     ├─ context_window.py
│     ├─ error_logger.py
│     ├─ image_moderation.py
│     ├─ level_system.py
│     ├─ llm_client.py
│     ├─ local_storage_utils.py
│     ├─ message_limit.py
│     ├─ payment_provider.py
│     ├─ request_utils.py
│     ├─ security_middleware.py
│     ├─ sensitive_keywords.txt
│     ├─ sensitive_patterns.txt
│     ├─ session.py
│     ├─ sms_utils.py
│     ├─ text_moderation.py
│     ├─ token_cap.py
│     ├─ token_usage_ledger.py
│     ├─ token_wallet.py
│     ├─ usage_utils.py
│     ├─ user_utils.py
│     ├─ validators.py
│     └─ wechat_pay_utils.py
├─ build.sh
├─ docker-compose.dev.yml
├─ docker-compose.prod.yml
├─ docs
│  ├─ ADMIN.md
│  ├─ backup.md
│  ├─ doc-organizer.agent.md
│  ├─ FEATURES.md
│  ├─ integrations.md
│  ├─ logging.md
│  └─ MIGRATION_GUIDE.md
├─ frontend
│  ├─ .env.development
│  ├─ .env.production
│  ├─ Dockerfile
│  ├─ Dockerfile.dev
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  ├─ alipay
│  │  │  ├─ 推荐.ai
│  │  │  ├─ 推荐.png
│  │  │  ├─ 支付宝logo-方形.ai
│  │  │  ├─ 支付宝logo-方形.pdf
│  │  │  ├─ 支付宝logo-方形.png
│  │  │  └─ 电脑网站支付.png
│  │  └─ favicon.ico
│  ├─ README.md
│  ├─ src
│  │  ├─ admin
│  │  │  ├─ admin-mobile.css
│  │  │  ├─ AdminApp.jsx
│  │  │  ├─ components
│  │  │  │  ├─ AdminSidebar.jsx
│  │  │  │  ├─ EditModal.jsx
│  │  │  │  └─ Table.jsx
│  │  │  └─ pages
│  │  │     ├─ AuditLogsPage.jsx
│  │  │     ├─ CharactersPage.jsx
│  │  │     ├─ ContentReviewPage.jsx
│  │  │     ├─ DashboardPage.jsx
│  │  │     ├─ ErrorLogsPage.jsx
│  │  │     ├─ InvitationCodesPage.jsx
│  │  │     ├─ NotificationsPage.jsx
│  │  │     ├─ ProblemReportsPage.jsx
│  │  │     ├─ SearchTermsPage.jsx
│  │  │     ├─ SystemSettingsPage.jsx
│  │  │     ├─ TagsPage.jsx
│  │  │     ├─ UsersPage.css
│  │  │     ├─ UsersPage.jsx
│  │  │     └─ UserStatsPage.jsx
│  │  ├─ App.jsx
│  │  ├─ assets
│  │  │  └─ images
│  │  │     ├─ default-avatar.png
│  │  │     ├─ default-picture-expired.png
│  │  │     ├─ default-picture.png
│  │  │     ├─ logo.png
│  │  │     ├─ logo_text.png
│  │  │     └─ logo_v1_old.png
│  │  ├─ components
│  │  │  ├─ AdminRoute.jsx
│  │  │  ├─ AuthLayout.jsx
│  │  │  ├─ AuthProvider.jsx
│  │  │  ├─ AvatarFrame.jsx
│  │  │  ├─ ButtonRounded.jsx
│  │  │  ├─ CardSection.jsx
│  │  │  ├─ CharacterAssistantModal.jsx
│  │  │  ├─ CharacterModal.jsx
│  │  │  ├─ CharacterSidebar.jsx
│  │  │  ├─ ConfirmModal.jsx
│  │  │  ├─ DiscoverMasonryCard.css
│  │  │  ├─ DiscoverMasonryCard.jsx
│  │  │  ├─ EntityCard.jsx
│  │  │  ├─ HorizontalCardSection.jsx
│  │  │  ├─ ImageCropModal.jsx
│  │  │  ├─ InfoCard.jsx
│  │  │  ├─ Layout.jsx
│  │  │  ├─ LevelProgress.jsx
│  │  │  ├─ NameCard.jsx
│  │  │  ├─ OnboardingTour.jsx
│  │  │  ├─ PageWrapper.jsx
│  │  │  ├─ PaginationBar.jsx
│  │  │  ├─ PersonaModal.jsx
│  │  │  ├─ PrimaryButton.jsx
│  │  │  ├─ ProblemReportModal.jsx
│  │  │  ├─ RefundPolicyModal.jsx
│  │  │  ├─ SceneCard.jsx
│  │  │  ├─ SceneCharacterSelectModal.jsx
│  │  │  ├─ SceneModal.jsx
│  │  │  ├─ SecondaryButton.jsx
│  │  │  ├─ Sidebar.jsx
│  │  │  ├─ TagsInput.jsx
│  │  │  ├─ TextButton.jsx
│  │  │  ├─ ToastProvider.jsx
│  │  │  ├─ UgcPolicyModal.jsx
│  │  │  ├─ UpdateNotificationModal.jsx
│  │  │  ├─ UserCard.jsx
│  │  │  └─ WeChatPayModal.jsx
│  │  ├─ firebase.js
│  │  ├─ hooks
│  │  ├─ i18n.js
│  │  ├─ locales
│  │  │  ├─ en.json
│  │  │  └─ zh.json
│  │  ├─ main.jsx
│  │  ├─ pages
│  │  │  ├─ AlipayReturnPage.jsx
│  │  │  ├─ AlipayTestPage.jsx
│  │  │  ├─ BrowsePage.jsx
│  │  │  ├─ CharacterFormPage.jsx
│  │  │  ├─ ChatPage.jsx
│  │  │  ├─ EntityDetailPage.jsx
│  │  │  ├─ EntityFormPage.jsx
│  │  │  ├─ HomePage.jsx
│  │  │  ├─ NotFoundPage.jsx
│  │  │  ├─ OrderDetailPage.jsx
│  │  │  ├─ OrderHistoryTab.jsx
│  │  │  ├─ PrivacyPolicyPage.jsx
│  │  │  ├─ ProfilePage.jsx
│  │  │  ├─ ProUpgradePage.jsx
│  │  │  ├─ ResetPasswordPage.jsx
│  │  │  ├─ SearchPage.jsx
│  │  │  ├─ SettingsPage.jsx
│  │  │  ├─ SignUpPage.jsx
│  │  │  ├─ TermsOfServicePage.jsx
│  │  │  ├─ TestPage.jsx
│  │  │  ├─ TokenTopUpPage.jsx
│  │  │  └─ WelcomePage.jsx
│  │  ├─ styles
│  │  │  ├─ AlipayTest.css
│  │  │  └─ WeChatPayModal.css
│  │  └─ utils
│  │     ├─ apiErrorUtils.js
│  │     ├─ auditLogger.js
│  │     ├─ contextWindow.js
│  │     ├─ errorLogger.js
│  │     ├─ expUtils.js
│  │     ├─ imageUtils.js
│  │     ├─ systemTemplate.js
│  │     └─ tokenDisplay.js
│  └─ vite.config.js
├─ nginx
│  ├─ conf.d
│  │  ├─ mikoshi.conf
│  │  └─ mikoshi.conf.dev
│  ├─ nginx.conf
│  └─ README.md
├─ README.md
├─ scripts
│  └─ backup
│     ├─ backup_prod_postgres.sh
│     ├─ prune_backups.sh
│     ├─ README.md
│     └─ restore_prod_postgres.sh
├─ start-dev.bat
└─ test_security.py

```