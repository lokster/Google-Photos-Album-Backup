# Google Photos Album Backup

A userscript that adds album backup and restore functionality to Google Photos. Export your album memberships to JSON and restore them later - useful when migrating photos or recovering from Google Takeout.

## Requirements

This userscript requires [Google Photos Toolkit (GPTK)](https://github.com/xob0t/Google-Photos-Toolkit) to be installed and loaded first.

## Installation

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Install [Google Photos Toolkit](https://github.com/xob0t/Google-Photos-Toolkit) first
3. **[Click here to install Google Photos Album Backup](https://github.com/lokster/Google-Photos-Album-Backup/raw/master/google_photos_album_backup.user.js)**

## Features

- **Export Albums** - Save album membership for all photos in a date range to JSON
- **Import Albums** - Restore album membership from a previously exported JSON file
- File preview showing album count, photo count, and date range before import
- Automatically creates missing albums during import
- Progress logging during operations

## Usage

### Export
1. Click the "Export Albums" button in Google Photos header
2. Select start and end dates
3. Click "Export"
4. JSON file downloads automatically

### Import
1. Click the "Import Albums" button in Google Photos header
2. Select a previously exported JSON file
3. Review the file preview (albums, photos, date range)
4. Click "Import" to restore album memberships

## Export Format

The export uses an album-centric JSON structure:

```json
{
  "start_timestamp": 1702483200000000,
  "end_timestamp": 1702569600000000,
  "albums": {
    "Album Name": [
      ["IMG_1234.jpg", 1702483200000000],
      ["IMG_5678.jpg", 1702483300000000]
    ]
  }
}
```

Photos are identified by `filename + timestamp` combination, which remains consistent even after restoring from Google Takeout.

## License

MIT
