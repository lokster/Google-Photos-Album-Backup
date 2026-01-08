# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Photos Album Backup is a userscript that provides album backup and restore functionality for Google Photos. It runs directly in the browser via userscript managers (Tampermonkey, Violentmonkey, etc.) and allows users to export album membership data to JSON and import it back later.

## Dependencies

This userscript requires [Google Photos Toolkit (GPTK)](https://github.com/xob0t/Google-Photos-Toolkit) to be installed and loaded. It uses GPTK's exposed API (`gptkApi`) for all Google Photos operations.

## File Structure

- **`google_photos_album_backup.user.js`** - The main userscript file

## Features

- Adds "Export Albums" and "Import Albums" buttons next to the GPTK button in Google Photos header
- Export popup with date range picker, export button, and log area
- Import popup with file picker button and log area
- Styled to match GPTK aesthetic
- Progress logging during operations

## Installation

Install via userscript manager (Tampermonkey, Violentmonkey) alongside the GPTK script. GPTK must be loaded first as this script depends on `gptkApi`.

## Usage

### Export Flow
1. Click "Export Albums" button
2. Set start and end dates in popup
3. Click "Export" to start
4. JSON file downloads automatically when complete

### Import Flow
1. Click "Import Albums" button
2. Click "Select JSON File" in popup
3. Choose previously exported JSON file
4. Import runs automatically, creating albums and adding photos

## Export Format

Uses an album-centric structure for efficient import (one API call per album):

```json
{
  "start_timestamp": 1702483200000000,
  "end_timestamp": 1702569600000000,
  "albums": {
    "Album1": [
      ["IMG_1234.jpg", 1702483200000000],
      ["IMG_5678.jpg", 1702483300000000]
    ],
    "Album2": [
      ["IMG_1234.jpg", 1702483200000000],
      ["IMG_9999.jpg", 1702483400000000]
    ]
  }
}
```

Each album contains an array of `[fileName, timestamp]` tuples.

## Photo Identification

Photos are uniquely identified by `fileName` + `timestamp` (microseconds). This combination is reliable for matching across exports/imports.

## Development Notes

- The script waits for GPTK to load before initializing
- All Google Photos API calls are made through `gptkApi`
- Album fetching is cached to avoid duplicate API calls during import
- Concurrent request limits are configurable via `MAX_CONCURRENT_REQUESTS`

## Git Workflow

- **Always ask the user for confirmation before running `git commit` and `git push`**
