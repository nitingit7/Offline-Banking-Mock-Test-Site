/**
 * landing.js
 * Landing page controller: Login clone, candidate name & mobile validation,
 * sample loaders, attempt history, and compare mode gating.
 */

(function () {
  'use strict';

  // Shared HTML-escape helper
  const _esc = (typeof window !== 'undefined' && window._esc) ||
               (typeof Sanitiser !== 'undefined' && (Sanitiser.escapeHtml || Sanitiser._esc)) ||
               function(str) {
                 if (str === null || str === undefined) return '';
                 return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
               };

  // ── 1. Gated Demo Data (?compare=login) ──────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const isCompareLogin = urlParams.get('compare') === 'login';

  const nameInput = document.getElementById('candidate-name');
  const mobileInput = document.getElementById('candidate-mobile');
  const headerCandName = document.getElementById('header-cand-name');
  const mobileError = document.getElementById('mobile-error');
  const clearDetailsLink = document.getElementById('clear-saved-details');
  const signInBtn = document.getElementById('signInLabel');
  const fileBtn = document.getElementById('btn-upload-file');
  const fileInput = document.getElementById('json-file-input');
  const addImagesBtn = document.getElementById('btn-add-images');
  const imagesFileInput = document.getElementById('images-file-input');
  const sampleSectionalBtn = document.getElementById('btn-sample-sectional');
  const sampleFullBtn = document.getElementById('btn-sample-full');
  const textarea = document.getElementById('json-textarea');
  const errBox = document.getElementById('error-box');
  const attemptHistoryEl = document.getElementById('attempt-history');
  const attachedContainer = document.getElementById('attached-images-container');
  const attachedList = document.getElementById('attached-images-list');
  const attachedCount = document.getElementById('attached-count');
  const imageChecklist = document.getElementById('image-checklist');
  const clearAllDataLink = document.getElementById('clear-all-data');

  if (isCompareLogin) {
    document.body.classList.add('is-compare-login');
    if (headerCandName) headerCandName.textContent = 'John Smith ';
    if (nameInput) {
      nameInput.value = '11111';
      nameInput.disabled = true;
    }
    if (mobileInput) {
      mobileInput.value = 'Guest';
      mobileInput.type = 'password';
      mobileInput.disabled = true;
    }
    // Return early: pure visual comparison reproducing saved Login.html 1:1
    return;
  }

  // ── 2. Candidate Mobile Validation & Sanitisation Helpers ────────────────────
  function sanitizeMobile(raw) {
    if (!raw) return '';
    let str = String(raw).trim().replace(/[\s\-\(\)]/g, '');
    if (str.startsWith('+91')) str = str.substring(3);
    else if (str.startsWith('91') && str.length > 10) str = str.substring(2);
    if (str.startsWith('0')) str = str.substring(1);
    return str.replace(/\D/g, '').substring(0, 10);
  }

  function validateMobile(str) {
    const clean = sanitizeMobile(str);
    if (!clean) return { valid: false, error: 'Mobile number is required.' };
    if (clean.length !== 10) return { valid: false, error: 'Mobile number must be exactly 10 digits.' };
    if (!/^[6-9]/.test(clean)) return { valid: false, error: 'Mobile number must start with 6, 7, 8 or 9.' };
    return { valid: true, mobile: clean };
  }

  function showMobileError(msg) {
    if (!mobileError) return;
    if (msg) {
      mobileError.textContent = msg;
      mobileError.style.display = 'block';
    } else {
      mobileError.textContent = '';
      mobileError.style.display = 'none';
    }
  }

  function showError(msg) {
    if (!errBox) return;
    if (msg) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    } else {
      errBox.textContent = '';
      errBox.style.display = 'none';
    }
  }

  // ── 3. Prefill Saved Candidate Details ───────────────────────────────────────
  if (mobileInput) mobileInput.type = 'tel';

  const savedName = Storage.loadCandidateName();
  if (savedName && savedName !== 'Candidate') {
    if (nameInput) nameInput.value = savedName;
    if (headerCandName) headerCandName.textContent = savedName;
  } else {
    if (nameInput) nameInput.value = '';
    if (headerCandName) headerCandName.textContent = 'Candidate';
  }

  const savedMobile = Storage.loadCandidateMobile();
  if (savedMobile) {
    if (mobileInput) mobileInput.value = savedMobile;
  } else {
    if (mobileInput) mobileInput.value = '';
  }

  // Remember last test data in textarea if present
  try {
    const lastTestData = Storage.loadTestData();
    if (lastTestData && textarea && !textarea.value) {
      textarea.value = JSON.stringify(lastTestData, null, 2);
    }
  } catch(e) {}

  // ── 4. Real-time Field Listeners ─────────────────────────────────────────────
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (headerCandName) headerCandName.textContent = val || 'Candidate';
      if (val.length > 0) {
        Storage.saveCandidateName(val);
      }
    });
  }

  if (mobileInput) {
    mobileInput.addEventListener('input', () => {
      const cur = mobileInput.value;
      const clean = sanitizeMobile(cur);
      if (cur !== clean) mobileInput.value = clean;

      if (clean.length === 10) {
        const res = validateMobile(clean);
        if (res.valid) {
          showMobileError('');
          Storage.saveCandidateMobile(res.mobile);
        } else {
          showMobileError(res.error);
        }
      } else if (clean.length > 0 && !/^[6-9]/.test(clean)) {
        showMobileError('Mobile number must start with 6, 7, 8 or 9.');
      } else {
        showMobileError('');
      }
    });

    mobileInput.addEventListener('blur', () => {
      if (mobileInput.value.trim()) {
        const res = validateMobile(mobileInput.value);
        if (!res.valid) {
          showMobileError(res.error);
        } else {
          showMobileError('');
          Storage.saveCandidateMobile(res.mobile);
        }
      }
    });

    mobileInput.addEventListener('paste', () => {
      setTimeout(() => {
        mobileInput.value = sanitizeMobile(mobileInput.value);
        const res = validateMobile(mobileInput.value);
        if (res.valid) {
          showMobileError('');
          Storage.saveCandidateMobile(res.mobile);
        } else {
          showMobileError(res.error);
        }
      }, 10);
    });
  }

  if (clearDetailsLink) {
    clearDetailsLink.addEventListener('click', e => {
      e.preventDefault();
      Storage.clearCandidateDetails();
      if (nameInput) nameInput.value = '';
      if (mobileInput) mobileInput.value = '';
      if (headerCandName) headerCandName.textContent = 'Candidate';
      showMobileError('');
    });
  }

  // ── 5. Images Attachment, Check List & File Loaders ──────────────────────────
  const attachedImages = {}; // filename -> dataUrl
  const PREINSTALLED_IMAGES = new Set([
    'quant1-di1-bar.png',
    'quant1-di2-pie.png',
    'sample-bar.png',
    'keyboard.png',
    'NewCandidateImage.jpg',
    'Icon-sprite.png'
  ]);

  function attachImageFiles(files) {
    if (!files || !files.length) return;
    let pending = files.length;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        pending--;
        if (pending === 0) {
          renderAttachedThumbnails();
          checkReferencedImages();
        }
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        attachedImages[file.name] = e.target.result;
        pending--;
        if (pending === 0) {
          renderAttachedThumbnails();
          checkReferencedImages();
        }
      };
      reader.onerror = () => {
        pending--;
        if (pending === 0) {
          renderAttachedThumbnails();
          checkReferencedImages();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function renderAttachedThumbnails() {
    const keys = Object.keys(attachedImages);
    if (!attachedContainer || !attachedList || !attachedCount) return;
    if (keys.length === 0) {
      attachedContainer.style.display = 'none';
      attachedList.innerHTML = '';
      attachedCount.textContent = '0';
      return;
    }
    attachedContainer.style.display = 'block';
    attachedCount.textContent = keys.length;
    attachedList.innerHTML = keys.map(name => {
      const dataUrl = attachedImages[name];
      return `
        <div style="position:relative; display:inline-flex; flex-direction:column; align-items:center; width:68px; padding:4px; border:1px solid #ddd; border-radius:4px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,0.05);" title="${_esc(name)}">
          <img src="${dataUrl}" alt="${_esc(name)}" style="width:58px; height:45px; object-fit:contain; border-radius:2px; display:block;" />
          <span style="font-size:10px; color:#555; max-width:64px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:3px;">${_esc(name)}</span>
          <button type="button" class="btn-remove-img" data-name="${_esc(name)}" style="position:absolute; top:-5px; right:-5px; width:18px; height:18px; line-height:16px; border-radius:50%; background:#e05353; color:#fff; border:none; cursor:pointer; font-size:11px; font-weight:bold; padding:0; display:flex; align-items:center; justify-content:center;">&times;</button>
        </div>
      `;
    }).join('');

    attachedList.querySelectorAll('.btn-remove-img').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const name = btn.dataset.name;
        delete attachedImages[name];
        renderAttachedThumbnails();
        checkReferencedImages();
      });
    });
  }

  function checkReferencedImages() {
    if (!imageChecklist) return;
    const raw = textarea ? textarea.value.trim() : '';
    if (!raw) {
      imageChecklist.style.display = 'none';
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      imageChecklist.style.display = 'none';
      return;
    }

    const val = Validator.validate(parsed);
    const refImgs = val.referencedImages || [];
    if (refImgs.length === 0) {
      imageChecklist.style.display = 'none';
      return;
    }

    let hasMissing = false;
    const items = refImgs.map(ref => {
      const fileName = ref.split('/').pop().split('\\').pop();
      const isFound = attachedImages[fileName] || PREINSTALLED_IMAGES.has(fileName);
      if (isFound) {
        return `<span style="color:#28a745; margin-right:12px; display:inline-block;">✔ Found: <strong>${_esc(fileName)}</strong></span>`;
      } else {
        hasMissing = true;
        return `<span style="color:#b26b00; margin-right:12px; display:inline-block;">⚠️ Missing: <strong>${_esc(fileName)}</strong></span>`;
      }
    });

    imageChecklist.style.display = 'block';
    if (hasMissing) {
      imageChecklist.style.background = '#fff8e1';
      imageChecklist.style.border = '1px solid #ffe082';
      imageChecklist.style.color = '#8d6e63';
      imageChecklist.innerHTML = `
        <div style="font-weight:600; color:#b26b00; margin-bottom:4px;">Image status:</div>
        <div style="margin-bottom:4px;">${items.join(' ')}</div>
        <div style="font-size:11px; color:#6d4c41;">Tip: You can attach missing images with the <strong>Add images</strong> button, or continue with placeholders.</div>
      `;
    } else {
      imageChecklist.style.background = '#e8f5e9';
      imageChecklist.style.border = '1px solid #c8e6c9';
      imageChecklist.style.color = '#2e7d32';
      imageChecklist.innerHTML = `
        <div style="font-weight:600; color:#2e7d32; margin-bottom:4px;">All referenced images ready:</div>
        <div>${items.join(' ')}</div>
      `;
    }
  }

  if (addImagesBtn && imagesFileInput) {
    addImagesBtn.addEventListener('click', () => imagesFileInput.click());
    imagesFileInput.addEventListener('change', () => {
      attachImageFiles(imagesFileInput.files);
      imagesFileInput.value = '';
    });
  }

  if (fileBtn && fileInput) {
    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      const jsonFiles = files.filter(f => f.name.endsWith('.json') || f.type === 'application/json' || f.name.endsWith('.txt'));
      const imgFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));

      if (jsonFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = e => {
          if (textarea) {
            textarea.value = e.target.result;
            checkReferencedImages();
          }
          showError('');
        };
        reader.onerror = () => showError('Failed to read selected file.');
        reader.readAsText(jsonFiles[0]);
      }

      if (imgFiles.length > 0) {
        attachImageFiles(imgFiles);
      }
      fileInput.value = '';
    });
  }

  // Drag & drop support on landing page
  ['dragenter', 'dragover'].forEach(evt => {
    window.addEventListener(evt, e => e.preventDefault(), false);
  });
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const jsonFiles = files.filter(f => f.name.endsWith('.json') || f.name.endsWith('.txt'));
      const imgFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name));

      if (jsonFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = ev => {
          if (textarea) {
            textarea.value = ev.target.result;
            checkReferencedImages();
          }
          showError('');
        };
        reader.readAsText(jsonFiles[0]);
      }
      if (imgFiles.length > 0) {
        attachImageFiles(imgFiles);
      }
    }
  });

  textarea?.addEventListener('input', () => {
    showError('');
    checkReferencedImages();
  });

  // Embedded sample test JSON data for offline / file:// protocol usage without CORS errors
  const EMBEDDED_SAMPLES = {
    'samples/sample-sectional-test.json': "{\n  \"meta\": {\n    \"examName\": \"SBI Clerk Prelims\",\n    \"testName\": \"Quant Sample with DI\",\n    \"testType\": \"sectional\",\n    \"durationMinutes\": 20,\n    \"marksPerQuestion\": 1,\n    \"negativeMarking\": 0.25,\n    \"allowReattempt\": true\n  },\n  \"sections\": [\n    {\n      \"name\": \"Quantitative Aptitude\",\n      \"durationMinutes\": 20,\n      \"groups\": [\n        {\n          \"id\": \"t1\",\n          \"passage\": \"<b>Directions (Q. 6-9):</b>\\nStudy the table below and answer the questions.\\n\\n<table><tr><th>Year</th><th>Revenue (\u20b9 crore)</th><th>Expenses (\u20b9 crore)</th></tr><tr><td>2019</td><td>120</td><td>90</td></tr><tr><td>2020</td><td>150</td><td>100</td></tr><tr><td>2021</td><td>180</td><td>125</td></tr><tr><td>2022</td><td>210</td><td>150</td></tr><tr><td>2023</td><td>240</td><td>170</td></tr></table>\"\n        },\n        {\n          \"id\": \"bar1\",\n          \"passage\": \"<b>Directions (Q. 10-12):</b>\\nThe bar chart shows the production of five companies in 2022 and 2023. Study it and answer the questions.\",\n          \"image\": \"quant1-di1-bar.png\"\n        },\n        {\n          \"id\": \"pie1\",\n          \"passage\": \"<b>Directions (Q. 13-15):</b>\\nThe pie chart shows the stream-wise distribution of 1200 students in a college. Study it and answer the questions.\",\n          \"image\": \"quant1-di2-pie.png\"\n        }\n      ],\n      \"questions\": [\n        {\n          \"id\": 1,\n          \"question\": \"A train 150 m long passes a pole in 15 seconds.\\nFind its speed in km/h.\",\n          \"options\": [\n            \"30 km/h\",\n            \"36 km/h\",\n            \"40 km/h\",\n            \"45 km/h\",\n            \"54 km/h\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Speed = 150/15 = 10 m/s = 10 x 18/5 = 36 km/h.<br><b>Full solution:</b> Quant_Sample.pdf, page 3\"\n        },\n        {\n          \"id\": 2,\n          \"question\": \"Find the simple interest on <b>\u20b9 4000</b> at 5% per annum for 3 years.\",\n          \"options\": [\n            \"\u20b9 450\",\n            \"\u20b9 500\",\n            \"\u20b9 550\",\n            \"\u20b9 600\"\n          ],\n          \"correct\": 4,\n          \"explanation\": \"SI = (4000 x 5 x 3)/100 = \u20b9 600.<br><b>Full solution:</b> Quant_Sample.pdf, page 3\"\n        },\n        {\n          \"id\": 3,\n          \"question\": \"If 3x + 7 = 25, what is the value of x?\",\n          \"options\": [\n            \"6\",\n            \"5\",\n            \"7\",\n            \"8\",\n            \"9\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"3x = 18, so x = 6.<br><b>Full solution:</b> Quant_Sample.pdf, page 4\"\n        },\n        {\n          \"id\": 4,\n          \"question\": \"What is the average of the first five odd numbers?\",\n          \"options\": [\n            \"3\",\n            \"4\",\n            \"5\",\n            \"6\",\n            \"7\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"(1+3+5+7+9)/5 = 25/5 = 5.<br><b>Full solution:</b> Quant_Sample.pdf, page 4\"\n        },\n        {\n          \"id\": 5,\n          \"question\": \"A number is increased by 20% and then decreased by 20%.\\nWhat is the net change?\",\n          \"options\": [\n            \"No change\",\n            \"4% increase\",\n            \"2% decrease\",\n            \"2% increase\",\n            \"4% decrease\"\n          ],\n          \"correct\": 5,\n          \"explanation\": \"1.2 x 0.8 = 0.96, so the net change is a 4% decrease.<br><b>Full solution:</b> Quant_Sample.pdf, page 5\"\n        },\n        {\n          \"id\": 6,\n          \"groupId\": \"t1\",\n          \"question\": \"What was the profit of the company in 2022 (in \u20b9 crore)?\",\n          \"options\": [\n            \"50\",\n            \"60\",\n            \"55\",\n            \"65\",\n            \"70\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Profit = 210 - 150 = \u20b9 60 crore.<br><b>Full solution:</b> Quant_Sample.pdf, page 8\"\n        },\n        {\n          \"id\": 7,\n          \"groupId\": \"t1\",\n          \"question\": \"By what percent did the revenue increase from 2020 to 2022?\",\n          \"options\": [\n            \"30%\",\n            \"35%\",\n            \"40%\",\n            \"45%\",\n            \"50%\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"(210 - 150)/150 x 100 = 40%.<br><b>Full solution:</b> Quant_Sample.pdf, page 8\"\n        },\n        {\n          \"id\": 8,\n          \"groupId\": \"t1\",\n          \"question\": \"What is the average profit over the five years (in \u20b9 crore)?\",\n          \"options\": [\n            \"50\",\n            \"52\",\n            \"54\",\n            \"53\",\n            \"56\"\n          ],\n          \"correct\": 4,\n          \"explanation\": \"Profits: 30, 50, 55, 60, 70. Sum = 265, average = 265/5 = 53.<br><b>Full solution:</b> Quant_Sample.pdf, page 9\"\n        },\n        {\n          \"id\": 9,\n          \"groupId\": \"t1\",\n          \"question\": \"In which year was the ratio of revenue to expenses the highest?\",\n          \"options\": [\n            \"2020\",\n            \"2019\",\n            \"2021\",\n            \"2022\",\n            \"2023\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"Ratios: 1.33, 1.50, 1.44, 1.40, 1.41. The highest is in 2020.<br><b>Full solution:</b> Quant_Sample.pdf, page 9\"\n        },\n        {\n          \"id\": 10,\n          \"groupId\": \"bar1\",\n          \"question\": \"What is the total production of Companies A and C together in 2023 (in thousand units)?\",\n          \"options\": [\n            \"90\",\n            \"100\",\n            \"110\",\n            \"120\",\n            \"130\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"50 + 60 = 110 thousand units.<br><b>Full solution:</b> Quant_Sample.pdf, page 10\"\n        },\n        {\n          \"id\": 11,\n          \"groupId\": \"bar1\",\n          \"question\": \"Which company showed the maximum percentage increase in production from 2022 to 2023?\",\n          \"options\": [\n            \"Company A\",\n            \"Company B\",\n            \"Company C\",\n            \"Company D\",\n            \"Company E\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"Company C rose from 30 to 60, an increase of 100%, the highest.<br><b>Full solution:</b> Quant_Sample.pdf, page 10\"\n        },\n        {\n          \"id\": 12,\n          \"groupId\": \"bar1\",\n          \"question\": \"What is the average production of all five companies in 2022 (in thousand units)?\",\n          \"options\": [\n            \"44\",\n            \"48\",\n            \"46\",\n            \"50\",\n            \"52\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"(40 + 55 + 30 + 65 + 50)/5 = 240/5 = 48.<br><b>Full solution:</b> Quant_Sample.pdf, page 11\"\n        },\n        {\n          \"id\": 13,\n          \"groupId\": \"pie1\",\n          \"question\": \"How many students are there in the Commerce stream?\",\n          \"options\": [\n            \"300\",\n            \"240\",\n            \"280\",\n            \"320\",\n            \"360\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"25% of 1200 = 300.<br><b>Full solution:</b> Quant_Sample.pdf, page 12\"\n        },\n        {\n          \"id\": 14,\n          \"groupId\": \"pie1\",\n          \"question\": \"What is the ratio of the number of Science students to the number of Arts students?\",\n          \"options\": [\n            \"3 : 2\",\n            \"2 : 3\",\n            \"4 : 3\",\n            \"5 : 3\",\n            \"3 : 4\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"30% : 20% = 3 : 2.<br><b>Full solution:</b> Quant_Sample.pdf, page 12\"\n        },\n        {\n          \"id\": 15,\n          \"groupId\": \"pie1\",\n          \"question\": \"If 40% of the Engineering students are girls, how many girls are there in the Engineering stream?\",\n          \"options\": [\n            \"60\",\n            \"68\",\n            \"75\",\n            \"72\",\n            \"80\"\n          ],\n          \"correct\": 4,\n          \"explanation\": \"Engineering = 15% of 1200 = 180; 40% of 180 = 72.<br><b>Full solution:</b> Quant_Sample.pdf, page 13\"\n        }\n      ]\n    }\n  ]\n}",
    'samples/sample-full-test.json': "{\n  \"meta\": {\n    \"examName\": \"IBPS PO Prelims\",\n    \"testName\": \"Full Mock Test - 3 Sections\",\n    \"testType\": \"full\",\n    \"durationMinutes\": 60,\n    \"marksPerQuestion\": 1,\n    \"negativeMarking\": 0.25,\n    \"sectionTimed\": true,\n    \"allowReattempt\": true\n  },\n  \"sections\": [\n    {\n      \"name\": \"English Language\",\n      \"durationMinutes\": 20,\n      \"cutoff\": 10,\n      \"groups\": [\n        {\n          \"id\": \"eng-rc1\",\n          \"passage\": \"<b>Directions (Q. 1\u20134):</b> Read the following passage carefully and answer the questions.\\n\\nThe banking sector plays a **pivotal** role in the economic development of a country. Modern banking has evolved beyond traditional deposits and loans to include digital transactions, fintech partnerships, and artificial intelligence-driven customer service. However, with technological advancement comes increased exposure to cyber threats and financial fraud.\\n\\nFinancial institutions must balance rapid digital innovation with robust security infrastructure, ensuring consumer trust while expanding access to unbanked populations.\"\n        }\n      ],\n      \"questions\": [\n        {\n          \"id\": 1,\n          \"groupId\": \"eng-rc1\",\n          \"question\": \"What is the primary theme of the passage?\",\n          \"options\": [\n            \"Banking should avoid digital innovation\",\n            \"Modern banking balances technological expansion with cybersecurity and trust\",\n            \"Traditional lending is more secure than online banking\",\n            \"Fintech companies have completely replaced traditional banks\",\n            \"Cyber threats cannot be mitigated by financial institutions\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"The passage emphasizes balancing digital innovation with robust security infrastructure and consumer trust.<br><b>Full solution:</b> English_Sample.pdf, page 2\"\n        },\n        {\n          \"id\": 2,\n          \"groupId\": \"eng-rc1\",\n          \"question\": \"Which of the following is highlighted as a consequence of technological advancement in banking?\",\n          \"options\": [\n            \"Lower operational costs only\",\n            \"Increased exposure to cyber threats and financial fraud\",\n            \"Decreased customer service responsiveness\",\n            \"Elimination of regulatory compliance needs\",\n            \"Complete closure of physical branch networks\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"The passage explicitly notes increased exposure to cyber threats and financial fraud.<br><b>Full solution:</b> English_Sample.pdf, page 2\"\n        },\n        {\n          \"id\": 3,\n          \"groupId\": \"eng-rc1\",\n          \"question\": \"The word <b>pivotal</b> as used in the passage most nearly means:\",\n          \"options\": [\n            \"Marginal\",\n            \"Crucial\",\n            \"Secondary\",\n            \"Temporary\",\n            \"Superficial\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Pivotal means vitally important, central, or crucial.<br><b>Full solution:</b> English_Sample.pdf, page 3\"\n        },\n        {\n          \"id\": 4,\n          \"groupId\": \"eng-rc1\",\n          \"question\": \"According to the passage, what must financial institutions ensure alongside expanding access?\",\n          \"options\": [\n            \"Maximum quarterly dividend payouts\",\n            \"Robust security infrastructure and consumer trust\",\n            \"Discontinuation of AI customer support\",\n            \"Restricting loans to corporate entities only\",\n            \"Elimination of fintech collaborations\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Financial institutions must balance innovation with security and maintain consumer trust.<br><b>Full solution:</b> English_Sample.pdf, page 3\"\n        },\n        {\n          \"id\": 5,\n          \"question\": \"Select the most appropriate synonym for the word: **METICULOUS**\",\n          \"options\": [\n            \"Careless\",\n            \"Thorough\",\n            \"Hastened\",\n            \"Indifferent\",\n            \"Vague\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Meticulous means showing great attention to detail; very careful and precise (thorough).<br><b>Full solution:</b> English_Sample.pdf, page 4\"\n        }\n      ]\n    },\n    {\n      \"name\": \"Quantitative Aptitude\",\n      \"durationMinutes\": 20,\n      \"cutoff\": 10,\n      \"groups\": [\n        {\n          \"id\": \"quant-di1\",\n          \"passage\": \"<b>Directions (Q. 6\u20139):</b>\\nThe bar chart shows the production of five companies in 2022 and 2023. Study it and answer the questions.\",\n          \"image\": \"quant1-di1-bar.png\"\n        }\n      ],\n      \"questions\": [\n        {\n          \"id\": 6,\n          \"groupId\": \"quant-di1\",\n          \"question\": \"What is the total production of Companies A and C together in 2023 (in thousand units)?\",\n          \"options\": [\n            \"90\",\n            \"100\",\n            \"110\",\n            \"120\",\n            \"130\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"50 + 60 = 110 thousand units.<br><b>Full solution:</b> Quant_Sample.pdf, page 10\"\n        },\n        {\n          \"id\": 7,\n          \"groupId\": \"quant-di1\",\n          \"question\": \"Which company showed the maximum percentage increase in production from 2022 to 2023?\",\n          \"options\": [\n            \"Company A\",\n            \"Company B\",\n            \"Company C\",\n            \"Company D\",\n            \"Company E\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"Company C rose from 30 to 60, an increase of 100%, which is the highest.<br><b>Full solution:</b> Quant_Sample.pdf, page 10\"\n        },\n        {\n          \"id\": 8,\n          \"groupId\": \"quant-di1\",\n          \"question\": \"What is the average production of all five companies in 2022 (in thousand units)?\",\n          \"options\": [\n            \"44\",\n            \"48\",\n            \"46\",\n            \"50\",\n            \"52\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"(40 + 55 + 30 + 65 + 50)/5 = 240/5 = 48.<br><b>Full solution:</b> Quant_Sample.pdf, page 11\"\n        },\n        {\n          \"id\": 9,\n          \"groupId\": \"quant-di1\",\n          \"question\": \"What is the ratio of Company B production in 2022 to Company D production in 2023?\",\n          \"options\": [\n            \"11 : 14\",\n            \"11 : 12\",\n            \"5 : 7\",\n            \"11 : 15\",\n            \"11 : 16\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"55 : 70 = 11 : 14.<br><b>Full solution:</b> Quant_Sample.pdf, page 11\"\n        },\n        {\n          \"id\": 10,\n          \"question\": \"A train 150 m long passes a pole in 15 seconds.\\nFind its speed in km/h.\",\n          \"options\": [\n            \"30 km/h\",\n            \"36 km/h\",\n            \"40 km/h\",\n            \"45 km/h\",\n            \"54 km/h\"\n          ],\n          \"correct\": 2,\n          \"explanation\": \"Speed = 150/15 = 10 m/s = 10 x 18/5 = 36 km/h.<br><b>Full solution:</b> Quant_Sample.pdf, page 3\"\n        }\n      ]\n    },\n    {\n      \"name\": \"Reasoning Ability\",\n      \"durationMinutes\": 20,\n      \"cutoff\": 10,\n      \"groups\": [\n        {\n          \"id\": \"reas-puz1\",\n          \"passage\": \"<b>Directions (Q. 11\u201314):</b> Study the following information carefully and answer the questions below.\\n\\nEight persons \u2014 A, B, C, D, E, F, G and H \u2014 are sitting in a straight row facing North.\\n\u2022 H sits at the extreme left end.\\n\u2022 G sits immediate right of H.\\n\u2022 A sits third to the left of B.\\n\u2022 Only one person sits between B and C.\\n\u2022 C sits at the extreme right end.\\n\u2022 D sits immediate left of C.\\n\u2022 E sits immediate right of F.\"\n        }\n      ],\n      \"questions\": [\n        {\n          \"id\": 11,\n          \"groupId\": \"reas-puz1\",\n          \"question\": \"Who sits at the extreme right end of the row?\",\n          \"options\": [\n            \"E\",\n            \"D\",\n            \"B\",\n            \"H\",\n            \"C\"\n          ],\n          \"correct\": 5,\n          \"explanation\": \"Left-to-right: H, G, A, F, E, B, D, C. C is at the extreme right end.<br><b>Full solution:</b> Reasoning_Sample.pdf, page 15\"\n        },\n        {\n          \"id\": 12,\n          \"groupId\": \"reas-puz1\",\n          \"question\": \"How many persons sit between G and B?\",\n          \"options\": [\n            \"One\",\n            \"Two\",\n            \"Three\",\n            \"Four\",\n            \"Five\"\n          ],\n          \"correct\": 3,\n          \"explanation\": \"Between G and B sit A, F and E: three persons.<br><b>Full solution:</b> Reasoning_Sample.pdf, page 15\"\n        },\n        {\n          \"id\": 13,\n          \"groupId\": \"reas-puz1\",\n          \"question\": \"Who sits third to the right of A?\",\n          \"options\": [\n            \"C\",\n            \"D\",\n            \"E\",\n            \"B\",\n            \"G\"\n          ],\n          \"correct\": 4,\n          \"explanation\": \"A is 3rd from the left; third to its right is the 6th person, B.<br><b>Full solution:</b> Reasoning_Sample.pdf, page 16\"\n        },\n        {\n          \"id\": 14,\n          \"groupId\": \"reas-puz1\",\n          \"question\": \"What is the position of F with respect to D?\",\n          \"options\": [\n            \"Third to the left\",\n            \"Immediate left\",\n            \"Third to the right\",\n            \"Second to the left\",\n            \"Second to the right\"\n          ],\n          \"correct\": 1,\n          \"explanation\": \"F is 4th and D is 7th from the left, so F is third to the left of D.<br><b>Full solution:</b> Reasoning_Sample.pdf, page 16\"\n        },\n        {\n          \"id\": 15,\n          \"question\": \"<b>Statements:</b>\\nAll chairs are tables.\\nNo table is sofa.\\n\\n<b>Conclusions:</b>\\nI. No chair is sofa.\\nII. Some tables are chairs.\",\n          \"options\": [\n            \"Only conclusion I follows\",\n            \"Only conclusion II follows\",\n            \"Either conclusion I or II follows\",\n            \"Neither conclusion I nor II follows\",\n            \"Both conclusions I and II follow\"\n          ],\n          \"correct\": 5,\n          \"explanation\": \"Since all chairs are tables and no table is sofa, no chair is sofa (I is valid). Since all chairs are tables, some tables are chairs (II is valid). Both conclusions follow.<br><b>Full solution:</b> Reasoning_Sample.pdf, page 18\"\n        }\n      ]\n    }\n  ]\n}"
  };

  function loadSample(path) {
    showError('');
    if (window.location.protocol === 'file:' && EMBEDDED_SAMPLES[path]) {
      if (textarea) textarea.value = EMBEDDED_SAMPLES[path];
      showError('');
      checkReferencedImages();
      return;
    }
    fetch(path)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(text => {
        if (textarea) textarea.value = text;
        showError('');
        checkReferencedImages();
      })
      .catch(e => {
        if (EMBEDDED_SAMPLES[path]) {
          if (textarea) textarea.value = EMBEDDED_SAMPLES[path];
          showError('');
          checkReferencedImages();
        } else {
          showError(`Could not load sample: ${e.message}`);
        }
      });
  }

  sampleSectionalBtn?.addEventListener('click', () => loadSample('samples/sample-sectional-test.json'));
  sampleFullBtn?.addEventListener('click', () => loadSample('samples/sample-full-test.json'));

  if (clearAllDataLink) {
    clearAllDataLink.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Are you sure you want to clear all saved tests, attempt history, and images?')) {
        Storage.clearAllTestsAndImages();
        Object.keys(attachedImages).forEach(k => delete attachedImages[k]);
        renderAttachedThumbnails();
        if (textarea) textarea.value = '';
        checkReferencedImages();
        renderHistory();
        showError('');
      }
    });
  }

  // Check referenced images on initial load if textarea pre-populated
  if (textarea && textarea.value.trim()) {
    checkReferencedImages();
  }

  // ── 6. Load Test & Sign In ───────────────────────────────────────────────────
  signInBtn?.addEventListener('click', loadTest);

  function loadTest() {
    showError('');
    showMobileError('');

    // Candidate Name
    const nameVal = nameInput ? nameInput.value.trim() : '';
    if (!nameVal) {
      showMobileError('Candidate Name is required.');
      nameInput?.focus();
      return;
    }

    // Candidate Mobile
    const mobileVal = mobileInput ? mobileInput.value.trim() : '';
    const mRes = validateMobile(mobileVal);
    if (!mRes.valid) {
      showMobileError(mRes.error);
      mobileInput?.focus();
      return;
    }

    // Persist details
    Storage.saveCandidateName(nameVal);
    Storage.saveCandidateMobile(mRes.mobile);

    // Test JSON
    const raw = textarea ? textarea.value.trim() : '';
    if (!raw) {
      showError('Please paste or upload a JSON test file, or choose a sample test.');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch(e) {
      showError(`Invalid JSON: ${e.message}`);
      return;
    }

    const validation = Validator.validate(parsed);
    if (!validation.valid) {
      showError('Validation errors:\n• ' + validation.errors.join('\n• '));
      return;
    }

    const testData = Validator.normalise(parsed);
    const testId = Storage.getTestId(testData);

    // Save attached images scoped to test
    if (Object.keys(attachedImages).length > 0) {
      Storage.saveImagesForTest(testId, attachedImages);
      if (!testData._images) testData._images = {};
      Object.assign(testData._images, attachedImages);
    }

    Storage.saveTestData(testData);
    Storage.saveOriginalTestData(testData);
    Storage.clearActiveAttempt();

    // Navigate to exam (pass forward debug or scale query params if present)
    const currentParams = new URLSearchParams(window.location.search);
    const targetParams = new URLSearchParams();
    if (currentParams.get('debug') === '1') targetParams.set('debug', '1');
    if (currentParams.get('scale')) targetParams.set('scale', currentParams.get('scale'));
    const qs = targetParams.toString() ? `?${targetParams.toString()}` : '';
    window.location.href = `exam.html${qs}`;
  }

  // ── 7. Render Attempt History ────────────────────────────────────────────────
  function renderHistory() {
    if (!attemptHistoryEl) return;
    const attempts = Storage.loadAttempts();
    if (!attempts || !attempts.length) {
      attemptHistoryEl.innerHTML = '<p class="no-history" style="text-align: center; color: #888; font-size: 13px;">No previous attempts found.</p>';
      return;
    }

    const rows = attempts.slice().reverse().map((a, i) => {
      const dt = a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-IN') : '—';
      const aInteg = a.integrity || (a.state && a.state.integrity);
      let integBadge = '—';
      if (aInteg) {
        const v = (aInteg.tabSwitches || 0) + (aInteg.fullscreenExits || 0) + (aInteg.tamperEvents || 0) + (aInteg.blockedKeyAttempts || 0);
        integBadge = v === 0
          ? '<span style="color:#22a95a; font-weight:600;">✔ Clean</span>'
          : `<span style="color:#e05353; font-weight:600;" title="Security violations: ${v}">⚠️ ${v}</span>`;
      }
      const candidateInfo = _esc(a.candidateName || '—') + (a.candidateMobile ? ` (${_esc(a.candidateMobile)})` : '');
      let reattemptsHtml = '';
      if (a.reattempts && a.reattempts.length > 0) {
        reattemptsHtml = `<div style="margin-top:4px; font-size:11px; color:#147eb3;">` +
          a.reattempts.map(r => `<div>↳ <strong>${_esc(r.name)}:</strong> ${r.totalCorrect} correct, ${r.totalWrong} wrong</div>`).join('') +
          `</div>`;
      }
      const aTotalTime = a.totalTime || (a.state && a.state.questions && a.state.questions.reduce((s, q) => s + (q.timeSpent || 0), 0)) || 0;
      return `
        <tr>
          <td>${attempts.length - i}</td>
          <td>${_esc(a.testName || '—')}${reattemptsHtml}</td>
          <td>${candidateInfo}</td>
          <td>${a.totalScore !== undefined ? a.totalScore : '—'} / ${a.totalMarks || '—'}</td>
          <td>${Timer.formatDuration(aTotalTime)}</td>
          <td style="text-align:center;">${integBadge}</td>
          <td>${dt}</td>
          <td><button class="btn-history-analyse" data-id="${a.attemptId}">Analyse</button></td>
        </tr>
      `;
    }).join('');

    attemptHistoryEl.innerHTML = `
      <h3 style="font-size: 15px; margin-bottom: 10px; color: #333;">Attempt History</h3>
      <table class="history-table">
        <thead>
          <tr>
            <th>#</th><th>Test</th><th>Candidate</th><th>Score</th><th>Time</th><th style="text-align:center;">Integrity</th><th>Date</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <button class="btn-clear-history" id="btn-clear-history">Clear All History</button>
    `;

    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (confirm('Clear all attempt history?')) {
        localStorage.removeItem(Storage.KEYS.ATTEMPTS);
        renderHistory();
      }
    });

    attemptHistoryEl.querySelectorAll('.btn-history-analyse').forEach(btn => {
      btn.addEventListener('click', () => {
        const aid = btn.dataset.id;
        const attempt = Storage.getAttemptById(aid);
        if (attempt) {
          Storage.saveAnalysisAttempt(attempt.state || attempt);
          window.location.href = `exam.html?mode=analyse&attempt=${aid}`;
        }
      });
    });
  }

  renderHistory();

  // ── 8. Screen Size Selector ───────────────────────────────────────────────
  function setupScreenSizeSelector() {
    const select = document.getElementById('bmt-scale-select');
    const customWrap = document.getElementById('bmt-scale-custom-wrap');
    const customInput = document.getElementById('bmt-scale-custom-input');
    const resetBtn = document.getElementById('btn-scale-reset');
    if (!select) return;

    // Load initial selection from URL (?scale=) or localStorage (bmt_ui_scale)
    const urlScale = new URLSearchParams(window.location.search).get('scale');
    let currentVal = 'auto';
    if (urlScale && !isNaN(parseFloat(urlScale))) {
      currentVal = urlScale;
    } else {
      try {
        const stored = localStorage.getItem('bmt_ui_scale');
        if (stored) currentVal = stored;
      } catch (e) {}
    }

    const presetValues = ['auto', '1.0', '1.1', '1.2', '1.25', '1.3', '1.4', '1.5', '1.75', '2.0', '2.25', '2.5'];

    function syncUI(val) {
      if (presetValues.includes(val)) {
        select.value = val;
        if (customWrap) customWrap.style.display = 'none';
      } else {
        select.value = 'custom';
        if (customWrap) {
          customWrap.style.display = 'inline-flex';
          const pct = Math.round(parseFloat(val) * 100);
          if (customInput) customInput.value = isNaN(pct) ? '' : pct;
        }
      }
    }

    syncUI(currentVal);

    function applySelection(val) {
      try {
        if (val === 'auto') {
          localStorage.setItem('bmt_ui_scale', 'auto');
        } else {
          localStorage.setItem('bmt_ui_scale', val);
        }
      } catch (e) {}
      if (typeof Renderer !== 'undefined' && Renderer.applyUiScale) {
        Renderer.applyUiScale();
      }
    }

    select.addEventListener('change', (e) => {
      const choice = e.target.value;
      if (choice === 'custom') {
        if (customWrap) {
          customWrap.style.display = 'inline-flex';
          if (customInput) {
            if (!customInput.value) customInput.value = '100';
            customInput.focus();
            const num = parseFloat(customInput.value);
            applySelection((num / 100).toFixed(2));
          }
        }
      } else {
        if (customWrap) customWrap.style.display = 'none';
        applySelection(choice);
      }
    });

    if (customInput) {
      customInput.addEventListener('input', () => {
        let num = parseFloat(customInput.value);
        if (isNaN(num)) return;
        if (num < 80) num = 80;
        if (num > 300) num = 300;
        applySelection((num / 100).toFixed(2));
      });
      customInput.addEventListener('change', () => {
        let num = parseFloat(customInput.value);
        if (isNaN(num)) num = 100;
        if (num < 80) num = 80;
        if (num > 300) num = 300;
        customInput.value = num;
        applySelection((num / 100).toFixed(2));
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        syncUI('auto');
        applySelection('auto');
      });
    }

    // Apply scale initially on landing page load
    if (typeof Renderer !== 'undefined' && Renderer.applyUiScale) {
      Renderer.applyUiScale();
    }
  }

  setupScreenSizeSelector();

})();

if (typeof window !== 'undefined') {
  window.BMT_FILE_VERSIONS = window.BMT_FILE_VERSIONS || {};
  window.BMT_FILE_VERSIONS['landing.js'] = '20261018_125625';
}
