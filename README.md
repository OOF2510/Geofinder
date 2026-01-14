# 🌍 GeoFinder App

GeoFinder is a GeoGuessr-style mobile game where you test your geography knowledge by guessing locations from street-view images. Compete for high scores on the global leaderboard!

The app is built with React Native and talks to my GeoGuess API backend, which serves pre-processed street-view images and location data. The API fetches imagery from Mapillary’s global street‑view network and enriches it with OpenStreetMap’s Nominatim and BigDataCloud for accurate country data.

> **Platform support**
>
> - **Officially supported platform:** Android (via Google Play closed testing and APKs from GitHub Releases).
> - **iOS:** Not officially supported. Advanced users are free to try building the iOS app from source, but it’s **“best-effort, no guarantees.”**
> - **iOS / desktop users:** You can always play the web version at **https://geofinder.oof2510.space/play**.

---

## 📋 Table of Contents

- [How to Play](#-how-to-play)
- [Game Features](#-game-features)
- [Installation](#-installation)
- [🛠 Tech Stack](#-tech-stack)
- [🏗 Architecture](#-architecture)
- [Integration with GeoGuess API](#integration-with-geoguess-api)
- [Getting Started (Developers)](#getting-started-developers)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🎮 How to Play

### Starting Out

- Tap **Start Game** to begin a 10‑round challenge.
- Each round shows a random street‑view image from somewhere in the world.

### Making Guesses

- Type in the **country name** where you think the image was taken.
- You get **3 attempts** to guess correctly.
- Points are awarded based on how quickly you guess:
  - 1st try: **3 points**
  - 2nd try: **2 points**
  - 3rd try: **1 point**

### During the Game

- See your **current score** and **personal best** at the bottom of the screen.
- Incorrect guesses are listed to help you narrow it down.
- You get instant feedback after each guess.
- Tap on the image to **zoom in** for a closer look.
- In **360° Mode (Panorama)**, drag or swipe to look around the full panorama before guessing.

### After 10 Rounds

- View your final score and how many locations you got right.
- Play another 10‑round session to improve your score.
- Your **best score is automatically saved** between sessions.

### Leaderboard

- From the main menu, submit your score to the **global leaderboard**.
- Check the leaderboard to see how you rank against other players.
- Play as many sessions as you want to climb the ranks!

---

## 🧩 Game Features

- 🖼 **Mapillary street‑view images** – Real‑world imagery from around the globe.
- 🔄 **360° panoramic imagery** – Explore full‑panorama Street View scenes.
- 🌎 **Global locations** – Images can come from anywhere in the world.
- 🤖 **AI Duel mode** – Challenge an AI opponent on the same image and see who guesses more accurately.
- 🏆 **Competitive leaderboard** – Global rankings of top player scores.
- 🧼 **Smooth, polished UI** – Native performance with gestures and image zoom.
- 🔒 **Secure API access** – All sensitive actions (starting games, submitting scores) use Firebase App Check.
- 📱 **Closed Android beta (Google Play)** – Join the early access testing program (see Installation).

---

## 📲 Installation

### 1. Official Android App (Recommended)

The GeoFinder app is currently distributed via **Google Play closed testing** on Android.

1. **Join the GeoFinder Testers Google Group.**
2. **Opt in to the GeoFinder closed test** on Google Play (using the same Google account).
3. On your Android device, open the Play Store, search for **“GeoFinder”**, and install the app.

You must be signed into the same Google account when joining the testers group and opting into the test.

If you don’t see the app immediately, wait a bit and try again—the Play Store can take a few minutes to update tester access.

### 2. APKs from GitHub Releases

If you can’t use Google Play, you can also grab APKs from the **GitHub Releases** page of the main repo. These may sometimes lag behind the latest Play Store build, but they’re a convenient fallback for side‑loading.

### 3. iOS and Other Platforms

- **iOS builds are not officially supported yet.**
- Advanced users can try to **clone the repo and build the iOS app themselves**, but there is no guarantee it will build or run correctly on every setup.
- For iOS and desktop players, the recommended experience is the **web version**:

> **Play in a browser:** https://geofinder.oof2510.space/play

---

## 🛠 Tech Stack

### Frontend (This App)

- **React Native 0.82.1** – Cross‑platform mobile framework.
- **TypeScript (TSX)** – Type‑safe development.
- **React Navigation** – Screen management (`@react-navigation/native`, `@react-navigation/native-stack`).
- **Firebase App Check** – Secures API requests from the app (`@react-native-firebase/app`, `@react-native-firebase/app-check`).
- **UI libraries** – Gesture Handler, Safe Area Context, Native Screens, Image Zoom Viewer for interactive UI.
- **Data & Networking** – `@oof2510/geoapi` client, Axios, AsyncStorage, RNFS for caching.

### Backend (GeoGuess API)

- **Node.js + Express** – Core API server.
- **MongoDB Atlas** – Stores game sessions and leaderboard data.
- **Mapillary Graph API** – Source of street‑view and panoramic imagery.
- **Geocoding** – OpenStreetMap’s Nominatim plus BigDataCloud for country lookup.
- **Firebase App Check (server‑side)** – Verifies App Check tokens on protected endpoints.
- **AI services** – Uses OpenRouter AI for the **AI Duel** gameplay.

### Tooling

- **Metro bundler** for React Native.
- **GitHub Actions** for CI.
- **ESLint** and **Prettier** for code quality.
- **Android SDK** and **Xcode** (for people experimenting with iOS builds).

---

## 🏗 Architecture

The app communicates with the GeoGuess API backend and related services.

High‑level flow:

- The mobile app calls endpoints such as `/getImage`, `/getPano`, `/game/start`, `/game/submit`, `/ai-duel/start`, and `/ai-duel/guess` on the Node/Express backend.
- The backend in turn:
  - Fetches images from **Mapillary**.
  - Reverse‑geocodes them using **Nominatim/BigDataCloud** for country info.
  - Stores and reads scores from **MongoDB**.
  - Verifies **Firebase App Check** tokens on protected routes.


For deployment and API configuration details, see the `geoguess-api` repository.

---

## Integration with GeoGuess API

This app connects to the GeoGuess API backend, which handles:

- **Image processing** – Fetches static images and 360° panoramas from Mapillary and enriches them with reverse‑geocoded country data.
- **Game sessions** – Creates and maintains 10‑round game sessions (with unique seeds) via `/game/start`.
- **Score submission** – Accepts scores via `/game/submit` and updates the global leaderboard.
- **AI Duels** – Manages 1v1 matches against the AI using `/ai-duel/start` and `/ai-duel/guess`.
- **Leaderboard** – Serves the top scores via `/leaderboard/top`.
- **Security** – Verifies Firebase App Check tokens on protected routes.

### API Endpoints Used

- `GET /getImage` – Returns a random street‑view image URL plus coordinates, `countryName`, and `countryCode`.
- `GET /getPano` – Returns a 360° panorama image URL and country info.
- `POST /game/start` (App Check required) – Starts a new game session (returns a session ID and seed).
- `POST /game/submit` (App Check required) – Submits a completed game score (requires `gameSessionId` and `score`).
- `POST /ai-duel/start` (App Check required) – Starts a new AI Duel match.
- `POST /ai-duel/guess` (App Check required) – Submits a guess for the current AI Duel round.
- `GET /leaderboard/top` – Retrieves the global top scores.
- `GET /health` – Service health check.

For more details, refer to the `geoguess-api` repo.

---

## Getting Started (Developers)

### Prerequisites

- **Node.js** `>= 20`
- **bun** (package manager for this project)
- React Native CLI setup with Android and/or iOS toolchains
- Android Studio for Android builds/emulators
- Xcode (only if you want to experiment with iOS builds)
- (Optional) A Google Firebase project for App Check if testing on physical devices

> **Important:** This project is set up to use **bun**. Please use `bun` instead of `npm`, `pnpm`, or `yarn` when installing and running scripts to avoid lockfile and dependency issues.

### Install dependencies

```bash
# Clone the repo
git clone https://github.com/oof2510/GeoguessApp.git
cd GeoguessApp

# Install dependencies with pnpm (recommended)
pnpm install
```

If you insist on using another package manager, you’re on your own—only the `pnpm` flow is considered supported.

### Running the app

```bash
# Start Metro bundler
bun start

# Run on Android (emulator or connected device)
bun run android

# (Optional / unsupported) Try running on iOS
bun run ios
```

Android is the only officially supported platform. The iOS command is provided **for experimentation only** and may require additional setup or manual tweaks.

### Other useful scripts

```bash
# Lint the codebase
bun run lint

# Run tests
bun test

# Format with Prettier
bun run prettier
```

The app’s entry point is `src/App.tsx`. API base URLs and Firebase/App Check configuration live under `src/services` and related config files—adjust these if you’re pointing at a custom backend or Firebase project.

---

## 🤝 Contributing

Contributions are welcome!

If you find any bugs, have feature ideas, or want to tweak the gameplay, feel free to:

1. Open an **issue** describing the problem or feature.
2. Submit a **pull request** with a clear description of the change.

Please follow the existing code style and add tests when it makes sense.

---

## 📜 License

This project is licensed under the **Mozilla Public License 2.0 (MPL‑2.0)**.  
See `LICENSE.md` for the full text.

---

## 💛 Acknowledgments

- **Mapillary** for street‑view and panorama imagery.
- **OpenStreetMap & BigDataCloud** for geographic data and country lookup.
- **Firebase** for App Check infrastructure.
- **OpenRouter AI** for powering the AI Duel models.
- The **React Native community** and all the open‑source libraries used here.
- Friends, testers, and early players for constant feedback and support.

---

Made with ❤️ by [oof2510](https://oof2510.space) | [API Status](https://geo.api.oof2510.space/health)
