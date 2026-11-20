/**
 * exam.js
 * Main exam controller.
 * Handles: instructions/declaration screens, exam screen, timers,
 * keyboard shortcuts, palette, submit flow, beforeunload, refresh-resume.
 * Also drives analyse mode when window.ANALYSE_MODE === true.
 */

(async function () {
  'use strict';
  await Storage.ready;

  // ── Comparison Mode (?compare=1 | ?compare=instructions | ?compare=declaration) ─
  const compareParam = new URLSearchParams(window.location.search).get('compare');
  const isCompareMode = compareParam === '1' || compareParam === 'instructions' || compareParam === 'declaration';

  if (isCompareMode) {
    document.body.classList.add('is-compare-mode');
    const screenExam = document.getElementById('screen-exam');
    const screenInstructions = document.getElementById('screen-instructions');
    const screenDeclaration = document.getElementById('screen-declaration');

    if (compareParam === 'instructions') {
      if (screenInstructions) screenInstructions.style.display = 'block';
      if (screenDeclaration) screenDeclaration.style.display = 'none';
      if (screenExam) screenExam.style.display = 'none';
      document.querySelectorAll('.candOrigName, .candOriginalName, #Username, .userName1, .decl-cand-name').forEach(cn => {
        cn.textContent = 'John Smith ';
      });
      document.querySelectorAll('.instMockName, .mockName').forEach(el => {
        el.textContent = 'UPUMS 2021 Mock PAPER I - PCB';
      });
      return;
    }

    if (compareParam === 'declaration') {
      if (screenInstructions) screenInstructions.style.display = 'none';
      if (screenDeclaration) screenDeclaration.style.display = 'block';
      if (screenExam) screenExam.style.display = 'none';
      document.querySelectorAll('.candOrigName, .candOriginalName, #Username, .userName1, .decl-cand-name').forEach(cn => {
        cn.textContent = 'John Smith ';
      });
      document.querySelectorAll('.instMockName, .mockName').forEach(el => {
        el.textContent = 'UPUMS 2021 Mock PAPER I - PCB';
      });
      const declBody = document.getElementById('declaration-body');
      if (declBody) {
        declBody.innerHTML = 'The instructions are not available in the chosen language. ';
      }
      return;
    }

    if (screenInstructions) screenInstructions.style.display = 'none';
    if (screenDeclaration) screenDeclaration.style.display = 'none';
    if (screenExam) screenExam.style.display = 'block';

    const candOriginalNames = document.querySelectorAll('.candOrigName, .candOriginalName, #Username, .userName1');
    candOriginalNames.forEach(cn => {
      cn.textContent = 'John Smith ';
    });

    const timeInMins = document.getElementById('timeInMins');
    if (timeInMins) timeInMins.textContent = '119:41';

    const fsBanner = document.getElementById('fullscreen-warning-banner');
    if (fsBanner) fsBanner.style.display = 'none';
    const scBanner = document.getElementById('scroll-warning-banner');
    if (scBanner) scBanner.style.display = 'none';
    const qTimer = document.getElementById('q-timer');
    if (qTimer) qTimer.style.display = 'none';

    return; // Freeze in compare mode without executing normal test timers or state logic
  }

  // ── Friendly Error Card ────────────────────────────────────────────────────
  function showAnalyseErrorCard(message) {
    document.title = 'No Test Attempt Found – Banking Mock Test';
    document.body.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f5f5f5; font-family:Arial,sans-serif; padding:20px; box-sizing:border-box;">
        <div style="background:#fff; border:1px solid #ddd; border-radius:8px; padding:36px 32px; max-width:460px; width:100%; text-align:center; box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <div style="font-size:36px; margin-bottom:12px; color:#d9534f;">⚠️</div>
          <h2 style="font-size:20px; color:#333; margin:0 0 12px; font-weight:600;">No Test Attempt Found</h2>
          <p style="font-size:14px; color:#666; margin:0 0 24px; line-height:1.5;">${message || 'No test attempt found to analyse.'}</p>
          <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
            <a href="index.html" class="btn btn-primary" style="text-decoration:none; padding:8px 18px; border-radius:4px; font-size:13px; font-weight:600; background:#147eb3; color:#fff; border:1px solid #147eb3; display:inline-block;">Return to Home</a>
            <a href="result.html" class="btn btn-default" style="text-decoration:none; padding:8px 18px; border-radius:4px; font-size:13px; font-weight:600; background:#fff; color:#333; border:1px solid #ccc; display:inline-block;">View Results</a>
          </div>
        </div>
      </div>
    `;
  }

  // ── Guards & Attempt Resolution ─────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const ANALYSE_MODE = window.ANALYSE_MODE === true || urlParams.get('mode') === 'analyse' || window.location.pathname.includes('analyse.html');

  let activeState = null;
  let attemptRecord = null;
  let testData = null;

  if (ANALYSE_MODE) {
    const attemptIdParam = urlParams.get('attempt');
    if (attemptIdParam) {
      attemptRecord = Storage.getAttemptById(attemptIdParam);
    }
    if (!attemptRecord) {
      const attempts = Storage.loadAttempts();
      if (attempts && attempts.length > 0) {
        attemptRecord = attempts[attempts.length - 1];
      }
    }
    if (!attemptRecord) {
      const storedAnalysis = Storage.loadAnalysisAttempt();
      if (storedAnalysis && storedAnalysis.attemptId) {
        attemptRecord = Storage.getAttemptById(storedAnalysis.attemptId) || storedAnalysis;
      }
    }

    if (!attemptRecord) {
      showAnalyseErrorCard('No test attempt found to analyse.');
      return;
    }

    activeState = attemptRecord.state || attemptRecord;
    testData = attemptRecord.testData || activeState.testData || Storage.loadTestData();
    if (!testData) {
      showAnalyseErrorCard('No test data found for this attempt.');
      return;
    }
  } else {
    activeState = Storage.loadActiveAttempt();
    testData = (activeState && activeState.testData) || Storage.loadTestData();
    if (!testData) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'samples/sample-full-test.json', false);
        xhr.send(null);
        if (xhr.status === 200) {
          const raw = JSON.parse(xhr.responseText);
          testData = (typeof Validator !== 'undefined' && Validator.normalise) ? Validator.normalise(raw) : raw;
          Storage.saveTestData(testData);
          Storage.saveOriginalTestData(testData);
        }
      } catch (e) {}
    }
    if (!testData) {
      window.location.replace('index.html' + (window.location.search || ''));
      return;
    }
    if (activeState && activeState.submitted) {
      window.location.replace('result.html');
      return;
    }
  }

  // ── Constants ───────────────────────────────────────────────────────────────
  const candidateName = (attemptRecord && attemptRecord.candidateName) || (activeState && activeState.candidateName) || Storage.loadCandidateName();
  const candidateMobile = (attemptRecord && attemptRecord.candidateMobile) || (activeState && activeState.candidateMobile) || Storage.loadCandidateMobile();
  const testMeta = (testData && testData.meta) || {};
  const isSectional = testMeta.testType === 'sectional';
  const sectionTimed = (!isSectional) && (testMeta.sectionTimed !== false);

  // ── Environment Lock Flags (Issue 3) ───────────────────────────────────────
  const LOCK_SELECTION = true;
  const LOCK_PAGE_SCROLL = true;

  // ── Active timers ───────────────────────────────────────────────────────────
  let mainTimerId = null;
  let qTimerId = null;
  let qElapsed = 0;

  // ── Screen tracking & lock states ───────────────────────────────────────────
  let currentScreenName = null;
  let _scrollWarningTimeout = null;

  // ── Screens ─────────────────────────────────────────────────────────────────
  const screenInstructions = document.getElementById('screen-instructions');
  const screenDeclaration = document.getElementById('screen-declaration');
  const screenExam = document.getElementById('screen-exam');

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const elHeader = document.getElementById('exam-header') || document.querySelector('.headergrup');
  const elSectionTabs = document.getElementById('section-tabs') || document.getElementById('sections');
  const elQMeta = document.getElementById('question-meta') || document.querySelector('.questionTypeCont');
  const elQArea = document.getElementById('question-area') || document.querySelector('.leftDiv') || document.getElementById('quesOuterDiv');
  const elPalette = document.getElementById('palette-panel') || document.getElementById('numberpanelQues');
  const elQTimer = document.getElementById('q-timer');
  const elFooter = document.getElementById('exam-footer') || document.getElementById('footer');
  const elPaletteToggle = document.querySelector('.collapse_icon') || document.getElementById('palette-toggle');
  const elPaletteDrawer = document.getElementById('palette-drawer'); // mobile drawer
  const elFloatPaletteBtn = document.getElementById('float-palette-btn');

  // Bottom action buttons
  const btnMarkReview = document.getElementById('underreview') || document.getElementById('btn-mark-review');
  const btnClear = document.getElementById('clearResponse') || document.getElementById('btn-clear');
  const btnPrev = document.getElementById('previousBtn') || document.getElementById('btn-prev');
  const btnSaveNext = document.getElementById('savenext') || document.getElementById('btn-save-next');
  const btnSubmit = document.getElementById('finalSubmit') || document.getElementById('btn-submit');

  // Modal refs
  const modalInstructions = document.getElementById('modal-instructions');
  const modalQPaper = document.getElementById('modal-qpaper');
  const modalSubmit = document.getElementById('modal-submit');
  const modalSectionEnd = document.getElementById('modal-section-end');

  // ── Fullscreen management (Issue 5) ─────────────────────────────────────────
  let enteredFullscreen = false;
  function requestFullScreen() {
    const el = document.documentElement;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (rfs) {
      try {
        const p = rfs.call(el);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (_) {}
    }
  }

  function exitFullScreen() {
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (efs && isFs) {
      try {
        const p = efs.call(document);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (_) {}
    }
    const banner = document.getElementById('fullscreen-warning-banner');
    if (banner) banner.style.display = 'none';
  }

  function checkFullScreenStatus() {
    if (ANALYSE_MODE || currentScreenName !== 'exam' || new URLSearchParams(window.location.search).get('test') === '1') {
      const banner = document.getElementById('fullscreen-warning-banner');
      if (banner) banner.style.display = 'none';
      return;
    }
    const isFs = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    const banner = document.getElementById('fullscreen-warning-banner');
    if (banner) {
      if (isFs) enteredFullscreen = true;
      banner.style.display = enteredFullscreen && !isFs ? 'flex' : 'none';
    }
  }

  // ── Scroll & selection locks (Issue 3) ───────────────────────────────────────
  function showScrollWarningBanner() {
    if (currentScreenName !== 'exam' || ANALYSE_MODE) return;
    const banner = document.getElementById('scroll-warning-banner');
    if (!banner) return;
    banner.style.display = 'block';
    banner.style.opacity = '1';
    if (_scrollWarningTimeout) clearTimeout(_scrollWarningTimeout);
    _scrollWarningTimeout = setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 200);
    }, 3000);
  }

  function isInsideScrollablePanel(el) {
    let curr = el;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      if (
        curr.id === 'question_area' ||
        curr.id === 'num_panel_box' ||
        curr.id === 'question-area' ||
        curr.id === 'passage-panel' ||
        curr.id === 'groupInstructionContextOverflow' ||
        curr.id === 'passageResizer' ||
        curr.classList?.contains('bmt-column-resizer') ||
        curr.id === 'quesAnsContent' ||
        curr.classList?.contains('leftDiv') ||
        curr.classList?.contains('question-panel-split') ||
        curr.classList?.contains('question-panel') ||
        curr.id === 'right-panel' ||
        curr.id === 'col2' ||
        curr.id === 'mobile-palette-content' ||
        curr.classList?.contains('palette-drawer-panel') ||
        curr.classList?.contains('modal-body') ||
        curr.classList?.contains('bmt-modal-body') ||
        curr.classList?.contains('inst-scroll-area')
      ) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  // ── Expired sections check on resume ────────────────────────────────────────
  function checkExpiredSectionsOnResume() {
    const state = State.getState();
    if (isSectional || !sectionTimed) {
      if (State.getActiveTimerEnd() <= Date.now()) {
        State.leaveQuestion('SUBMIT', State.getCurrentQState().selectedOption);
        State.submitExam();
      }
      return;
    }
    const now = Date.now();
    let si = state.currentSectionIndex;

    while (si < testData.sections.length) {
      const startTs = state.sectionStartTimestamps && state.sectionStartTimestamps[si];
      if (!startTs) {
        State.startSection(si);
        break;
      }
      const durMs = (testData.sections[si].durationMinutes || 20) * 60 * 1000;
      const endTs = startTs + durMs;
      if (now >= endTs) {
        State.leaveQuestion('SUBMIT', State.getCurrentQState().selectedOption);
        if (si < testData.sections.length - 1) {
          State.advanceSection('time-out');
          si = State.getState().currentSectionIndex;
          state.sectionStartTimestamps[si] = endTs;
          state.sectionEndTimestamps[si] = endTs + testData.sections[si].durationMinutes * 60000;
          State.getCurrentQState().lastVisitedAt = endTs;
        } else {
          State.advanceSection('time-out');
          State.submitExam();
          Storage.saveActiveAttempt(State.getState());
          break;
        }
      } else {
        state.sectionEndTimestamps[si] = endTs;
        break;
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    window.__initCalled = true;
    if (typeof Renderer !== 'undefined' && Renderer.applyUiScale) {
      Renderer.applyUiScale();
    }
    if (isCompareMode) {
      const directFooter = document.getElementById('footer');
      if (directFooter) directFooter.textContent = 'Version : 17.07.00';
    }

    if (ANALYSE_MODE) {
      // Skip instructions, go straight to exam screen with read-only state, starting at Q1
      try {
        if (activeState && !activeState.testData && testData) {
          activeState.testData = testData;
        }
        State.setState(activeState);
        const st = State.getState();
        st.currentQuestionFlatIndex = 0;
        st.currentSectionIndex = 0;
        showScreen('exam');
        renderAll();
        initAnalyseControls();
      } catch(err) {
        window.__analyseInitError = String(err) + ' ' + (err && err.stack);
        console.error('ANALYSE INIT ERROR:', err);
      }
      return;
    }

    // Check if resuming
    if (activeState && !activeState.submitted) {
      State.setState(activeState);
      checkExpiredSectionsOnResume();
      if (State.getState().submitted) {
        finaliseAndRedirect();
        return;
      }
      showScreen('exam');
      renderAll();
      startTimers();
      bindExamEvents();
      bindBeforeUnload();
      return;
    }

    // Fresh start: build state, show instructions
    const state = State.buildFreshState(testData, candidateName, candidateMobile);
    State.setState(state);
    showScreen('instructions');
    renderInstructionsContent();
  }

  // ── Screen transitions ──────────────────────────────────────────────────────
  function showScreen(name) {
    currentScreenName = name;
    window.currentScreenName = name;
    [screenInstructions, screenDeclaration, screenExam].forEach(s => {
      if (s) s.style.display = 'none';
    });
    const target = { instructions: screenInstructions, declaration: screenDeclaration, exam: screenExam }[name];
    if (target) target.style.display = 'flex';

    document.body.classList.remove('screen-instructions-active', 'screen-declaration-active');
    document.documentElement.classList.remove('screen-instructions-active', 'screen-declaration-active');

    if (ANALYSE_MODE) {
      document.body.classList.add('exam-selection-locked');
      const fsBanner = document.getElementById('fullscreen-warning-banner');
      if (fsBanner) fsBanner.style.display = 'none';
      const scBanner = document.getElementById('scroll-warning-banner');
      if (scBanner) scBanner.style.display = 'none';
    } else if (name === 'exam') {
      if (LOCK_SELECTION) {
        document.body.classList.add('exam-selection-locked');
      }
      if (LOCK_PAGE_SCROLL) {
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100%';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100%';
      }
      checkFullScreenStatus();
      if (typeof Renderer !== 'undefined' && Renderer.showReducedToast) {
        Renderer.showReducedToast();
      }
    } else {
      document.body.classList.remove('exam-selection-locked');
      const fsBanner = document.getElementById('fullscreen-warning-banner');
      if (fsBanner) fsBanner.style.display = 'none';
      const scBanner = document.getElementById('scroll-warning-banner');
      if (scBanner) scBanner.style.display = 'none';
      if (LOCK_PAGE_SCROLL && name !== 'exam') {
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.height = 'auto';
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
      }
      if (name === 'instructions') {
        document.body.classList.add('screen-instructions-active');
        document.documentElement.classList.add('screen-instructions-active');
      } else if (name === 'declaration') {
        document.body.classList.add('screen-declaration-active');
        document.documentElement.classList.add('screen-declaration-active');
      }
    }
  }

  // ── Instructions screen ─────────────────────────────────────────────────────
  function renderInstructionsContent() {
    const cName = candidateName || 'Candidate';
    document.querySelectorAll('.candOrigName, .candOriginalName, .decl-cand-name, .userName, #decl-cand-name').forEach(cn => {
      cn.textContent = cName;
    });

    const meta = testData ? testData.meta : null;
    if (meta) {
      document.querySelectorAll('.instMockName, .mockName').forEach(el => {
        el.textContent = meta.examName;
      });
      const totalDuration = testData.meta.durationMinutes || testData.sections.reduce((s, sec) => s + sec.durationMinutes, 0);
      document.querySelectorAll('.completeDuration').forEach(el => {
        el.textContent = totalDuration;
      });
    }
  }

  function renderDeclarationContent() {
    const cName = candidateName || 'Candidate';
    document.querySelectorAll('.candOrigName, .candOriginalName, .decl-cand-name, .userName, #decl-cand-name').forEach(cn => {
      cn.textContent = cName;
    });

    const cMobile = candidateMobile || (typeof Storage !== 'undefined' ? Storage.loadCandidateMobile() : '');
    if (cMobile) {
      document.querySelectorAll('.mockCandId, .candId').forEach(ci => {
        ci.textContent = cMobile;
      });
    }

    const meta = testData ? testData.meta : null;
    if (meta) {
      document.querySelectorAll('.instMockName, .mockName').forEach(el => {
        el.textContent = meta.examName;
      });
    }

    const el = document.getElementById('declaration-body');
    if (!el || !testData) return;

    const totalDuration = testData.meta.durationMinutes || testData.sections.reduce((s, sec) => s + sec.durationMinutes, 0);
    const sectionRows = testData.sections ? testData.sections.map(s =>
      `<tr><td style="padding:6px 10px;border:1px solid #d0d7de;font-weight:600;">${s.name}</td><td style="padding:6px 10px;border:1px solid #d0d7de;text-align:center;">${s.questions.length}</td><td style="padding:6px 10px;border:1px solid #d0d7de;text-align:center;">${sectionTimed || isSectional ? s.durationMinutes + ' min' : 'Shared timer'}</td><td style="padding:6px 10px;border:1px solid #d0d7de;text-align:center;">${testData.meta.practiceMode ? '—' : s.cutoff}</td></tr>`
    ).join('') : '';

    el.innerHTML = `
      <div style="font-size:13px; color:#24292f; line-height:1.65; max-width:98%;">
        <p style="margin-bottom:8px;"><strong>Exam:</strong> ${meta.examName} – ${meta.testName}</p>
        <p style="margin-bottom:8px;"><strong>Assessment Type:</strong> ${isSectional ? (testData.meta.practiceMode === 'drill' ? 'Speed drill (Single ' : 'Sectional Mock Test (Single ') + totalDuration + '-minute timer)' : (sectionTimed ? 'Full Mock Test (Section-timed: ' + totalDuration + ' mins total)' : 'Full Mock Test (Free Navigation: ' + totalDuration + ' mins total)')}</p>
        <p style="margin-bottom:12px;"><strong>Marking Scheme:</strong> +${meta.marksPerQuestion} mark for correct answers, -${meta.negativeMarking} penalty for wrong answers.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px;background:#f6f8fa;border:1px solid #d0d7de;font-size:12.5px;">
          <tr style="background:#4D8CCA;color:#fff;">
            <th style="padding:6px 10px;text-align:left;">Section</th>
            <th style="padding:6px 10px;text-align:center;">Questions</th>
            <th style="padding:6px 10px;text-align:center;">Duration</th>
            <th style="padding:6px 10px;text-align:center;">Cut-off</th>
          </tr>
          ${sectionRows}
        </table>
        <p style="margin-bottom:8px;font-weight:bold;color:#147EB3;">Please note the following examination guidelines:</p>
        <ul style="padding-left:22px;margin-bottom:12px;">
          <li>All questions are objective type Multiple Choice Questions (MCQ).</li>
          ${(!isSectional && sectionTimed) ? `
          <li><strong>Sectional Timing:</strong> Each section has a dedicated countdown timer. Sections must be attempted sequentially in the order given above.</li>
          <li>Only the currently active section is accessible. Question navigation, palette, and Question Paper work strictly for the open section.</li>
          <li>Once you submit a section or its time expires, it is permanently locked and you cannot return to or modify your answers.</li>
          <li>The countdown timer in the top-right corner displays the remaining time for the <strong>current section</strong>. When it expires, you will automatically transition to the next section.</li>
          <li><strong>Save &amp; Next</strong> on the last question of a section wraps around to Question 1 of the same section.</li>
          ` : `
          <li>The countdown timer in the top right corner of the screen will display the remaining time available for you to complete the examination.</li>
          <li>When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination manually.</li>
          <li>You can navigate between questions using the Question Palette on the right side of the screen.</li>
          `}
          <li>Click on <strong>Save &amp; Next</strong> to save your answer for the current question and then go to the next question.</li>
          <li>Click on <strong>Mark for Review &amp; Next</strong> to save your answer (if selected) or mark it for review, and then go to the next question.</li>
        </ul>
      </div>
    `;
  }

  const btnNext = document.getElementById('instPaginationa') || document.getElementById('btn-next-to-declaration');
  btnNext?.addEventListener('click', () => {
    showScreen('declaration');
    renderDeclarationContent();
  });

  const btnBack = document.getElementById('PreviousInst') || document.getElementById('btn-back-to-instructions');
  btnBack?.addEventListener('click', () => {
    showScreen('instructions');
    renderInstructionsContent();
  });

  const declCheckbox = document.getElementById('decl-checkbox') || document.getElementById('disclaimer');
  const btnBegin = document.getElementById('readylink') || document.getElementById('btn-begin');

  declCheckbox?.addEventListener('change', () => {
    if (btnBegin) {
      btnBegin.disabled = !declCheckbox.checked;
      btnBegin.setAttribute('aria-disabled', String(!declCheckbox.checked));
    }
  });

  btnBegin?.addEventListener('click', () => {
    try {
      if (!declCheckbox?.checked) {
        console.warn('declCheckbox is not checked!');
        return;
      }
      State.setState(State.buildFreshState(testData, candidateName, candidateMobile));
      requestFullScreen();
      showScreen('exam');
      // Visit first question
      State.visitQuestion(0);
      State.getState().currentSectionIndex = 0;
      State.getState().currentQuestionFlatIndex = 0;
      persistState();
      renderAll();
      startTimers();
      bindExamEvents();
      bindBeforeUnload();
    } catch(err) {
      console.error('[CRITICAL ERROR in btnBegin click]:', err);
      window.__beginError = err.stack || err.toString();
    }
  });

  // ── Render all ──────────────────────────────────────────────────────────────
  function renderAll() {
    const state = State.getState();
    const meta = testData.meta;

    // Watermark (apply only once; backgroundImage persists across re-renders)
    const qArea = document.getElementById('question-area-wrap');
    if (qArea && !qArea._watermarkApplied) {
      applyWatermark(qArea, candidateName);
      qArea._watermarkApplied = true;
    }

    // Header
    Renderer.renderHeader(elHeader, {
      examName: meta.examName,
      testName: meta.testName,
      candidateName,
      isReview: ANALYSE_MODE,
    });
    bindHeaderButtons();

    // Section tabs
    const timerEnd = ANALYSE_MODE ? null : State.getActiveTimerEnd();
    const timerText = timerEnd ? Timer.formatMMSS(Timer.secondsLeft(timerEnd)) : '—';
    Renderer.renderSectionTabs(elSectionTabs, {
      sections: testData.sections,
      currentSectionIndex: state.currentSectionIndex,
      sectionCompleted: state.sectionCompleted,
      isSectional,
      timerText,
      isReview: ANALYSE_MODE,
      sectionTimed,
    });
    bindSectionTabs();

    // Question meta
    const qData = State.getCurrentQuestionData();
    const marks = qData.marks ?? testData.meta.marksPerQuestion ?? 1;
    const negative = qData.negative ?? qData.negativeMarks ?? testData.meta.negativeMarking ?? 0.25;
    Renderer.renderQuestionMeta(elQMeta, { marks, negative });

    // Question
    const flatIdx = state.currentQuestionFlatIndex;
    const qIndexInSection = state.questions[flatIdx].questionIndex;
    const displayNum = qIndexInSection + 1;

    const isReattempt = ANALYSE_MODE && reattemptState.active;
    const reattemptAnswer = isReattempt ? reattemptState.answers[flatIdx] : null;
    const origQState = (attemptRecord && attemptRecord.state && attemptRecord.state.questions && attemptRecord.state.questions[flatIdx]) || state.questions[flatIdx];
    const originalTimeSpent = origQState ? origQState.timeSpent : 0;

    Renderer.renderQuestion(elQArea, {
      qData,
      qState: origQState || State.getCurrentQState(),
      questionNumber: displayNum,
      isReview: ANALYSE_MODE,
      isReattempt,
      reattemptAnswer,
      qElapsed: isReattempt ? (reattemptAnswer ? reattemptAnswer.timeSpent : reattemptQElapsed) : qElapsed,
      originalTimeSpent,
    });
    bindOptionSelection();

    // Palette (desktop)
    Renderer.renderPalette(elPalette, {
      sections: testData.sections,
      questions: state.questions,
      currentSectionIndex: state.currentSectionIndex,
      currentFlatIndex: flatIdx,
      isReview: ANALYSE_MODE,
      isReattempt,
      reattemptAnswers: reattemptState.answers,
      reattemptQueue: reattemptState.queue,
      filter: _analyseFilter,
      avgTime: computeSectionAvgTime(state.currentSectionIndex),
    });
    bindPaletteButtons();
    if (ANALYSE_MODE) updatePaletteFilterUI();

    // Mobile drawer: sync palette HTML into the drawer panel
    const mobileContent = document.getElementById('mobile-palette-content');
    if (mobileContent && elPalette) {
      mobileContent.innerHTML = elPalette.innerHTML;
      // Re-bind palette buttons inside drawer
      mobileContent.querySelectorAll('.palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const fi = parseInt(btn.dataset.flatIndex, 10);
          if (isNaN(fi)) return;
          // Close drawer
          mobilePaletteOpen = false;
          if (elPaletteDrawer) elPaletteDrawer.classList.remove('open');
          // Navigate
          if (!ANALYSE_MODE && !isSectional && sectionTimed) {
            const targetSi = state.questions[fi].sectionIndex;
            if (targetSi !== state.currentSectionIndex) return;
          } else if (!ANALYSE_MODE && !isSectional) {
            const targetSi = state.questions[fi].sectionIndex;
            if (state.sectionCompleted[targetSi]) return;
          }
          if (!ANALYSE_MODE && fi === state.currentQuestionFlatIndex) return;
          stopQTimer();
          const sel = getSelectedOption();
          State.navigateTo(fi, sel);
          state.currentSectionIndex = state.questions[fi].sectionIndex;
          persistState();
          renderAll();
          if (!ANALYSE_MODE) startQTimer();
        });
      });
      // Submit button inside mobile drawer
      mobileContent.querySelector('.btn-submit-palette')?.addEventListener('click', () => {
        mobilePaletteOpen = false;
        if (elPaletteDrawer) elPaletteDrawer.classList.remove('open');
        if (!ANALYSE_MODE) openSubmitModal();
      });
    }

    // Bottom action row visibility in analyse vs exam mode
    if (ANALYSE_MODE) {
      // Hide exam action buttons
      ['underreview', 'clearResponse', 'savenext', 'finalSubmit', 'finalSubmitMbl', 'savenextGroup'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = 'none';
      });
      // Show and enable analyse buttons
      const btnPrev = document.getElementById('previousBtn');
      if (btnPrev) {
        btnPrev.style.display = 'inline-block';
        btnPrev.style.pointerEvents = 'auto';
        btnPrev.style.opacity = '1';
      }
      const btnNext = document.getElementById('btnAnalyseNext');
      if (btnNext) btnNext.style.display = 'inline-block';
      const btnBackRes = document.getElementById('btnAnalyseBackResult');
      if (btnBackRes) {
        btnBackRes.style.display = 'inline-block';
        if (attemptRecord && attemptRecord.attemptId) {
          btnBackRes.href = `result.html?attempt=${attemptRecord.attemptId}`;
        }
      }

      // Top bar
      const topBar = document.getElementById('analyse-top-bar');
      if (topBar) topBar.style.display = 'flex';
      const btnTopBack = document.getElementById('btn-back-to-results');
      if (btnTopBack && attemptRecord && attemptRecord.attemptId) {
        btnTopBack.href = `result.html?attempt=${attemptRecord.attemptId}`;
      }

      // Hide legacy top filter bar
      const oldFilterBar = document.getElementById('analyse-filter-bar');
      if (oldFilterBar) oldFilterBar.style.display = 'none';

      // Update palette filter container (Follow-up C)
      updatePaletteFilterUI();
    } else {
      // Live exam mode: previousBtn visible and enabled when not on first question of section
      const btnPrev = document.getElementById('previousBtn');
      if (btnPrev) {
        if (qIndexInSection > 0) {
          btnPrev.style.display = 'inline-block';
          btnPrev.style.pointerEvents = 'auto';
          btnPrev.style.opacity = '1';
        } else {
          btnPrev.style.display = 'none';
          btnPrev.style.pointerEvents = 'none';
          btnPrev.style.opacity = '0.5';
        }
      }
    }
  }


  // ── Watermark ───────────────────────────────────────────────────────────────
  function applyWatermark(container, text) {
    const t = encodeURIComponent(text);
    // Create repeating SVG watermark via data URI
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='120'>
      <text x='50%' y='60' text-anchor='middle' dominant-baseline='middle'
        fill='rgba(0,0,0,0.07)' font-size='22' font-family='Arial,sans-serif'
        transform='rotate(-25 150 60)'>${text}</text>
    </svg>`;
    const dataUri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    container.style.backgroundImage = dataUri;
    container.style.backgroundRepeat = 'repeat';
    container.style.backgroundSize = '300px 120px';
  }

  // ── Timers ──────────────────────────────────────────────────────────────────
  function startTimers() {
    if (ANALYSE_MODE) return;
    Timer.stopAll();

    mainTimerId = Timer.createCountdown({
      endTimestamp: () => State.getActiveTimerEnd(),
      onTick: ({ secondsLeft }) => {
        Renderer.renderTimer(Timer.formatMMSS(secondsLeft));
      },
      onExpire: onTimerExpire,
    });

    startQTimer();
  }

  function startQTimer() {
    if (qTimerId) Timer.stop(qTimerId);
    qElapsed = State.getCurrentQState().timeSpent;
    const base = qElapsed;
    const startMs = Date.now();
    qTimerId = Timer.createStopwatch(({ elapsed }) => {
      qElapsed = base + elapsed;
      Renderer.renderQTimer(qElapsed);
    });
  }

  function stopQTimer() {
    if (qTimerId) { Timer.stop(qTimerId); qTimerId = null; }
  }

  let _transitionTimerId = null;

  function showSectionTransitionModal({ title, message, autoSec = 5, onProceed }) {
    closeAllModals();
    stopQTimer();
    Timer.stopAll();

    const modal = document.getElementById('modal-section-transition');
    if (!modal) {
      if (typeof onProceed === 'function') onProceed();
      return;
    }

    const titleEl = document.getElementById('modal-section-transition-title');
    const msgEl = document.getElementById('modal-section-transition-msg');
    const timerEl = document.getElementById('modal-section-transition-timer');
    const countEl = document.getElementById('transition-countdown');
    const btnOk = document.getElementById('btn-section-transition-ok');

    if (titleEl) titleEl.textContent = title || 'Section Transition';
    if (msgEl) msgEl.textContent = message || '';

    let timeLeft = autoSec;
    if (countEl) countEl.textContent = timeLeft;
    if (timerEl) timerEl.style.display = 'block';

    let proceedDone = false;
    function handleProceed() {
      if (proceedDone) return;
      proceedDone = true;
      if (_transitionTimerId) {
        clearInterval(_transitionTimerId);
        _transitionTimerId = null;
      }
      modal.style.display = 'none';
      if (typeof onProceed === 'function') onProceed();
    }

    if (btnOk) {
      btnOk.onclick = handleProceed;
    }

    if (_transitionTimerId) clearInterval(_transitionTimerId);
    _transitionTimerId = setInterval(() => {
      timeLeft--;
      if (countEl) countEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        handleProceed();
      }
    }, 1000);

    modal.style.display = 'flex';
  }

  function onTimerExpire() {
    const state = State.getState();
    const sel = getSelectedOption();
    State.leaveQuestion('SUBMIT', sel);
    persistState();
    if (!isSectional && sectionTimed) {
      const currSi = state.currentSectionIndex;
      if (currSi >= testData.sections.length - 1) {
        autoSubmit();
      } else {
        const currSec = testData.sections[currSi];
        const nextSec = testData.sections[currSi + 1];
        showSectionTransitionModal({
          title: 'Section Time Over',
          message: `Time for section "${currSec.name}" is over. Moving to section "${nextSec.name}".`,
          autoSec: 5,
          onProceed: () => {
            State.advanceSection('time-out');
            persistState();
            renderAll();
            startTimers();
          }
        });
      }
    } else {
      autoSubmit();
    }
  }

  function autoSubmit() {
    stopQTimer();
    Timer.stopAll();
    const sel = getSelectedOption();
    State.leaveQuestion('SUBMIT', sel);
    State.submitExam();
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    finaliseAndRedirect();
  }

  // ── Persist state ───────────────────────────────────────────────────────────
  function persistState() {
    Storage.saveActiveAttempt(State.getState());
  }

  // ── Before-unload ───────────────────────────────────────────────────────────
  function beforeUnloadHandler(e) {
    if (new URLSearchParams(window.location.search).get('test') === '1') return;
    e.preventDefault();
    e.returnValue = 'Your exam is in progress. Are you sure you want to leave?';
    return e.returnValue;
  }

  function bindBeforeUnload() {
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  // ── Bind events ─────────────────────────────────────────────────────────────
  function bindHeaderButtons() {
    ['VI', 'VIMbl', 'btn-instructions'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        renderInstructionsModalContent();
        openModal(modalInstructions);
      });
    });

    ['viewQPButton', 'viewQPButtonMbl', 'btn-qpaper'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        renderQPaperContent();
        openModal(modalQPaper);
      });
    });
  }

  function bindSectionTabs() {
    document.querySelectorAll('#sections .subject-name, .section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const si = parseInt(tab.dataset.section, 10);
        if (isNaN(si)) return;
        const state = State.getState();

        if (ANALYSE_MODE) {
          if (reattemptState.active) {
            const sqs = State.getSectionQuestions(si);
            let targetFlat = -1;
            for (let q of sqs) {
              const fi = state.questions.indexOf(q);
              if (reattemptState.queue.includes(fi)) { targetFlat = fi; break; }
            }
            if (targetFlat >= 0) navigateToQuestion(targetFlat);
            return;
          }
          const sqs = State.getSectionQuestions(si);
          let targetFlat = -1;
          for (let q of sqs) {
            const fi = state.questions.indexOf(q);
            if (questionMatchesFilter(fi, _analyseFilter)) { targetFlat = fi; break; }
          }
          if (targetFlat < 0 && sqs.length > 0) targetFlat = state.questions.indexOf(sqs[0]);
          if (targetFlat >= 0) navigateToQuestion(targetFlat);
          return;
        }

        if (!isSectional && sectionTimed) {
          // Section-timed: tabs open strictly one at a time; clicking any other tab does nothing
          if (si !== state.currentSectionIndex) return;
        } else if (!isSectional) {
          // Full test with free navigation: can't go back to completed sections
          if (state.sectionCompleted[si] && si !== state.currentSectionIndex) return;
        }

        stopQTimer();
        const sel = getSelectedOption();
        State.leaveQuestion('NAV', sel);
        State.recordTimeForCurrent();
        state.currentSectionIndex = si;
        // Navigate to first question in section
        const sqs = State.getSectionQuestions(si);
        const firstFlat = state.questions.indexOf(sqs[0]);
        state.currentQuestionFlatIndex = firstFlat;
        State.visitQuestion(firstFlat);
        persistState();
        renderAll();
        if (!ANALYSE_MODE) startQTimer();
      });
    });
  }

  function bindPaletteButtons() {
    document.querySelectorAll('#numberpanelQues span.numpan, .palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const flatIdx = parseInt(btn.id || btn.dataset.flatIndex, 10);
        if (isNaN(flatIdx)) return;
        const state = State.getState();

        if (ANALYSE_MODE) {
          if (btn.classList.contains('palette-dimmed')) return;
          if (reattemptState.active && !reattemptState.queue.includes(flatIdx)) return;
          navigateToQuestion(flatIdx);
          return;
        }

        if (!isSectional && sectionTimed) {
          const targetSi = state.questions[flatIdx].sectionIndex;
          if (targetSi !== state.currentSectionIndex) return;
        } else if (!isSectional) {
          const targetSi = state.questions[flatIdx].sectionIndex;
          if (state.sectionCompleted[targetSi]) return;
        }

        if (flatIdx === state.currentQuestionFlatIndex) return;

        stopQTimer();
        const sel = getSelectedOption();
        State.navigateTo(flatIdx, sel);
        state.currentSectionIndex = state.questions[flatIdx].sectionIndex;
        persistState();
        renderAll();
        if (!ANALYSE_MODE) startQTimer();
      });
    });

    const submitBtns = [
      document.getElementById('finalSubmit'),
      document.getElementById('btn-submit-palette'),
      document.getElementById('btn-submit')
    ];
    submitBtns.forEach(btn => {
      btn?.addEventListener('click', () => {
        if (ANALYSE_MODE) return;
        openSubmitModal();
      });
    });
  }

  function bindOptionSelection() {
    document.querySelectorAll('input[name="answers"], input[name="option"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (ANALYSE_MODE) {
          if (reattemptState.active) {
            const chosen = parseInt(radio.value, 10);
            onReattemptOptionSelect(chosen);
          }
          return;
        }
        document.querySelectorAll('.optionLabel, .option-label').forEach(l => l.classList.remove('option-selected'));
        radio.closest('.optionLabel, .option-label')?.classList.add('option-selected');
        const chosen = parseInt(radio.value, 10);
        if (!isNaN(chosen)) {
          State.getCurrentQState().selectedOption = chosen;
          persistState();
        }
      });
    });

    if (ANALYSE_MODE) return;

    // Restore visual selection for current question
    const sel = State.getCurrentQState().selectedOption;
    if (sel) {
      const radio = document.querySelector(`input[name="answers"][value="${sel}"], input[name="option"][value="${sel}"]`);
      if (radio) {
        radio.checked = true;
        radio.closest('.optionLabel, .option-label')?.classList.add('option-selected');
      }
    }
  }

  // ── Action buttons ──────────────────────────────────────────────────────────
  function bindExamEvents() {
    btnSaveNext?.addEventListener('click', onSaveNext);
    btnMarkReview?.addEventListener('click', onMarkReview);
    btnClear?.addEventListener('click', onClear);
    btnPrev?.addEventListener('click', onPrev);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);

    // Palette toggle (desktop collapse / expand)
    setupPaletteCollapseControls();

    // Mobile floating button
    elFloatPaletteBtn?.addEventListener('click', toggleMobilePalette);

    // Bottom action bar Submit button
    [document.getElementById('finalSubmit'), document.getElementById('finalSubmitMbl'), document.getElementById('btn-submit')].forEach(b => {
      if (b) {
        b.disabled = false;
        b.removeAttribute('disabled');
        b.removeAttribute('title');
        b.addEventListener('click', () => openSubmitModal());
      }
    });

    // Modal closes
    document.querySelectorAll('.modal-close, .bmt-modal-close, .bmt-btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => closeAllModals());
    });
    document.querySelectorAll('.modal-overlay, .bmt-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAllModals();
      });
    });

    // Submit modal buttons
    document.getElementById('btn-confirm-submit')?.addEventListener('click', () => {
      closeAllModals();
      const state = State.getState();
      const isLastSec = isSectional || !sectionTimed || state.currentSectionIndex >= testData.sections.length - 1;
      if (isLastSec) {
        doSubmit();
      } else {
        const sel = getSelectedOption();
        State.leaveQuestion('SUBMIT', sel);
        persistState();
        const currSi = state.currentSectionIndex;
        const currSec = testData.sections[currSi];
        const nextSec = testData.sections[currSi + 1];
        showSectionTransitionModal({
          title: 'Section Submitted',
          message: `Section "${currSec.name}" submitted. Section "${nextSec.name}" is now open (${nextSec.durationMinutes} minutes).`,
          autoSec: 5,
          onProceed: () => {
            State.advanceSection('submitted');
            persistState();
            renderAll();
            startTimers();
          }
        });
      }
    });
    document.getElementById('btn-cancel-submit')?.addEventListener('click', closeAllModals);
    document.getElementById('btn-cancel-submit-x')?.addEventListener('click', closeAllModals);
  }

  function getSelectedOption() {
    const checked = document.querySelector('input[name="answers"]:checked, input[name="option"]:checked');
    return checked ? parseInt(checked.value, 10) : null;
  }

  function onSaveNext() {
    const sel = getSelectedOption();
    stopQTimer();
    State.saveAndNext(sel);
    persistState();
    renderAll();
    startQTimer();
  }

  function onMarkReview() {
    const sel = getSelectedOption();
    stopQTimer();
    State.markForReviewAndNext(sel);
    persistState();
    renderAll();
    startQTimer();
  }

  function onClear() {
    stopQTimer();
    State.getCurrentQState().lastVisitedAt = Date.now(); // keep tracking
    State.clearResponse();
    persistState();
    renderAll();
    startQTimer();
  }

  function onPrev() {
    stopQTimer();
    const sel = getSelectedOption();
    State.movePrev(sel);
    persistState();
    renderAll();
    startQTimer();
  }

  function handleKeyDown(e) {
    if (ANALYSE_MODE) return;
    // Don't fire if a modal is open or focus is on an input
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    // Prevent page-scrolling keys when focus is not inside an interactive control or scrollable panel
    const SCROLL_KEYS = [' ', 'Spacebar', 'PageUp', 'PageDown', 'Home', 'End'];
    if (LOCK_PAGE_SCROLL && SCROLL_KEYS.includes(e.key) && currentScreenName === 'exam') {
      const activeEl = document.activeElement;
      if (!isInsideScrollablePanel(activeEl) && !['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(activeEl?.tagName)) {
        e.preventDefault();
        showScrollWarningBanner();
      }
    }

    if (document.querySelector('.modal-overlay[style*="flex"], .bmt-modal-overlay[style*="flex"]')) return;

    const key = e.key.toUpperCase();
    if (key === 'N') { e.preventDefault(); (document.getElementById('savenext') || btnSaveNext)?.click(); }
    else if (key === 'P') { e.preventDefault(); (document.getElementById('previousBtn') || btnPrev)?.click(); }
    else if (key === 'M') { e.preventDefault(); (document.getElementById('underreview') || btnMarkReview)?.click(); }
    else if (['1','2','3','4','5'].includes(e.key)) {
      const radio = document.querySelector(`input[name="answers"][value="${e.key}"], input[name="option"][value="${e.key}"]`);
      if (radio && !radio.disabled) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  function openSubmitModal() {
    const sel = getSelectedOption();
    State.leaveQuestion('SUBMIT', sel);
    persistState();

    const state = State.getState();
    const isLastSec = isSectional || !sectionTimed || state.currentSectionIndex >= testData.sections.length - 1;
    const modalTitle = document.querySelector('#modal-submit .bmt-modal-header h2') || document.getElementById('modal-submit-title');
    const modalWarn = document.querySelector('#modal-submit .bmt-modal-body p') || document.getElementById('modal-submit-warning');
    const btnConfirm = document.getElementById('btn-confirm-submit');

    if (modalTitle) {
      modalTitle.textContent = isLastSec ? 'Submit Exam' : 'Submit Section';
    }
    if (modalWarn) {
      modalWarn.innerHTML = isLastSec
        ? '⚠ Are you sure you want to submit? This action cannot be undone.'
        : '⚠ Once you submit this section you cannot return to it.';
    }
    if (btnConfirm) {
      btnConfirm.textContent = isLastSec ? 'Submit Exam' : 'Submit Section';
    }

    // Refresh palette & counters so UI and modal summary match
    const elPal = document.getElementById('palette-panel') || document.getElementById('numberpanelQues');
    if (elPal) {
      Renderer.renderPalette(elPal, {
        sections: testData.sections,
        questions: state.questions,
        currentSectionIndex: state.currentSectionIndex,
        currentFlatIndex: state.currentQuestionFlatIndex,
        isReview: ANALYSE_MODE,
        isReattempt: false,
      });
      bindPaletteButtons();
    }

    const el = document.getElementById('submit-summary');
    if (el) {
      if (isLastSec) {
        Renderer.renderSubmitSummary(el, {
          sections: testData.sections,
          questions: state.questions,
        });
      } else {
        Renderer.renderSubmitSummary(el, {
          sections: testData.sections,
          questions: state.questions,
        }, state.currentSectionIndex);
      }
    }
    openModal(modalSubmit);
  }
  function promptSubmit() {
    openSubmitModal();
  }

  function doSubmit() {
    stopQTimer();
    Timer.stopAll();
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    const sel = getSelectedOption();
    State.leaveQuestion('SUBMIT', sel);
    State.submitExam();
    finaliseAndRedirect();
  }

  async function finaliseAndRedirect() {
    exitFullScreen();
    document.body.classList.remove('exam-selection-locked');
    document.documentElement.style.overflow = '';
    document.documentElement.style.height = '';
    document.body.style.overflow = '';
    document.body.style.height = '';
    const state = State.getState();
    // Capture integrity data from security layer
    let integ = null;
    if (window.BMT_SECURITY && typeof window.BMT_SECURITY.getIntegrity === 'function') {
      integ = window.BMT_SECURITY.getIntegrity();
    } else {
      const prevActive = Storage.loadActiveAttempt();
      if (prevActive && prevActive.integrity) {
        integ = prevActive.integrity;
      }
    }
    if (integ) {
      state.integrity = integ;
    }

    // Calculate results and save
    const results = State.calculateResults(state);
    if (integ) {
      results.integrity = integ;
    }
    const record = {
      ...results,
      attemptId: state.attemptId,
      testName: testData.meta.testName,
      examName: testData.meta.examName,
      candidateName,
      integrity: integ || results.integrity,
      state,             // full state for re-analysis
      testData,
    };
    Storage.saveActiveAttempt(state);
    try { await Storage.saveCompletedAttempt(record); }
    catch { alert('Your result could not be archived. Keep this tab open, free browser storage, then reload to save your submitted attempt.'); return; }
    Storage.saveActiveAttempt(state); // keep for result page
    window.location.replace('result.html');
  }

  // ── Palette collapse / expand (A2) ──────────────────────────────────────────
  function isPaletteCollapsed() {
    return document.body.classList.contains('is-palette-collapsed');
  }

  function setPaletteCollapsed(collapsed) {
    if (collapsed) {
      document.body.classList.add('is-palette-collapsed');
      sessionStorage.setItem('bmt_palette_collapsed', '1');
      const expandIcon = document.querySelector('.expand_icon');
      if (expandIcon) expandIcon.style.display = 'block';
    } else {
      document.body.classList.remove('is-palette-collapsed');
      sessionStorage.removeItem('bmt_palette_collapsed');
      const expandIcon = document.querySelector('.expand_icon');
      if (expandIcon) expandIcon.style.display = 'none';
    }
  }

  function togglePalette() {
    setPaletteCollapsed(!isPaletteCollapsed());
  }

  let _paletteCollapseBound = false;
  function setupPaletteCollapseControls() {
    if (_paletteCollapseBound) return;
    _paletteCollapseBound = true;

    // Palette collapse: ONE listener on the collapse tab icon (.collapse_icon) ONLY
    document.querySelectorAll('.collapse_icon').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setPaletteCollapsed(true);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setPaletteCollapsed(true);
        }
      });
    });

    // Palette expand: ONE listener on the expand tab icon (.expand_icon) ONLY
    document.querySelectorAll('.expand_icon, #showdet').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setPaletteCollapsed(false);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setPaletteCollapsed(false);
        }
      });
    });

    if ((sessionStorage.getItem('bmt_palette_collapsed') === '1' || window.innerWidth < 600) && !isCompareMode) {
      setPaletteCollapsed(true);
    } else {
      setPaletteCollapsed(false);
    }
  }

  // ── Mobile palette drawer ───────────────────────────────────────────────────
  let mobilePaletteOpen = false;
  function toggleMobilePalette() {
    mobilePaletteOpen = !mobilePaletteOpen;
    if (elPaletteDrawer) {
      elPaletteDrawer.classList.toggle('open', mobilePaletteOpen);
    }
  }

  // ── Modals ──────────────────────────────────────────────────────────────────
  function openModal(el) {
    if (!el) return;
    stopQTimer();
    el.style.display = 'flex';
  }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay, .bmt-modal-overlay').forEach(m => m.style.display = 'none');
    if (currentScreenName === 'exam' && !ANALYSE_MODE) {
      startQTimer();
    }
  }
  window.closeAllModals = closeAllModals;

  // Global modal escape key listener
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const openModals = Array.from(document.querySelectorAll('.modal-overlay, .bmt-modal-overlay')).filter(m => {
        const s = window.getComputedStyle(m);
        return s && s.display !== 'none';
      });
      if (openModals.length > 0) {
        e.preventDefault();
        closeAllModals();
      }
    }
  });

  // ── Analyse & Re-attempt Controller ─────────────────────────────────────────
  let _analyseFilter = 'all';
  let _avgTimePerQ = 0;

  const reattemptState = {
    active: false,
    scope: 'wrong-unattempted', // 'all' or 'wrong-unattempted'
    queue: [],                  // flat indices
    answers: {},                // flatIdx -> { selectedOption, isCorrect, timeSpent }
    timerId: null,
    qStartTime: null,
  };
  let reattemptQElapsed = 0;

  function computeSectionAvgTime(secIdx) {
    const qs = (attemptRecord && attemptRecord.state && attemptRecord.state.questions) || State.getState().questions;
    if (!qs || qs.length === 0) return 30;
    const secQs = qs.filter(q => q.sectionIndex === secIdx);
    if (!secQs || secQs.length === 0) return 30;
    const totalTime = secQs.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
    return Math.round(totalTime / secQs.length) || 30;
  }

  function questionMatchesFilter(flatIdx, filter) {
    if (!filter || filter === 'all') return true;
    const state = State.getState();
    const q = state.questions[flatIdx];
    if (!q) return false;
    const qData = testData.sections[q.sectionIndex]?.questions[q.questionIndex];
    if (!qData) return false;

    // In re-attempt mode with answer:
    if (ANALYSE_MODE && reattemptState.active && reattemptState.answers[flatIdx]) {
      const reAns = reattemptState.answers[flatIdx];
      if (filter === 'correct') return reAns.isCorrect;
      if (filter === 'wrong' || filter === 'incorrect') return !reAns.isCorrect;
    }

    const isAns = q.status === 'answered' || q.status === 'answered-marked';
    const isCorr = isAns && q.selectedOption === qData.correct;
    const isWrong = isAns && q.selectedOption !== qData.correct;
    const isSkipped = q.status === 'not-answered' || q.status === 'not_answered';
    const isUnseen = q.status === 'not-visited' || q.status === 'not_visited';
    const isMarked = q.status === 'marked' || q.status === 'answered-marked';
    const secAvg = computeSectionAvgTime(q.sectionIndex);
    const isSlow = (q.timeSpent || 0) > secAvg;

    if (filter === 'correct') return isCorr;
    if (filter === 'wrong' || filter === 'incorrect') return isWrong;
    if (filter === 'skipped') return isSkipped;
    if (filter === 'unseen') return isUnseen;
    if (filter === 'marked') return isMarked;
    if (filter === 'slow') return isSlow;
    return true;
  }

  function navigateToQuestion(flatIdx) {
    const state = State.getState();
    const targetQ = state.questions[flatIdx];
    if (!targetQ) return;
    state.currentQuestionFlatIndex = flatIdx;
    state.currentSectionIndex = targetQ.sectionIndex;
    renderAll();
    if (ANALYSE_MODE && reattemptState.active) {
      if (!reattemptState.answers[flatIdx]) {
        startReattemptQTimer();
      } else {
        stopReattemptQTimer();
      }
    }
  }

  function updatePaletteFilterUI() {
    const container = document.getElementById('analyse-filter-container');
    if (!container) return;
    if (!ANALYSE_MODE) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    const state = State.getState();
    const curSec = state.currentSectionIndex;
    const secQs = state.questions.filter(q => q.sectionIndex === curSec);
    const totalCount = secQs.length;
    let matchCount = 0;
    secQs.forEach(q => {
      const flat = state.questions.indexOf(q);
      if (questionMatchesFilter(flat, _analyseFilter)) matchCount++;
    });

    const countEl = document.getElementById('analyse-filter-count');
    if (countEl) {
      countEl.textContent = `${matchCount} of ${totalCount}`;
    }

    const selectEl = document.getElementById('analyse-filter-select');
    if (selectEl && selectEl.value !== _analyseFilter) {
      selectEl.value = _analyseFilter;
    }
  }

  function initAnalyseControls() {
    bindHeaderButtons();
    bindSectionTabs();
    bindPaletteButtons();

    // Modal closes
    document.querySelectorAll('.modal-close, .bmt-modal-close, .bmt-btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => closeAllModals());
    });
    document.querySelectorAll('.modal-overlay, .bmt-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAllModals();
      });
    });

    // Palette collapse / expand (A2 & Follow-up A)
    setupPaletteCollapseControls();

    // Filter dropdown listener (Follow-up C)
    const filterSelect = document.getElementById('analyse-filter-select');
    if (filterSelect) {
      filterSelect.value = _analyseFilter;
      filterSelect.onchange = () => {
        _analyseFilter = filterSelect.value;
        applyAnalyseFilter();
      };
    }
    updatePaletteFilterUI();

    // Mobile floating palette button
    elFloatPaletteBtn?.addEventListener('click', toggleMobilePalette);

    // Analyse bottom bar nav (Previous & Next)
    document.getElementById('previousBtn')?.addEventListener('click', () => {
      if (!ANALYSE_MODE) return;
      if (reattemptState.active) {
        const curFlat = State.getState().currentQuestionFlatIndex;
        const curPos = reattemptState.queue.indexOf(curFlat);
        if (curPos > 0) {
          stopReattemptQTimer();
          navigateToQuestion(reattemptState.queue[curPos - 1]);
        }
        return;
      }
      // Review mode: find previous matching filter
      const qs = State.getState().questions;
      const curFlat = State.getState().currentQuestionFlatIndex;
      let prevFlat = -1;
      for (let i = curFlat - 1; i >= 0; i--) {
        if (questionMatchesFilter(i, _analyseFilter)) {
          prevFlat = i;
          break;
        }
      }
      if (prevFlat >= 0) {
        navigateToQuestion(prevFlat);
      }
    });

    document.getElementById('btnAnalyseNext')?.addEventListener('click', () => {
      if (!ANALYSE_MODE) return;
      if (reattemptState.active) {
        const curFlat = State.getState().currentQuestionFlatIndex;
        const curPos = reattemptState.queue.indexOf(curFlat);
        if (curPos >= 0 && curPos < reattemptState.queue.length - 1) {
          stopReattemptQTimer();
          navigateToQuestion(reattemptState.queue[curPos + 1]);
        }
        return;
      }
      // Review mode: find next matching filter
      const qs = State.getState().questions;
      const curFlat = State.getState().currentQuestionFlatIndex;
      let nextFlat = -1;
      for (let i = curFlat + 1; i < qs.length; i++) {
        if (questionMatchesFilter(i, _analyseFilter)) {
          nextFlat = i;
          break;
        }
      }
      if (nextFlat >= 0) {
        navigateToQuestion(nextFlat);
      }
    });

    // Re-attempt controls initialization
    initReattemptControls();
  }

  function applyAnalyseFilter() {
    const state = State.getState();
    const curFlat = state.currentQuestionFlatIndex;
    if (!questionMatchesFilter(curFlat, _analyseFilter)) {
      // Find first matching question in current section or anywhere
      const curSec = state.currentSectionIndex;
      const secMatch = state.questions.findIndex((q, i) => q.sectionIndex === curSec && questionMatchesFilter(i, _analyseFilter));
      if (secMatch >= 0) {
        navigateToQuestion(secMatch);
        return;
      }
      const anyMatch = state.questions.findIndex((_, i) => questionMatchesFilter(i, _analyseFilter));
      if (anyMatch >= 0) {
        navigateToQuestion(anyMatch);
        return;
      }
    }
    renderAll();
  }

  // ── Re-attempt Implementation ───────────────────────────────────────────────
  function initReattemptControls() {
    const switchEl = document.getElementById('reattempt-switch');
    const labelEl = document.getElementById('reattempt-toggle-label');
    const allowReattempt = testData.meta && testData.meta.allowReattempt !== false;

    if (!allowReattempt) {
      if (switchEl) switchEl.disabled = true;
      if (labelEl) {
        labelEl.title = 'Re-attempts disabled for this test';
        labelEl.style.opacity = '0.5';
        labelEl.style.cursor = 'not-allowed';
      }
      return;
    }

    switchEl?.addEventListener('change', () => {
      if (switchEl.checked) {
        startReattemptMode();
      } else {
        stopReattemptMode();
      }
    });

    document.getElementById('reattempt-scope-select')?.addEventListener('change', (e) => {
      if (reattemptState.active) {
        reattemptState.scope = e.target.value;
        buildReattemptQueue();
        resetReattemptRound();
      }
    });

    document.getElementById('btn-reattempt-reset')?.addEventListener('click', () => {
      resetReattemptRound();
    });

    document.getElementById('btn-reattempt-finish')?.addEventListener('click', () => {
      finishReattemptRound();
    });

    document.getElementById('btn-close-reattempt-summary')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-reattempt-summary');
      if (modal) modal.style.display = 'none';
    });
    document.getElementById('btn-close-reattempt-summary-x')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-reattempt-summary');
      if (modal) modal.style.display = 'none';
    });
  }

  function startReattemptMode() {
    reattemptState.active = true;
    const scopeContainer = document.getElementById('reattempt-scope-container');
    const btnReset = document.getElementById('btn-reattempt-reset');
    const btnFinish = document.getElementById('btn-reattempt-finish');
    if (scopeContainer) scopeContainer.style.display = 'flex';
    if (btnReset) btnReset.style.display = 'inline-block';
    if (btnFinish) btnFinish.style.display = 'inline-block';

    reattemptState.scope = document.getElementById('reattempt-scope-select')?.value || 'wrong-unattempted';
    buildReattemptQueue();
    resetReattemptRound();
  }

  function stopReattemptMode() {
    stopReattemptQTimer();
    reattemptState.active = false;
    const scopeContainer = document.getElementById('reattempt-scope-container');
    const btnReset = document.getElementById('btn-reattempt-reset');
    const btnFinish = document.getElementById('btn-reattempt-finish');
    if (scopeContainer) scopeContainer.style.display = 'none';
    if (btnReset) btnReset.style.display = 'none';
    if (btnFinish) btnFinish.style.display = 'none';

    // Restore original state
    State.setState(attemptRecord.state || attemptRecord);
    renderAll();
  }

  function buildReattemptQueue() {
    const origQuestions = (attemptRecord.state && attemptRecord.state.questions) || attemptRecord.questions || State.getState().questions;
    let queue = [];

    origQuestions.forEach((q, idx) => {
      const qData = testData.sections[q.sectionIndex]?.questions[q.questionIndex];
      if (!qData) return;
      const isAns = q.status === 'answered' || q.status === 'answered-marked';
      const isWrong = isAns && q.selectedOption !== qData.correct;
      const isUnattempted = !isAns;

      if (reattemptState.scope === 'wrong-unattempted') {
        if (isWrong || isUnattempted) {
          queue.push(idx);
        }
      } else {
        queue.push(idx);
      }
    });

    if (queue.length === 0) {
      queue = origQuestions.map((_, i) => i);
      const sel = document.getElementById('reattempt-scope-select');
      if (sel) sel.value = 'all';
      reattemptState.scope = 'all';
    }
    reattemptState.queue = queue;
  }

  function resetReattemptRound() {
    stopReattemptQTimer();
    reattemptState.answers = {};
    const firstFlat = reattemptState.queue[0] || 0;
    navigateToQuestion(firstFlat);
    startReattemptQTimer();
  }

  function startReattemptQTimer() {
    stopReattemptQTimer();
    reattemptState.qStartTime = Date.now();
    reattemptQElapsed = 0;
    reattemptState.timerId = setInterval(() => {
      reattemptQElapsed = Math.floor((Date.now() - reattemptState.qStartTime) / 1000);
      const origQState = (attemptRecord.state && attemptRecord.state.questions && attemptRecord.state.questions[State.getState().currentQuestionFlatIndex]) || State.getCurrentQState();
      const origTime = origQState ? origQState.timeSpent : 0;
      const qTimerEl = document.getElementById('q-timer');
      if (qTimerEl) {
        qTimerEl.textContent = `Re-attempt Time: ${Timer.formatDuration(reattemptQElapsed)} | Original Time: ${Timer.formatDuration(origTime || 0)}`;
      }
    }, 1000);
  }

  function stopReattemptQTimer() {
    if (reattemptState.timerId) {
      clearInterval(reattemptState.timerId);
      reattemptState.timerId = null;
    }
  }

  function onReattemptOptionSelect(chosenOpt) {
    const flatIdx = State.getState().currentQuestionFlatIndex;
    if (reattemptState.answers[flatIdx]) return; // already answered

    stopReattemptQTimer();
    const timeSpent = Math.max(1, Math.floor((Date.now() - reattemptState.qStartTime) / 1000));
    const qData = State.getCurrentQuestionData();
    const isCorrect = chosenOpt === qData.correct;

    reattemptState.answers[flatIdx] = {
      selectedOption: chosenOpt,
      isCorrect: isCorrect,
      timeSpent: timeSpent,
    };

    renderAll();
  }

  async function finishReattemptRound() {
    stopReattemptQTimer();

    const totalQ = reattemptState.queue.length;
    const ansEntries = Object.entries(reattemptState.answers);
    const attempted = ansEntries.length;
    const correct = ansEntries.filter(([_, a]) => a.isCorrect).length;
    const wrong = ansEntries.filter(([_, a]) => !a.isCorrect).length;
    const notTried = totalQ - attempted;
    const totalTime = ansEntries.reduce((acc, [_, a]) => acc + (a.timeSpent || 0), 0);
    const avgTime = attempted > 0 ? Math.round(totalTime / attempted) : 0;

    const origQuestions = (attemptRecord.state && attemptRecord.state.questions) || attemptRecord.questions || [];
    let originalNet = 0;
    let newlyCorrect = 0;
    reattemptState.queue.forEach(idx => {
      const origQ = origQuestions[idx];
      const qData = testData.sections[origQ.sectionIndex]?.questions[origQ.questionIndex];
      const wasCorrect = origQ && qData && (origQ.status === 'answered' || origQ.status === 'answered-marked') && origQ.selectedOption === qData.correct;
      if (origQ && qData && ['answered','answered-marked'].includes(origQ.status)) {
        originalNet += wasCorrect ? qData.marks : -qData.negative;
      }

      const reAns = reattemptState.answers[idx];
      if (reAns && reAns.isCorrect && !wasCorrect) {
        newlyCorrect++;
      }
    });

    const marksPerQ = testData.meta.marksPerQuestion || 1;
    const negMark = testData.meta.negativeMarking ?? 0.25;
    const origScore = originalNet.toFixed(2);
    const newScore = ((correct * marksPerQ) - (wrong * negMark)).toFixed(2);

    const reattemptNum = (attemptRecord.reattempts?.length || 0) + 1;
    const reattemptRecord = {
      id: 'reattempt_' + Date.now(),
      name: `Re-attempt ${reattemptNum}`,
      date: new Date().toISOString(),
      scope: reattemptState.scope,
      totalQuestions: totalQ,
      attempted: attempted,
      correct: correct,
      wrong: wrong,
      notTried: notTried,
      totalTimeSeconds: totalTime,
      avgTimePerQ: avgTime,
      questionsImproved: newlyCorrect,
      originalScore: parseFloat(origScore),
      score: parseFloat(newScore),
      totalCorrect: correct,
      totalWrong: wrong,
    };

    try { await Storage.addReattemptToAttempt(attemptRecord.attemptId, reattemptRecord); }
    catch { alert('This review round could not be saved. Please free device storage and try again.'); return; }
    if (!Array.isArray(attemptRecord.reattempts)) attemptRecord.reattempts = [];
    attemptRecord.reattempts.push(reattemptRecord);

    const modalBody = document.getElementById('modal-reattempt-summary-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="font-size: 13px; color: #333; line-height: 1.6;">
          <p style="margin: 0 0 12px; font-weight: 600; font-size: 14px; color: #147eb3;">${reattemptRecord.name} Completed</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; background: #f8f9fa; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0; margin-bottom: 14px;">
            <div>Scope: <strong>${reattemptState.scope === 'all' ? 'All Questions' : 'Wrong + Unattempted'}</strong></div>
            <div>Total Questions: <strong>${totalQ}</strong></div>
            <div>Attempted: <strong style="color: #147eb3;">${attempted}</strong></div>
            <div>Not Tried: <strong style="color: #666;">${notTried}</strong></div>
            <div>Correct: <strong style="color: #28a745;">${correct}</strong></div>
            <div>Wrong: <strong style="color: #dc3545;">${wrong}</strong></div>
            <div>Total Time: <strong>${Timer.formatDuration(totalTime)}</strong></div>
            <div>Avg Time / Q: <strong>${Timer.formatDuration(avgTime)}</strong></div>
          </div>
          <div style="padding: 10px; background: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 4px; color: #2e7d32; font-weight: 500;">
            ✨ Improvement: <strong>+${newlyCorrect} questions improved</strong> (Score on scope: ${origScore} → ${newScore})
          </div>
        </div>
      `;
    }
    const modal = document.getElementById('modal-reattempt-summary');
    if (modal) modal.style.display = 'flex';
  }

  // ── Instructions modal content (D3) ─────────────────────────────────────────
  function renderInstructionsModalContent() {
    const el = document.getElementById('modal-instructions-body');
    if (!el) return;
    const meta = testData.meta;
    const totalDuration = testData.meta.durationMinutes || testData.sections.reduce((s, sec) => s + (sec.durationMinutes || 0), 0);
    const sectionRows = testData.sections.map(s =>
      `<tr><td style="padding:6px 12px; border:1px solid #ddd;">${s.name}</td><td style="padding:6px 12px; border:1px solid #ddd; text-align:center;">${s.questions.length}</td><td style="padding:6px 12px; border:1px solid #ddd; text-align:center;">${sectionTimed || isSectional ? s.durationMinutes + ' min' : 'Shared timer'}</td><td style="padding:6px 12px; border:1px solid #ddd; text-align:center;">${testData.meta.practiceMode ? '—' : s.cutoff ?? '-'}</td></tr>`
    ).join('');

    el.innerHTML = `
      <div style="border-bottom:1px solid #ddd; padding-bottom:12px; margin-bottom:16px;">
        <h2 style="font-size:18px; color:#147eb3; margin:0 0 6px;">${meta.examName}</h2>
        <h3 style="font-size:14px; color:#555; margin:0;">${meta.testName}</h3>
      </div>
      
      <div style="margin-bottom:16px;">
        <h4 style="font-size:14px; margin-bottom:8px; color:#222;">Section Breakdown</h4>
        <table style="width:100%; border-collapse:collapse; font-size:13px; border:1px solid #ddd;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:6px 12px; border:1px solid #ddd; text-align:left;">Section</th>
              <th style="padding:6px 12px; border:1px solid #ddd; text-align:center;">Questions</th>
              <th style="padding:6px 12px; border:1px solid #ddd; text-align:center;">Duration</th>
              <th style="padding:6px 12px; border:1px solid #ddd; text-align:center;">Cut-off</th>
            </tr>
          </thead>
          <tbody>
            ${sectionRows}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="font-size:14px; margin-bottom:8px; color:#222;">Marking Scheme & Duration</h4>
        <ul style="padding-left:20px; font-size:13px; line-height:1.6; color:#444;">
          <li>Total Duration: <strong>${totalDuration} minutes</strong></li>
          ${(!isSectional && sectionTimed) ? '<li>Assessment Mode: <strong>Section-Timed</strong> (Each section has a separate countdown timer; sections must be taken sequentially and lock permanently upon submit or time-out).</li>' : ''}
          <li>Correct Answer: <strong style="color:#28a745;">+${meta.marksPerQuestion} marks</strong></li>
          <li>Incorrect Answer: <strong style="color:#dc3545;">-${meta.negativeMarking} marks</strong></li>
          <li>Unattempted Question: <strong>0 marks</strong></li>
        </ul>
      </div>

      <div style="margin-bottom:16px;">
        <h4 style="font-size:14px; margin-bottom:8px; color:#222;">Question Palette Legend</h4>
        <table style="width:100%; border-collapse:collapse; font-size:12px; line-height:1.4;">
          <tr>
            <td style="padding:4px 8px; width:45px;"><span class="not_visited" style="display:inline-block; width:28px; height:24px; text-align:center; line-height:24px; background:#ddd; color:#000; font-weight:bold; border-radius:2px;">1</span></td>
            <td style="padding:4px 8px;">You have not visited the question yet.</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;"><span class="not_answered" style="display:inline-block; width:28px; height:24px; text-align:center; line-height:24px; background:#e74c3c; color:#fff; font-weight:bold; border-radius:2px;">2</span></td>
            <td style="padding:4px 8px;">You have not answered the question.</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;"><span class="answered" style="display:inline-block; width:28px; height:24px; text-align:center; line-height:24px; background:#2ecc71; color:#fff; font-weight:bold; border-radius:2px;">3</span></td>
            <td style="padding:4px 8px;">You have answered the question.</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;"><span class="review" style="display:inline-block; width:28px; height:24px; text-align:center; line-height:24px; background:#9b59b6; color:#fff; font-weight:bold; border-radius:2px;">4</span></td>
            <td style="padding:4px 8px;">You have NOT answered the question, but have marked the question for review.</td>
          </tr>
          <tr>
            <td style="padding:4px 8px;"><span class="review_answered" style="display:inline-block; width:28px; height:24px; text-align:center; line-height:24px; background:#8e44ad; color:#fff; font-weight:bold; border-radius:2px;">5</span></td>
            <td style="padding:4px 8px;">The question(s) "Answered and Marked for Review" will be considered for evaluation.</td>
          </tr>
        </table>
      </div>

      <div>
        <h4 style="font-size:14px; margin-bottom:8px; color:#222;">Navigating & Answering</h4>
        <ol style="padding-left:20px; font-size:13px; line-height:1.6; color:#444;">
          ${(!isSectional && sectionTimed) ? '<li><b>Sectional Timing:</b> Only the active section is open. Save &amp; Next on the last question wraps to question 1 of the same section. Submitting a section locks it permanently.</li>' : ''}
          <li>Click on <b>Save & Next</b> to save your answer for the current question and go to the next question.</li>
          <li>Click on <b>Mark for Review & Next</b> to save answer (if selected), mark it for review, and go to the next question.</li>
          <li>Click on <b>Clear Response</b> to deselect your chosen answer for the current question.</li>
          <li>To change your chosen answer, click on the button of another option and click <b>Save & Next</b>.</li>
        </ol>
      </div>
    `;
  }

  // ── Question Paper modal content (D3) ───────────────────────────────────────
  let selectedQPaperSectionIndex = null;
  function renderQPaperContent(sectionIdx) {
    const el = document.getElementById('modal-qpaper-body');
    if (!el) return;
    const state = State.getState();
    const currentSecIdx = state.currentSectionIndex;

    const isRestrictedToCurrent = !ANALYSE_MODE && !isSectional && sectionTimed;
    if (isRestrictedToCurrent) {
      selectedQPaperSectionIndex = currentSecIdx;
    } else {
      if (sectionIdx === undefined || sectionIdx === null) {
        selectedQPaperSectionIndex = currentSecIdx;
      } else {
        selectedQPaperSectionIndex = sectionIdx;
      }
    }

    const sec = testData.sections[selectedQPaperSectionIndex];
    if (!sec) return;

    // Section selector buttons if multiple sections exist
    let selectorHtml = '';
    if (isRestrictedToCurrent) {
      selectorHtml = `
        <div class="qpaper-section-selector" style="margin-bottom:16px; border-bottom:1px solid #e0e0e0; padding-bottom:10px;">
          <span style="font-weight:bold; color:#147eb3; font-size:14px;">Section: ${Sanitiser.sanitise(sec.name)}</span>
          <span style="color:#666; font-size:12px; margin-left:8px;">(${sec.questions.length} Questions | ${sec.durationMinutes} Minutes)</span>
        </div>
      `;
    } else if (testData.sections.length > 1) {
      const tabsHtml = testData.sections.map((s, idx) => {
        const isCompleted = !isSectional && sectionTimed && idx < currentSecIdx;
        const isActive = idx === selectedQPaperSectionIndex;
        const disabledAttr = isCompleted ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
        const activeStyle = isActive ? 'background:#147eb3; color:#fff; font-weight:bold;' : 'background:#fff; color:#333;';
        return `
          <button type="button" class="qpaper-sec-tab ${isActive ? 'active' : ''}" data-sec-idx="${idx}" ${disabledAttr} style="padding:6px 14px; margin-right:8px; border:1px solid #147eb3; border-radius:3px; cursor:pointer; font-size:13px; ${activeStyle}">
            ${s.name} ${isCompleted ? '(Completed)' : ''}
          </button>
        `;
      }).join('');
      selectorHtml = `<div class="qpaper-section-selector" style="margin-bottom:16px; border-bottom:1px solid #e0e0e0; padding-bottom:10px;">${tabsHtml}</div>`;
    }

    // Questions of this section
    const secQuestions = sec.questions;
    let questionsHtml = '';
    let currentPassage = null;

    secQuestions.forEach((q, localIdx) => {
      const flatIdx = state.questions.findIndex(sq => sq.id === q.id);
      const qState = (flatIdx >= 0 && state.questions[flatIdx]) ? state.questions[flatIdx] : { status: 'not_visited', selectedOption: null };

      // Status badge
      let statusBadge = '<span style="display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#e0e0e0; color:#555; margin-left:10px;">Not Visited</span>';
      if (qState.status === 'answered') {
        statusBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#28a745; color:#fff; margin-left:10px;">Answered: Option ${qState.selectedOption}</span>`;
      } else if (qState.status === 'answered-marked') {
        statusBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#6f42c1; color:#fff; margin-left:10px;">Answered & Marked: Option ${qState.selectedOption}</span>`;
      } else if (qState.status === 'marked') {
        statusBadge = '<span style="display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#6f42c1; color:#fff; margin-left:10px;">Marked for Review</span>';
      } else if (qState.status === 'not_answered') {
        statusBadge = '<span style="display:inline-block; padding:2px 8px; border-radius:3px; font-size:11px; background:#dc3545; color:#fff; margin-left:10px;">Not Answered</span>';
      }

      // Check if question has a passage or group image
      let passageHtml = '';
      const groupImg = q.groupImage || (q.groupId && !q.passage ? q.image : null);
      const passageKey = (q.passage || '') + '::' + (groupImg || '');
      if ((q.passage || groupImg) && passageKey !== currentPassage) {
        currentPassage = passageKey;
        let pDir = '';
        let pTbl = '';
        if (q.passage) {
          const rawP = q.passage;
          const tIdx = rawP.toLowerCase().indexOf('<table');
          if (tIdx >= 0) {
            pDir = rawP.substring(0, tIdx);
            pTbl = rawP.substring(tIdx);
          } else {
            pDir = rawP;
          }
        }
        let pContent = '';
        if (pDir.trim()) pContent += Sanitiser.sanitise(pDir);
        if (groupImg) pContent += Renderer.buildImageMarkup(groupImg, 'Directions diagram');
        if (pTbl.trim()) pContent += Sanitiser.sanitise(pTbl);

        passageHtml = `
          <div class="qpaper-passage-box" style="background:#f8f9fa; border:1px solid #dcdcdc; border-left:4px solid #147eb3; padding:12px 16px; margin:16px 0 12px; border-radius:3px;">
            <div style="font-weight:bold; color:#147eb3; font-size:12px; margin-bottom:6px; text-transform:uppercase;">Directions / Context:</div>
            <div class="qpaper-passage-text" style="font-size:var(--exam-font-size); line-height:1.5; color:#333;">${pContent}</div>
          </div>
        `;
      } else if (!q.passage && !groupImg) {
        currentPassage = null;
      }

      // Read-only options
      const optsHtml = q.options.map((opt, optI) => {
        const optNum = optI + 1;
        const isChosen = qState.selectedOption === optNum;
        return `
          <div class="qpaper-option-row" style="display:flex; align-items:flex-start; gap:8px; margin:6px 0; pointer-events:none;">
            <span style="display:inline-flex; align-items:center; margin-top:4px;">
              <input type="radio" disabled ${isChosen ? 'checked' : ''} style="margin:0; cursor:default;" />
            </span>
            <span class="qpaper-option-text" style="font-size:var(--exam-font-size); line-height:1.5; color:${isChosen ? '#147eb3; font-weight:bold;' : '#444;'}">
              ${optNum}. ${Sanitiser.sanitise(opt)}
            </span>
          </div>
        `;
      }).join('');

      const questionImg = (q.image && q.image !== groupImg) ? q.image : (!q.passage && !groupImg && q.image ? q.image : null);
      const imgHtml = questionImg ? Renderer.buildImageMarkup(questionImg, 'Question diagram') : '';

      questionsHtml += `
        ${passageHtml}
        <div class="qpaper-question-block qpaper-q-card" style="padding:14px; border-bottom:1px solid #eee; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-weight:bold; color:#222; font-size:14px;">Question ${localIdx + 1}</div>
            <div>${statusBadge}</div>
          </div>
          ${imgHtml}
          <div class="qpaper-question-text" style="font-size:var(--exam-font-size); line-height:1.5; margin-bottom:10px; color:#222;">
            ${Sanitiser.sanitise(q.question)}
          </div>
          <div class="qpaper-options-container" style="padding-left:12px;">
            ${optsHtml}
          </div>
        </div>
      `;
    });

    el.innerHTML = `
      ${selectorHtml}
      <div class="qpaper-questions-list" style="overflow-y:auto;">
        ${questionsHtml}
      </div>
    `;

    // Attach click listeners to section tabs in Question Paper
    el.querySelectorAll('.qpaper-sec-tab:not([disabled])').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        const targetSec = parseInt(e.currentTarget.dataset.secIdx, 10);
        renderQPaperContent(targetSec);
      });
    });
  }

  // Mobile palette backdrop close
  document.getElementById('palette-drawer-backdrop')?.addEventListener('click', () => {
    mobilePaletteOpen = false;
    if (elPaletteDrawer) elPaletteDrawer.classList.remove('open');
  });

  // Modal close buttons and backdrop dismiss
  document.querySelectorAll('.bmt-modal-close, .bmt-btn-cancel, .modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });
  document.querySelectorAll('.modal-overlay, .bmt-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeAllModals();
      }
    });
  });

  // ── Lightbox click-to-enlarge opener ─────────────────────────────────────────
  document.addEventListener('click', e => {
    const img = e.target.closest('.bmt-zoomable-image, .passage-content img, .question-image img');
    if (img && img.src && !img.closest('#modal-image-lightbox')) {
      const modal = document.getElementById('modal-image-lightbox');
      if (modal) {
        const lbImg = modal.querySelector('#lightbox-img');
        if (lbImg) {
          lbImg.src = img.src;
          lbImg.alt = img.alt || 'Enlarged diagram';
        }
        modal.style.display = 'flex';
      }
    }
  });

  // ── Global Environment Lock & Fullscreen Event Listeners ────────────────────
  ['contextmenu', 'copy', 'cut', 'paste', 'dragstart'].forEach(evtName => {
    document.addEventListener(evtName, e => {
      if (LOCK_SELECTION && currentScreenName === 'exam' && !ANALYSE_MODE) {
        e.preventDefault();
      }
    });
  });

  window.addEventListener('wheel', e => {
    if (!LOCK_PAGE_SCROLL || currentScreenName !== 'exam' || ANALYSE_MODE) return;
    if (window.innerWidth <= 900) return;
    if (e.target && (e.target.closest('#modal-instructions-body') || e.target.closest('#modal-qpaper-body') || e.target.closest('.bmt-modal-box'))) {
      return; // Exempt Instructions and Question Paper modal body
    }
    e.preventDefault();
    showScrollWarningBanner();
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    if (!LOCK_PAGE_SCROLL || currentScreenName !== 'exam' || ANALYSE_MODE) return;
    // On phones and touch screens keep page scrolling locked but allow touch scrolling inside question, passage, palette panels with no banner
    if (!isInsideScrollablePanel(e.target)) {
      e.preventDefault();
    }
  }, { passive: false });

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evtName => {
    document.addEventListener(evtName, checkFullScreenStatus);
  });

  document.getElementById('btn-return-fullscreen')?.addEventListener('click', () => {
    requestFullScreen();
  });

  window.openSubmitModal = openSubmitModal;
  window.promptSubmit = promptSubmit;
  window.closeAllModals = closeAllModals;
  window.renderAll = renderAll;

  init();

})();

if (typeof window !== 'undefined') {
  window.BMT_FILE_VERSIONS = window.BMT_FILE_VERSIONS || {};
  window.BMT_FILE_VERSIONS['exam.js'] = '20261018_125625';
}

