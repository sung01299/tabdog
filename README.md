# TabDog

<p align="center">
  <img src="docs/tabdog-icon.png" alt="TabDog" width="128" height="128">
</p>

> Monitor and control your Chrome tabs and apps from the macOS menu bar

**TabDog** is an open-source utility that bridges Google Chrome's internal tab and process information to the macOS system level. See memory usage at a glance, close tabs without switching windows, and keep your browser under control.

## Architecture

```
Chrome Extension ←→ Native Messaging ←→ macOS Menu Bar App
     (Data)            (stdio)              (SwiftUI)
```

## Requirements

- macOS 13 Ventura or later
- Google Chrome 116 or later

## Installation

### Option 1: Direct Download (DMG)

<a href="https://github.com/sung01299/tabdog/releases/download/v1.0.1/TabDog.dmg">
  <img src="https://img.shields.io/badge/Download-TabDog.dmg-blue?style=for-the-badge&logo=apple" alt="Download TabDog.dmg">
</a>

1. Click the button above or download from [GitHub Releases](https://github.com/sung01299/tabdog/releases/latest)
2. Open the DMG file and drag TabDog to your Applications folder
3. Install the [Chrome Extension](https://chrome.google.com/webstore/detail/tabdog/jadjicoipoakmiahodaniigoocompfpi) from Chrome Web Store
4. Launch TabDog from Applications

### Option 2: Homebrew

```bash
brew tap sung01299/tabdog 
brew install --cask tabdog
```

Then install the [Chrome Extension](https://chrome.google.com/webstore/detail/tabdog/jadjicoipoakmiahodaniigoocompfpi) from Chrome Web Store.

## Usage

### Opening TabDog

Click the TabDog icon in your menu bar to open the popup. The search field is automatically focused.

### View Modes

TabDog has two view modes:

- **Browser Tabs**: View and manage Chrome/Brave tabs
- **Windows**: View and manage all macOS app windows

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Switch between Browser Tabs / Windows mode |
| `↑` / `↓` | Navigate through the list |
| `Enter` | Activate selected item (switch to tab/window, expand group) |
| `C` | Close selected tab or window |
| `H` | Hide selected window (Windows mode only) |
| `Esc` | Return to search field |

### Features

- **Search**: Type to filter tabs or windows by title, URL, or app name
- **Group by Domain**: Toggle to group tabs by website domain
- **Sort Order**: Sort tabs by most recent or oldest first
- **Recently Closed**: Quickly reopen recently closed tabs
- **Recently Quit**: Relaunch recently quit apps

## Contributing

We welcome contributions from the community! Here's how you can help:

### Getting Started

1. **Fork** the repository
2. **Clone** your fork locally

   ```bash
   git clone https://github.com/YOUR_USERNAME/tabdog.git
   cd tabdog
   ```
3. Create a **new branch** for your feature or fix
   
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Setup

#### macOS App (TabDog)
- Open `TabDog/TabDog.xcodeproj` in Xcode
- Build and run the project (⌘R)

#### Chrome Extension
- Navigate to `chrome://extensions/` in Chrome
- Enable "Developer mode"
- Click "Load unpacked" and select the `Extension/` folder

### Submitting Changes

1. Make your changes with clear, descriptive commits
2. Test your changes thoroughly
3. Push to your fork
   
   ```bash
   git push origin feature/your-feature-name
   ```
4. Open a **Pull Request** against the `main` branch

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/sung01299/tabdog/issues/new) with:
- Clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your macOS and Chrome versions

## License

MIT

---

*Built for power users who refuse to let their browser slow them down.*
