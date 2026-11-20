/**
 * validator.js
 * Validates a parsed test JSON object against the schema.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */

const Validator = (() => {

  function validateMeta(meta) {
    const errors = [];
    if (!meta || typeof meta !== 'object') {
      return ['meta: missing or not an object'];
    }
    if (!meta.examName || typeof meta.examName !== 'string') {
      errors.push('meta.examName: must be a non-empty string');
    }
    if (!meta.testName || typeof meta.testName !== 'string') {
      errors.push('meta.testName: must be a non-empty string');
    }
    if (meta.testType && !['sectional', 'full'].includes(meta.testType)) {
      errors.push('meta.testType: must be "sectional" or "full"');
    }
    if (meta.durationMinutes !== undefined) {
      if (typeof meta.durationMinutes !== 'number' || meta.durationMinutes <= 0) {
        errors.push('meta.durationMinutes: must be a positive number');
      }
    }
    if (meta.marksPerQuestion !== undefined) {
      if (typeof meta.marksPerQuestion !== 'number' || meta.marksPerQuestion < 0) {
        errors.push('meta.marksPerQuestion: must be a non-negative number');
      }
    }
    if (meta.negativeMarking !== undefined) {
      if (typeof meta.negativeMarking !== 'number' || meta.negativeMarking < 0) {
        errors.push('meta.negativeMarking: must be a non-negative number');
      }
    }
    return errors;
  }

  function validateQuestion(q, sectionName, questionIndex, allIds) {
    const errors = [];
    const prefix = `Section "${sectionName}", Question index ${questionIndex}`;

    if (typeof q.id !== 'number') {
      errors.push(`${prefix}: id must be a number`);
    } else if (allIds.has(q.id)) {
      errors.push(`${prefix}: duplicate question id ${q.id}`);
    } else {
      allIds.add(q.id);
    }

    if (!q.question || typeof q.question !== 'string' || q.question.trim() === '') {
      errors.push(`${prefix} (id:${q.id}): question text must be a non-empty string`);
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${prefix} (id:${q.id}): options must be an array with at least 2 items`);
    } else {
      q.options.forEach((opt, i) => {
        if (typeof opt !== 'string' || opt.trim() === '') {
          errors.push(`${prefix} (id:${q.id}): option ${i + 1} must be a non-empty string`);
        }
      });
    }

    if (typeof q.correct !== 'number') {
      errors.push(`${prefix} (id:${q.id}): correct must be a number (1-based)`);
    } else if (Array.isArray(q.options) && (q.correct < 1 || q.correct > q.options.length)) {
      errors.push(`${prefix} (id:${q.id}): correct (${q.correct}) is out of range (1–${q.options.length})`);
    }

    if (q.marks !== undefined && (typeof q.marks !== 'number' || q.marks < 0)) {
      errors.push(`${prefix} (id:${q.id}): marks must be a non-negative number`);
    }
    if (q.negative !== undefined && (typeof q.negative !== 'number' || q.negative < 0)) {
      errors.push(`${prefix} (id:${q.id}): negative must be a non-negative number`);
    }
    if (q.explanation !== undefined && typeof q.explanation !== 'string') {
      errors.push(`${prefix} (id:${q.id}): explanation must be a string if provided`);
    }

    return errors;
  }

  function validate(data) {
    const errors = [];
    const warnings = [];
    const referencedImages = new Set();

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Root: must be an object'], warnings: [], referencedImages: [] };
    }

    // Validate meta
    errors.push(...validateMeta(data.meta || {}));

    // Validate sections
    if (!Array.isArray(data.sections) || data.sections.length === 0) {
      errors.push('sections: must be a non-empty array');
      return { valid: false, errors, warnings: [], referencedImages: [] };
    }

    const allIds = new Set();

    data.sections.forEach((section, si) => {
      const sname = section.name || `Section ${si + 1}`;
      if (!section.name || typeof section.name !== 'string') {
        errors.push(`Section ${si + 1}: name must be a non-empty string`);
      }

      // Check groups
      const groupIds = new Set();
      if (section.groups !== undefined) {
        if (!Array.isArray(section.groups)) {
          errors.push(`Section "${sname}": groups must be an array`);
        } else {
          section.groups.forEach((g, gi) => {
            if (!g || typeof g !== 'object' || !g.id) {
              errors.push(`Section "${sname}", Group ${gi + 1}: group must have an id`);
            } else {
              groupIds.add(g.id);
              if (!g.passage && !g.image) {
                warnings.push(`Section "${sname}", Group "${g.id}": has neither a passage nor an image`);
              }
              if (g.image && typeof g.image === 'string') {
                referencedImages.add(g.image.trim());
              }
              if (g.passage && typeof g.passage === 'string') {
                const imgMatches = g.passage.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
                for (const m of imgMatches) {
                  referencedImages.add(m[1].trim());
                }
              }
            }
          });
        }
      }

      if (!Array.isArray(section.questions) || section.questions.length === 0) {
        errors.push(`Section "${sname}": questions must be a non-empty array`);
      } else {
        section.questions.forEach((q, qi) => {
          errors.push(...validateQuestion(q, sname, qi + 1, allIds));
          if (q.groupId && !groupIds.has(q.groupId) && !q.passage) {
            warnings.push(`Section "${sname}", Question ${q.id}: references unknown groupId "${q.groupId}"`);
          }
          if (q.image && typeof q.image === 'string') {
            referencedImages.add(q.image.trim());
          }
          if (q.question && typeof q.question === 'string') {
            const imgMatches = q.question.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
            for (const m of imgMatches) {
              referencedImages.add(m[1].trim());
            }
          }
          if (Array.isArray(q.options)) {
            q.options.forEach(opt => {
              if (typeof opt === 'string') {
                const imgMatches = opt.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
                for (const m of imgMatches) {
                  referencedImages.add(m[1].trim());
                }
              }
            });
          }
          if (q.passage && typeof q.passage === 'string') {
            const imgMatches = q.passage.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
            for (const m of imgMatches) {
              referencedImages.add(m[1].trim());
            }
          }
        });
      }
      if (section.durationMinutes !== undefined) {
        if (typeof section.durationMinutes !== 'number' || section.durationMinutes <= 0) {
          errors.push(`Section "${sname}": durationMinutes must be a positive number`);
        }
      }
      if (section.cutoff !== undefined) {
        if (typeof section.cutoff !== 'number' || section.cutoff < 0) {
          errors.push(`Section "${sname}": cutoff must be a non-negative number`);
        }
      }
    });

    // Check sectional timing durations
    const meta = data.meta || {};
    const isSectional = meta.testType === 'sectional';
    const isSectionTimed = !isSectional && (meta.sectionTimed === true || (meta.testType === 'full' && meta.sectionTimed !== false));
    if (isSectionTimed) {
      let sumSectionMinutes = 0;
      data.sections.forEach((sec, si) => {
        const sname = sec.name || `Section ${si + 1}`;
        if (!sec.durationMinutes || typeof sec.durationMinutes !== 'number' || sec.durationMinutes <= 0) {
          warnings.push(`Section "${sname}": missing durationMinutes for sectionTimed test; default will be assigned.`);
        } else {
          sumSectionMinutes += sec.durationMinutes;
        }
      });
      if (typeof meta.durationMinutes === 'number' && sumSectionMinutes > 0 && sumSectionMinutes !== meta.durationMinutes) {
        warnings.push(`Total duration (${meta.durationMinutes} mins) does not match sum of section durations (${sumSectionMinutes} mins); sum of sections will be used as total.`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, referencedImages: Array.from(referencedImages) };
  }

  /**
   * Infer and normalise missing fields from a validated test object.
   * Returns a normalised copy with defaults filled in.
   */
  function normalise(data) {
    const d = JSON.parse(JSON.stringify(data)); // deep clone

    const meta = d.meta || {};

    // Infer testType
    if (!meta.testType) {
      meta.testType = d.sections.length === 1 ? 'sectional' : 'full';
    }
    d.meta = meta;

    // Default marks
    const defaultMarks = typeof meta.marksPerQuestion === 'number' ? meta.marksPerQuestion : 1;
    const defaultNeg = typeof meta.negativeMarking === 'number' ? meta.negativeMarking : 0.25;

    // Default durations
    const isSectional = meta.testType === 'sectional';
    const defaultTotalMins = meta.durationMinutes || (isSectional ? 20 : 60);

    // Default section durations
    d.sections.forEach(section => {
      if (!section.durationMinutes) {
        section.durationMinutes = isSectional ? defaultTotalMins
          : Math.round(defaultTotalMins / d.sections.length);
      }

      // Default cutoffs (with scaling)
      if (section.cutoff === undefined) {
        const STANDARD = {
          'Quantitative Aptitude': { cutoff: 30, count: 35 },
          'Reasoning Ability': { cutoff: 33, count: 35 },
          'English Language': { cutoff: 27, count: 30 },
        };
        const std = STANDARD[section.name];
        if (std) {
          const scaled = Math.round(std.cutoff * section.questions.length / std.count);
          section.cutoff = scaled;
          section._cutoffScaled = true;
          section._standardCutoff = std.cutoff;
          section._standardCount = std.count;
        } else {
          section.cutoff = 0;
        }
      }

      // Group map for inheritance
      const groupMap = {};
      if (Array.isArray(section.groups)) {
        section.groups.forEach(g => {
          if (g && g.id) groupMap[g.id] = g;
        });
      }

      // Normalise questions
      section.questions.forEach(q => {
        if (q.marks === undefined) q.marks = defaultMarks;
        if (q.negative === undefined) q.negative = defaultNeg;

        // Group inheritance
        if (q.groupId && groupMap[q.groupId]) {
          const grp = groupMap[q.groupId];
          if (!q.passage && grp.passage) q.passage = grp.passage;
          if (!q.groupImage && grp.image) q.groupImage = grp.image;
        }
      });
    });

    // sectionTimed default: true for full tests
    if (meta.sectionTimed === undefined) {
      meta.sectionTimed = meta.testType === 'full';
    }
    if (!isSectional && meta.sectionTimed === true) {
      const sumSecMins = d.sections.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      if (sumSecMins > 0) {
        meta.durationMinutes = sumSecMins;
      }
    }
    if (meta.allowReattempt === undefined) {
      meta.allowReattempt = true;
    }

    return d;
  }

  return { validate, normalise };
})();
