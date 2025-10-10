```
Mikoshi-MonoRepo
├─ backend
│  ├─ database.py
│  ├─ Dockerfile
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
│     ├─ firebase_admin_setup.py
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
│  │  │     └─ logo.png
│  │  ├─ components
│  │  │  ├─ AuthLayout.jsx
│  │  │  ├─ AuthProvider.jsx
│  │  │  ├─ ButtonBlack.jsx
│  │  │  ├─ ButtonRounded.jsx
│  │  │  ├─ ButtonWhite.jsx
│  │  │  ├─ CardSection.jsx
│  │  │  ├─ CharacterCard.jsx
│  │  │  ├─ CharacterModal.jsx
│  │  │  ├─ CharacterSidebar.jsx
│  │  │  ├─ ChatInitModal.jsx
│  │  │  ├─ EntityCard.jsx
│  │  │  ├─ HorizontalCardSection.jsx
│  │  │  ├─ InfoCard.jsx
│  │  │  ├─ Layout.jsx
│  │  │  ├─ PageWrapper.jsx
│  │  │  ├─ PersonaCard.jsx
│  │  │  ├─ PersonaModal.jsx
│  │  │  ├─ SceneCard.jsx
│  │  │  ├─ SceneModal.jsx
│  │  │  ├─ Sidebar.jsx
│  │  │  ├─ TagsInput.jsx
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
│  │  │  ├─ SceneFormPage.jsx
│  │  │  ├─ SearchPage.jsx
│  │  │  ├─ SignUpPage.jsx
│  │  │  ├─ TestPage.jsx
│  │  │  └─ WelcomePage.jsx
│  │  └─ utils
│  │     └─ systemTemplate.js
│  └─ vite.config.js
├─ README.md
└─ start-dev.bat

```