#!/bin/bash

# TabDog DMG Builder Script
# Usage: ./scripts/build-dmg.sh /path/to/TabDog.app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/dist"
RESOURCES_DIR="$SCRIPT_DIR/dmg-resources"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐕 TabDog DMG Builder${NC}"
echo "================================"

# Check for app path argument
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide the path to TabDog.app${NC}"
    echo "Usage: $0 /path/to/TabDog.app"
    exit 1
fi

APP_PATH="$1"

# Validate app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}Error: TabDog.app not found at: $APP_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}App path:${NC} $APP_PATH"

# Check for required tools
if ! command -v create-dmg &> /dev/null; then
    echo -e "${RED}Error: create-dmg is not installed${NC}"
    echo "Install with: brew install create-dmg"
    exit 1
fi

if ! command -v fileicon &> /dev/null; then
    echo -e "${YELLOW}Warning: fileicon not found, installing...${NC}"
    npm install -g fileicon
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Clean up old DMG files
rm -f "$OUTPUT_DIR/TabDog.dmg"
rm -f "$OUTPUT_DIR/rw."*.dmg

echo -e "${YELLOW}Creating DMG...${NC}"

# Create DMG with background
create-dmg \
    --volname "TabDog" \
    --volicon "$RESOURCES_DIR/TabDog.icns" \
    --background "$RESOURCES_DIR/dmg-background.png" \
    --window-pos 200 120 \
    --window-size 540 380 \
    --icon-size 128 \
    --icon "TabDog.app" 130 180 \
    --hide-extension "TabDog.app" \
    --app-drop-link 400 180 \
    "$OUTPUT_DIR/TabDog.dmg" \
    "$APP_PATH"

echo -e "${YELLOW}Setting Applications folder icon...${NC}"

# Convert to read-write for icon editing
hdiutil convert "$OUTPUT_DIR/TabDog.dmg" -format UDRW -o "$OUTPUT_DIR/TabDog_rw.dmg"
hdiutil attach "$OUTPUT_DIR/TabDog_rw.dmg" -mountpoint /Volumes/TabDog_edit

# Replace symlink with alias and set folder icon
rm "/Volumes/TabDog_edit/Applications"
osascript -e 'tell application "Finder" to make new alias file at POSIX file "/Volumes/TabDog_edit" to POSIX file "/Applications" with properties {name:"Applications"}'
fileicon set "/Volumes/TabDog_edit/Applications" "$RESOURCES_DIR/Folder.icns"

# Clean up and convert back
rm -rf /Volumes/TabDog_edit/.fseventsd
hdiutil detach /Volumes/TabDog_edit
rm -f "$OUTPUT_DIR/TabDog.dmg"
hdiutil convert "$OUTPUT_DIR/TabDog_rw.dmg" -format UDZO -o "$OUTPUT_DIR/TabDog.dmg"
rm -f "$OUTPUT_DIR/TabDog_rw.dmg"

echo -e "${YELLOW}Setting DMG file icon...${NC}"

# Set custom icon on DMG file
sips -i "$RESOURCES_DIR/TabDog.icns" > /dev/null
DeRez -only icns "$RESOURCES_DIR/TabDog.icns" > "$OUTPUT_DIR/tmpicns.rsrc"
Rez -append "$OUTPUT_DIR/tmpicns.rsrc" -o "$OUTPUT_DIR/TabDog.dmg"
SetFile -a C "$OUTPUT_DIR/TabDog.dmg"
rm -f "$OUTPUT_DIR/tmpicns.rsrc"

echo ""
echo -e "${GREEN}✅ DMG created successfully!${NC}"
echo -e "${GREEN}📦 Output:${NC} $OUTPUT_DIR/TabDog.dmg"
echo ""
ls -lh "$OUTPUT_DIR/TabDog.dmg"
