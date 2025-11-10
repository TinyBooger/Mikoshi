```
Mikoshi-MonoRepo
├─ backend
│  ├─ database.py
│  ├─ Dockerfile
│  ├─ init_db.py
│  ├─ models.py
│  ├─ README.md
│  ├─ requirements.txt
│  ├─ routes
│  │  ├─ auth.py
│  │  ├─ character.py
│  │  ├─ chat.py
│  │  ├─ persona.py
│  │  ├─ scene.py
│  │  ├─ search.py
│  │  ├─ tags.py
│  │  └─ user.py
│  ├─ schemas.py
│  ├─ server.py
│  ├─ static
│  └─ utils
│     ├─ chat_utils.py
│     ├─ cloudinary_utils.py
│     ├─ llm_client.py
│     ├─ local_storage_utils.py
│     ├─ session.py
│     └─ validators.py
├─ build.sh
├─ docker-compose.yml
├─ frontend
│  ├─ Dockerfile
│  ├─ index.html
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  └─ favicon.ico
│  ├─ README.md
│  ├─ src
│  │  ├─ admin
│  │  │  ├─ AdminApp.jsx
│  │  │  ├─ components
│  │  │  │  ├─ AdminSidebar.jsx
│  │  │  │  └─ Table.jsx
│  │  │  └─ pages
│  │  │     ├─ CharactersPage.jsx
│  │  │     ├─ DashboardPage.jsx
│  │  │     ├─ SearchTermsPage.jsx
│  │  │     ├─ TagsPage.jsx
│  │  │     └─ UsersPage.jsx
│  │  ├─ App.jsx
│  │  ├─ assets
│  │  │  └─ images
│  │  │     ├─ default-avatar.png
│  │  │     ├─ default-picture.png
│  │  │     ├─ logo.png
│  │  │     ├─ logo_text.png
│  │  │     └─ logo_v1_old.png
│  │  ├─ components
│  │  │  ├─ AuthLayout.jsx
│  │  │  ├─ AuthProvider.jsx
│  │  │  ├─ PrimaryButton.jsx
│  │  │  ├─ ButtonRounded.jsx
│  │  │  ├─ SecondaryButton.jsx
│  │  │  ├─ CardSection.jsx
│  │  │  ├─ CharacterModal.jsx
│  │  │  ├─ CharacterSidebar.jsx
│  │  │  ├─ ChatInitModal.jsx
│  │  │  ├─ ConfirmModal.jsx
│  │  │  ├─ EntityCard.jsx
│  │  │  ├─ HorizontalCardSection.jsx
│  │  │  ├─ ImageCropModal.jsx
│  │  │  ├─ InfoCard.jsx
│  │  │  ├─ Layout.jsx
│  │  │  ├─ PageWrapper.jsx
│  │  │  ├─ PersonaModal.jsx
│  │  │  ├─ SceneModal.jsx
│  │  │  ├─ Sidebar.jsx
│  │  │  ├─ TagsInput.jsx
│  │  │  ├─ ToastProvider.jsx
│  │  │  └─ Topbar.jsx
│  │  ├─ firebase.js
│  │  ├─ hooks
│  │  ├─ i18n.js
│  │  ├─ locales
│  │  │  ├─ en.json
│  │  │  └─ zh.json
│  │  ├─ main.jsx
│  │  ├─ pages
│  │  │  ├─ BrowsePage.jsx
│  │  │  ├─ CharacterFormPage.jsx
│  │  │  ├─ ChatPage.jsx
│  │  │  ├─ HomePage.jsx
│  │  │  ├─ PersonaFormPage.jsx
│  │  │  ├─ ProfilePage.jsx
│  │  │  ├─ ResetPasswordPage.jsx
│  │  │  ├─ SceneFormPage.jsx
│  │  │  ├─ SearchPage.jsx
│  │  │  ├─ SettingsPage.jsx
│  │  │  ├─ SignUpPage.jsx
│  │  │  ├─ TestPage.jsx
│  │  │  └─ WelcomePage.jsx
│  │  └─ utils
│  │     ├─ imageUtils.js
│  │     └─ systemTemplate.js
│  └─ vite.config.js
├─ README.md
└─ start-dev.bat

```