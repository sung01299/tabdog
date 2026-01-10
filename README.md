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

1. Download the latest `TabDog.dmg` from [GitHub Releases](https://github.com/sung01299/tabdog/releases/latest)
2. Open the DMG file and drag TabDog to your Applications folder
3. Install the [Chrome Extension](https://chrome.google.com/webstore/detail/tabdog/EXTENSION_ID) from Chrome Web Store
4. Launch TabDog from Applications

### Option 2: Homebrew

```bash
brew install --cask tabdog
```

Then install the [Chrome Extension](https://chrome.google.com/webstore/detail/tabdog/EXTENSION_ID) from Chrome Web Store.

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