# 🐕 TabDog

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

## License

MIT

---

*Built for power users who refuse to let their browser slow them down.*