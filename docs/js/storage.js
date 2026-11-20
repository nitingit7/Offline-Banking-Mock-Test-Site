/**
 * storage.js
 * Centralised localStorage persistence layer.
 * Keys:
 *   bmt_test_data          – normalised test JSON
 *   bmt_original_test_data – original full test JSON (before any re-attempt filtering)
 *   bmt_candidate_name     – candidate name string
 *   bmt_active_attempt     – in-progress attempt state
 *   bmt_attempts           – array of completed attempt records
 *   bmt_analysis_attempt   – attempt state opened for analysis
 */

const Storage = (() => {
  const KEYS = {
    TEST_DATA: 'bmt_test_data',
    CANDIDATE: 'bmt_candidate_name',
    MOBILE: 'bmt_candidate_mobile',
    ACTIVE: 'bmt_active_attempt',
    ATTEMPTS: 'bmt_attempts',
    ANALYSIS: 'bmt_analysis_attempt',
  };

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Storage read error:', key, e);
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
        showStorageQuotaWarning();
      }
      console.error('Storage write error:', key, e);
      return false;
    }
  }

  function showStorageQuotaWarning() {
    if (typeof document === 'undefined') return;
    let bar = document.getElementById('bmt-quota-warning-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bmt-quota-warning-banner';
      bar.style.cssText = 'position:fixed;bottom:10px;right:10px;background:#fff3cd;color:#856404;padding:12px 18px;border:1px solid #ffeeba;border-radius:4px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:13px;max-width:380px;';
      bar.innerHTML = '<strong>Storage Quota Warning:</strong> The browser could not save this change. Free device storage and try again. <button style="margin-left:8px;padding:2px 6px;border:none;background:#856404;color:#fff;border-radius:3px;cursor:pointer;" onclick="this.parentElement.remove()">Dismiss</button>';
      document.body.appendChild(bar);
    }
  }

  function _remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Storage remove error:', key, e);
    }
  }

  // ── Test data ──────────────────────────────────────────────────────────────

  function getTestId(data) {
    if (!data || !data.meta) return 'default_test';
    if (data.meta.testId) return String(data.meta.testId);
    const slug = (data.meta.examName + '_' + data.meta.testName).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    data.meta.testId = slug;
    return slug;
  }

  function saveTestData(data) {
    if (data && data.meta) getTestId(data);
    return _set(KEYS.TEST_DATA, data);
  }
  function loadTestData() { return _get(KEYS.TEST_DATA); }
  function clearTestData() { _remove(KEYS.TEST_DATA); }

  function saveOriginalTestData(data) {
    if (data && data.meta) getTestId(data);
    return _set('bmt_original_test_data', data);
  }
  function loadOriginalTestData() { return _get('bmt_original_test_data'); }

  // ── Images & IndexedDB ─────────────────────────────────────────────────────

  const IDB_NAME = 'BMT_ImageDatabase_v1';
  const IDB_STORE = 'test_images';
  let _idbPromise = null;
  const _imageMemCache = {}; // testId -> { fileName: dataUrl }

  function _getIDB() {
    if (_idbPromise) return _idbPromise;
    _idbPromise = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      try {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
    return _idbPromise;
  }

  function saveImagesForTest(testId, imagesMap) {
    if (!testId || !imagesMap) return;
    _imageMemCache[testId] = Object.assign({}, _imageMemCache[testId] || {}, imagesMap);

    // Save in localStorage (scoped key) if size permits
    try {
      localStorage.setItem(`bmt_images_${testId}`, JSON.stringify(_imageMemCache[testId]));
    } catch (e) {
      console.warn('Could not store full images in localStorage:', e);
    }

    // Also persist into IndexedDB
    _getIDB().then(db => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        Object.entries(imagesMap).forEach(([name, dataUrl]) => {
          store.put({ key: `${testId}::${name}`, testId, name, dataUrl });
        });
      } catch (err) {
        console.warn('IndexedDB write error:', err);
      }
    });
  }

  function loadImagesForTest(testId) {
    if (!testId) return {};
    if (_imageMemCache[testId] && Object.keys(_imageMemCache[testId]).length > 0) {
      return _imageMemCache[testId];
    }
    try {
      const raw = localStorage.getItem(`bmt_images_${testId}`);
      if (raw) {
        _imageMemCache[testId] = JSON.parse(raw);
        return _imageMemCache[testId];
      }
    } catch (e) {}

    // Async warm up from IndexedDB
    _getIDB().then(db => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).getAll();
        req.onsuccess = () => {
          if (Array.isArray(req.result)) {
            req.result.filter(item => item.testId === testId).forEach(item => {
              if (!_imageMemCache[testId]) _imageMemCache[testId] = {};
              _imageMemCache[testId][item.name] = item.dataUrl;
            });
          }
        };
      } catch (e) {}
    });

    return _imageMemCache[testId] || {};
  }

  function resolveImageSrc(imageRef, testData) {
    if (!imageRef || typeof imageRef !== 'string') return null;
    const cleanRef = imageRef.trim();

    // 1. Data URI or blob URL
    if (cleanRef.startsWith('data:image/') || cleanRef.startsWith('blob:')) {
      return cleanRef;
    }

    // 2. Attached images scoped to testId
    const tData = testData || loadTestData();
    const tid = getTestId(tData);
    const attached = loadImagesForTest(tid);
    if (attached && attached[cleanRef]) {
      return attached[cleanRef];
    }

    // 3. Embedded in testData._images
    if (tData && tData._images && tData._images[cleanRef]) {
      return tData._images[cleanRef];
    }

    // 4. Relative path starting with images/
    if (cleanRef.startsWith('images/')) {
      return cleanRef;
    }

    // 5. Default search in pre-installed images/tests/ directory
    return `images/tests/${cleanRef}`;
  }

  // ── Candidate details ───────────────────────────────────────────────────────

  function saveCandidateName(name) {
    try {
      localStorage.setItem(KEYS.CANDIDATE, name);
      return true;
    } catch(e) { return false; }
  }

  function loadCandidateName() {
    let val = localStorage.getItem(KEYS.CANDIDATE);
    if (!val) return 'Candidate';
    if (val.startsWith('"') && val.endsWith('"')) {
      try { val = JSON.parse(val); } catch(e) {}
    }
    return val || 'Candidate';
  }

  function saveCandidateMobile(mobile) {
    try {
      localStorage.setItem(KEYS.MOBILE, mobile);
      return true;
    } catch(e) { return false; }
  }

  function loadCandidateMobile() {
    let val = localStorage.getItem(KEYS.MOBILE);
    if (!val) return '';
    if (val.startsWith('"') && val.endsWith('"')) {
      try { val = JSON.parse(val); } catch(e) {}
    }
    return val || '';
  }

  function clearCandidateDetails() {
    _remove(KEYS.CANDIDATE);
    _remove(KEYS.MOBILE);
  }

  // ── Active attempt ─────────────────────────────────────────────────────────

  function saveActiveAttempt(state) {
    // Strip redundant _images copy to prevent huge state objects
    const st = state ? JSON.parse(JSON.stringify(state)) : null;
    if (st && st.testData && st.testData._images) {
      delete st.testData._images;
    }
    return _set(KEYS.ACTIVE, st);
  }
  function loadActiveAttempt() { return _get(KEYS.ACTIVE); }
  function clearActiveAttempt() { _remove(KEYS.ACTIVE); }

  // ── Completed attempts ─────────────────────────────────────────────────────

  let archive = null;
  const records = new Map();
  const ready = (async () => {
    const old = _get(KEYS.ATTEMPTS) || [];
    old.forEach(item => records.set(item.attemptId, item));
    try {
      archive = await new Promise((resolve, reject) => {
        const req = indexedDB.open('PracticeDeskHistory', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('attempts', { keyPath: 'attemptId' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const stored = await new Promise((resolve, reject) => {
        const req = archive.transaction('attempts').objectStore('attempts').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      stored.forEach(item => records.set(item.attemptId, item));
      if (old.length) {
        const existing = new Set(stored.map(item => item.attemptId));
        for (const item of old) if (!existing.has(item.attemptId)) await putRecord(item);
        _remove(KEYS.ATTEMPTS);
      }
    } catch { archive = null; }
  })();
  function putRecord(item) {
    return new Promise((resolve, reject) => {
      const tx = archive.transaction('attempts', 'readwrite');
      tx.objectStore('attempts').put(item);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }
  function loadAttempts() {
    return Array.from(records.values()).sort((a, b) => a.submittedAt - b.submittedAt);
  }
  async function saveCompletedAttempt(input) {
    await ready;
    const record = JSON.parse(JSON.stringify(input));
    if (record.testData && record.state?.testData) record.testData = record.state.testData;
    if (archive) await putRecord(record);
    else {
      const saved = _get(KEYS.ATTEMPTS) || [];
      const next = saved.filter(item => item.attemptId !== record.attemptId).concat(record);
      if (!_set(KEYS.ATTEMPTS, next)) throw Error('Attempt storage full');
    }
    records.set(record.attemptId, record);
    return true;
  }


  function getAttemptById(attemptId) {
    const attempts = loadAttempts();
    return attempts.find(a => a.attemptId === attemptId) || null;
  }

  // ── Analysis state ─────────────────────────────────────────────────────────

  function saveAnalysisAttempt(state) {
    const st = state ? JSON.parse(JSON.stringify(state)) : null;
    if (st && st.testData && st.testData._images) {
      delete st.testData._images;
    }
    return _set(KEYS.ANALYSIS, st);
  }
  function loadAnalysisAttempt() { return _get(KEYS.ANALYSIS); }
  function clearAnalysisAttempt() { _remove(KEYS.ANALYSIS); }

  async function addReattemptToAttempt(attemptId, reattemptRecord) {
    const attempts = loadAttempts();
    const existing = attempts.find(a => a.attemptId === attemptId);
    const target = existing ? structuredClone(existing) : null;
    if (target) {
      if (!Array.isArray(target.reattempts)) target.reattempts = [];
      target.reattempts.push(reattemptRecord);
      await saveCompletedAttempt(target);
      const active = loadActiveAttempt();
      if (active && active.attemptId === attemptId) {
        if (!Array.isArray(active.reattempts)) active.reattempts = [];
        active.reattempts.push(reattemptRecord);
        saveActiveAttempt(active);
      }
      return true;
    }
    return false;
  }

  // ── Clear All Tests and Images ─────────────────────────────────────────────

  function clearAllTestsAndImages() {
    clearTestData();
    _remove('bmt_original_test_data');
    clearActiveAttempt();
    clearAnalysisAttempt();
    _remove(KEYS.ATTEMPTS);

    // Remove all bmt_images_* from localStorage
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bmt_images_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}

    // Clear IndexedDB
    _getIDB().then(db => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
      } catch(e) {}
    });

    Object.keys(_imageMemCache).forEach(k => delete _imageMemCache[k]);
  }

  return {
    saveTestData, loadTestData, clearTestData,
    saveOriginalTestData, loadOriginalTestData,
    saveCandidateName, loadCandidateName,
    saveCandidateMobile, loadCandidateMobile, clearCandidateDetails,
    saveActiveAttempt, loadActiveAttempt, clearActiveAttempt,
    ready, loadAttempts, saveCompletedAttempt, getAttemptById, addReattemptToAttempt,
    saveAnalysisAttempt, loadAnalysisAttempt, clearAnalysisAttempt,
    saveImagesForTest, loadImagesForTest, resolveImageSrc, getTestId,
    clearAllTestsAndImages,
    KEYS,
  };
})();
