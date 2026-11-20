/**
 * state.js
 * Central application state and business logic.
 * All exam state lives here; storage.js handles persistence.
 */

const State = (() => {

  // ── State shape ────────────────────────────────────────────────────────────

  let _state = null;

  /**
   * Build a fresh attempt state for a given test + candidate.
   */
  function buildFreshState(testData, candidateName, candidateMobile) {
    const attemptId = `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const cName = candidateName || (typeof Storage !== 'undefined' ? Storage.loadCandidateName() : '') || 'Candidate';
    const cMobile = candidateMobile || (typeof Storage !== 'undefined' ? Storage.loadCandidateMobile() : '') || '';

    // Flat question list with metadata
    const questions = [];
    testData.sections.forEach((section, si) => {
      section.questions.forEach((q, qi) => {
        questions.push({
          sectionIndex: si,
          questionIndex: qi,
          questionId: q.id,
          status: 'not-visited', // not-visited | not-answered | answered | marked | answered-marked
          selectedOption: null,  // 1-based index or null
          timeSpent: 0,          // cumulative seconds on this question
          lastVisitedAt: null,   // Date.now() when last opened (null if not open)
        });
      });
    });

    // Section end timestamps
    const isSectional = testData.meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (testData.meta.sectionTimed === true || (testData.meta.testType === 'full' && testData.meta.sectionTimed !== false));
    const sectionStartTimestamps = {};
    const sectionEndTimestamps = [];
    let cursor = now;

    if (isSectional || !isSectionTimed) {
      // Single timer for the whole test
      const totalMins = isSectional
        ? (testData.sections.reduce((s, sec) => s + (sec.durationMinutes || 0), 0) || testData.meta.durationMinutes || 20)
        : (testData.meta.durationMinutes || testData.sections.reduce((s, sec) => s + (sec.durationMinutes || 0), 0) || 60);
      sectionStartTimestamps[0] = now;
      sectionEndTimestamps.push(now + totalMins * 60 * 1000);
    } else {
      // Per-section timers: only first section starts now
      testData.sections.forEach((sec, i) => {
        if (i === 0) {
          sectionStartTimestamps[0] = now;
          sectionEndTimestamps.push(now + (sec.durationMinutes || 20) * 60 * 1000);
        } else {
          // Will be set when section is unlocked
          sectionEndTimestamps.push(null);
        }
      });
    }

    return {
      attemptId,
      testData,
      candidateName: cName,
      candidateMobile: cMobile,
      startedAt: now,
      currentSectionIndex: 0,
      currentQuestionFlatIndex: 0, // index into questions[]
      questions,
      sectionStartTimestamps,
      sectionEndTimestamps,
      sectionCompleted: testData.sections.map(() => false),
      sectionEndReasons: {},
      submitted: false,
      submitTime: null,
    };
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  function getState() { return _state; }

  function setState(s) {
    if (s && s.testData && s.testData.meta) {
      const meta = s.testData.meta;
      const isSec = meta.testType === 'sectional';
      const isTimed = !isSec && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
      if (isTimed && Array.isArray(s.sectionCompleted)) {
        // Reject attempts to reopen completed sections
        if (s.sectionCompleted[s.currentSectionIndex]) {
          const nextOpen = s.sectionCompleted.findIndex(c => !c);
          if (nextOpen >= 0) {
            s.currentSectionIndex = nextOpen;
          }
        }
        const curQ = s.questions && s.questions[s.currentQuestionFlatIndex];
        if (curQ && curQ.sectionIndex !== s.currentSectionIndex) {
          s.currentQuestionFlatIndex = getFlatIndex(s.currentSectionIndex, 0);
        }
      }
    }
    _state = s;
  }

  /**
   * Get the flat question index for a given (sectionIndex, questionIndex).
   */
  function getFlatIndex(sectionIndex, questionIndex) {
    const td = (_state && _state.testData) || (typeof Storage !== 'undefined' && Storage.loadTestData());
    let offset = 0;
    for (let i = 0; i < sectionIndex; i++) {
      offset += td.sections[i].questions.length;
    }
    return offset + questionIndex;
  }

  /**
   * Get the question state entry at the current position.
   */
  function getCurrentQState() {
    return _state.questions[_state.currentQuestionFlatIndex];
  }

  /**
   * Get the raw question data for a given flat index.
   */
  function getQuestionData(flatIndex) {
    const qs = _state.questions[flatIndex];
    if (!qs) return null;
    const td = (_state && _state.testData) || (typeof Storage !== 'undefined' && Storage.loadTestData());
    if (!td || !td.sections || !td.sections[qs.sectionIndex]) return null;
    return td.sections[qs.sectionIndex].questions[qs.questionIndex];
  }

  /**
   * Get the current raw question data.
   */
  function getCurrentQuestionData() {
    return getQuestionData(_state.currentQuestionFlatIndex);
  }

  /**
   * Get questions for a given section (their state entries).
   */
  function getSectionQuestions(sectionIndex) {
    return _state.questions.filter(q => q.sectionIndex === sectionIndex);
  }

  /**
   * Palette counts for a given section.
   */
  function getPaletteCounts(sectionIndex) {
    const qs = getSectionQuestions(sectionIndex);
    const counts = {
      answered: 0,
      notAnswered: 0,
      notVisited: 0,
      marked: 0,
      answeredMarked: 0,
    };
    qs.forEach(q => {
      switch (q.status) {
        case 'answered':        counts.answered++;        break;
        case 'not-answered':    counts.notAnswered++;     break;
        case 'not-visited':     counts.notVisited++;      break;
        case 'marked':          counts.marked++;          break;
        case 'answered-marked': counts.answeredMarked++;  break;
      }
    });
    return counts;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Record that a question is now being viewed.
   * Updates lastVisitedAt; if not-visited, transitions to not-answered.
   */
  function visitQuestion(flatIndex) {
    const q = _state.questions[flatIndex];
    q.lastVisitedAt = Date.now();
    if (q.status === 'not-visited') {
      q.status = 'not-answered';
    }
  }

  /**
   * Accumulate time spent on the current question (called before navigating away).
   */
  function recordTimeForCurrent() {
    const q = getCurrentQState();
    if (q.lastVisitedAt) {
      const deadline = getActiveTimerEnd() || Date.now();
      q.timeSpent += Math.max(0, Math.round((Math.min(Date.now(), deadline) - q.lastVisitedAt) / 1000));
      q.lastVisitedAt = null;
    }
  }

  /**
   * Recalculate status of current question upon leaving it.
   * Centralized status logic (matching real TCS iON rules):
   * 1. The purple mark exists ONLY when the candidate pressed 'Mark for Review & Next'
   *    during the visit being left. Nothing carries the mark over from an earlier visit.
   * 2. If action === 'MARK':
   *    - option selected: 'answered-marked' (purple circle with small green icon)
   *    - no option selected: 'marked' (plain purple circle)
   * 3. Any other leave route (Save & Next, Previous, Palette click, Section switch, Submit, Timeout):
   *    - option selected: 'answered' (green)
   *    - no option selected: 'not-answered' (red)
   *    Even if the question was previously marked for review!
   *
   * @param {string} action 'MARK' | 'SAVE' | 'PREV' | 'NAV' | 'SUBMIT'
   * @param {number|null} selectedOption 1-based index or null
   */
  function leaveQuestion(action, selectedOption) {
    const q = getCurrentQState();
    if (!q) return;

    const sel = (selectedOption !== undefined && selectedOption !== null)
      ? parseInt(selectedOption, 10)
      : null;
    q.selectedOption = isNaN(sel) ? null : sel;

    if (action === 'MARK') {
      q.status = (q.selectedOption !== null) ? 'answered-marked' : 'marked';
    } else {
      q.status = (q.selectedOption !== null) ? 'answered' : 'not-answered';
    }
  }

  /**
   * Navigate to a specific question (by flat index within current section).
   * Records time for the current question first.
   * Also leaves the current question, updating its status.
   */
  function navigateTo(flatIndex, selectedOption) {
    const targetQ = _state.questions[flatIndex];
    if (!targetQ) return;
    const meta = _state.testData.meta || {};
    const isSectional = meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
    if (isSectionTimed) {
      if (targetQ.sectionIndex !== _state.currentSectionIndex || _state.sectionCompleted[targetQ.sectionIndex]) {
        return; // reject navigating outside open section or to completed section
      }
    }
    if (flatIndex !== _state.currentQuestionFlatIndex) {
      leaveQuestion('NAV', selectedOption);
      recordTimeForCurrent();
      _state.currentQuestionFlatIndex = flatIndex;
      visitQuestion(flatIndex);
    }
  }

  /**
   * Navigate to a specific (sectionIndex, questionIndex).
   */
  function navigateToSectionQ(sectionIndex, questionIndex, selectedOption) {
    const meta = _state.testData.meta || {};
    const isSectional = meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
    if (isSectionTimed) {
      if (sectionIndex !== _state.currentSectionIndex || _state.sectionCompleted[sectionIndex]) {
        return;
      }
    }
    navigateTo(getFlatIndex(sectionIndex, questionIndex), selectedOption);
    _state.currentSectionIndex = sectionIndex;
  }

  /**
   * Save & Next: records selection, updates status to answered / not-answered, moves to next question.
   * @param {number|null} selectedOption 1-based or null
   * @returns {boolean} moved (false if at last question in section)
   */
  function saveAndNext(selectedOption) {
    leaveQuestion('SAVE', selectedOption);
    return moveNext();
  }

  /**
   * Mark for Review & Next: marks question (answered-marked if has answer, else marked).
   * Moves to next question.
   */
  function markForReviewAndNext(selectedOption) {
    leaveQuestion('MARK', selectedOption);
    return moveNext();
  }

  /**
   * Clear Response: removes the selected option, marks as not-answered.
   */
  function clearResponse() {
    const q = getCurrentQState();
    if (!q) return;
    q.selectedOption = null;
    q.status = 'not-answered';
    // stay on same question, just re-render
  }

  /**
   * Move to the next question in the current section.
   * In a sectionTimed test, wraps to the first question of the SAME section.
   * @returns {boolean} true if moved
   */
  function moveNext() {
    recordTimeForCurrent();
    const sectionQs = getSectionQuestions(_state.currentSectionIndex);
    const curInSection = sectionQs.findIndex(
      q => q === getCurrentQState()
    );
    if (curInSection < sectionQs.length - 1) {
      const nextFlat = getFlatIndex(_state.currentSectionIndex, curInSection + 1);
      _state.currentQuestionFlatIndex = nextFlat;
      visitQuestion(nextFlat);
      return true;
    }
    // At last question of section
    const meta = _state.testData.meta || {};
    const isSectional = meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
    if (isSectionTimed) {
      // Wrap to first question of the same section!
      const firstFlat = getFlatIndex(_state.currentSectionIndex, 0);
      _state.currentQuestionFlatIndex = firstFlat;
      visitQuestion(firstFlat);
      return true;
    }
    // Non-sectionTimed: stay here
    visitQuestion(_state.currentQuestionFlatIndex);
    return false;
  }

  /**
   * Move to the previous question in the current section.
   * @param {number|null} selectedOption
   * @returns {boolean} true if moved
   */
  function movePrev(selectedOption) {
    const sectionQs = getSectionQuestions(_state.currentSectionIndex);
    const curInSection = sectionQs.findIndex(
      q => q === getCurrentQState()
    );
    if (curInSection > 0) {
      leaveQuestion('PREV', selectedOption);
      recordTimeForCurrent();
      const prevFlat = getFlatIndex(_state.currentSectionIndex, curInSection - 1);
      _state.currentQuestionFlatIndex = prevFlat;
      visitQuestion(prevFlat);
      return true;
    }
    visitQuestion(_state.currentQuestionFlatIndex);
    return false;
  }

  /**
   * Start a section's timer countdown (called when section is shown).
   */
  function startSection(si) {
    if (!_state) return;
    const durMs = ((_state.testData.sections[si] && _state.testData.sections[si].durationMinutes) || 20) * 60 * 1000;
    if (!_state.sectionStartTimestamps) _state.sectionStartTimestamps = {};
    if (!_state.sectionEndTimestamps) _state.sectionEndTimestamps = [];
    _state.sectionStartTimestamps[si] = Date.now();
    _state.sectionEndTimestamps[si] = Date.now() + durMs;
  }

  /**
   * Move to the next section (full tests).
   * Marks the current section as completed, records endReason.
   * @param {string} endReason 'submitted' | 'timeout'
   * @returns {boolean} true if moved, false if at last section
   */
  function advanceSection(endReason = 'submitted') {
    recordTimeForCurrent();
    const si = _state.currentSectionIndex;
    _state.sectionCompleted[si] = true;
    if (!_state.sectionEndReasons) _state.sectionEndReasons = {};
    _state.sectionEndReasons[si] = endReason;

    const nextSi = si + 1;
    if (nextSi >= _state.testData.sections.length) return false;

    // Navigate to first question of next section and start its timer
    _state.currentSectionIndex = nextSi;
    const firstFlat = getFlatIndex(nextSi, 0);
    _state.currentQuestionFlatIndex = firstFlat;
    visitQuestion(firstFlat);
    startSection(nextSi);
    return true;
  }

  /**
   * Compute the end timestamp for the current active timer.
   * Sectional or free navigation: sectionEndTimestamps[0].
   * Section-timed: sectionEndTimestamps[currentSectionIndex].
   */
  function getActiveTimerEnd() {
    const meta = _state.testData.meta || {};
    const isSectional = meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
    if (isSectional || !isSectionTimed) return _state.sectionEndTimestamps[0];
    return _state.sectionEndTimestamps[_state.currentSectionIndex];
  }

  /**
   * Submit the exam. Sets submitted flag and records submit time.
   */
  function submitExam() {
    recordTimeForCurrent();
    _state.submitted = true;
    _state.submitTime = Date.now();
  }

  // ── Result calculation ─────────────────────────────────────────────────────

  /**
   * Calculate results from a submitted (or current) state.
   * @param {object} state
   * @returns {object} results
   */
  function calculateResults(state) {
    const testData = state.testData;
    const sections = testData.sections;

    // Helper: get question data from a given state (not from _state)
    function getQData(qState) {
      return testData.sections[qState.sectionIndex].questions[qState.questionIndex];
    }

    const sectionResults = sections.map((section, si) => {
      const sqs = state.questions.filter(q => q.sectionIndex === si);
      let correct = 0, wrong = 0, unattempted = 0, markedOnly = 0;
      let score = 0;

      sqs.forEach(qState => {
        const qData = section.questions[qState.questionIndex];
        const marks = qData.marks;
        const neg = qData.negative;
        const isAnswered = qState.status === 'answered' || qState.status === 'answered-marked';
        const isMarkedOnly = qState.status === 'marked';

        if (isMarkedOnly) {
          markedOnly++;
          unattempted++;
        } else if (!isAnswered) {
          unattempted++;
        } else {
          if (qState.selectedOption === qData.correct) {
            correct++;
            score += marks;
          } else {
            wrong++;
            score -= neg;
          }
        }
      });

      const attempted = correct + wrong;
      const totalQ = sqs.length;
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
      const totalMarks = section.questions.reduce((s, q) => s + q.marks, 0);

      return {
        sectionName: section.name,
        totalQuestions: totalQ,
        attempted,
        correct,
        wrong,
        unattempted,
        markedOnly,
        score: Math.round(score * 100) / 100,
        totalMarks,
        accuracy,
        cutoff: section.cutoff,
        cutoffScaled: section._cutoffScaled || false,
        passed: score >= section.cutoff,
        timeSpent: sqs.reduce((s, q) => s + q.timeSpent, 0),
        endReason: (state.sectionEndReasons && state.sectionEndReasons[si]) || (state.sectionCompleted && state.sectionCompleted[si] ? 'submitted' : (state.submitted ? 'submitted' : '-')),
      };
    });

    const totalScore = sectionResults.reduce((s, r) => s + r.score, 0);
    const totalCorrect = sectionResults.reduce((s, r) => s + r.correct, 0);
    const totalWrong = sectionResults.reduce((s, r) => s + r.wrong, 0);
    const totalUnattempted = sectionResults.reduce((s, r) => s + r.unattempted, 0);
    const totalAttempted = sectionResults.reduce((s, r) => s + r.attempted, 0);
    const totalQ = state.questions.length;
    const totalMarks = sectionResults.reduce((s, r) => s + r.totalMarks, 0);
    const totalTime = state.questions.reduce((s, q) => s + q.timeSpent, 0);
    const overallPassed = sectionResults.every(r => r.passed);
    const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

    // Per-question time table
    const questionTimes = state.questions.map((qState) => {
      const qData = getQData(qState);
      return {
        sectionIndex: qState.sectionIndex,
        questionIndex: qState.questionIndex,
        questionId: qState.questionId,
        timeSpent: qState.timeSpent,
        status: qState.status,
        selectedOption: qState.selectedOption,
        correctOption: qData.correct,
      };
    });

    const avgTime = totalQ > 0 ? Math.round(totalTime / totalQ) : 0;

    return {
      sectionResults,
      totalScore: Math.round(totalScore * 100) / 100,
      totalMarks,
      totalCorrect,
      totalWrong,
      totalUnattempted,
      totalAttempted,
      totalQ,
      overallAccuracy,
      overallPassed,
      totalTime,
      avgTimePerQ: avgTime,
      questionTimes,
      attemptId: state.attemptId,
      candidateName: state.candidateName,
      candidateMobile: state.candidateMobile || '',
      submittedAt: state.submitTime,
      startedAt: state.startedAt,
      integrity: state.integrity || null,
    };
  }

  return {
    buildFreshState,
    getState, setState,
    getFlatIndex, getCurrentQState, getQuestionData, getCurrentQuestionData,
    getSectionQuestions, getPaletteCounts,
    visitQuestion, recordTimeForCurrent, navigateTo, navigateToSectionQ,
    saveAndNext, markForReviewAndNext, clearResponse, leaveQuestion,
    moveNext, movePrev, advanceSection, startSection,
    getActiveTimerEnd, submitExam,
    calculateResults,
  };
})();
