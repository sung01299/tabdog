# TabDog

<p align="center">
  <img src="docs/tabdog-icon.png" alt="TabDog" width="128" height="128">
</p>

> Manage all your browser tabs in one place

**TabDog** is an open-source Chrome extension that helps you manage tabs efficiently. Search, group by domain, save workspaces, browse history, and sync across devices — all from a single popup.

## Features

### Tabs
- **Quick Search** — Find any tab instantly by title, URL, or domain
- **Domain Grouping** — Automatically group tabs by website domain
- **Smart Sorting** — Sort tabs by last accessed time
- **Recently Closed** — Quickly reopen tabs closed within the last 30 minutes
- **Tab Actions** — Close individual tabs or all tabs in a domain group

### Workspaces (Spaces)
- **Save Tab Sets** — Save your current tabs as a named workspace
- **Custom URLs** — Add extra URLs when creating a workspace
- **Color Labels** — Choose from 9 color options to organize workspaces
- **Restore Modes** — Add tabs to current window or replace all tabs
- **Cloud Sync** — Workspaces sync across devices when signed in

### History
- **Browse History** — View browsing history from the last 7 days
- **Search** — Filter history by keyword
- **Date Grouping** — Entries grouped by Today, Yesterday, and older dates

### General
- **Google Sign-in** — Sign in with Google for cloud sync
- **Dark / Light Mode** — Toggle theme or match system preference
- **Keyboard Navigation** — Navigate and manage tabs without touching your mouse

## Installation

### Chrome Web Store

<a href="https://chrome.google.com/webstore/detail/tabdog/jadjicoipoakmiahodaniigoocompfpi">
  <img src="https://img.shields.io/badge/Install-Chrome%20Web%20Store-blue?style=for-the-badge&logo=googlechrome" alt="Install from Chrome Web Store">
</a>

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome (or your Chromium-based browser)
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `Extension/` folder

### Supported Browsers

TabDog works with any Chromium-based browser

## Usage

### Opening TabDog

Click the TabDog icon in your browser toolbar, or use the keyboard shortcut:

| Platform | Shortcut |
|----------|----------|
| macOS | `Cmd + Shift + E` |
| Windows/Linux | `Ctrl + Shift + E` |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate through the list |
| `Enter` | Activate selected tab or expand group |
| `C` | Close selected tab |
| `Escape` | Return to search field |
| `Cmd/Ctrl + F` | Focus search field |

### Tips

- **Search**: Type to filter tabs by title, URL, or domain
- **Group by Domain**: Click the grid icon to group/ungroup tabs by website
- **Sort Order**: Click the sort icon to toggle between newest and oldest first
- **Close Tab**: Hover over a tab and click the X button, or select it and press `C`
- **Close All in Domain**: Hover over a domain group header and click "Close All"
- **Recently Closed**: Scroll down on the Tabs page to see and reopen recently closed tabs

## Contributing

We welcome contributions from the community!

### Getting Started

1. **Fork** the repository
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tabdog.git
   cd tabdog
   ```
3. Create a **new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Setup

1. Navigate to `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `Extension/` folder
4. Make changes and click the refresh icon on the extension card to reload

#### Firebase Configuration (for cloud sync)

Cloud sync features require a Firebase project. See [Firebase Setup Guide](docs/FIREBASE_SETUP.md) for detailed instructions.

1. Copy `Extension/config/firebase-config.example.js` to `firebase-config.js`
2. Fill in your Firebase project credentials
3. Set up Firestore security rules from `Extension/config/firestore.rules`

### Project Structure

```
Extension/
├── manifest.json              # Extension configuration (Manifest V3)
├── background.js              # Service worker (sync, tab tracking)
├── popup/
│   ├── popup.html             # Popup UI structure
│   ├── popup.css              # Styles (light/dark mode)
│   └── popup.js               # UI logic and interactions
├── services/
│   ├── auth.js                # Google OAuth authentication
│   ├── firestore.js           # Firestore REST API helpers
│   ├── sync.js                # Cross-device tab sync
│   ├── device.js              # Device registration
│   ├── workspace.js           # Workspaces CRUD
│   ├── share.js               # Tab sharing
│   ├── session-history.js     # Session snapshots
│   └── tab-history.js         # Tab history tracking
├── config/
│   ├── firebase-config.js     # Firebase credentials (gitignored)
│   ├── firebase-config.example.js
│   └── firestore.rules        # Firestore security rules
└── icons/                     # Extension icons
```

### Submitting Changes

1. Make your changes with clear, descriptive commits
2. Test your changes thoroughly
3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a **Pull Request** against the `main` branch

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/sung01299/tabdog/issues/new) with:
- Clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your browser and version

## Privacy

TabDog uses Firebase for authentication and cloud sync. When signed in:
- Your tab data, workspaces, and sessions are stored in Google Firestore
- Authentication is handled via Google OAuth through Chrome's identity API
- No third-party tracking or analytics

When not signed in, all data stays local in your browser.

See our [Privacy Policy](docs/privacy-policy.html) for more details.

## License

MIT

---

*Built for power users who refuse to let their browser slow them down.*
