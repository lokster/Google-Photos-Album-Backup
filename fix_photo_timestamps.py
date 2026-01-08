#!/usr/bin/env python3
"""
Fix Photo/Video Timestamps

This script reads a JSON file exported from Google Photos Album Backup,
finds matching photos and videos in a directory, and restores their timestamps.

Modes available:
  --exif (-e):       Update metadata for files WITHOUT existing timestamps
  --filesystem (-f): Update filesystem modification/access times for ALL files
  --verify (-v):     Compare existing timestamps against JSON (no modifications)

At least one mode must be specified. --exif and --filesystem can be used together.

Features:
- Progress indicator with ETA during processing
- Automatic handling of misnamed files (e.g., HEIC files that are actually JPEGs)
- Sub-second timestamp precision for images
- Video support (MP4, MOV, AVI, MKV, etc.) with appropriate metadata tags
- Numbered duplicate handling (e.g., IMG_123(1).jpg uses timestamp from IMG_123.jpg)
- Persistent exiftool process for better performance

Scenario: Restoring photos from Google Takeout
---------------------------------------------
When you download your photos from Google Photos using Google Takeout,
the exported photos often have issues:

1. Missing EXIF timestamps - Some photos (especially screenshots, edited
   photos, or photos uploaded from certain apps) lose their date/time
   metadata in the export.

2. Wrong file dates - The file modification dates may show the export date
   instead of when the photo was actually taken.

3. Photos appear out of order - When you import these photos into another
   app (like a local gallery, iCloud, or a new Google account), they appear
   sorted incorrectly because the timestamps are wrong or missing.

The workflow:
1. Before leaving Google Photos: Run "Export Albums" to save your album
   structure AND the original timestamps for each photo.
2. Download via Google Takeout: Get your actual photo files.
3. Run this script: It restores the correct timestamps from your JSON export.

Why this matters:
- Google Photos stores the "taken date" separately from the file's EXIF data.
- When you download, that Google-stored date doesn't always make it into
  the file.
- Without correct timestamps, your 2015 vacation photos might appear as
  taken in 2024.
- This script bridges that gap by using the timestamps you exported while
  still connected to Google Photos.

Requirements:
    - exiftool must be installed (sudo apt install libimage-exiftool-perl)
    - Python 3.6+

Usage:
    # Update EXIF for photos without timestamps
    python fix_photo_timestamps.py <json_file> <photo_directory> --exif [--dry-run]

    # Update filesystem times for all photos
    python fix_photo_timestamps.py <json_file> <photo_directory> --filesystem [--dry-run]

    # Update both EXIF and filesystem times
    python fix_photo_timestamps.py <json_file> <photo_directory> --exif --filesystem [--dry-run]

    # Verify existing EXIF timestamps against JSON (report mismatches)
    python fix_photo_timestamps.py <json_file> <photo_directory> --verify
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# Video file extensions (QuickTime-based and others)
VIDEO_EXTENSIONS = {
    '.mp4', '.mov', '.m4v', '.3gp', '.3g2',  # QuickTime-based
    '.avi', '.mkv', '.webm', '.wmv', '.flv',  # Other formats
    '.mts', '.m2ts', '.ts',  # AVCHD/MPEG-TS
}


def is_video_file(filepath):
    """Check if file is a video based on extension."""
    return Path(filepath).suffix.lower() in VIDEO_EXTENSIONS


def get_base_filename(filename):
    """Extract base filename by removing numbered suffix like (1), (2), etc.

    Examples:
        IMG_20210807_151248(1).HEIC -> IMG_20210807_151248.HEIC
        IMG_20210807_151248(2).jpg -> IMG_20210807_151248.jpg
        IMG_20210807_151248.HEIC -> None (no numbered suffix)
    """
    path = Path(filename)
    stem = path.stem
    suffix = path.suffix

    # Match pattern like "name(1)", "name(2)", etc.
    match = re.match(r'^(.+)\(\d+\)$', stem)
    if match:
        return match.group(1) + suffix
    return None


class ExifTool:
    """
    Persistent exiftool process for batch operations.
    Uses -stay_open flag for much better performance.
    """

    def __init__(self):
        self.process = None
        self.sentinel = "{ready}\n"

    def start(self):
        """Start the exiftool process."""
        self.process = subprocess.Popen(
            [
                "exiftool",
                "-stay_open", "True",
                "-@", "-",  # Read arguments from stdin
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            text=True,
        )

    def stop(self):
        """Stop the exiftool process."""
        if self.process:
            self.process.stdin.write("-stay_open\n")
            self.process.stdin.write("False\n")
            self.process.stdin.flush()
            self.process.communicate()
            self.process = None

    def execute(self, *args):
        """Execute exiftool command and return output."""
        if not self.process:
            self.start()

        # Write arguments, one per line
        for arg in args:
            self.process.stdin.write(arg + "\n")

        # Write execute command
        self.process.stdin.write("-execute\n")
        self.process.stdin.flush()

        # Read output until we see the sentinel "{ready}"
        output_lines = []
        while True:
            line = self.process.stdout.readline()
            if not line:
                break
            # Check for sentinel (exiftool outputs "{ready}" on its own line)
            if line == self.sentinel or line.strip() == "{ready}":
                break
            output_lines.append(line.rstrip('\r\n'))

        return output_lines

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.stop()


class Progress:
    """Progress indicator with ETA calculation."""

    def __init__(self, total, desc="Processing"):
        self.total = total
        self.desc = desc
        self.current = 0
        self.start_time = time.time()
        self.last_update = 0

    def update(self, n=1):
        """Update progress by n items."""
        self.current += n
        # Throttle updates to avoid flickering (update every 0.1 seconds)
        now = time.time()
        if now - self.last_update >= 0.1 or self.current >= self.total:
            self._display()
            self.last_update = now

    def _format_time(self, seconds):
        """Format seconds as human-readable time."""
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            mins = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{mins}m {secs}s"
        else:
            hours = int(seconds // 3600)
            mins = int((seconds % 3600) // 60)
            return f"{hours}h {mins}m"

    def _display(self):
        """Display current progress."""
        elapsed = time.time() - self.start_time
        pct = (self.current / self.total * 100) if self.total > 0 else 0

        if self.current > 0 and elapsed > 0:
            rate = self.current / elapsed
            remaining = (self.total - self.current) / rate if rate > 0 else 0
            eta_str = f"ETA: {self._format_time(remaining)}"
        else:
            eta_str = "ETA: --"

        line = f"\r{self.desc}: {self.current}/{self.total} ({pct:.1f}%) - {eta_str}    "
        sys.stdout.write(line)
        sys.stdout.flush()

    def finish(self):
        """Finish progress and print newline."""
        elapsed = time.time() - self.start_time
        line = f"\r{self.desc}: {self.current}/{self.total} (100%) - Done in {self._format_time(elapsed)}    \n"
        sys.stdout.write(line)
        sys.stdout.flush()


def parse_timestamp(ts):
    """Convert timestamp to datetime, auto-detecting unit (microseconds/milliseconds/seconds)."""
    if ts > 1e15:
        # Microseconds
        return datetime.fromtimestamp(ts / 1_000_000)
    elif ts > 1e12:
        # Milliseconds
        return datetime.fromtimestamp(ts / 1_000)
    else:
        # Seconds
        return datetime.fromtimestamp(ts)


def format_exif_datetime(dt):
    """Format datetime for EXIF (YYYY:MM:DD HH:MM:SS)."""
    return dt.strftime("%Y:%m:%d %H:%M:%S")


def get_subsec(ts):
    """Extract sub-second digits from timestamp."""
    if ts > 1e15:
        # Microseconds - get last 6 digits
        return str(ts % 1_000_000).zfill(6)
    elif ts > 1e12:
        # Milliseconds - get last 3 digits, pad to 6
        return str(ts % 1_000).zfill(3) + "000"
    else:
        # Seconds - no sub-second precision
        return "000000"


def get_exif_dates(exiftool, filepath):
    """Get existing EXIF/metadata date fields from a file using exiftool.

    For images: DateTimeOriginal, CreateDate, ModifyDate, GPSDateTime
    For videos: Also includes MediaCreateDate, TrackCreateDate
    """
    try:
        # Base tags for all files
        tags = [
            "-DateTimeOriginal",
            "-CreateDate",
            "-ModifyDate",
            "-GPSDateTime",
        ]

        # Add video-specific tags
        if is_video_file(filepath):
            tags.extend([
                "-MediaCreateDate",
                "-TrackCreateDate",
            ])

        output = exiftool.execute(
            *tags,
            "-s3",
            "-d", "%Y:%m:%d %H:%M:%S",
            str(filepath)
        )

        dates = [line.strip() for line in output if line.strip()]
        return dates
    except Exception as e:
        print(f"  Warning: Error reading EXIF from {filepath}: {e}")
        return []


def parse_exif_datetime(exif_str):
    """Parse EXIF datetime string to datetime object."""
    try:
        return datetime.strptime(exif_str, "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def has_any_date(exif_dates):
    """Check if any valid EXIF date exists."""
    for exif_str in exif_dates:
        exif_dt = parse_exif_datetime(exif_str)
        if exif_dt:
            return True
    return False


def get_first_valid_date(exif_dates):
    """Get the first valid EXIF datetime from a list of date strings."""
    for exif_str in exif_dates:
        exif_dt = parse_exif_datetime(exif_str)
        if exif_dt:
            return exif_dt
    return None


def format_timedelta(td):
    """Format a timedelta as human-readable string."""
    total_seconds = abs(td.total_seconds())
    if total_seconds < 60:
        return f"{int(total_seconds)}s"
    elif total_seconds < 3600:
        mins = int(total_seconds // 60)
        return f"{mins}m"
    elif total_seconds < 86400:
        hours = int(total_seconds // 3600)
        mins = int((total_seconds % 3600) // 60)
        return f"{hours}h {mins}m"
    else:
        days = int(total_seconds // 86400)
        hours = int((total_seconds % 86400) // 3600)
        return f"{days}d {hours}h"


def detect_wrong_extension(error_line):
    """Detect if error is about wrong file extension and return correct extension."""
    # Pattern: "Not a valid HEIC (looks more like a JPEG)"
    match = re.search(r"Not a valid \w+ \(looks more like a (\w+)\)", error_line)
    if match:
        actual_type = match.group(1).lower()
        ext_map = {
            "jpeg": ".jpg",
            "jpg": ".jpg",
            "png": ".png",
            "gif": ".gif",
            "tiff": ".tiff",
            "webp": ".webp",
        }
        return ext_map.get(actual_type, f".{actual_type}")
    return None


def set_exif_dates(exiftool, filepath, dt, ts, dry_run=False):
    """Set EXIF/metadata date fields using exiftool.

    For images: Sets DateTimeOriginal, CreateDate, ModifyDate with sub-second precision
    For videos: Sets CreateDate, ModifyDate, MediaCreateDate/ModifyDate, TrackCreateDate/ModifyDate
    """
    exif_datetime = format_exif_datetime(dt)
    subsec = get_subsec(ts)
    is_video = is_video_file(filepath)

    def build_args(fpath):
        args = [
            "-m",  # Ignore minor errors
            "-overwrite_original",
        ]

        if is_video:
            # Video-specific tags (QuickTime/MP4/MOV and others)
            args.extend([
                f"-CreateDate={exif_datetime}",
                f"-ModifyDate={exif_datetime}",
                f"-TrackCreateDate={exif_datetime}",
                f"-TrackModifyDate={exif_datetime}",
                f"-MediaCreateDate={exif_datetime}",
                f"-MediaModifyDate={exif_datetime}",
            ])
        else:
            # Image tags with sub-second precision
            args.extend([
                f"-DateTimeOriginal={exif_datetime}",
                f"-CreateDate={exif_datetime}",
                f"-ModifyDate={exif_datetime}",
                f"-SubSecTimeOriginal={subsec}",
                f"-SubSecTimeDigitized={subsec}",
                f"-SubSecTime={subsec}",
            ])

        # FileModifyDate for all file types
        args.append(f"-FileModifyDate={exif_datetime}")
        args.append(str(fpath))
        return args

    if dry_run:
        file_type = "video" if is_video else "image"
        print(f"  [DRY RUN] Would set {file_type} metadata dates")
        return True

    try:
        output = exiftool.execute(*build_args(filepath))

        # Check for wrong extension error
        for line in output:
            correct_ext = detect_wrong_extension(line)
            if correct_ext:
                # Temporarily rename file to correct extension
                old_path = Path(filepath)
                temp_path = old_path.with_suffix(correct_ext)
                print(f"  Temporarily renaming: {old_path.name} -> {temp_path.name}")
                os.rename(filepath, temp_path)

                try:
                    # Retry with temporary path
                    output2 = exiftool.execute(*build_args(temp_path))
                    success = False
                    for line2 in output2:
                        if "updated" in line2.lower():
                            success = True
                            break
                        if "error" in line2.lower():
                            print(f"  Error: {line2}")
                            break
                    return success
                finally:
                    # Always rename back to original extension
                    if temp_path.exists():
                        os.rename(temp_path, filepath)
                        print(f"  Restored original name: {old_path.name}")

        # Check if update was successful (exiftool prints "1 image files updated")
        for line in output:
            if "updated" in line.lower():
                return True
            if "error" in line.lower():
                print(f"  Error: {line}")
                return False
        return True
    except Exception as e:
        print(f"  Error setting EXIF for {filepath}: {e}")
        return False


def find_file_in_directory(filename, directory):
    """Find a file by name in directory (recursive search)."""
    for root, dirs, files in os.walk(directory):
        if filename in files:
            return os.path.join(root, filename)
    return None


def find_all_files_in_directory(directory):
    """Find all files in directory (recursive search).

    Returns dict: filename -> filepath
    """
    result = {}
    for root, dirs, files in os.walk(directory):
        for filename in files:
            # If duplicate filename in different subdirs, keep first one found
            if filename not in result:
                result[filename] = os.path.join(root, filename)
    return result


def set_file_times(filepath, dt, dry_run=False):
    """Set filesystem modification and access times."""
    timestamp = dt.timestamp()

    if dry_run:
        return True

    try:
        os.utime(filepath, (timestamp, timestamp))
        return True
    except Exception as e:
        print(f"  Error setting file times: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Fix photo/video timestamps based on exported JSON from Google Photos Album Backup"
    )
    parser.add_argument("json_file", help="Path to the exported JSON file")
    parser.add_argument("photo_directory", help="Directory containing photos/videos to process")
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Don't actually modify files, just show what would be done"
    )
    parser.add_argument(
        "--exif", "-e",
        action="store_true",
        help="Update EXIF metadata for files without existing timestamp metadata"
    )
    parser.add_argument(
        "--filesystem", "-f",
        action="store_true",
        help="Update filesystem modification/access times for all files"
    )
    parser.add_argument(
        "--verify", "-v",
        action="store_true",
        help="Verify existing timestamps against JSON (no modifications)"
    )

    args = parser.parse_args()

    if not args.exif and not args.filesystem and not args.verify:
        print("Error: At least one of --exif, --filesystem, or --verify must be specified")
        print("Use --help for usage information")
        sys.exit(1)

    # Check exiftool is installed
    try:
        subprocess.run(["exiftool", "-ver"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: exiftool is not installed.")
        print("Install it with: sudo apt install libimage-exiftool-perl")
        sys.exit(1)

    # Load JSON
    try:
        with open(args.json_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error loading JSON file: {e}")
        sys.exit(1)

    albums = data.get("albums", {})
    if not albums:
        print("No albums found in JSON file")
        sys.exit(1)

    # Build unique file list (filename -> timestamp)
    # Note: same filename might have different timestamps, we collect all
    files = {}  # filename -> set of timestamps
    for album_name, photo_list in albums.items():
        for filename, timestamp in photo_list:
            if filename not in files:
                files[filename] = set()
            files[filename].add(timestamp)

    print(f"Found {len(files)} unique files in JSON")

    # Scan directory for all files to find numbered duplicates
    print("Scanning directory for files...")
    all_dir_files = find_all_files_in_directory(args.photo_directory)
    print(f"Found {len(all_dir_files)} files in directory")

    # Find numbered duplicates (e.g., "IMG_123(1).jpg") whose base file is in JSON
    # These will inherit the timestamp from their base filename
    numbered_duplicates = {}  # filename -> base_filename
    for filename in all_dir_files:
        if filename not in files:
            base_filename = get_base_filename(filename)
            if base_filename and base_filename in files:
                numbered_duplicates[filename] = base_filename
                # Add to files dict with same timestamps as base file
                files[filename] = files[base_filename].copy()

    if numbered_duplicates:
        print(f"Found {len(numbered_duplicates)} numbered duplicates to process")
    print(f"Searching in: {args.photo_directory}")
    if args.dry_run:
        print("DRY RUN MODE - no files will be modified")
    if args.verify:
        print("VERIFY MODE - comparing EXIF timestamps against JSON")
    else:
        modes = []
        if args.exif:
            modes.append("EXIF metadata")
        if args.filesystem:
            modes.append("filesystem times")
        if modes:
            print(f"Will update: {', '.join(modes)}")
    print("-" * 60)

    stats = {
        "found": 0,
        "not_found": 0,
        "has_metadata": 0,
        "no_metadata": 0,
        "exif_updated": 0,
        "file_times_updated": 0,
        "numbered_duplicates": 0,
        "errors": 0,
        # Verify mode stats
        "verify_match": 0,
        "verify_mismatch": 0,
    }

    # Collect mismatches for verify mode
    mismatches = []

    # Use persistent exiftool process for better performance
    exiftool = ExifTool() if (args.exif or args.verify) else None
    if exiftool:
        exiftool.start()

    # Progress indicator
    progress = Progress(len(files), "Processing")

    try:
        for filename, timestamps in sorted(files.items()):
            progress.update()

            # Use pre-scanned file paths for efficiency
            filepath = all_dir_files.get(filename)

            if not filepath:
                stats["not_found"] += 1
                continue

            stats["found"] += 1

            # Get first timestamp from JSON for this file
            ts = next(iter(timestamps))
            target_dt = parse_timestamp(ts)

            # Verify mode - compare existing EXIF against JSON
            if args.verify:
                exif_dates = get_exif_dates(exiftool, filepath)
                exif_dt = get_first_valid_date(exif_dates)

                if exif_dt is None:
                    stats["no_metadata"] += 1
                    continue

                stats["has_metadata"] += 1

                # Compare timestamps (allow 1 second tolerance for rounding)
                diff = abs((exif_dt - target_dt).total_seconds())
                if diff <= 1:
                    stats["verify_match"] += 1
                else:
                    stats["verify_mismatch"] += 1
                    time_diff = exif_dt - target_dt
                    mismatches.append({
                        "filename": filename,
                        "filepath": filepath,
                        "json_dt": target_dt,
                        "exif_dt": exif_dt,
                        "diff": time_diff
                    })
                continue

            # Fix filesystem times if requested (for ALL files)
            if args.filesystem:
                if set_file_times(filepath, target_dt, args.dry_run):
                    stats["file_times_updated"] += 1

            # Update EXIF if requested
            if args.exif:
                # Get existing EXIF dates
                exif_dates = get_exif_dates(exiftool, filepath)

                # Only update EXIF if photo has NO timestamp metadata
                if has_any_date(exif_dates):
                    stats["has_metadata"] += 1
                    continue

                subsec = get_subsec(ts)
                # Print newline to avoid overwriting progress
                print(f"\n{filename}")
                print(f"  Path: {filepath}")
                # Show if this is a numbered duplicate
                if filename in numbered_duplicates:
                    base_file = numbered_duplicates[filename]
                    print(f"  Using timestamp from: {base_file}")
                    stats["numbered_duplicates"] += 1
                print(f"  JSON timestamp: {ts} -> {format_exif_datetime(target_dt)}.{subsec}")

                if set_exif_dates(exiftool, filepath, target_dt, ts, args.dry_run):
                    stats["exif_updated"] += 1
                    print(f"  {'[DRY RUN] Would set' if args.dry_run else 'Set'} EXIF to: {format_exif_datetime(target_dt)}.{subsec}")
                else:
                    stats["errors"] += 1
    finally:
        progress.finish()
        if exiftool:
            exiftool.stop()

    # Print mismatches for verify mode
    if args.verify and mismatches:
        print("\nTimestamp mismatches found:")
        print("-" * 60)
        for m in mismatches:
            sign = "+" if m["diff"].total_seconds() > 0 else "-"
            print(f"\n{m['filename']}")
            print(f"  Path: {m['filepath']}")
            print(f"  JSON: {format_exif_datetime(m['json_dt'])}")
            print(f"  EXIF: {format_exif_datetime(m['exif_dt'])}")
            print(f"  Diff: {sign}{format_timedelta(m['diff'])} (EXIF is {'ahead' if sign == '+' else 'behind'})")

    print("\n" + "=" * 60)
    print("Summary:")
    json_file_count = len(files) - len(numbered_duplicates)
    print(f"  Files in JSON:         {json_file_count}")
    if numbered_duplicates:
        print(f"  Numbered duplicates:   {len(numbered_duplicates)}")
    print(f"  Found in directory:    {stats['found']}")
    print(f"  Not found:             {stats['not_found']}")
    if args.verify:
        print(f"  With metadata:         {stats['has_metadata']}")
        print(f"  Without metadata:      {stats['no_metadata']}")
        print(f"  Timestamps match:      {stats['verify_match']}")
        print(f"  Timestamps mismatch:   {stats['verify_mismatch']}")
    elif args.exif:
        print(f"  Already has metadata:  {stats['has_metadata']}")
        print(f"  Metadata updated:      {stats['exif_updated']}")
        if stats["numbered_duplicates"] > 0:
            print(f"    (incl. duplicates):  {stats['numbered_duplicates']}")
    if args.filesystem:
        print(f"  File times updated:    {stats['file_times_updated']}")
    if not args.verify:
        print(f"  Errors:                {stats['errors']}")


if __name__ == "__main__":
    main()
