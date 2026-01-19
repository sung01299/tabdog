# TabDoggy Bridge — Privacy Policy

Effective date: 2026-01-08

TabDoggy Bridge (“the extension”) is a companion Chrome extension for the TabDoggy macOS app. This policy explains what data the extension handles and how it is used.

## Data the extension accesses
To provide its functionality, the extension accesses:
- Tab metadata: **tab URL**, **tab title**, **tab favicon URL**, **tab active state**, and **tab windowId/tabId**
- Local timestamps: **tab creation/open time** (stored locally in the browser)

## How the data is used
The extension uses this data only to:
- Display and search tabs in the TabDoggy macOS app
- Allow tab actions from TabDoggy (activate tab, close tab(s))
- Sort tabs by opened time

## Data sharing / selling
- The extension **does not sell** user data.
- The extension **does not share** user data with third parties.
- The extension **does not transmit** data to any remote servers.

## Communication
The extension communicates **only** with the local TabDoggy macOS app using Chrome Native Messaging (`nativeMessaging` permission). This communication occurs on the user’s device.

## Storage
- Tab creation/open timestamps are stored in **`chrome.storage.local`** on the user’s device.

## Security
The extension communicates locally with TabDoggy. Users should install TabDoggy only from trusted sources.

## Changes
This policy may be updated over time. Updates will be reflected in this document.

## Contact
For questions, please use the “Report Issue” link on the project repository.



