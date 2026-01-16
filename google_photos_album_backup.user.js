// ==UserScript==
// @name        Google Photos Album Backup
// @description Backup and restore album membership for Google Photos
// @version     1.1.0
// @author      lokster
// @match       *://photos.google.com/*
// @license     MIT
// @run-at      document-idle
// @grant       GM_registerMenuCommand
// @homepageURL https://github.com/lokster/Google-Photos-Album-Backup
// @downloadURL https://github.com/lokster/Google-Photos-Album-Backup/raw/master/google_photos_album_backup.user.js
// @updateURL   https://github.com/lokster/Google-Photos-Album-Backup/raw/master/google_photos_album_backup.user.js
// ==/UserScript==

(function() {
  'use strict';

  // Wait for GPTK to load
  const waitForGptk = () => {
    return new Promise((resolve) => {
      const check = () => {
        if (typeof gptkApi !== 'undefined') {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  };

  // CSS Styles
  const styles = `
    .aei-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 9998;
      display: none;
    }

    .aei-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #202124;
      border-radius: 8px;
      padding: 24px;
      z-index: 9999;
      width: min(600px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      display: none;
      flex-direction: column;
      color: #e8eaed;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      box-sizing: border-box;
      overflow: hidden;
    }

    .aei-popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #3c4043;
    }

    .aei-popup-title {
      font-size: 20px;
      font-weight: 500;
      margin: 0;
    }

    .aei-close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .aei-close-btn:hover {
      background: rgba(255,255,255,0.1);
    }
    .aei-close-btn svg {
      fill: #9aa0a6;
      width: 20px;
      height: 20px;
    }

    .aei-description {
      color: #9aa0a6;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 16px 0;
    }

    .aei-form-group {
      margin-bottom: 16px;
    }

    .aei-form-group label {
      display: block;
      margin-bottom: 8px;
      color: #9aa0a6;
      font-size: 14px;
    }

    .aei-form-group input {
      width: 100%;
      padding: 12px;
      border: 1px solid #3c4043;
      border-radius: 4px;
      background: #303134;
      color: #e8eaed;
      font-size: 14px;
      box-sizing: border-box;
    }

    .aei-form-group input:focus {
      outline: none;
      border-color: #8ab4f8;
    }

    .aei-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .aei-btn-primary {
      background: #8ab4f8;
      color: #202124;
    }
    .aei-btn-primary:hover {
      background: #aecbfa;
    }
    .aei-btn-primary:disabled {
      background: #3c4043;
      color: #5f6368;
      cursor: not-allowed;
    }

    .aei-btn-secondary {
      background: transparent;
      color: #8ab4f8;
      border: 1px solid #8ab4f8;
    }
    .aei-btn-secondary:hover {
      background: rgba(138,180,248,0.1);
    }

    .aei-log-area {
      background: #303134;
      border: 1px solid #3c4043;
      border-radius: 4px;
      padding: 12px;
      margin-top: 16px;
      flex: 1;
      min-height: 100px;
      max-height: min(300px, calc(100vh - 350px));
      overflow-y: auto;
      font-family: 'Roboto Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
    }

    .aei-log-area::-webkit-scrollbar {
      width: 8px;
    }
    .aei-log-area::-webkit-scrollbar-track {
      background: #202124;
    }
    .aei-log-area::-webkit-scrollbar-thumb {
      background: #5f6368;
      border-radius: 4px;
    }

    .aei-log-entry {
      margin: 2px 0;
      word-wrap: break-word;
    }
    .aei-log-entry.error {
      color: #f28b82;
    }
    .aei-log-entry.success {
      color: #81c995;
    }
    .aei-log-entry.info {
      color: #8ab4f8;
    }

    .aei-button-row {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      justify-content: flex-end;
    }

    .aei-status {
      margin-top: 16px;
      padding: 12px;
      background: #303134;
      border-radius: 4px;
      text-align: center;
      color: #9aa0a6;
    }

    .aei-import-prompt {
      text-align: center;
      padding: 40px 20px;
    }

    .aei-import-prompt p {
      color: #9aa0a6;
      margin-bottom: 20px;
    }

    .aei-file-preview {
      background: #303134;
      border: 1px solid #3c4043;
      border-radius: 8px;
      padding: 16px;
    }

    .aei-file-preview-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #3c4043;
    }

    .aei-file-preview-name {
      color: #81c995;
      font-size: 14px;
      font-weight: 500;
      word-break: break-all;
    }

    .aei-file-preview-stats {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }

    .aei-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }

    .aei-stat-value {
      font-size: 20px;
      font-weight: 500;
      color: #e8eaed;
      white-space: nowrap;
    }

    .aei-stat-label {
      font-size: 12px;
      color: #9aa0a6;
      margin-top: 4px;
      white-space: nowrap;
    }

    .aei-file-preview .aei-button-row {
      margin-top: 0;
    }

    .aei-select-group {
      margin: 16px 0;
      padding: 12px;
      background: #303134;
      border-radius: 4px;
    }

    .aei-select-group label {
      display: block;
      color: #9aa0a6;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .aei-select-group select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #3c4043;
      border-radius: 4px;
      background: #202124;
      color: #e8eaed;
      font-size: 14px;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239aa0a6'%3E%3Cpath d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
    }

    .aei-select-group select:focus {
      outline: none;
      border-color: #8ab4f8;
    }

    .aei-select-group select option {
      background: #303134;
      color: #e8eaed;
    }

    /* Responsive adjustments for smaller screens */
    @media (max-width: 500px) {
      .aei-popup {
        padding: 16px;
        border-radius: 0;
        width: 100vw;
        max-height: 100vh;
        height: 100vh;
      }

      .aei-popup-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
      }

      .aei-popup-title {
        font-size: 18px;
      }

      .aei-form-group {
        margin-bottom: 12px;
      }

      .aei-form-group input {
        padding: 10px;
      }

      .aei-btn {
        padding: 10px 20px;
      }

      .aei-log-area {
        padding: 8px;
        font-size: 11px;
        max-height: none;
        flex: 1;
      }

      .aei-button-row {
        margin-top: 16px;
      }

      .aei-import-prompt {
        padding: 20px 10px;
      }

      .aei-file-preview-stats {
        gap: 12px;
      }

      .aei-stat-value {
        font-size: 16px;
      }

      .aei-stat-label {
        font-size: 11px;
      }
    }

    @media (max-height: 500px) {
      .aei-popup {
        padding: 12px;
        max-height: 100vh;
      }

      .aei-popup-header {
        margin-bottom: 12px;
        padding-bottom: 8px;
      }

      .aei-log-area {
        max-height: calc(100vh - 280px);
        min-height: 60px;
      }

      .aei-import-prompt {
        padding: 16px 10px;
      }
    }
  `;

  // Icons (styled like GPTK button icons)
  const exportIcon = `<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M 2,2 C 0.9,2 0,2.9 0,4 v 16 c 0,1.1 0.9,2 2,2 h 12 c 1.1,0 2,-0.9 2,-2 v -6 h -2 v 6 H 2 V 4 H 8 V 8.0004297 L 10.5,6.1195703 13,8.0004297 V 4 h 1 v 6 h 2 V 4 C 16,2.9 15.1,2 14,2 Z m 7.669922,12 -2.5,2.980469 L 5.5,14.800781 3,18 h 10 z"/><path d="M 20.17,11 17.59,8.41 19,7 24,12 19,17 17.59,15.59 20.17,13 H 10.5 v -2 z"/></svg>`;
  const importIcon = `<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M 2,2 C 0.9,2 0,2.9 0,4 v 16 c 0,1.1 0.9,2 2,2 h 12 c 1.1,0 2,-0.9 2,-2 v -4 l -2,-2 v 6 H 2 V 4 H 8 V 8.0004297 L 10.5,6.1195703 13,8.0004297 V 4 h 1 v 6 L 16,8 V 4 C 16,2.9 15.1,2 14,2 Z m 7.669922,12 -2.5,2.980469 L 5.5,14.800781 3,18 h 10 z"/><path d="M 18.83,11 21.41,8.41 20,7 15,12 20,17 21.41,15.59 18.83,13 H 24 v -2 z"/></svg>`;
  const closeIcon = `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;

  // Logger class
  class Logger {
    constructor(logArea) {
      this.logArea = logArea;
    }

    log(message, type = '') {
      const entry = document.createElement('div');
      entry.className = `aei-log-entry ${type}`;
      const timestamp = new Date().toLocaleTimeString();
      entry.textContent = `[${timestamp}] ${message}`;
      this.logArea.appendChild(entry);
      this.logArea.scrollTop = this.logArea.scrollHeight;
      console.log(`[Album Backup] ${message}`);
    }

    clear() {
      this.logArea.innerHTML = '';
    }
  }

  // Timestamp utilities - normalize everything to milliseconds for consistency
  function normalizeToMs(ts) {
    if (ts > 1e15) return ts / 1000;      // Microseconds to ms
    if (ts > 1e12) return ts;              // Already milliseconds
    return ts * 1000;                       // Seconds to ms
  }

  function timestampToDate(ts) {
    return new Date(normalizeToMs(ts));
  }

  // Export function
  async function runExport(startDate, endDate, logger) {
    const MAX_CONCURRENT_REQUESTS = 20;

    logger.log('Starting export...', 'info');

    // Convert date range to milliseconds for comparison
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate + 'T23:59:59.999').getTime();

    // Fetch all items in date range
    logger.log(`Fetching photos from ${startDate} to ${endDate}...`);

    let allItems = [];
    let pageId = null;
    let currentTs = endMs; // Start from end date (milliseconds)

    do {
      const page = await gptkApi.getItemsByTakenDate(currentTs, null, pageId, 500, true);

      if (page.items?.length > 0) {
        const firstDate = timestampToDate(page.items[0].timestamp).toISOString().split('T')[0];
        const lastDate = timestampToDate(page.items[page.items.length - 1].timestamp).toISOString().split('T')[0];

        // Filter using normalized milliseconds for consistent comparison
        const filtered = page.items.filter(item => {
          const itemMs = normalizeToMs(item.timestamp);
          return itemMs >= startMs && itemMs <= endMs;
        });

        allItems.push(...filtered);
        logger.log(`Page: ${lastDate} to ${firstDate}, ${filtered.length} in range. Total: ${allItems.length}`);

        // Check if we've gone past the start date (using normalized comparison)
        if (page.lastItemTimestamp && normalizeToMs(page.lastItemTimestamp) < startMs) break;
      }

      pageId = page.nextPageId;
      currentTs = page.lastItemTimestamp;
    } while (pageId);

    logger.log(`Total items: ${allItems.length}`);
    if (allItems.length === 0) {
      logger.log('No items found in date range.', 'error');
      return null;
    }

    // Get extended info (parallel)
    logger.log(`Fetching photo info with ${MAX_CONCURRENT_REQUESTS} parallel requests...`);

    const itemsWithInfo = [];
    let fetchCompleted = 0;

    const allPromises = [];
    const promisePool = new Set();

    for (const item of allItems) {
      while (promisePool.size >= MAX_CONCURRENT_REQUESTS) {
        await Promise.race(promisePool);
      }

      const promise = gptkApi.getItemInfoExt(item.mediaKey)
        .then((extInfo) => {
          itemsWithInfo.push({ ...item, ...extInfo });
        })
        .catch((e) => {
          logger.log(`Error fetching info for ${item.mediaKey}: ${e}`, 'error');
        })
        .finally(() => {
          fetchCompleted++;
          if (fetchCompleted % 50 === 0) {
            logger.log(`Fetch progress: ${fetchCompleted}/${allItems.length}`);
          }
          promisePool.delete(promise);
        });

      promisePool.add(promise);
      allPromises.push(promise);
    }

    // Wait for ALL promises, not just those remaining in the pool
    await Promise.all(allPromises);
    logger.log(`Fetched info for ${itemsWithInfo.length} items`);

    // Build album-centric JSON structure
    logger.log('Building export data...');

    const albums = {};
    let photoCount = 0;

    for (const item of itemsWithInfo) {
      const albumNames = (item.albums || [])
        .filter(a => a.title)
        .map(a => a.title);

      if (albumNames.length === 0) continue;

      photoCount++;

      for (const albumName of albumNames) {
        if (!albums[albumName]) {
          albums[albumName] = [];
        }
        albums[albumName].push([item.fileName, item.timestamp]);
      }
    }

    const albumCount = Object.keys(albums).length;

    const exportData = {
      start_timestamp: startMs,  // Milliseconds
      end_timestamp: endMs,
      albums: albums
    };

    logger.log(`Export ready: ${photoCount} photos in ${albumCount} albums`, 'success');

    // Download JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `GooglePhotos_AlbumExport_${startDate}_${endDate}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.log(`Downloaded as "${filename}"`, 'success');

    return { ...exportData, filename };
  }

  // Import function
  // matchMode: 'exact' | 'seconds' | 'filename'
  async function runImport(jsonData, logger, matchMode = 'seconds') {
    const MAX_CONCURRENT_REQUESTS = 20;

    logger.log('Starting import...', 'info');
    const modeDescriptions = {
      'exact': 'filename + timestamp (exact)',
      'seconds': 'filename + timestamp (to seconds)',
      'filename': 'filename only'
    };
    logger.log(`Matching mode: ${modeDescriptions[matchMode] || matchMode}`);

    // Helper to normalize timestamp to seconds
    const normalizeToSeconds = (ts) => {
      if (ts > 1e15) return Math.floor(ts / 1000000); // Microseconds to seconds
      if (ts > 1e12) return Math.floor(ts / 1000);    // Milliseconds to seconds
      return ts;                                       // Already seconds
    };

    // Read timestamps and albums from JSON structure
    const startTs = jsonData.start_timestamp;
    const endTs = jsonData.end_timestamp;
    const albumsData = jsonData.albums;

    if (!startTs || !endTs || !albumsData) {
      logger.log('Invalid JSON structure. Expected: { start_timestamp, end_timestamp, albums }', 'error');
      return;
    }

    // Normalize timestamps to milliseconds for comparison
    const startMs = normalizeToMs(startTs);
    const endMs = normalizeToMs(endTs);

    const albumEntries = Object.entries(albumsData);
    logger.log(`Loaded ${albumEntries.length} albums from JSON`);

    // Build set of unique photos to find and album mapping
    const uniquePhotos = new Set();
    let totalMemberships = 0;

    for (const [albumName, photos] of albumEntries) {
      for (const [fileName, timestamp] of photos) {
        if (matchMode === 'exact') {
          uniquePhotos.add(`${fileName}|${timestamp}`);
        } else if (matchMode === 'seconds') {
          uniquePhotos.add(`${fileName}|${normalizeToSeconds(timestamp)}`);
        } else {
          uniquePhotos.add(fileName);
        }
        totalMemberships++;
      }
    }
    logger.log(`Unique photos to find: ${uniquePhotos.size}`);
    logger.log(`Total album memberships: ${totalMemberships}`);

    if (uniquePhotos.size === 0) {
      logger.log('No photos found in JSON.', 'error');
      return;
    }

    logger.log(`Date range from JSON: ${timestampToDate(startTs).toISOString()} to ${timestampToDate(endTs).toISOString()}`);

    // Album cache
    const albumCache = new Map();

    // Fetch all existing albums
    logger.log('Fetching existing albums...');
    {
      let pageId = null;
      do {
        const page = await gptkApi.getAlbums(pageId, 100, true);
        if (!page) break;
        if (page.items?.length > 0) {
          for (const album of page.items) {
            if (album.title) {
              albumCache.set(album.title, { mediaKey: album.mediaKey, isShared: album.isShared });
            }
          }
        }
        pageId = page.nextPageId;
      } while (pageId);
    }
    logger.log(`Total existing albums: ${albumCache.size}`);

    // Fetch photos in date range
    logger.log('Fetching photos from library...');

    let allItems = [];
    let pageId = null;
    let currentTs = endTs; // Start from the end date in the JSON file

    do {
      const page = await gptkApi.getItemsByTakenDate(currentTs, null, pageId, 500, true);

      if (page.items?.length > 0) {
        const firstDate = timestampToDate(page.items[0].timestamp).toISOString().split('T')[0];
        const lastDate = timestampToDate(page.items[page.items.length - 1].timestamp).toISOString().split('T')[0];

        // Filter using normalized milliseconds for consistent comparison
        const filtered = page.items.filter(item => {
          const itemMs = normalizeToMs(item.timestamp);
          return itemMs >= startMs && itemMs <= endMs;
        });

        allItems.push(...filtered);
        logger.log(`Page: ${lastDate} to ${firstDate}, ${filtered.length} in range. Total: ${allItems.length}`);

        // Check if we've gone past the start date (using normalized comparison)
        if (page.lastItemTimestamp && normalizeToMs(page.lastItemTimestamp) < startMs) break;
      }

      pageId = page.nextPageId;
      currentTs = page.lastItemTimestamp;
    } while (pageId);

    logger.log(`Total items fetched: ${allItems.length}`);
    if (allItems.length === 0) {
      logger.log('No photos found in the date range.', 'error');
      return;
    }

    // Get extended info (parallel)
    logger.log(`Fetching photo info with ${MAX_CONCURRENT_REQUESTS} parallel requests...`);

    const itemsWithInfo = [];
    let fetchCompleted = 0;

    {
      const allPromises = [];
      const promisePool = new Set();

      for (const item of allItems) {
        while (promisePool.size >= MAX_CONCURRENT_REQUESTS) {
          await Promise.race(promisePool);
        }

        const promise = gptkApi.getItemInfoExt(item.mediaKey)
          .then((extInfo) => {
            itemsWithInfo.push({ ...item, ...extInfo });
          })
          .catch((e) => {
            logger.log(`Error fetching info: ${e}`, 'error');
          })
          .finally(() => {
            fetchCompleted++;
            if (fetchCompleted % 50 === 0) {
              logger.log(`Fetch progress: ${fetchCompleted}/${allItems.length}`);
            }
            promisePool.delete(promise);
          });

        promisePool.add(promise);
        allPromises.push(promise);
      }

      // Wait for ALL promises, not just those remaining in the pool
      await Promise.all(allPromises);
    }
    logger.log(`Fetched info for ${itemsWithInfo.length} items`);

    // Match photos and build album -> mediaKeys mapping
    logger.log('Matching photos with import data...');

    // Build lookup based on matching mode
    const photoLookup = new Map();
    for (const item of itemsWithInfo) {
      let key;
      if (matchMode === 'exact') {
        key = `${item.fileName}|${item.timestamp}`;
      } else if (matchMode === 'seconds') {
        key = `${item.fileName}|${normalizeToSeconds(item.timestamp)}`;
      } else {
        key = item.fileName;
      }

      // For all modes, collect all matching mediaKeys (handles duplicates)
      if (!photoLookup.has(key)) {
        photoLookup.set(key, []);
      }
      photoLookup.get(key).push(item.mediaKey);
    }

    const albumToPhotos = new Map();
    const matchedPhotos = new Set();
    const notFoundPhotos = new Set();

    for (const [albumName, photos] of albumEntries) {
      const mediaKeys = [];

      for (const [fileName, timestamp] of photos) {
        let key;
        if (matchMode === 'exact') {
          key = `${fileName}|${timestamp}`;
        } else if (matchMode === 'seconds') {
          key = `${fileName}|${normalizeToSeconds(timestamp)}`;
        } else {
          key = fileName;
        }

        const keys = photoLookup.get(key);

        if (keys && keys.length > 0) {
          mediaKeys.push(...keys);
          matchedPhotos.add(key);
        } else {
          notFoundPhotos.add(key);
        }
      }

      if (mediaKeys.length > 0) {
        // Deduplicate mediaKeys in case same photo appears multiple times
        albumToPhotos.set(albumName, [...new Set(mediaKeys)]);
      }
    }

    logger.log(`Matched photos: ${matchedPhotos.size}`);
    logger.log(`Not found in library: ${notFoundPhotos.size}`);
    logger.log(`Albums to process: ${albumToPhotos.size}`);

    if (albumToPhotos.size === 0) {
      logger.log('No albums to process.', 'error');
      return;
    }

    // Show albums to process
    for (const [albumName, mediaKeys] of albumToPhotos) {
      const albumInfo = albumCache.get(albumName);
      const exists = !!albumInfo;
      const sharedTag = albumInfo?.isShared ? ' [shared]' : '';
      logger.log(`${exists ? '✓' : '+'} "${albumName}"${sharedTag} - ${mediaKeys.length} photos ${exists ? '(exists)' : '(will create)'}`);
    }

    // Create missing albums
    logger.log('Creating missing albums...', 'info');

    const albumsToCreate = [...albumToPhotos.keys()].filter(name => !albumCache.has(name));
    let createdCount = 0;

    for (const albumName of albumsToCreate) {
      try {
        logger.log(`Creating album: "${albumName}"`);
        const mediaKey = await gptkApi.createAlbum(albumName);
        albumCache.set(albumName, { mediaKey: mediaKey, isShared: false });
        createdCount++;
      } catch (e) {
        logger.log(`Error creating album "${albumName}": ${e}`, 'error');
      }
    }
    logger.log(`Created ${createdCount} new albums`);

    // Add photos to albums (sequential, max 500 per request)
    logger.log('Adding photos to albums...', 'info');

    const BATCH_SIZE = 500;
    let successCount = 0;
    let errorCount = 0;

    for (const [albumName, mediaKeys] of albumToPhotos) {
      const albumInfo = albumCache.get(albumName);
      if (!albumInfo) {
        logger.log(`Album "${albumName}" not found in cache, skipping`, 'error');
        errorCount += mediaKeys.length;
        continue;
      }

      // Split mediaKeys into batches of BATCH_SIZE
      const batches = [];
      for (let i = 0; i < mediaKeys.length; i += BATCH_SIZE) {
        batches.push(mediaKeys.slice(i, i + BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchLabel = batches.length > 1 ? ` (batch ${batchIndex + 1}/${batches.length})` : '';

        try {
          // Use appropriate function based on whether album is shared
          if (albumInfo.isShared) {
            await gptkApi.addItemsToSharedAlbum(batch, albumInfo.mediaKey);
          } else {
            await gptkApi.addItemsToAlbum(batch, albumInfo.mediaKey);
          }
          logger.log(`✓ Added ${batch.length} photos to "${albumName}"${batchLabel}`, 'success');
          successCount += batch.length;
        } catch (e) {
          logger.log(`✗ Error adding to "${albumName}"${batchLabel}: ${e}`, 'error');
          errorCount += batch.length;
        }
      }
    }

    logger.log('========== SUMMARY ==========', 'info');
    logger.log(`Albums in JSON: ${albumEntries.length}`);
    logger.log(`Unique photos in JSON: ${uniquePhotos.size}`);
    logger.log(`Photos matched: ${matchedPhotos.size}`);
    logger.log(`Photos not found: ${notFoundPhotos.size}`);
    logger.log(`Albums processed: ${albumToPhotos.size}`);
    logger.log(`Albums created: ${createdCount}`);
    logger.log(`Photos added: ${successCount}`, 'success');
    logger.log(`Errors: ${errorCount}`, errorCount > 0 ? 'error' : '');
  }

  // Create UI
  function createUI() {
    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'aei-overlay';
    document.body.appendChild(overlay);

    // Create Export popup
    const exportPopup = document.createElement('div');
    exportPopup.className = 'aei-popup';
    exportPopup.innerHTML = `
      <div class="aei-popup-header">
        <h2 class="aei-popup-title">Export Albums</h2>
        <button class="aei-close-btn">${closeIcon}</button>
      </div>
      <p class="aei-description">Saves album membership for all photos in the selected date range to a JSON file. Photos are identified by filename + timestamp combination, which remains consistent even after restoring from Google Takeout.</p>
      <div id="aei-export-form">
        <div class="aei-select-group">
          <label for="aei-year-select">Quick select year</label>
          <select id="aei-year-select">
            <option value="">Custom date range</option>
            ${(() => {
              const currentYear = new Date().getFullYear();
              let options = '';
              for (let y = currentYear; y >= 2000; y--) {
                options += `<option value="${y}">${y}</option>`;
              }
              return options;
            })()}
          </select>
        </div>
        <div class="aei-form-group">
          <label>Start Date</label>
          <input type="date" id="aei-start-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="aei-form-group">
          <label>End Date</label>
          <input type="date" id="aei-end-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="aei-button-row">
          <button class="aei-btn aei-btn-primary" id="aei-export-btn">Export</button>
        </div>
      </div>
      <div class="aei-file-preview" id="aei-export-preview" style="display:none;">
        <div class="aei-file-preview-header">
          <span class="aei-file-preview-name" id="aei-export-file-name"></span>
        </div>
        <div class="aei-file-preview-stats">
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-export-stat-albums">0</span>
            <span class="aei-stat-label">Albums</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-export-stat-photos">0</span>
            <span class="aei-stat-label">Photos</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-export-stat-start-date">-</span>
            <span class="aei-stat-label">Start Date</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-export-stat-end-date">-</span>
            <span class="aei-stat-label">End Date</span>
          </div>
        </div>
        <div class="aei-button-row">
          <button class="aei-btn aei-btn-primary" id="aei-export-new-btn">New Export</button>
        </div>
      </div>
      <div class="aei-log-area" id="aei-export-log" style="display:none;"></div>
    `;
    document.body.appendChild(exportPopup);

    // Create Import popup
    const importPopup = document.createElement('div');
    importPopup.className = 'aei-popup';
    importPopup.innerHTML = `
      <div class="aei-popup-header">
        <h2 class="aei-popup-title">Import Albums</h2>
        <button class="aei-close-btn">${closeIcon}</button>
      </div>
      <p class="aei-description">Restores album membership from a previously exported JSON file. Creates any missing albums and adds photos back to their original albums.</p>
      <div class="aei-import-prompt" id="aei-import-prompt">
        <p>Select a JSON file exported from "Export Albums"</p>
        <button class="aei-btn aei-btn-primary" id="aei-select-file-btn">Select JSON File</button>
      </div>
      <div class="aei-file-preview" id="aei-file-preview" style="display:none;">
        <div class="aei-file-preview-header">
          <span class="aei-file-preview-name" id="aei-file-name"></span>
        </div>
        <div class="aei-file-preview-stats">
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-stat-albums">0</span>
            <span class="aei-stat-label">Albums</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-stat-photos">0</span>
            <span class="aei-stat-label">Photos</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-stat-start-date">-</span>
            <span class="aei-stat-label">Start Date</span>
          </div>
          <div class="aei-stat">
            <span class="aei-stat-value" id="aei-stat-end-date">-</span>
            <span class="aei-stat-label">End Date</span>
          </div>
        </div>
        <div class="aei-select-group">
          <label for="aei-match-mode">Photo matching mode</label>
          <select id="aei-match-mode">
            <option value="seconds">Filename + timestamp (to seconds)</option>
            <option value="exact">Filename + timestamp (exact)</option>
            <option value="filename">Filename only</option>
          </select>
        </div>
        <div class="aei-button-row">
          <button class="aei-btn aei-btn-secondary" id="aei-change-file-btn">Change File</button>
          <button class="aei-btn aei-btn-primary" id="aei-import-btn">Import</button>
        </div>
      </div>
      <div class="aei-log-area" id="aei-import-log" style="display:none;"></div>
    `;
    document.body.appendChild(importPopup);

    // Get elements
    const exportLogArea = document.getElementById('aei-export-log');
    const importLogArea = document.getElementById('aei-import-log');
    const exportLogger = new Logger(exportLogArea);
    const importLogger = new Logger(importLogArea);

    // Import state
    let pendingImportData = null;

    // Helper to reset export dialog state
    const resetExportState = () => {
      document.getElementById('aei-export-form').style.display = 'block';
      document.getElementById('aei-export-preview').style.display = 'none';
      document.getElementById('aei-export-log').style.display = 'none';
      exportLogger.clear();
    };

    // Close handlers
    const closeExport = () => {
      exportPopup.style.display = 'none';
      overlay.style.display = 'none';
      resetExportState();
    };

    const closeImport = () => {
      importPopup.style.display = 'none';
      overlay.style.display = 'none';
      // Reset import popup state
      document.getElementById('aei-import-prompt').style.display = 'block';
      document.getElementById('aei-file-preview').style.display = 'none';
      document.getElementById('aei-import-log').style.display = 'none';
      pendingImportData = null;
      importLogger.clear();
    };

    exportPopup.querySelector('.aei-close-btn').onclick = closeExport;
    importPopup.querySelector('.aei-close-btn').onclick = closeImport;
    overlay.onclick = () => {
      closeExport();
      closeImport();
    };

    // Year selector handler
    document.getElementById('aei-year-select').onchange = (e) => {
      const year = e.target.value;
      if (year) {
        document.getElementById('aei-start-date').value = `${year}-01-01`;
        document.getElementById('aei-end-date').value = `${year}-12-31`;
      }
    };

    // Reset year selector when dates are manually changed
    document.getElementById('aei-start-date').onchange = () => {
      document.getElementById('aei-year-select').value = '';
    };
    document.getElementById('aei-end-date').onchange = () => {
      document.getElementById('aei-year-select').value = '';
    };

    // Export button handler
    document.getElementById('aei-export-btn').onclick = async () => {
      const startDate = document.getElementById('aei-start-date').value;
      const endDate = document.getElementById('aei-end-date').value;

      if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
      }

      // Hide form, show log
      document.getElementById('aei-export-form').style.display = 'none';
      document.getElementById('aei-export-log').style.display = 'block';
      exportLogger.clear();

      try {
        const result = await runExport(startDate, endDate, exportLogger);

        if (result) {
          // Show preview with stats
          const albums = result.albums || {};
          const albumCount = Object.keys(albums).length;

          const uniquePhotos = new Set();
          for (const photos of Object.values(albums)) {
            for (const [fn, ts] of photos) {
              uniquePhotos.add(`${fn}|${ts}`);
            }
          }

          document.getElementById('aei-export-file-name').textContent = result.filename;
          document.getElementById('aei-export-stat-albums').textContent = albumCount.toLocaleString();
          document.getElementById('aei-export-stat-photos').textContent = uniquePhotos.size.toLocaleString();
          document.getElementById('aei-export-stat-start-date').textContent = formatDate(result.start_timestamp);
          document.getElementById('aei-export-stat-end-date').textContent = formatDate(result.end_timestamp);

          document.getElementById('aei-export-log').style.display = 'none';
          document.getElementById('aei-export-preview').style.display = 'block';
        }
      } catch (e) {
        exportLogger.log(`Export failed: ${e}`, 'error');
      }
    };

    // New Export button handler
    document.getElementById('aei-export-new-btn').onclick = resetExportState;

    // Helper to format date from timestamp
    const formatDate = (timestamp) => {
      const date = timestampToDate(timestamp);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // Helper to show file preview
    const showFilePreview = (fileName, data) => {
      const albums = data.albums || {};
      const albumCount = Object.keys(albums).length;

      // Count unique photos
      const uniquePhotos = new Set();
      for (const photos of Object.values(albums)) {
        for (const [fn, ts] of photos) {
          uniquePhotos.add(`${fn}|${ts}`);
        }
      }

      document.getElementById('aei-file-name').textContent = fileName;
      document.getElementById('aei-stat-albums').textContent = albumCount.toLocaleString();
      document.getElementById('aei-stat-photos').textContent = uniquePhotos.size.toLocaleString();
      document.getElementById('aei-stat-start-date').textContent = formatDate(data.start_timestamp);
      document.getElementById('aei-stat-end-date').textContent = formatDate(data.end_timestamp);

      document.getElementById('aei-import-prompt').style.display = 'none';
      document.getElementById('aei-file-preview').style.display = 'block';
    };

    // Import file select handler
    const selectFile = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          pendingImportData = JSON.parse(text);

          if (!pendingImportData.albums || !pendingImportData.start_timestamp || !pendingImportData.end_timestamp) {
            throw new Error('Invalid file format');
          }

          showFilePreview(file.name, pendingImportData);
        } catch (err) {
          alert(`Error reading file: ${err}`);
        }
      };
      input.click();
    };

    document.getElementById('aei-select-file-btn').onclick = selectFile;
    document.getElementById('aei-change-file-btn').onclick = selectFile;

    // Import button handler
    document.getElementById('aei-import-btn').onclick = async () => {
      if (!pendingImportData) return;

      const matchMode = document.getElementById('aei-match-mode').value;

      // Hide preview, show log
      document.getElementById('aei-file-preview').style.display = 'none';
      document.getElementById('aei-import-log').style.display = 'block';

      try {
        await runImport(pendingImportData, importLogger, matchMode);
      } catch (err) {
        importLogger.log(`Error: ${err}`, 'error');
      }
    };

    // Create buttons with same structure as GPTK button
    const createButton = (icon, title) => {
      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      button.className = 'U26fgb JRtysb WzwrXb YI2CVc G6iPcb';
      button.setAttribute('aria-label', title);
      button.setAttribute('aria-disabled', 'false');
      button.setAttribute('tabindex', '0');
      button.setAttribute('title', title);
      button.innerHTML = `
        <div class="NWlf3e MbhUzd" jsname="ksKsZd"></div>
        <span jsslot="" class="MhXXcc oJeWuf">
          <span class="Lw7GHd snByac">
            ${icon}
            <div class="oK50pe eLNT1d" aria-hidden="true" jsname="JjzL4d"></div>
          </span>
        </span>
      `;
      return button;
    };

    // Open dialog functions
    const openExport = () => {
      exportPopup.style.display = 'flex';
      overlay.style.display = 'block';
      resetExportState();
    };

    const openImport = () => {
      importPopup.style.display = 'flex';
      overlay.style.display = 'block';
    };

    const exportButton = createButton(exportIcon, 'Export Albums');
    exportButton.onclick = openExport;

    const importButton = createButton(importIcon, 'Import Albums');
    importButton.onclick = openImport;

    return { exportButton, importButton, openExport, openImport };
  }

  // Insert buttons next to GPTK button
  function insertButtons(exportButton, importButton) {
    const checkForGptkButton = () => {
      const gptkButton = document.getElementById('gptk-button');
      if (gptkButton) {
        gptkButton.parentNode.insertBefore(importButton, gptkButton.nextSibling);
        gptkButton.parentNode.insertBefore(exportButton, gptkButton.nextSibling);
        return true;
      }
      return false;
    };

    if (!checkForGptkButton()) {
      const observer = new MutationObserver(() => {
        if (checkForGptkButton()) {
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Initialize
  async function init() {
    await waitForGptk();
    console.log('[Album Backup] GPTK detected, initializing...');

    const { exportButton, importButton, openExport, openImport } = createUI();
    insertButtons(exportButton, importButton);

    // Register menu commands
    GM_registerMenuCommand('Export Albums', openExport);
    GM_registerMenuCommand('Import Albums', openImport);

    console.log('[Album Backup] Ready');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
