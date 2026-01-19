# TabDog

<p align="center">
  <img src="docs/tabdog-icon.png" alt="TabDog" width="128" height="128">
</p>

> Manage all your browser tabs in one place

**TabDog** is an open-source browser extension that helps you manage your tabs efficiently. Search, group by domain, and quickly switch between tabs without losing focus.

## Features

- **Quick Search** - Find any tab instantly by title, URL, or domain
- **Domain Grouping** - Automatically group tabs by website domain
- **Smart Sorting** - Sort tabs by newest or oldest first
- **Recently Closed** - Quickly reopen tabs you accidentally closed
- **Keyboard Navigation** - Navigate and manage tabs without touching your mouse
- **Dark/Light Mode** - Automatically matches your system preference

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

TabDog works with any Chromium-based browser:

- Google Chrome
- Brave
- Microsoft Edge
- Opera
- Vivaldi
- Arc

## Usage

### Opening TabDog

Click the TabDog icon in your browser toolbar, or use the keyboard shortcut:

| Platform | Shortcut |
|----------|----------|
| macOS | `Cmd + Shift + T` |
| Windows/Linux | `Ctrl + Shift + T` |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate through the list |
| `Enter` | Activate selected tab or expand group |
| `Delete` / `Backspace` | Close selected tab |
| `Escape` | Return to search field |
| `Cmd/Ctrl + F` | Focus search field |

### Features

- **Search**: Type to filter tabs by title, URL, or domain
- **Group by Domain**: Click the grid icon to group/ungroup tabs by website
- **Sort Order**: Click the sort icon to toggle between newest and oldest first
- **Close Tab**: Hover over a tab and click the X button
- **Close All in Domain**: Hover over a domain group header and click "Close All"
- **Recently Closed**: Scroll down to see and reopen recently closed tabs

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

### Project Structure

```
Extension/
├── manifest.json      # Extension configuration
├── background.js      # Service worker (tab time tracking)
├── popup/
│   ├── popup.html     # Popup UI structure
│   ├── popup.css      # Styles (light/dark mode)
│   └── popup.js       # UI logic and interactions
└── icons/             # Extension icons
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

TabDog respects your privacy:
- **No data collection** - All data stays in your browser
- **No external servers** - Everything runs locally
- **No tracking** - We don't track your browsing history

See our [Privacy Policy](docs/privacy-policy.html) for more details.

## License

MIT

---

*Built for power users who refuse to let their browser slow them down.*
