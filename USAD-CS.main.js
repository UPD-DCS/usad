// USAD-CS application code.
// This file is loaded remotely by USAD-CS.user.js.

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // 1. Configuration and shared state
    // -------------------------------------------------------------------------
    const PREREQ_SPREADSHEET_ID = '1LrlNoZjLS5N4LstDTwCp6774vAENwCcFHeAfBZ2S_rs';
    const PREREQ_CSV_URL = `https://docs.google.com/spreadsheets/d/${PREREQ_SPREADSHEET_ID}/export?format=csv&gid=0`;
    const VSO_SPREADSHEET_ID = '1yYECEDmllyGMuL1c3lzmvuR00lWtedS1x6Kweronpp0';
    const VSO_CSV_URL = `https://docs.google.com/spreadsheets/d/${VSO_SPREADSHEET_ID}/export?format=csv&gid=0`;

    const CURRICULUM_RULES_CACHE_KEY = 'usad_curriculum_rules_csv_v1';
    const CURRICULUM_RULES_CACHE_TIME_KEY = 'usad_curriculum_rules_csv_time_v1';
    const LEGACY_PREREQ_CACHE_KEY = 'crs_prereq_sheet_data';
    const LEGACY_PREREQ_CACHE_TIME_KEY = 'crs_prereq_sheet_time';
    const VSO_CACHE_KEY = 'usad_vso_students_csv_v1';
    const VSO_CACHE_TIME_KEY = 'usad_vso_students_csv_time_v1';
    const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const VSO_CACHE_EXPIRY_MS = 5 * 60 * 1000;
    const CHECKLIST_SESSION_CACHE_PREFIX = 'usad_checklist_html_v1_';
    const CHECKLIST_SESSION_CACHE_INDEX_KEY = 'usad_checklist_html_v1_index';
    const CHECKLIST_SESSION_CACHE_EXPIRY_MS = 5 * 60 * 1000;
    const CHECKLIST_SESSION_CACHE_LIMIT = 5;
    const RECOMMENDATION_RENDER_TARGET_MS = 2000;

    // Bundled fallback matching the prerequisite sheet as of 2026-08-09.
    // It lets recommendation evaluation begin immediately on a fresh install;
    // the live sheet still refreshes this data in the background.
    const BUILT_IN_PREREQ_RULES_ROWS = [
        ['Course', 'Prerequisite', 'Corequisite', 'Semester Offered', 'with Lab?'],
        ['CS 10', '', '', '1', '0'],
        ['CS 11', '', '', '1, 2', '1'],
        ['CS 12', 'CS 11', '', '1, 2', '1'],
        ['CS 20', 'CS 12', '', '1, 2', '1'],
        ['CS 21', 'CS 20', '', '1, 2', '1'],
        ['CS 30', '', '', '1, 2', '0'],
        ['CS 31', 'CS 30', '', '1, 2', '0'],
        ['CS 32', 'CS 12, CS 31', '', '1, 2', '1'],
        ['CS 33', 'CS 32', '', '1, 2', '1'],
        ['CS 132', 'CS 31, Math 23, Math 40', '', '1, 2', '0'],
        ['CS 133', 'CS 30', '', '1, 2', '0'],
        ['CS 136', 'CS 31, Math 23', '', '2', '0'],
        ['CS 138', 'CS 136, Math 40', '', '1', '0'],
        ['CS 140', 'CS 21, CS 32', '', '1', '1'],
        ['CS 145', 'CS 140', '', '2', '1'],
        ['CS 150', 'CS 33', '', '1', '1'],
        ['CS 153', 'CS 140', 'CS 145, CS 192', '2', '0'],
        ['CS 155', 'CS 21, CS 133, CS 150', '', '2', '1'],
        ['CS 165', 'CS 33', '', '1', '1'],
        ['CS 171', '', '', '1, 2', '0'],
        ['CS 172', '', '', '1, 2', '0'],
        ['CS 173', '', '', '1, 2', '0'],
        ['CS 174', '', '', '1, 2', '0'],
        ['CS 175', '', '', '1, 2', '0'],
        ['CS 176', '', '', '1, 2', '0'],
        ['CS 180', 'CS 33', '', '1, 2', '0'],
        ['CS 191', 'CS 33', 'CS 150, CS 165', '1', '0'],
        ['CS 192', 'CS 191', '', '2', '1'],
        ['CS 194', 'JR_STANDING', '', '2', '0'],
        ['CS 195', 'CS 192', '', 'M', '0'],
        ['CS 196', 'SR_STANDING', '', '1, 2', '0'],
        ['CS 198', 'CS 194', '', '1', '1'],
        ['CS 199', 'CS 198', '', '2', '1'],
        ['Math 20', '', '', '1, 2, M', '0'],
        ['Math 21', '', '', '1, 2, M', '0'],
        ['Math 22', 'Math 21', '', '1, 2, M', '0'],
        ['Math 23', 'Math 22', '', '1, 2, M', '0'],
        ['Math 40', 'Math 22', '', '1, 2, M', '0'],
        ['Physics 71', 'Math 21', '', '1, 2, M', '0'],
        ['Physics 72', 'Physics 71', '', '1, 2, M', '0'],
        ['Engg 150', 'SR_STANDING', '', '1, 2', '0'],
    ];

    // Courses in this easily editable list are always treated as ineligible
    // because an equivalent course already exists in the BSCS curriculum.
    // Add or remove course codes as needed; spacing and letter case are ignored.
    const COURSES_WITH_TOPIC_OVERLAPS = [
        'Stat 101',
        'Math 122',
        'EEE 111',
    ];

    const COURSE_CATEGORIES = Object.freeze({
        CORE: 'Core Courses',
        REQUIRED_GE: 'Required GE Courses',
        GE_ELECTIVE: 'GE Elective',
        CS_ELECTIVE: 'CS Electives',
        FREE_ELECTIVE: 'Free Electives',
        NSTP: 'NSTP',
        PE: 'PE',
    });
    const POST_CORE_ACADEMIC_CATEGORIES = new Set([
        COURSE_CATEGORIES.REQUIRED_GE,
        COURSE_CATEGORIES.GE_ELECTIVE,
        COURSE_CATEGORIES.CS_ELECTIVE,
        COURSE_CATEGORIES.FREE_ELECTIVE,
    ]);
    const NON_ACADEMIC_CATEGORIES = new Set([
        COURSE_CATEGORIES.NSTP,
        COURSE_CATEGORIES.PE,
    ]);
    const ZERO_ACADEMIC_UNIT_COURSE_CODES = new Set(['MATH20']);
    const TWICE_REPEATABLE_COURSE_CODES = new Set([
        'CS171',
        'CS172',
        'CS173',
        'CS174',
        'CS175',
        'CS176',
    ]);
    const FOUNDATION_LOAD_COURSE_CODES = new Set([
        'CS10',
        'CS11',
        'CS12',
        'CS20',
        'CS21',
        'CS30',
        'CS31',
        'CS32',
        'CS33',
        'MATH20',
        'MATH21',
        'MATH22',
        'MATH23',
        'MATH40',
    ]);
    const ACRONYM_SUBJECTS = new Set([
        'BIO',
        'CS',
        'CW',
        'EL',
        'FA',
        'FN',
        'GE',
        'LIS',
        'MBB',
        'MS',
        'PE',
        'PI',
        'PS',
        'SAS',
        'SEA',
        'SOSC',
        'STS',
    ]);
    const STANDING_UNIT_THRESHOLDS = Object.freeze({
        SOSTANDING: 37,
        JRSTANDING: 74,
        SRSTANDING: 111,
    });
    const NSTP_1_STANDING_REQUIREMENT = 'SO_STANDING';
    const TERM_CODES = Object.freeze({
        FIRST: '1',
        SECOND: '2',
        MIDYEAR: 'M',
    });
    const TERM_NAMES = Object.freeze({
        [TERM_CODES.FIRST]: 'First Sem',
        [TERM_CODES.SECOND]: 'Second Sem',
        [TERM_CODES.MIDYEAR]: 'Midyear',
    });

    // Memory store for extracted student checklist grades
    const extractedStudentGrades = new Map();
    const passedAttemptCourseCodes = new Set();
    const passedAttemptCourseCounts = new Map();
    const normalizeCache = new Map();

    // Summary values read directly from the CRS Curriculum Checklist.
    let crsChecklistWAG = null;
    let crsTotalCreditedUnits = null;

    // Grade matching regex to cover all UP grade formats (1.0 - 5.0, INC, DRP, etc.)
    const GRADE_REGEX =
        /\b(?:INC(?:\s*\([^)]+\))?|4(?:\.[0-9]+)?(?:\s*\([^)]+\))?|[1-5](?:\.[0-9]+)?|PASSED|FAILED|PASS|FAIL|DRP|S|U)\b/gi;

    // Dynamic UP Diliman GE course source. The GEC webpage may replace its
    // linked PDF whenever the semester list is updated.
    const GEC_GE_PAGE_URL =
        'https://gec.upd.edu.ph/list-of-ge-courses-offered-for-the-first-semester-of-ay-2026-2027/';
    const GE_LIST_CACHE_KEY = 'upd_ge_course_list_dynamic';
    const GE_LIST_CACHE_TIME_KEY = 'upd_ge_course_list_dynamic_time';
    const GE_LIST_CACHE_SOURCE_KEY = 'upd_ge_course_list_dynamic_source';
    const GE_LIST_CACHE_EXPIRY_MS = 12 * 60 * 60 * 1000;

    let GE_COURSES_LIST = [];
    let GE_COURSES_NORMALIZED = new Set();
    let geCourseListSource = '';

    // Promise shared by checklist processing and prerequisite evaluation. The
    // checklist request and GE-list initialization start concurrently, while
    // prerequisite evaluation waits until the GE lookup is ready.
    let geCourseListReadyPromise = Promise.resolve([]);
    let prereqRulesReadyPromise = Promise.resolve(null);
    let vsoStatusReadyPromise = Promise.resolve(false);
    let vsoStatusResolved = false;
    let isVsoStudent = false;
    let checklistRecommendationDataReady = false;
    let latestPrereqRulesRows = null;
    let recommendationEvaluationVersion = 0;
    const recommendationLoadStartedAt =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    let hasLoggedRecommendationRenderTime = false;

    // Cached academic summary for the current checklist load. This avoids
    // traversing all checklist entries separately during rendering and again
    // during prerequisite evaluation.
    let checklistAcademicSummary = {
        passedAcademicUnits: 0,
        gwa: null,
        gwaUnits: 0,
    };

    // -------------------------------------------------------------------------
    // 2. Student information extraction
    // -------------------------------------------------------------------------
    const studentIdHeader = document.querySelector('td.tr_submit h1');
    const studentNameHeader = document.querySelector('#studentname');

    const rawStudentId = studentIdHeader?.innerText?.trim() || '';
    const studentId = rawStudentId.replace(/\D/g, ''); // CRS displays separators in student numbers; retain digits only.
    const pageStudentName = studentNameHeader ? studentNameHeader.innerText.trim() : 'N/A';

    // Reads the total curriculum units from the "Curriculum for Evaluation" row
    // on the Online Advising page. Example: "BS CS (2018) 148 units" -> 148.
    function getCurriculumTotalUnits() {
        const rows = Array.from(document.querySelectorAll('table.form tr'));
        const curriculumRow = rows.find((row) =>
            /curriculum\s+for\s+evaluation/i.test(row.cells?.[0]?.textContent || ''),
        );

        if (!curriculumRow) return null;

        const valueText = Array.from(curriculumRow.cells)
            .slice(1)
            .map((cell) => cell.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        const unitsMatch = valueText.match(/(\d+(?:\.\d+)?)\s*units?\b/i);
        if (!unitsMatch) return null;

        const units = Number.parseFloat(unitsMatch[1]);
        return Number.isFinite(units) && units > 0 ? units : null;
    }

    const curriculumTotalUnits = studentIdHeader ? getCurriculumTotalUnits() : null;

    // -------------------------------------------------------------------------
    // 3. General helpers and sorting utilities
    // -------------------------------------------------------------------------

    // Reads the student's currently enlisted unit total from the advising page, with a fallback for minor CRS layout changes.
    function getTotalUnits() {
        const classList = document.querySelector('table.classlist');
        const container = classList?.previousElementSibling;
        const value = container?.querySelector('span');
        const units = Number.parseFloat(value?.textContent || '');
        if (Number.isFinite(units)) return units;

        // Fallback for minor CRS markup changes.
        for (const span of document.querySelectorAll('span')) {
            if (span.parentElement?.textContent.includes('Total Units:')) {
                const parsed = Number.parseFloat(span.textContent);
                if (Number.isFinite(parsed)) return parsed;
            }
        }
        return 0;
    }

    // Detects whether the active advising period is Midyear from CRS term
    // fields, labeled information rows, and page headings.
    function isMidyearAcademicTerm() {
        // CRS identifies the active advising term in this module heading, e.g.
        // "Online Advising for Midyear AY 2026-2027".
        const moduleHeading = document.querySelector('h1.module-name-h1')?.textContent?.trim();
        if (moduleHeading) {
            return /\bmidyear(?:\s+term)?\b/i.test(moduleHeading);
        }

        // Retain fallbacks in case CRS changes or removes the module heading.
        const termTexts = [document.title];
        const termFieldSelectors = [
            'select[name*="term" i]',
            'select[id*="term" i]',
            'select[name*="semester" i]',
            'select[id*="semester" i]',
            'input[name*="term" i]',
            'input[id*="term" i]',
            'input[name*="semester" i]',
            'input[id*="semester" i]',
        ];

        document.querySelectorAll(termFieldSelectors.join(',')).forEach((field) => {
            termTexts.push(field.value || '');
            termTexts.push(field.selectedOptions?.[0]?.textContent || '');
        });

        document.querySelectorAll('table tr').forEach((row) => {
            const cells = Array.from(row.cells || []);
            const label = cells[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
            if (/^(?:academic\s+term|term|semester)\s*:?\s*$/i.test(label)) {
                termTexts.push(
                    cells
                        .slice(1)
                        .map((cell) => cell.textContent || '')
                        .join(' '),
                );
            }
        });

        document.querySelectorAll('h1, h2, h3, caption, legend, .page-header, .title').forEach(
            (element) => termTexts.push(element.textContent || ''),
        );

        return termTexts.some((text) => /\bmidyear\b/i.test(text));
    }

    const isMidyearTerm = isMidyearAcademicTerm();

    // Returns the term code used by column 4 ("Semester Offered") of the
    // prerequisite rules sheet: 1, 2, or M. A null result keeps the
    // recommender usable if CRS changes its term-label markup.
    function getActiveAcademicTermCode() {
        const termTexts = [
            document.querySelector('h1.module-name-h1')?.textContent || '',
            document.title || '',
        ];

        document.querySelectorAll('h1, h2, h3, caption, legend, .page-header, .title').forEach(
            (element) => termTexts.push(element.textContent || ''),
        );

        const combined = termTexts.join(' ').replace(/\s+/g, ' ');
        if (/\bmidyear(?:\s+term)?\b/i.test(combined)) return 'M';
        if (/\b(?:first|1st)\s+semester\b/i.test(combined)) return '1';
        if (/\b(?:second|2nd)\s+semester\b/i.test(combined)) return '2';
        return null;
    }

    const activeAcademicTermCode = getActiveAcademicTermCode();
    const onlineAdvisingHeading =
        document.querySelector('h1.module-name-h1')?.textContent?.replace(/\s+/g, ' ').trim() ||
        '';
    const advisingTermHeading = onlineAdvisingHeading
        .replace(/^Online\s+Advising\s+for\s+/i, '')
        .trim();
    const activeAcademicYearMatch = onlineAdvisingHeading.match(
        /\bAY\s*(\d{4})\s*[-–]\s*(\d{4})\b/i,
    );
    const activeAcademicYearStart = activeAcademicYearMatch
        ? Number.parseInt(activeAcademicYearMatch[1], 10)
        : null;

    // Normalizes a raw grade string and resolves grades written in parenthetical completion form, such as INC (1.75).
    function parseGradeValue(grade) {
        if (!grade) return 'null';
        grade = grade.trim().toUpperCase();

        const incMatch = grade.match(/^INC\s*\(\s*([0-9.]+)\s*\)$/i);
        if (incMatch) {
            return incMatch[1];
        }

        return grade;
    }

    // Returns true when a normalized grade represents a passing UP grade or passing non-numerical mark.
    function isPassingGrade(grade) {
        if (!grade || grade === 'null' || grade === 'undefined') return false;
        const cleanGrade = grade.trim().toUpperCase();
        if (['PASSED', 'PASS', 'P', 'S'].includes(cleanGrade)) return true;
        const num = parseFloat(cleanGrade);
        return !isNaN(num) && num > 0 && num <= 3.0;
    }

    // CS 171-176 may each receive credit twice. Other courses retain the
    // ordinary one-passing-attempt limit used by duplicate-course validation.
    function getPassedAttemptLimit(courseCode) {
        return TWICE_REPEATABLE_COURSE_CODES.has(normalizeCode(courseCode)) ? 2 : 1;
    }

    function hasReachedPassedAttemptLimit(courseCode, passedAttemptCount) {
        return Number(passedAttemptCount || 0) >= getPassedAttemptLimit(courseCode);
    }

    function recordPassedCourseAttempt(courseCode) {
        const normalizedCourse = normalizeCode(courseCode);
        if (!normalizedCourse) return;

        passedAttemptCourseCodes.add(normalizedCourse);
        passedAttemptCourseCounts.set(
            normalizedCourse,
            (passedAttemptCourseCounts.get(normalizedCourse) || 0) + 1,
        );
    }

    // Extracts the most relevant course attempt from a checklist row, preferring a passing attempt when one exists.
    function extractDetailsFromRow(row) {
        let detailsTable = row.querySelector('table.class-details');
        if (
            !detailsTable &&
            row.nextElementSibling &&
            !row.nextElementSibling.querySelector('td:first-child')?.innerText.trim()
        ) {
            detailsTable = row.nextElementSibling.querySelector('table.class-details');
        }

        const attempts = [];

        if (detailsTable) {
            const detailRows = detailsTable.querySelectorAll('tr');
            detailRows.forEach((dRow) => {
                const tds = dRow.querySelectorAll('td');
                const gradeCell =
                    dRow.querySelector('td.pass, td.fail, td.conditional, td.drp, td.exfrwag') ||
                    (tds.length > 0 ? tds[tds.length - 1] : null);
                if (gradeCell) {
                    const txt = gradeCell.innerText.trim();
                    if (txt && txt.match(GRADE_REGEX)) {
                        const parsedG = parseGradeValue(txt);
                        let classTxt =
                            tds.length >= 2 ? tds[1].innerText.trim() : dRow.innerText.trim();
                        attempts.push({
                            rawClass: classTxt,
                            grade: parsedG,
                            passed: isPassingGrade(parsedG),
                        });
                    }
                }
            });
        }

        if (attempts.length === 0) {
            const gradeCells = row.querySelectorAll('.pass, .fail, .conditional, .drp, .exfrwag');
            let parsedG = 'null';

            if (gradeCells.length > 0) {
                parsedG = parseGradeValue(gradeCells[gradeCells.length - 1].innerText.trim());
            } else {
                const nonHeaderCells = Array.from(row.querySelectorAll('td')).slice(2);
                let fullText = nonHeaderCells.map((c) => c.innerText).join(' ');

                if (
                    row.nextElementSibling &&
                    !row.nextElementSibling.querySelector('td:first-child')?.innerText.trim()
                ) {
                    fullText += ' ' + row.nextElementSibling.innerText;
                }
                const matches = fullText.match(GRADE_REGEX);
                if (matches) {
                    parsedG = parseGradeValue(matches[matches.length - 1]);
                }
            }

            const rawClass =
                row
                    .querySelector('td:first-child')
                    ?.innerText.replace(/\{\d+\}/g, '')
                    .replace(/[\r\n]+/g, ' ')
                    .trim() || '';
            attempts.push({
                rawClass: rawClass,
                grade: parsedG,
                passed: isPassingGrade(parsedG),
            });
        }

        const passingAttempts = attempts.filter((a) => a.passed);
        if (passingAttempts.length > 0) {
            return passingAttempts[passingAttempts.length - 1];
        }
        return attempts[attempts.length - 1];
    }

    // Removes a leading curriculum GE-slot prefix from a raw course title.
    function sanitizeCourseTitle(rawTitle) {
        if (!rawTitle) return '';
        return rawTitle.replace(/^GE\s*\d*[:\-]?\s*/i, '').trim();
    }

    // Strips GE prefixes like "GE 8: ", "GE 1: ", etc.
    // Removes labels such as "GE 3:" while preserving the actual course code that follows.
    function stripGEIndex(courseName) {
        if (!courseName) return '';
        return courseName
            .replace(/^GE\s*\d+\s*:\s*/i, '')
            .replace(/^GE\s*\d+\s*/i, '')
            .trim();
    }

    // Converts a course label into a compact canonical key used for reliable comparisons, aliases, and set lookups.
    function normalizeCode(code) {
        if (!code) return '';
        const cacheKey = String(code);
        const cached = normalizeCache.get(cacheKey);
        if (cached !== undefined) return cached;

        // Step A: Strip a curriculum GE-slot prefix.
        // Example: "GE 8: STS 1" -> "STS 1"
        let cleaned = stripGEIndex(String(code)).replace(/\s+/g, ' ').trim();

        // Step B: Keep the actual course code while dropping class-section
        // and schedule suffixes. PE 2 activity codes must be preserved because
        // different activities are distinct completed courses.
        // Examples:
        //   "CS 33 WFR/HVW2" -> "CS 33"
        //   "Soc Sci 1 THR"   -> "Soc Sci 1"
        //   "PE 2 BD SDE"     -> "PE 2 BD"
        //   "PE 2 PG"         -> "PE 2 PG"
        //   "PE 1 MCD"        -> "PE 1"
        const peCodeMatch = cleaned.match(/^PE\s+(\d+)(?:\s+([A-Za-z0-9]+))?\b/i);

        if (peCodeMatch) {
            const peNumber = peCodeMatch[1];
            const activityCode = peCodeMatch[2]?.toUpperCase() || '';

            // PE 1 is a generic course. Any following token is a section code,
            // not a distinct PE activity.
            if (peNumber === '1') {
                cleaned = 'PE 1';
            } else if (activityCode) {
                cleaned = `PE ${peNumber} ${activityCode}`;
            } else {
                cleaned = `PE ${peNumber}`;
            }
        } else {
            // Preserve the subject and catalog number for non-PE courses.
            const courseCodeMatch = cleaned.match(
                /^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+(?:\.\d+)?[A-Za-z]?)\b/,
            );

            if (courseCodeMatch) {
                cleaned = `${courseCodeMatch[1]} ${courseCodeMatch[2]}`;
            }
        }

        // Step C: Convert to uppercase alphanumeric for strict comparison.
        let norm = cleaned.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        // Step D: STS alias exception (treat "STS" as "STS 1").
        if (norm === 'STS') {
            norm = 'STS1';
        }

        normalizeCache.set(cacheKey, norm);
        return norm;
    }

    // Determines whether a course should be treated as a GE course using the live GE list and fallback patterns.
    function isGECourse(codeStr) {
        if (!codeStr) return false;
        const raw = codeStr.trim();
        const norm = normalizeCode(raw);

        if (/^PI\s*100\b/i.test(norm)) return false;
        if (/^GE\b/i.test(raw)) return true;

        const cleanedTitle = sanitizeCourseTitle(raw);
        if (GE_COURSES_NORMALIZED.has(normalizeCode(cleanedTitle))) return true;

        const gePattern =
            /^(KAS\s*[12]|HIST\s*1|COMM\s*10|SPEECH\s*30|ENG\s*13|ENG\s*30|PHILO?\s*1|ARTS\s*1|PHILARTS\s*1|FIL\s*40|SOC\s*SCI\s*[12]|STS\s*1?|DRMAPS|SCIENCE\s*11|PHYSICS\s*10|MATH\s*10|\bGE\b|GE\s*ELECTIVE|AH\s*GE|SSP\s*GE|MST\s*GE|GE\s*AH|GE\s*SSP|GE\s*MST)/i;
        return gePattern.test(norm) || norm.includes('GE ') || norm.includes('SOC SCI');
    }

    // Assigns a course or curriculum slot to the mini-checklist category where it should be displayed.
    function getCourseCategory(courseName) {
        if (!courseName) return COURSE_CATEGORIES.CORE;

        const norm = normalizeCode(courseName);

        if (/^PI\s*100\b/i.test(norm)) return COURSE_CATEGORIES.CORE;
        if (/^(NSTP|CWTS|LTS|ROTC|MIL\s*SCI)/i.test(norm))
            return COURSE_CATEGORIES.NSTP;
        if (/^PE\b/i.test(norm)) return COURSE_CATEGORIES.PE;

        if (
            /^GE\b/i.test(courseName.trim()) ||
            isGECourse(courseName) ||
            /GE\s*COURSE\s*GROUP/i.test(norm)
        ) {
            return COURSE_CATEGORIES.REQUIRED_GE;
        }

        if (/^CS\s*17[1-6]\b/i.test(norm) || /CS\s*ELECTIVE/i.test(norm))
            return COURSE_CATEGORIES.CS_ELECTIVE;
        if (/FREE\s*ELECTIVE/i.test(norm) || (/ELECTIVE/i.test(norm) && !/GE/i.test(norm)))
            return COURSE_CATEGORIES.FREE_ELECTIVE;

        return COURSE_CATEGORIES.CORE;
    }

    const COURSE_DISPLAY_CASE_RULES = [
        [/\bARTS(?=\s*\d)/gi, 'ARTS'],
        [/\bKAS(?=\s*\d)/gi, 'KAS'],
        [/\bMATH(?=\s*\d)/gi, 'Math'],
        [/\bPHYSICS(?=\s*\d)/gi, 'Physics'],
        [/\bSOC\s+SCI(?=\s*(?:\d|$))/gi, 'Soc Sci'],
        [/\bPHILO(?=\s*\d)/gi, 'Philo'],
        [/\bENGG(?=\s*\d)/gi, 'Engg'],
        [/\bENG(?=\s*\d)/gi, 'Eng'],
        [/\bFIL(?=\s*\d)/gi, 'Fil'],
        [/\bSPEECH(?=\s*\d)/gi, 'Speech'],
        [/\bROTC\s+MIL\s+SCI(?=\s*\d)/gi, 'ROTC Mil Sci'],
        [/\bPI(?=\s*100\b)/gi, 'PI'],
    ];

    // Applies official CRS capitalization without changing the normalized
    // course codes used for matching and eligibility rules.
    function formatCourseDisplayName(courseName) {
        return COURSE_DISPLAY_CASE_RULES.reduce(
            (displayName, [pattern, replacement]) =>
                displayName.replace(pattern, replacement),
            String(courseName || ''),
        );
    }

    // Returns the raw labels that can identify one curriculum checklist entry.
    function getChecklistEntryLabels(data) {
        return [
            data?.rawName || '',
            data?.completedCourse || '',
            data?.curriculumSlot || '',
        ];
    }

    // Returns canonical aliases for one curriculum checklist entry.
    function getChecklistEntryCodes(data) {
        return [
            data?.normalizedRawName || normalizeCode(data?.rawName || ''),
            data?.normalizedCompletedCourse || normalizeCode(data?.completedCourse || ''),
            data?.normalizedCurriculumSlot || normalizeCode(data?.curriculumSlot || ''),
        ].filter(Boolean);
    }

    function buildChecklistIndexes(checklistEntries) {
        const passedCodes = new Set();
        const displayNameByCode = new Map();
        const entryByCode = new Map();

        for (const data of checklistEntries) {
            for (const code of getChecklistEntryCodes(data)) {
                if (!displayNameByCode.has(code)) {
                    displayNameByCode.set(code, data.rawName || code);
                }
                if (!entryByCode.has(code)) entryByCode.set(code, data);
                if (isPassingGrade(data.grade)) passedCodes.add(code);
            }
        }

        return { passedCodes, displayNameByCode, entryByCode };
    }

    // Extracts a normalized subject-and-number code from a CRS class description.
    function parseCourseCodeFromClassDescription(fullText) {
        if (!fullText) return '';
        const firstLine = fullText.split('\n')[0].trim();
        if (/^DRMAPS\b/i.test(firstLine)) return 'DRMAPS';
        const match = firstLine.match(/^([A-Za-z\s]+?)\s*(\d+(?:\.\d+)?[A-Za-z]?)\b/i);
        if (match) {
            return `${match[1].trim().toUpperCase()} ${match[2].trim().toUpperCase()}`;
        }
        return firstLine.replace(/\s+/g, ' ').trim().toUpperCase();
    }

    // Checks a course against the current GE list and the built-in GE fallbacks.
    function isGeCourseCode(courseCode) {
        if (!courseCode) return false;
        const normalized = normalizeCode(courseCode);
        return (
            GE_COURSES_NORMALIZED.has(normalized) ||
            isGECourse(courseCode) ||
            /^GE\b/i.test(courseCode) ||
            /^GE/.test(normalized)
        );
    }

    // Splits a prerequisite/corequisite cell into its cumulative requirements.
    function parseRequirementList(requirementText) {
        if (!requirementText || requirementText.toLowerCase() === 'none') return [];
        return requirementText
            .split(/[,;]|\band\b/i)
            .map((requirement) => stripGEIndex(requirement.trim()))
            .filter(Boolean);
    }

    // Parses the external prerequisite sheet into reusable rule indexes.
    function parsePrerequisiteRules(rulesRows) {
        const rules = [];
        const ruleByCode = new Map();

        for (const row of rulesRows.slice(1)) {
            if (!row?.[0]) continue;
            const course = stripGEIndex(row[0].trim());
            const rule = {
                course,
                normCourse: normalizeCode(course),
                prerequisites: parseRequirementList(row[1]?.trim() || ''),
                corequisites: parseRequirementList(row[2]?.trim() || ''),
                semesterOffered: parseSemesterOfferingTerms(row[3]),
                hasLab: parseHasLab(row[4]),
            };
            rules.push(rule);
            ruleByCode.set(rule.normCourse, rule);
        }

        return { rules, ruleByCode };
    }

    // Applies curriculum-specific rules that cannot be expressed globally in
    // the shared prerequisite sheet. Math 20 is a bridging course: only
    // checklist entries that contain it should require it before Math 21.
    // A currently enlisted Math 20 is inserted into that checklist first.
    function applyCurriculumSpecificRuleOverrides(parsedRules, checklistEntries) {
        const hasMath20 = checklistEntries.some((data) =>
            getChecklistEntryCodes(data).includes('MATH20'),
        );
        if (!hasMath20) return parsedRules;

        let math20Rule = parsedRules.ruleByCode.get('MATH20');
        if (!math20Rule) {
            math20Rule = {
                course: 'Math 20',
                normCourse: 'MATH20',
                prerequisites: [],
                corequisites: [],
                semesterOffered: ['1', '2', 'M'],
                hasLab: false,
            };
            parsedRules.rules.push(math20Rule);
            parsedRules.ruleByCode.set(math20Rule.normCourse, math20Rule);
        }

        const math21Rule = parsedRules.ruleByCode.get('MATH21');
        if (
            math21Rule &&
            !math21Rule.prerequisites.some(
                (requirement) => normalizeCode(requirement) === 'MATH20',
            )
        ) {
            math21Rule.prerequisites.push('Math 20');
        }

        return parsedRules;
    }

    // Adds the non-credit bridging course to the mini checklist when CRS shows
    // it as currently enlisted but the curriculum checklist omits it.
    function ensureEnlistedMath20ChecklistEntry(
        checklistEntryMap,
        currentlyEnlistedCourseCodes,
    ) {
        const alreadyListed = Array.from(checklistEntryMap.values()).some((data) =>
            getChecklistEntryCodes(data).includes('MATH20'),
        );
        const isEnlisted = currentlyEnlistedCourseCodes.some(
            (courseCode) => normalizeCode(courseCode) === 'MATH20',
        );
        if (alreadyListed || !isEnlisted) return false;

        checklistEntryMap.set('MATH20___enlisted', {
            grade: 'null',
            rawName: 'Math 20',
            curriculumSlot: 'Math 20',
            completedCourse: 'Math 20',
            semester: '--',
            units: '(4)',
            normalizedRawName: 'MATH20',
            normalizedCurriculumSlot: 'MATH20',
            normalizedCompletedCourse: 'MATH20',
            category: COURSE_CATEGORIES.CORE,
            isPE: false,
            isNSTP: false,
            isGE: false,
            isCurrentlyEnlisted: true,
        });
        return true;
    }

    function isZeroAcademicUnitCourse(courseName, category = '') {
        return (
            NON_ACADEMIC_CATEGORIES.has(category) ||
            ZERO_ACADEMIC_UNIT_COURSE_CODES.has(normalizeCode(courseName))
        );
    }

    // Returns both academic-load units and the value shown beside the course.
    // Parenthesized display units identify courses excluded from academic load.
    function getCourseUnitValues(courseName, category, rawUnits, fallbackUnits = 3) {
        const parsedUnits = Number.parseFloat(
            String(rawUnits ?? '').replace(/[^0-9.\-]/g, ''),
        );
        const listedUnits =
            Number.isFinite(parsedUnits) && parsedUnits > 0
                ? parsedUnits
                : fallbackUnits;
        const normalizedCode = normalizeCode(courseName);
        const displayUnits =
            normalizedCode === 'MATH20'
                ? 4
                : category === COURSE_CATEGORIES.NSTP
                  ? 3
                  : category === COURSE_CATEGORIES.PE
                    ? 2
                    : listedUnits;

        return {
            units: isZeroAcademicUnitCourse(courseName, category) ? 0 : listedUnits,
            displayUnits,
        };
    }

    // Checks whether at least half of the current academic load consists of
    // not-yet-passed foundation CS/Math courses. Math 20 remains visible as a
    // four-unit course but contributes zero to academic-load accounting.
    function getFoundationLoadRuleStatus(
        totalLoadUnits,
        enlistedCourses,
        hasPassedCourse = () => false,
    ) {
        const normalizedTotalUnits = Number(totalLoadUnits);
        const totalUnits =
            Number.isFinite(normalizedTotalUnits) && normalizedTotalUnits > 0
                ? normalizedTotalUnits
                : 0;
        const foundationUnits = (Array.isArray(enlistedCourses)
            ? enlistedCourses
            : []
        ).reduce((sum, course) => {
            const normalizedCode = normalizeCode(
                course?.normalizedCode || course?.baseCode || '',
            );
            if (
                !FOUNDATION_LOAD_COURSE_CODES.has(normalizedCode) ||
                hasPassedCourse(normalizedCode)
            ) {
                return sum;
            }

            const { units } = getCourseUnitValues(
                normalizedCode,
                COURSE_CATEGORIES.CORE,
                course?.creditText,
            );
            return sum + units;
        }, 0);

        return {
            totalUnits,
            foundationUnits,
            ratio: totalUnits > 0 ? foundationUnits / totalUnits : 0,
            satisfied: totalUnits <= 0 || foundationUnits >= totalUnits * 0.5,
        };
    }

    // Returns null when the requirement is not a standing rule; otherwise,
    // evaluates it against completed academic units.
    function getStandingRequirementStatus(requirement, academicUnits) {
        const threshold = STANDING_UNIT_THRESHOLDS[normalizeCode(requirement)];
        if (!threshold) return null;

        const normalizedUnits = Number(academicUnits);
        return Number.isFinite(normalizedUnits) && normalizedUnits >= threshold;
    }

    // Converts internal standing-rule tokens into adviser-facing labels while
    // preserving any other course requirements or OR expressions unchanged.
    function formatRequirementForDisplay(requirement) {
        return String(requirement || '')
            .replace(/\bSO[_\s]*STANDING\b/gi, 'SOPHOMORE STANDING')
            .replace(/\bJR[_\s]*STANDING\b/gi, 'JUNIOR STANDING')
            .replace(/\bSR[_\s]*STANDING\b/gi, 'SENIOR STANDING');
    }

    function getNstpPrerequisites(nstpLevel, existingPrerequisites = []) {
        const prerequisites = [...existingPrerequisites];
        if (
            nstpLevel === 1 &&
            !prerequisites.some(
                (requirement) =>
                    normalizeCode(requirement) ===
                    normalizeCode(NSTP_1_STANDING_REQUIREMENT),
            )
        ) {
            prerequisites.push(NSTP_1_STANDING_REQUIREMENT);
        }
        return prerequisites;
    }

    function normalizeStudentNumber(value) {
        return String(value || '').replace(/\D/g, '');
    }

    // Reads the Student number column even when the sheet has notes or update
    // timestamps above the actual table header.
    function parseVsoStudentNumbers(rows) {
        if (!Array.isArray(rows)) return new Set();

        const headerRowIndex = rows.findIndex((row) =>
            row.some(
                (cell) =>
                    String(cell || '')
                        .replace(/[^a-z]/gi, '')
                        .toLowerCase() === 'studentnumber',
            ),
        );
        if (headerRowIndex < 0) return new Set();

        const headerRow = rows[headerRowIndex];
        const studentNumberColumn = headerRow.findIndex(
            (cell) =>
                String(cell || '')
                    .replace(/[^a-z]/gi, '')
                    .toLowerCase() === 'studentnumber',
        );

        return new Set(
            rows
                .slice(headerRowIndex + 1)
                .map((row) => normalizeStudentNumber(row?.[studentNumberColumn]))
                .filter((studentNumber) => /^\d{9}$/.test(studentNumber)),
        );
    }

    function isStudentInVsoRows(studentNumber, rows) {
        const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
        return (
            /^\d{9}$/.test(normalizedStudentNumber) &&
            parseVsoStudentNumbers(rows).has(normalizedStudentNumber)
        );
    }

    // Identifies the generic GE-elective checklist slot across its aliases.
    function isGeElectiveChecklistEntry(data) {
        return [
            ...getChecklistEntryLabels(data),
            ...getChecklistEntryCodes(data),
        ].some((value) => /GE\s*ELECTIVE|GEELECTIVE/i.test(value));
    }

    // Resolves one concrete option in the paired GE requirement families.
    function getPairedGeOption(courseCode) {
        const normalized = normalizeCode(courseCode);
        if (normalized === 'SOCSCI1' || normalized === 'SOCSCI10') return 'SOCSCI1';
        if (normalized === 'SOCSCI2' || normalized === 'SOCSCI20') return 'SOCSCI2';
        if (normalized === 'STS' || normalized === 'STS1' || normalized === 'STS10')
            return 'STS1';
        if (
            normalized === 'DRMAPS' ||
            normalized === 'DRMAPS1' ||
            normalized === 'DRMAPS10'
        )
            return 'DRMAPS';
        return '';
    }

    // Resolves the paired GE family represented by one or more labels.
    function getPairedGeFamily(...courseLabels) {
        const labels = courseLabels.filter(Boolean);
        const combined = labels.join(' ');
        if (/SOC\s*SCI\s*1\s*\/\s*2/i.test(combined)) return 'SOCSCI';
        if (/STS\s*\/\s*DRMAPS/i.test(combined)) return 'STSDRMAPS';

        const options = labels.map(getPairedGeOption).filter(Boolean);
        if (options.some((option) => option === 'SOCSCI1' || option === 'SOCSCI2'))
            return 'SOCSCI';
        if (options.some((option) => option === 'STS1' || option === 'DRMAPS'))
            return 'STSDRMAPS';
        return '';
    }

    // Resolves the NSTP sequence level represented by one or more labels.
    function getNstpLevel(...courseCodes) {
        for (const courseCode of courseCodes) {
            const match = normalizeCode(courseCode).match(
                /^(?:NSTP|CWTS|LTS|ROTC|ROTCMILSCI|MILSCI)([12])/,
            );
            if (match) return Number(match[1]);
        }
        return null;
    }

    function getProgressionMaximumUnits(termCode, courses) {
        if (termCode === TERM_CODES.MIDYEAR) return 6;
        return courses.some((course) => course.hasLab) ? 21 : 18;
    }

    // Combines the authoritative CRS enlisted-unit total with proposed
    // additions. Enlisted course metadata remains part of the course set so
    // lab-aware caps and exclusive Midyear CS 195 loads are evaluated against
    // the student's actual current load, not only the new recommendations.
    function getProgressionLoadSummary(
        termCode,
        currentEnlistedUnits,
        enlistedCourses,
        additionalCourses,
    ) {
        const normalizedCurrentUnits = Number(currentEnlistedUnits);
        const currentUnits =
            Number.isFinite(normalizedCurrentUnits) && normalizedCurrentUnits > 0
                ? normalizedCurrentUnits
                : 0;
        const currentCourses = Array.isArray(enlistedCourses) ? enlistedCourses : [];
        const additions = Array.isArray(additionalCourses) ? additionalCourses : [];
        const additionalUnits = additions.reduce((sum, course) => {
            const units = Number(course?.units);
            return sum + (Number.isFinite(units) && units > 0 ? units : 0);
        }, 0);
        const combinedCourses = [...currentCourses, ...additions];

        return {
            currentUnits,
            additionalUnits,
            totalUnits: currentUnits + additionalUnits,
            maximumUnits: getProgressionMaximumUnits(termCode, combinedCourses),
            combinedCourses,
        };
    }

    // Converts a prerequisite-valid CRS enlistment into the same shape used
    // by the prescribed progression. This allows valid current courses to be
    // fixed into the first term even when they do not match an unfinished
    // checklist row or the external sheet's semester placement.
    function buildEnlistedProgressionCandidate(enlistedCourse, rule = null) {
        const normCode = enlistedCourse?.normalizedCode || '';
        const course = formatCourseDisplayName(
            cleanExtractedCourseTitle(
                enlistedCourse?.baseCode || enlistedCourse?.firstLine || '',
            ),
        );
        let category = getCourseCategory(course);
        if (/^PE\b/i.test(course)) category = COURSE_CATEGORIES.PE;
        if (category === COURSE_CATEGORIES.CORE && !rule) {
            category = COURSE_CATEGORIES.FREE_ELECTIVE;
        }

        const { units, displayUnits } = getCourseUnitValues(
            normCode || course,
            category,
            enlistedCourse?.creditText,
        );

        return {
            id: `__enlisted__${normCode}`,
            normCode,
            course,
            units,
            displayUnits,
            category,
            nstpLevel:
                category === COURSE_CATEGORIES.NSTP
                    ? getNstpLevel(normCode, course)
                    : null,
            prerequisites: rule?.prerequisites || [],
            corequisites: rule?.corequisites || [],
            semesterOffered: rule?.semesterOffered?.length
                ? rule.semesterOffered
                : ['1', '2', 'M'],
            hasLab: Boolean(
                rule?.hasLab || /\blab\b/i.test(enlistedCourse?.scheduleText || ''),
            ),
            isCurrentlyEnlisted: true,
            isPlaceholder: false,
        };
    }

    function isCs195Course(course) {
        return course?.normCode === 'CS195';
    }

    function isValidProgressionCourseSet(termCode, courses) {
        if (termCode !== TERM_CODES.MIDYEAR || !courses.some(isCs195Course)) return true;
        return courses.every(isCs195Course);
    }

    function getNextTermCode(termCode) {
        if (termCode === TERM_CODES.FIRST) return TERM_CODES.SECOND;
        if (termCode === TERM_CODES.SECOND) return TERM_CODES.MIDYEAR;
        return TERM_CODES.FIRST;
    }

    function buildProgressionTermHeading(
        termCode,
        academicYearStart,
        isStartingTerm,
        currentAdvisingHeading,
    ) {
        if (Number.isFinite(academicYearStart)) {
            if (termCode === TERM_CODES.MIDYEAR) return `Midyear ${academicYearStart + 1}`;

            const compactAcademicYear =
                `${String(academicYearStart).slice(-2)}` +
                `${String(academicYearStart + 1).slice(-2)}`;
            return `${TERM_NAMES[termCode]} ${compactAcademicYear}`;
        }

        if (isStartingTerm && currentAdvisingHeading) {
            if (termCode === TERM_CODES.MIDYEAR) {
                return currentAdvisingHeading.replace(
                    /\b(?:Midyear\s+)?AY\s*(\d{4})\s*[-–]\s*(\d{4})\b/i,
                    'Midyear $2',
                );
            }

            return currentAdvisingHeading
                .replace(/\bFirst\s+Semester\b/i, 'First Sem')
                .replace(/\bSecond\s+Semester\b/i, 'Second Sem')
                .replace(
                    /\bAY\s*\d{2}(\d{2})\s*[-–]\s*\d{2}(\d{2})\b/i,
                    '$1$2',
                );
        }

        return TERM_NAMES[termCode];
    }

    // Converts a raw CRS class description into a clean human-readable course code for display.
    // Formatting Rules:
    // - NSTP: CWTS 1, CWTS 2, LTS 1, LTS 2, ROTC Mil Sci 1, ROTC Mil Sci 2
    // - PE: PE 2 PG, PE 2 RF, PE 1
    // - CS Electives & Free Electives: Strictly "Subject Number" (e.g., CS 175, Psych 101)
    function cleanExtractedCourseTitle(rawClass, catName = '') {
        if (!rawClass) return '';
        let cleaned = rawClass
            .split('\n')[0]
            .replace(/<[^>]*>/g, '')
            .trim();

        // Remove metadata like section, schedule, instructor
        cleaned = cleaned.replace(
            /\s+(LEC|LAB|LECTURE|LABORATORY|SEC|SECTION|WF|TTH|MTH|M|T|W|TH|F|S)\b.*/i,
            '',
        );

        // 1. NSTP Track Format (CWTS 1/2, LTS 1/2, ROTC Mil Sci 1/2)
        const nstpMatch = cleaned.match(
            /\b(NSTP|CWTS|LTS|ROTC\s*Mil\s*Sci|ROTC|Mil\s*Sci)\s*([12])\b/i,
        );
        if (nstpMatch) {
            let track = nstpMatch[1].replace(/\s+/g, ' ').toUpperCase();

            if (track === 'NSTP') {
                track = 'NSTP';
            } else if (track.includes('ROTC') || track.includes('MIL')) {
                track = 'ROTC Mil Sci';
            } else if (track.includes('CWTS')) {
                track = 'CWTS';
            } else if (track.includes('LTS')) {
                track = 'LTS';
            }

            return `${track} ${nstpMatch[2]}`;
        }

        // 2. PE Format (e.g. PE 2 PG)
        const peMatch = cleaned.match(/^PE\s+(\d+)\s+([A-Za-z0-9]+)/i);
        if (peMatch) {
            return `PE ${peMatch[1]} ${peMatch[2].toUpperCase()}`;
        }

        // Preserve the complete subject name before the catalog number.
        // This supports both single-word and multiword subjects, including
        // "CS 175", "Soc Sci 1", "Art Stud 2", and "Pan Pil 17".
        const courseCodeMatch = cleaned.match(
            /^([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*){0,3})\s+(\d+(?:\.\d+)?[A-Za-z]?)\b/i,
        );

        if (courseCodeMatch) {
            const subject = courseCodeMatch[1]
                .split(/\s+/)
                .map((token) => {
                    const upperToken = token.toUpperCase();
                    if (ACRONYM_SUBJECTS.has(upperToken)) return upperToken;
                    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
                })
                .join(' ');

            return `${subject} ${courseCodeMatch[2]}`;
        }

        // Retain the cleaned source text when no valid course code is found.
        return cleaned;
    }

    // Compares two course labels using case-insensitive natural-number ordering.
    function naturalCourseSort(aStr, bStr) {
        return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
    }

    function getProgressionDisplayGroup(course) {
        if (course.category === COURSE_CATEGORIES.CORE) return 0;
        if (POST_CORE_ACADEMIC_CATEGORIES.has(course.category)) return 1;
        if (course.category === COURSE_CATEGORIES.PE) return 2;
        if (course.category === COURSE_CATEGORIES.NSTP) return 3;
        return 1;
    }

    // Keeps current enlistments together at the top of the active term, then
    // applies the established category and natural course-code ordering within
    // the enlisted and recommended sections independently.
    function sortProgressionCourses(courses) {
        return [...courses].sort((a, b) => {
            const enlistmentDifference =
                Number(Boolean(b.isCurrentlyEnlisted)) -
                Number(Boolean(a.isCurrentlyEnlisted));
            if (enlistmentDifference !== 0) return enlistmentDifference;

            const groupDifference =
                getProgressionDisplayGroup(a) - getProgressionDisplayGroup(b);
            if (groupDifference !== 0) return groupDifference;

            return naturalCourseSort(a.course, b.course);
        });
    }

    // Sorts GE entries primarily by their GE curriculum-slot number and secondarily by course name.
    function sortGECourses(a, b) {
        // Extracts the numeric GE-slot index used to order required GE entries.
        const getGeNum = (item) => {
            const targetStr = item.curriculumSlot || item.rawName || '';
            const match = targetStr.match(/GE\s*(\d+)/i);
            return match ? parseInt(match[1], 10) : null;
        };

        const numA = getGeNum(a);
        const numB = getGeNum(b);

        if (numA !== null && numB !== null) {
            if (numA !== numB) return numA - numB;
            return naturalCourseSort(a.curriculumSlot, b.curriculumSlot);
        }
        if (numA !== null) return -1;
        if (numB !== null) return 1;

        return naturalCourseSort(a.curriculumSlot, b.curriculumSlot);
    }

    function getImmediatePrereqRules(cachedRulesRows) {
        return hasProgressionMetadataColumns(cachedRulesRows)
            ? cachedRulesRows
            : BUILT_IN_PREREQ_RULES_ROWS;
    }

    function isFreshChecklistCacheEntry(entry, now = Date.now()) {
        return Boolean(
            entry &&
            typeof entry.html === 'string' &&
            now - Number(entry.cachedAt || 0) < CHECKLIST_SESSION_CACHE_EXPIRY_MS,
        );
    }

    // Expose pure helpers only when an explicit test harness requests them.
    // Normal userscript execution does not add anything to the global object.
    if (globalThis.__USAD_CS_TEST_MODE__) {
        globalThis.__USAD_CS_INTERNALS__ = Object.freeze({
            normalizeCode,
            getCourseCategory,
            formatCourseDisplayName,
            cleanExtractedCourseTitle,
            parseCourseCodeFromClassDescription,
            parseRequirementList,
            parsePrerequisiteRules,
            applyCurriculumSpecificRuleOverrides,
            ensureEnlistedMath20ChecklistEntry,
            isZeroAcademicUnitCourse,
            getCourseUnitValues,
            getFoundationLoadRuleStatus,
            getPassedAttemptLimit,
            hasReachedPassedAttemptLimit,
            getStandingRequirementStatus,
            formatRequirementForDisplay,
            getNstpPrerequisites,
            normalizeStudentNumber,
            parseVsoStudentNumbers,
            isStudentInVsoRows,
            getPairedGeOption,
            getPairedGeFamily,
            getNstpLevel,
            getProgressionMaximumUnits,
            getProgressionLoadSummary,
            buildEnlistedProgressionCandidate,
            sortProgressionCourses,
            isValidProgressionCourseSet,
            getNextTermCode,
            buildProgressionTermHeading,
            parseSemesterOfferingTerms,
            parseHasLab,
            getImmediatePrereqRules,
            isFreshChecklistCacheEntry,
        });
    }

    if (!studentIdHeader) return;

    // -------------------------------------------------------------------------
    // 4. Advising panel interface
    // -------------------------------------------------------------------------
    // Build the fixed USAD-CS advising and recommendation panel that appears over the CRS page.
    function createAdvisingOverlay() {
        const panel = document.createElement('div');
        panel.style.cssText = `
        position: fixed; top: 15px; right: 15px; width: 800px; max-width: calc(100vw - 50px);
        max-height: 88vh; overflow-y: auto;
        background: #ffffff; border: 2px solid #7b1113; border-radius: 8px;
        padding: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        z-index: 9999; font-family: Arial, sans-serif; font-size: 12px; color: #333;
    `;

        panel.innerHTML = `
        <div id="advising-panel-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; margin-bottom: 8px;">
            <div style="min-width: 0;">
                <div style="color: #7b1113; font-size: 18px; line-height: 1.1; font-weight: bold;">USAD-CS v1.0</div>
                <div style="margin-top: 2px; color: #7b1113; font-size: 10px; line-height: 1.5; white-space: nowrap;"><b>U</b>nified <b>S</b>tudent <b>A</b>dvising and <b>D</b>egree-Progression Recommender Tool</div>
            </div>
            <div style="display: flex; align-items: center; gap: 5px;">
                <button id="btn-refresh-sheet" type="button" title="Refresh rules" aria-label="Refresh rules" style="cursor:pointer; font-size: 9px; line-height: 1.1; white-space: nowrap; padding: 2px 5px; background:#e0e0e0; border:1px solid #bbb; border-radius:3px;">Refresh Rules</button>
                <button id="btn-minimize-panel" type="button" title="Minimize extension" aria-label="Minimize extension" style="cursor:pointer; font-size: 14px; line-height: 1; width: 25px; height: 25px; padding: 0; background:#f5f5f5; color:#7b1113; border:1px solid #bbb; border-radius:50%; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;">▴</button>
            </div>
        </div>
        <div id="advising-panel-body">
        <div id="info-name" style="font-size: 13px;margin-top: 12px;"><b>Name:</b> ${escapeHTML(pageStudentName)}</div>
        <div id="info-id" style="font-size: 13px; margin-bottom: 10px;"><b>Student ID:</b> ${escapeHTML(studentId || 'N/A')}</div>

        <div id="unit-status"></div>
        <div id="foundation-load-rule-status"></div>
        <div id="vso-status"></div>
        <div id="matcher-status" style="margin-top: 5px;"></div>

        <div id="recommendations-requirements-layout" style="display: flex; align-items: stretch; gap: 6px; margin-top: 5px;">
            <div id="prereq-recommender-box" style="display: flex; flex: 1 1 50%; min-width: 0; flex-direction: column; padding: 6px; background: #e7f3ff; border: 1px solid #b6d4fe; border-radius: 6px; font-size: 11px; box-sizing: border-box;">
                <b style="color: #7b1113; font-size: 13px; display: block; margin-bottom: 3px;">👍 Recommended Courses</b>
                <div id="prereq-status-msg" style="font-size: 11px; color: #666;">Waiting for checklist data...</div>
                <div id="prereq-recommendations-list" style="flex: 1 1 0; min-height: 0; margin-top: 4px; overflow-y: auto; font-size: 11px;"></div>
            </div>
            <div id="requirements-summary-container" style="display: flex; flex: 1 1 50%; min-width: 0; flex-direction: column; gap: 5px; box-sizing: border-box;"></div>
        </div>

        <div id="progression-recommender-box" style="margin-top: 5px; padding: 6px; background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <b style="color: #7b1113; font-size: 13px;">📈 Progression Recommender</b>
                <button id="btn-toggle-progression" type="button" style="cursor:pointer; font-size:10px; padding:2px 6px; background:#e0e0e0; border:1px solid #bbb; border-radius:3px;">Show</button>
            </div>
            <div id="progression-recommender-content" style="display:none;">
                <div id="progression-recommender-status" style="margin-top: 3px; color: #666; font-size: 11px;">Waiting for checklist and prerequisite data...</div>
                <div id="progression-recommender-load" style="margin-top: 4px;"></div>
            </div>
        </div>
        <div id="checklist-status" style="margin-top: 5px; padding: 6px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <b style="color: #7b1113; font-size: 13px;">Mini BSCS Curriculum Checklist</b>
                <button id="btn-toggle-checklist" style="cursor: pointer; font-size: 10px; padding: 2px 6px; background: #e0e0e0; border: 1px solid #bbb; border-radius: 3px;">Show</button>
            </div>
            <div id="checklist-content" style="display: none; margin-top: 4px;">
                <div id="sil-status" style="font-size: 11px; color: #666; text-align: center; font-weight: bold;">Fetching checklist...</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 1px 3px; font-size: 10px; color: #555;">
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none;">
                        <input id="chk-show-satisfied-courses" type="checkbox" checked style="margin: 0; cursor: pointer;">
                        Show satisfied courses
                    </label>
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none;">
                        <input id="chk-show-unsatisfied-courses" type="checkbox" checked style="margin: 0; cursor: pointer;">
                        Show unsatisfied courses
                    </label>
                </div>
                <div id="formatted-checklist-view" style="margin-top: 3px; max-height: 210px; overflow-y: auto; background: #ffffff; border: 1px solid #ccc; border-radius: 4px; padding: 4px;"></div>
            </div>
        </div>
        </div>
    `;

        document.body.appendChild(panel);
        return panel;
    }

    const overlay = createAdvisingOverlay();

    // Clear cached prerequisite and GE data when the adviser requests a manual refresh.
    // Forces a fresh download of both the prerequisite rules and the current
    // GE course list. Clearing the cached GE source also makes the script
    // revisit the GEC webpage and verify the currently linked GE-list PDF.
    document.getElementById('btn-refresh-sheet').onclick = () => {
        localStorage.removeItem(CURRICULUM_RULES_CACHE_KEY);
        localStorage.removeItem(CURRICULUM_RULES_CACHE_TIME_KEY);
        localStorage.removeItem(LEGACY_PREREQ_CACHE_KEY);
        localStorage.removeItem(LEGACY_PREREQ_CACHE_TIME_KEY);
        localStorage.removeItem(VSO_CACHE_KEY);
        localStorage.removeItem(VSO_CACHE_TIME_KEY);
        localStorage.removeItem(GE_LIST_CACHE_KEY);
        localStorage.removeItem(GE_LIST_CACHE_TIME_KEY);
        localStorage.removeItem(GE_LIST_CACHE_SOURCE_KEY);
        location.reload();
    };

    // Collapse the complete extension into its title bar and restore it on demand.
    // The chosen state is retained when the CRS page is reloaded.
    const PANEL_MINIMIZED_KEY = 'bscs_advising_panel_minimized';
    const panelHeader = document.getElementById('advising-panel-header');
    const panelBody = document.getElementById('advising-panel-body');
    const minimizePanelBtn = document.getElementById('btn-minimize-panel');
    const refreshRulesBtn = document.getElementById('btn-refresh-sheet');

    function setPanelMinimized(isMinimized) {
        panelBody.style.display = isMinimized ? 'none' : 'block';
        refreshRulesBtn.style.display = isMinimized ? 'none' : 'inline-block';
        panelHeader.style.marginBottom = isMinimized ? '0' : '8px';
        overlay.style.width = isMinimized ? 'auto' : '420px';
        overlay.style.maxHeight = isMinimized ? 'none' : '88vh';
        overlay.style.overflowY = isMinimized ? 'hidden' : 'auto';
        minimizePanelBtn.innerText = isMinimized ? '▾' : '▴';
        minimizePanelBtn.title = isMinimized ? 'Restore extension' : 'Minimize extension';
        minimizePanelBtn.setAttribute(
            'aria-label',
            isMinimized ? 'Restore extension' : 'Minimize extension',
        );
        localStorage.setItem(PANEL_MINIMIZED_KEY, isMinimized ? '1' : '0');
    }

    let isPanelMinimized = localStorage.getItem(PANEL_MINIMIZED_KEY) === '1';
    setPanelMinimized(isPanelMinimized);

    minimizePanelBtn.onclick = () => {
        isPanelMinimized = !isPanelMinimized;
        setPanelMinimized(isPanelMinimized);
    };

    const toggleChecklistBtn = document.getElementById('btn-toggle-checklist');
    const checklistContent = document.getElementById('checklist-content');
    const showSatisfiedCoursesCheckbox = document.getElementById('chk-show-satisfied-courses');
    const showUnsatisfiedCoursesCheckbox = document.getElementById('chk-show-unsatisfied-courses');
    let showSatisfiedChecklistCourses = true;
    let showUnsatisfiedChecklistCourses = true;
    toggleChecklistBtn.onclick = () => {
        if (checklistContent.style.display === 'none') {
            checklistContent.style.display = 'block';
            toggleChecklistBtn.innerText = 'Hide';
        } else {
            checklistContent.style.display = 'none';
            toggleChecklistBtn.innerText = 'Show';
        }
    };

    // Re-render the mini checklist whenever either course-status filter changes.
    // Category totals and the units-passed summary continue to use the complete
    // checklist data, regardless of which rows are currently visible.
    function updateChecklistCourseFilters() {
        showSatisfiedChecklistCourses = showSatisfiedCoursesCheckbox.checked;
        showUnsatisfiedChecklistCourses = showUnsatisfiedCoursesCheckbox.checked;

        const formattedView = document.getElementById('formatted-checklist-view');
        if (formattedView && extractedStudentGrades.size > 0) {
            renderFormattedChecklist(formattedView);
        }
    }

    showSatisfiedCoursesCheckbox.onchange = updateChecklistCourseFilters;
    showUnsatisfiedCoursesCheckbox.onchange = updateChecklistCourseFilters;

    // Hide or restore the long prescribed progression independently of the
    // complete USAD-CS panel, and retain the preference across page reloads.
    const PROGRESSION_HIDDEN_KEY = 'bscs_progression_recommender_hidden_v2';
    const toggleProgressionBtn = document.getElementById('btn-toggle-progression');
    const progressionContent = document.getElementById('progression-recommender-content');

    function setProgressionHidden(isHidden) {
        progressionContent.style.display = isHidden ? 'none' : 'block';
        toggleProgressionBtn.innerText = isHidden ? 'Show' : 'Hide';
        toggleProgressionBtn.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        localStorage.setItem(PROGRESSION_HIDDEN_KEY, isHidden ? '1' : '0');
    }

    const storedProgressionHidden = localStorage.getItem(
        PROGRESSION_HIDDEN_KEY,
    );
    let isProgressionHidden =
        storedProgressionHidden === null || storedProgressionHidden === '1';
    setProgressionHidden(isProgressionHidden);
    toggleProgressionBtn.onclick = () => {
        isProgressionHidden = !isProgressionHidden;
        setProgressionHidden(isProgressionHidden);
    };

    function applyVsoAdvisingRestrictions() {
        const vsoStatusDiv = document.getElementById('vso-status');
        if (vsoStatusDiv) {
            vsoStatusDiv.innerHTML = `<div style="color:#842029; background-color:#f8d7da; border:1px solid #f5c2c7; padding:5px 6px; border-radius:4px; margin-top:5px; font-size:13px;">🚫 <strong>Do not advise!</strong> (VSO student)</div>`;
        }

        [
            document.getElementById('unit-status'),
            document.getElementById('foundation-load-rule-status'),
            document.getElementById('matcher-status'),
            document.getElementById('recommendations-requirements-layout'),
            document.getElementById('progression-recommender-box'),
        ].forEach((element) => {
            if (element) element.style.display = 'none';
        });
    }

    initializeAdvisingAssistant();

    // Loads the current GE course list, reports initialization status, and then fetches the student checklist.
    async function initializeAdvisingAssistant() {
        const statusDiv = document.getElementById('sil-status');

        if (statusDiv) {
            statusDiv.style.color = '#666';
            statusDiv.innerText = 'Checking VSO status...';
        }

        // Resolve VSO status before inspecting current enlistments or starting
        // any recommendation-support workflow. Listed students need only the
        // curriculum checklist, so GE and curriculum-rule work is unnecessary.
        vsoStatusReadyPromise = loadVsoStudentStatus(studentId)
            .then((isListed) => {
                isVsoStudent = isListed;
                vsoStatusResolved = true;
                if (isListed) applyVsoAdvisingRestrictions();
                return isListed;
            })
            .catch((error) => {
                vsoStatusResolved = true;
                console.error('[USAD-CS] VSO roster loading failed:', error);
                return false;
            });
        const listedAsVso = await vsoStatusReadyPromise;

        if (listedAsVso) {
            await silentFetchChecklist(studentId);
            return;
        }

        if (statusDiv) {
            statusDiv.innerText = 'Loading checklist and current GEC course list...';
        }

        // After VSO exclusion, start the full advising workflows concurrently.
        geCourseListReadyPromise = loadGECourseList()
            .then((courses) => {
                console.log(
                    `[USAD-CS] Loaded ${courses.length} GE courses from ${geCourseListSource || 'cache'}`,
                );
                return courses;
            })
            .catch((error) => {
                console.error('[USAD-CS] GE list loading failed:', error);
                return [];
            });

        // Start the prerequisite-rules request at the same time as the GE and
        // checklist workflows. Evaluation still waits for checklist parsing,
        // but it no longer starts this independent network request afterward.
        prereqRulesReadyPromise = loadPrereqRules().catch((error) => {
            console.error('[USAD-CS] Prerequisite rules loading failed:', error);
            return null;
        });
        const checklistPromise = silentFetchChecklist(studentId);
        await Promise.allSettled([
            geCourseListReadyPromise,
            prereqRulesReadyPromise,
            vsoStatusReadyPromise,
            checklistPromise,
        ]);
    }

    // -------------------------------------------------------------------------
    // 5. Academic load status
    // -------------------------------------------------------------------------
    // Evaluate the student's current enlisted load and show the appropriate status banner.
    const totalUnits = getTotalUnits();
    const unitDiv = document.getElementById('unit-status');
    const minimumRegularUnits = isMidyearTerm ? 1.0 : 15.0;
    const maximumRegularUnits = isMidyearTerm ? 6.0 : 21.0;

    if (totalUnits < minimumRegularUnits) {
        unitDiv.innerHTML = `<div style="color: #664d03; background-color: #fff3cd; border: 1px solid #ffe69c; padding: 5px 6px; border-radius: 4px; margin-top: 5px; font-size: 13px;"><strong>⚠️ Underloaded: ${totalUnits} units</strong> (&lt; ${minimumRegularUnits.toFixed(1)}) (Apply for underloading)</div>`;
    } else if (totalUnits > maximumRegularUnits) {
        unitDiv.innerHTML = `<div style="color: #842029; background-color: #f8d7da; border: 1px solid #f5c2c7; padding: 5px 6px; border-radius: 4px; margin-top: 5px; font-size: 13px;"><strong>⚠️ Overloaded: ${totalUnits} units</strong> (&gt; ${maximumRegularUnits.toFixed(1)}) (Apply for Permit to Overload)</div>`;
    } else {
        unitDiv.innerHTML = `<div style="color: #0f5132; background-color: #d1e7dd; border: 1px solid #badbcc; padding: 5px 6px; border-radius: 4px; margin-top: 5px; font-size: 13px; font-weight: bold;">🟢 Normal Load: ${totalUnits} units</div>`;
    }

    // -------------------------------------------------------------------------
    // 6. Semester and grade-history helpers
    // -------------------------------------------------------------------------

    // Converts a CRS semester label into a sortable numeric value.
    // Examples: 1st Sem 22-23 -> 2022.1; Midyear 2023 -> 2023.2.
    // Converts a CRS semester label into a sortable numeric weight so the most recent attempt can be selected.
    function parseTermWeight(termStr) {
        if (!termStr || termStr === '--') return -1;

        // Match patterns like "1st Sem 22-23", "2nd Sem 2022-2023", "Midyear 2023", etc.
        const yearMatch = termStr.match(/\b(20\d{2}|\d{2})\b/);
        if (!yearMatch) return 0;

        let year = parseInt(yearMatch[1], 10);
        if (year < 100) year += 2000; // Convert 22 -> 2022

        let semWeight = 0.1; // Default fallback weight
        if (/1st/i.test(termStr)) semWeight = 0.1;
        else if (/Midyear/i.test(termStr)) semWeight = 0.2;
        else if (/2nd/i.test(termStr)) semWeight = 0.3;

        return year + semWeight;
    }

    // -------------------------------------------------------------------------
    // 7. Curriculum checklist extraction and rendering
    // -------------------------------------------------------------------------

    // Helper function to extract grade inside parentheses if present (e.g., "INC(1.25)" -> "1.25", "4.0(3.0)" -> "3.0")
    // Returns the resolved grade inside parentheses when CRS records a completion grade such as INC (2.00).
    function extractFinalGrade(gradeStr) {
        if (!gradeStr || gradeStr === 'null') return 'null';

        // Look for content inside parentheses
        const match = String(gradeStr).match(/\(([^)]+)\)/);
        if (match && match[1]) {
            return match[1].trim();
        }

        return String(gradeStr).trim();
    }

    // Finds a numeric checklist summary value by inspecting nearby elements and then falling back to body text.
    function extractChecklistMetric(doc, labelPatterns) {
        const patterns = labelPatterns.map((pattern) =>
            pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i'),
        );

        // Extracts the first finite numeric value from a candidate checklist metric string.
        const parseMetricNumber = (text) => {
            if (!text) return null;
            const match = String(text)
                .replace(/,/g, '')
                .match(/-?\d+(?:\.\d+)?/);
            if (!match) return null;
            const value = Number.parseFloat(match[0]);
            return Number.isFinite(value) ? value : null;
        };

        // Prefer values in the same row or in an adjacent cell as the label.
        const candidates = Array.from(doc.querySelectorAll('td, th, div, span, label, strong, b'));
        for (const element of candidates) {
            const labelText = (element.textContent || '').replace(/\s+/g, ' ').trim();
            if (!patterns.some((pattern) => pattern.test(labelText))) continue;

            const textsToCheck = [];
            if (element.nextElementSibling)
                textsToCheck.push(element.nextElementSibling.textContent);
            if (element.parentElement) {
                const siblings = Array.from(element.parentElement.children);
                const index = siblings.indexOf(element);
                if (index >= 0 && siblings[index + 1])
                    textsToCheck.push(siblings[index + 1].textContent);
                textsToCheck.push(element.parentElement.textContent);
            }
            textsToCheck.push(labelText);

            for (const candidateText of textsToCheck) {
                const cleaned = String(candidateText || '')
                    .replace(/\s+/g, ' ')
                    .trim();
                // Remove the metric label so its own digits do not affect parsing.
                let withoutLabel = cleaned;
                patterns.forEach((pattern) => {
                    withoutLabel = withoutLabel.replace(pattern, ' ');
                });
                const value = parseMetricNumber(withoutLabel);
                if (value !== null) return value;
            }
        }

        // Fallback for checklist layouts where the label and value are plain text.
        const bodyText = (doc.body?.innerText || doc.body?.textContent || '').replace(/\s+/g, ' ');
        for (const pattern of patterns) {
            const source = pattern.source;
            const match = bodyText.match(
                new RegExp(`${source}\\s*[:=-]?\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'),
            );
            if (match) {
                const value = Number.parseFloat(match[1]);
                if (Number.isFinite(value)) return value;
            }
        }

        return null;
    }

    // Downloads, parses, and indexes the authoritative CRS curriculum checklist before rendering and evaluation.
    function silentFetchChecklist(studentNumber) {
        const statusDiv = document.getElementById('sil-status');
        const formattedView = document.getElementById('formatted-checklist-view');

        statusDiv.style.color = '#666';
        statusDiv.innerText = 'Fetching checklist from server...';
        formattedView.innerHTML = '';

        const processChecklistHtml = async (htmlString) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');

                // Pull the official summary values directly from the CRS checklist.
                // The stable element IDs prevent nearby values (such as academic-load units)
                // from being mistaken for the WAG or credited-unit total.
                const wagNode = doc.querySelector('#txtWAG');
                const creditedUnitsNode = doc.querySelector('#txtTotalCreditedUnits');

                const wagRaw = wagNode?.textContent?.trim() || '';
                const creditedUnitsRaw = creditedUnitsNode?.textContent?.trim() || '';

                const parsedWAG = Number.parseFloat(wagRaw.replace(/[^0-9.\-]/g, ''));
                const parsedCreditedUnits = Number.parseFloat(
                    creditedUnitsRaw.replace(/[^0-9.\-]/g, ''),
                );

                crsChecklistWAG = Number.isFinite(parsedWAG)
                    ? parsedWAG
                    : extractChecklistMetric(doc, [/weighted\s+average\s+grade/i, /\bWAG\b/i]);
                crsTotalCreditedUnits = Number.isFinite(parsedCreditedUnits)
                    ? parsedCreditedUnits
                    : extractChecklistMetric(doc, [
                          /total\s+credited\s+units?\s*\(for\s+WAG\)/i,
                          /total\s+credited\s+units?/i,
                      ]);

                const table =
                    doc.querySelector('#tblCourseGroupView') ||
                    doc.querySelector('#divCourseGroupView table');

                if (!table) throw new Error('Course Group View table not found.');

                // Reset the in-memory checklist indexes before parsing the newly fetched checklist.
                const rows = Array.from(table.querySelectorAll('tr'));
                extractedStudentGrades.clear();
                passedAttemptCourseCodes.clear();
                passedAttemptCourseCounts.clear();

                let nstpOccurrence = 0;
                let rowSequence = 0;
                let firstNstpPassedTrack = null;

                // Parse each curriculum row into a stable mini-checklist entry.
                rows.forEach((row) => {
                    if (
                        row.closest('table.class-details') ||
                        row.classList.contains('checklist-row-header') ||
                        row.classList.contains('checklist-row-subheader1') ||
                        row.querySelector('th')
                    )
                        return;

                    const tds = row.querySelectorAll(':scope > td');
                    if (tds.length < 2) return;

                    let rawCourseName = tds[0].innerText
                        .replace(/\{\d+\}/g, '')
                        .replace(/[\r\n]+/g, ' ')
                        .trim();
                    if (
                        !rawCourseName ||
                        /^course group\s*$/i.test(rawCourseName) ||
                        /^core courses\s*$/i.test(rawCourseName)
                    )
                        return;

                    // Read the credited units from the second checklist column.
                    let rawUnits = tds[1] ? tds[1].innerText.replace(/[\r\n]+/g, ' ').trim() : '--';

                    let courseName = stripGEIndex(rawCourseName);

                    // Collect all recorded attempts before selecting the latest one.
                    const attempts = extractAllAttemptsFromRow(row);

                    // Preserve the actual course code from every passing attempt.
                    // This supports generic slots such as "GE Elective", whose
                    // slot label does not identify the completed course.
                    attempts.forEach((attempt) => {
                        const effectiveAttemptGrade = extractFinalGrade(attempt.grade);
                        if (!isPassingGrade(effectiveAttemptGrade)) return;

                        recordPassedCourseAttempt(attempt.rawClass || '');
                    });

                    // Select the latest attempt in one pass instead of sorting the full history.
                    const latestAttempt = attempts.reduce(
                        (latest, attempt) =>
                            parseTermWeight(attempt.term) > parseTermWeight(latest.term)
                                ? attempt
                                : latest,
                        { grade: 'null', term: '--', rawClass: '' },
                    );

                    // Resolve parenthetical completion grades before evaluation.
                    const latestGrade = extractFinalGrade(latestAttempt.grade);
                    const latestSem = latestAttempt.term || '--';

                    // Extract the NSTP component and track from the latest valid attempt.
                    const isNstpRow = /^(NSTP|CWTS|LTS|ROTC|MIL\s*SCI)\b/i.test(courseName);
                    if (isNstpRow) {
                        nstpOccurrence++; // Track sequential NSTP entries (1st, 2nd, etc.)

                        let textToSearch = latestAttempt.rawClass || row.innerText;
                        if (
                            row.nextElementSibling &&
                            !row.nextElementSibling
                                .querySelector('td:first-child')
                                ?.innerText.trim()
                        ) {
                            textToSearch += ' ' + row.nextElementSibling.innerText;
                        }

                        let nstpMatch = textToSearch.match(
                            /\b(CWTS|LTS|ROTC\s*Mil\s*Sci|ROTC|Mil\s*Sci)\s*([12])\b/i,
                        );

                        if (!nstpMatch) {
                            let fullRowText = row.innerText;
                            if (
                                row.nextElementSibling &&
                                !row.nextElementSibling
                                    .querySelector('td:first-child')
                                    ?.innerText.trim()
                            ) {
                                fullRowText += ' ' + row.nextElementSibling.innerText;
                            }
                            nstpMatch = fullRowText.match(
                                /\b(CWTS|LTS|ROTC\s*Mil\s*Sci|ROTC|Mil\s*Sci)\s*([12])\b/i,
                            );
                        }

                        if (nstpMatch) {
                            let track = nstpMatch[1].replace(/\s+/g, ' ').toUpperCase();
                            if (track.includes('ROTC') || track.includes('MIL')) {
                                track = 'ROTC Mil Sci';
                            } else if (track.includes('CWTS')) {
                                track = 'CWTS';
                            } else if (track.includes('LTS')) {
                                track = 'LTS';
                            }
                            courseName = `${track} ${nstpMatch[2]}`;

                            if (isPassingGrade(latestGrade) && nstpMatch[2] === '1') {
                                firstNstpPassedTrack = track;
                            }
                        } else {
                            // Fallback when track is not specified in text
                            const numMatch = courseName.match(/\b([12])\b/);
                            let levelNum = numMatch ? numMatch[1] : nstpOccurrence <= 1 ? '1' : '2';

                            if (levelNum === '2' && firstNstpPassedTrack) {
                                courseName = `${firstNstpPassedTrack} 2`;
                            } else {
                                // Strictly defaults to "NSTP 1" or "NSTP 2" if blank/unspecified
                                courseName = `NSTP ${levelNum}`;
                            }
                        }
                    }

                    // Store every curriculum slot separately, including duplicate generic slots.
                    // A deterministic key avoids random IDs while preserving source-row order.
                    const baseNormCode = normalizeCode(courseName);
                    const uniqueKey = `${baseNormCode}___${rowSequence++}`;

                    const completedCourse = latestAttempt.rawClass || courseName;
                    const category = getCourseCategory(rawCourseName || courseName);

                    extractedStudentGrades.set(uniqueKey, {
                        grade: latestGrade,
                        rawName: courseName,
                        curriculumSlot: rawCourseName,
                        completedCourse,
                        semester: latestSem,
                        units: rawUnits || '--',

                        // Store normalized and classified values once so later
                        // rendering and evaluation passes do not repeat the same
                        // normalization and category-detection work.
                        normalizedRawName: normalizeCode(courseName),
                        normalizedCurriculumSlot: normalizeCode(rawCourseName),
                        normalizedCompletedCourse: normalizeCode(completedCourse),
                        category,
                        isPE: category === 'PE',
                        isNSTP: category === 'NSTP',
                        isGE: category === 'Required GE Courses',
                    });
                });

                if (!isVsoStudent) {
                    const currentlyEnlistedCourseCodes = Array.from(
                        document.querySelectorAll('table.classlist td.td_coursedesc'),
                    )
                        .map((cell) =>
                            parseCourseCodeFromClassDescription(
                                cell.innerText || cell.textContent || '',
                            ),
                        )
                        .filter(Boolean);
                    ensureEnlistedMath20ChecklistEntry(
                        extractedStudentGrades,
                        currentlyEnlistedCourseCodes,
                    );
                }

                // Uncredited courses are outside #tblCourseGroupView. Include
                // their passing grades in duplicate-course and prerequisite checks.
                collectPassedUncreditedCourses(doc);

                // Calculate the summary once for this checklist load and reuse it
                // in both the compact checklist and the prerequisite engine.
                checklistAcademicSummary = calculateChecklistAcademicSummary();

                // Hide the checklist status after a successful load.
                statusDiv.innerText = '';
                statusDiv.style.display = 'none';

                renderFormattedChecklist(formattedView);
                checklistRecommendationDataReady = true;

                try {
                    // The independent GE and prerequisite-rule workflows began
                    // with checklist loading. Wait only for their bounded/cache
                    // results before evaluating the parsed checklist.
                    const [, rulesRows, isListedAsVso] = await Promise.all([
                        geCourseListReadyPromise,
                        prereqRulesReadyPromise,
                        vsoStatusReadyPromise,
                    ]);
                    if (isListedAsVso) return;
                    const effectiveRulesRows = latestPrereqRulesRows || rulesRows;
                    if (effectiveRulesRows) {
                        latestPrereqRulesRows = effectiveRulesRows;
                        evaluatePrereqAndEnlisted(effectiveRulesRows);
                    }
                } catch (err) {
                    console.error('Prereq Init Error:', err);
                    const msgDiv = document.getElementById('prereq-status-msg');
                    if (msgDiv) {
                        msgDiv.style.color = 'red';
                        msgDiv.innerText = `Initialization Error: ${err.message}`;
                    }
                }
            };

        const cacheKey = `${CHECKLIST_SESSION_CACHE_PREFIX}${studentNumber}`;
        const readCachedChecklist = () => {
            try {
                const parsed = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
                if (!isFreshChecklistCacheEntry(parsed)) {
                    return null;
                }
                return parsed;
            } catch {
                return null;
            }
        };

        const cacheChecklist = (html) => {
            try {
                sessionStorage.setItem(
                    cacheKey,
                    JSON.stringify({ html, cachedAt: Date.now() }),
                );
                const existingIndex = JSON.parse(
                    sessionStorage.getItem(CHECKLIST_SESSION_CACHE_INDEX_KEY) || '[]',
                );
                const nextIndex = [
                    cacheKey,
                    ...(Array.isArray(existingIndex) ? existingIndex : []).filter(
                        (key) => key !== cacheKey,
                    ),
                ];
                while (nextIndex.length > CHECKLIST_SESSION_CACHE_LIMIT) {
                    sessionStorage.removeItem(nextIndex.pop());
                }
                sessionStorage.setItem(
                    CHECKLIST_SESSION_CACHE_INDEX_KEY,
                    JSON.stringify(nextIndex),
                );
            } catch (error) {
                console.warn('[USAD-CS] Could not cache checklist HTML:', error);
            }
        };

        const fetchLiveChecklist = () =>
            fetch('https://crs.upd.edu.ph/curriculum_checklist/load_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ studentno: studentNumber }),
            }).then((response) => {
                if (!response.ok) throw new Error(`Server status: ${response.status}`);
                return response.text();
            });

        const showChecklistError = (error) => {
            statusDiv.style.color = 'red';
            statusDiv.innerText = 'Extraction failed.';
            console.error(`Checklist Extraction Error: ${error.message}`);
        };

        const cachedChecklist = readCachedChecklist();
        const liveChecklistPromise = fetchLiveChecklist();

        if (cachedChecklist) {
            const cachedProcessingPromise = processChecklistHtml(cachedChecklist.html);
            liveChecklistPromise
                .then((liveHtml) => {
                    cacheChecklist(liveHtml);
                    if (liveHtml !== cachedChecklist.html) {
                        return processChecklistHtml(liveHtml);
                    }
                    return null;
                })
                .catch((error) => {
                    console.warn(
                        '[USAD-CS] Live checklist refresh failed; retained session cache:',
                        error,
                    );
                });

            return cachedProcessingPromise.catch((error) =>
                liveChecklistPromise
                    .then((liveHtml) => {
                        cacheChecklist(liveHtml);
                        return processChecklistHtml(liveHtml);
                    })
                    .catch(showChecklistError),
            );
        }

        return liveChecklistPromise
            .then((liveHtml) => {
                cacheChecklist(liveHtml);
                return processChecklistHtml(liveHtml);
            })
            .catch(showChecklistError);
    }

    // Adds every passing course from the CRS "Uncredited Courses" table to the
    // authoritative passed-course set. Uncredited means the course was not
    // applied to the current curriculum/WAG; it does not mean the student
    // failed the course.
    // Adds passing courses from the checklist's Uncredited Courses table to the authoritative passed-course set.
    function collectPassedUncreditedCourses(doc) {
        const uncreditedContainer = doc.querySelector('#div-uncredited');
        if (!uncreditedContainer) return;

        const uncreditedTable =
            uncreditedContainer.querySelector('#div-uncredited-notice + table') ||
            uncreditedContainer.querySelector('table');

        if (!uncreditedTable) return;

        const rows = Array.from(uncreditedTable.querySelectorAll('tr'));
        rows.forEach((row) => {
            if (
                row.querySelector('th') ||
                row.classList.contains('checklist-row-header') ||
                row.classList.contains('checklist-row-subheader1')
            ) {
                return;
            }

            const cells = row.querySelectorAll(':scope > td');
            if (cells.length < 3) return;

            const rawClass = (cells[0].innerText || cells[0].textContent || '')
                .replace(/\{\d+\}/g, '')
                .replace(/[\r\n]+/g, ' ')
                .trim();
            const rawGrade = (cells[2].innerText || cells[2].textContent || '').trim();
            const finalGrade = extractFinalGrade(rawGrade);

            if (!rawClass || !isPassingGrade(finalGrade)) return;

            recordPassedCourseAttempt(rawClass);
        });
    }

    // Helper to scrape all history details out of a single checklist row (handling retakes)
    // Collects every recorded attempt for one curriculum row, including attempts stored in continuation rows.
    function extractAllAttemptsFromRow(row) {
        const attempts = [];

        // CRS may place the attempt-history table either inside the course row
        // or in the immediately following continuation row. Always inspect
        // both locations so full-checklist pass history remains authoritative.
        const detailContainers = [row];
        const nextRow = row.nextElementSibling;
        if (nextRow && !nextRow.querySelector('td:first-child')?.innerText.trim()) {
            detailContainers.push(nextRow);
        }

        const detailRows = detailContainers.flatMap((container) =>
            Array.from(container.querySelectorAll('.class-details tr, tr.detail-row')),
        );

        if (detailRows.length > 0) {
            detailRows.forEach((dRow) => {
                const tds = dRow.querySelectorAll('td');
                if (tds.length >= 2) {
                    const termText = tds[0].innerText.trim();
                    const classText = tds[1] ? tds[1].innerText.trim() : '';
                    const gradeText = tds[tds.length - 1].innerText.trim();

                    if (termText) {
                        attempts.push({
                            term: termText,
                            rawClass: classText,
                            grade: extractFinalGrade(gradeText) || 'null',
                        });
                    }
                }
            });
        }

        // Fallback if no sub-table rows were matched but main row details exist
        if (attempts.length === 0) {
            const fallbackDetails = extractDetailsFromRow(row); // Uses the shared checklist-row parser.
            if (fallbackDetails) {
                fallbackDetails.grade = extractFinalGrade(fallbackDetails.grade);
                attempts.push(fallbackDetails);
            }
        }

        return attempts;
    }

    // Calculates passed academic units and a local weighted-average summary while excluding PE and NSTP.
    function calculateChecklistAcademicSummary() {
        let passedAcademicUnits = 0;
        let gwaWeightedSum = 0;
        let gwaUnits = 0;

        extractedStudentGrades.forEach((data) => {
            const category =
                data.category || getCourseCategory(data.curriculumSlot || data.rawName || '');
            const rawCourse = `${data.rawName || ''} ${data.curriculumSlot || ''}`.trim();
            const isPECourse = data.isPE ?? (category === 'PE' || /^PE\b/i.test(rawCourse));
            const isNSTPCourse =
                data.isNSTP ??
                (category === 'NSTP' ||
                    /^(NSTP|CWTS|LTS|ROTC|MIL\s*SCI)\b/i.test(rawCourse));

            // PE, NSTP, and curriculum bridging courses such as Math 20 are
            // excluded from both academic-unit standing and GWA.
            if (
                isPECourse ||
                isNSTPCourse ||
                isZeroAcademicUnitCourse(rawCourse, category)
            )
                return;

            const units = Number.parseFloat(String(data.units || '').replace(/[^0-9.\-]/g, ''));
            if (!Number.isFinite(units) || units <= 0) return;

            const effectiveGrade = extractFinalGrade(data.grade);
            if (isPassingGrade(effectiveGrade)) {
                passedAcademicUnits += units;
            }

            // GWA uses only valid numerical grades. Non-numerical marks such as
            // INC, DRP, PASS, and S are not included in the weighted average.
            const numericGrade = Number.parseFloat(effectiveGrade);
            if (Number.isFinite(numericGrade) && numericGrade >= 1.0 && numericGrade <= 5.0) {
                gwaWeightedSum += numericGrade * units;
                gwaUnits += units;
            }
        });

        return {
            passedAcademicUnits,
            gwa: gwaUnits > 0 ? gwaWeightedSum / gwaUnits : null,
            gwaUnits,
        };
    }

    // Builds and inserts the compact mini curriculum checklist, including category counts and resolved course labels.
    function renderFormattedChecklist(container) {
        const categories = {
            'Core Courses': [],
            'Required GE Courses': [],
            'CS Electives': [],
            'Free Electives': [],
            NSTP: [],
            PE: [],
        };

        extractedStudentGrades.forEach((val) => {
            const cat =
                val.category || getCourseCategory(val.curriculumSlot); // Reuse the precomputed category when available.
            if (categories[cat]) {
                categories[cat].push(val);
            } else {
                categories['Core Courses'].push(val);
            }
        });

        categories['Core Courses'].sort((a, b) => naturalCourseSort(a.rawName, b.rawName));
        categories['Required GE Courses'].sort(sortGECourses); // Uses the shared course-category helper.

        ['CS Electives', 'Free Electives', 'NSTP', 'PE'].forEach((cat) => {
            categories[cat].sort((a, b) => naturalCourseSort(a.rawName, b.rawName));
        });

        const wagDisplay = crsChecklistWAG === null ? '--' : crsChecklistWAG.toFixed(4);
        // Count passed academic units directly from the parsed Mini Checklist.
        // PE and NSTP are excluded by the cached checklist summary calculation.
        const { passedAcademicUnits } = checklistAcademicSummary;
        const creditedUnitsDisplay = Number.isInteger(passedAcademicUnits)
            ? passedAcademicUnits
            : passedAcademicUnits.toFixed(1);
        const curriculumUnitsDisplay =
            curriculumTotalUnits === null
                ? '--'
                : Number.isInteger(curriculumTotalUnits)
                  ? curriculumTotalUnits
                  : curriculumTotalUnits.toFixed(1);
        const unitsPassedPercentage =
            curriculumTotalUnits !== null && curriculumTotalUnits > 0
                ? ((passedAcademicUnits / curriculumTotalUnits) * 100).toFixed(2)
                : null;
        const unitsProgressDisplay =
            curriculumTotalUnits === null
                ? creditedUnitsDisplay
                : `${creditedUnitsDisplay} / ${curriculumUnitsDisplay} (${unitsPassedPercentage}%)`;

        let html = `
        <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            <div style="flex: 1; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 3px 4px; text-align: center;">
                <div style="font-size: 9px; color: #555; text-transform: uppercase; font-weight: bold;">WAG</div>
                <div style="font-size: 14px; color: #7b1113; font-weight: bold; margin-top: 1px;">${wagDisplay}</div>
            </div>
            <div style="flex: 1; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 3px 4px; text-align: center;">
                <div style="font-size: 9px; color: #555; text-transform: uppercase; font-weight: bold;">Units Passed</div>
                <div style="font-size: 14px; color: #0f5132; font-weight: bold; margin-top: 1px;">${unitsProgressDisplay}</div>
            </div>
        </div>`;

        // Render each nonempty checklist category as a compact status table.
        let visibleCourseCount = 0;

        Object.keys(categories).forEach((catName) => {
            const items = categories[catName];
            if (items.length > 0) {
                const passedCount = items.filter((item) =>
                    isPassingGrade(extractFinalGrade(item.grade)),
                ).length;
                const visibleItems = items.filter((item) => {
                    const isSatisfied = isPassingGrade(extractFinalGrade(item.grade));
                    return isSatisfied
                        ? showSatisfiedChecklistCourses
                        : showUnsatisfiedChecklistCourses;
                });

                // Hide a category when none of its rows match the active filters.
                if (visibleItems.length === 0) return;
                visibleCourseCount += visibleItems.length;

                html += `
                <div style="margin-bottom: 6px;">
                    <div style="background: #7b1113; color: white; padding: 3px 6px; font-weight: bold; font-size: 11px; border-radius: 3px;">
                        ${catName === 'Required GE Courses' ? 'GEs' : catName} (${passedCount} / ${items.length} passed)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 2px;">
            `;

                visibleItems.forEach((item, idx) => {
                    const effectiveGrade = extractFinalGrade(item.grade);
                    const passed = isPassingGrade(effectiveGrade);
                    const numericGrade = parseFloat(effectiveGrade);
                    const isPassed =
                        (!isNaN(numericGrade) && numericGrade <= 3.0) ||
                        ['P', 'PASS', 'S'].includes(String(effectiveGrade).toUpperCase());

                    const checkboxHtml = isPassed
                        ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; background-color: #198754; border-radius: 3px; margin-right: 6px; vertical-align: middle;">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="2 6 5 9 10 3"></polyline>
                        </svg>
                       </span>`
                        : `<span style="display: inline-block; width: 12px; height: 12px; border: 1.5px solid #ccc; border-radius: 3px; margin-right: 6px; vertical-align: middle; background-color: #fafafa;"></span>`;

                    const gradeDisplay =
                        effectiveGrade === 'null'
                            ? '<span style="color: #888;">--</span>'
                            : effectiveGrade;
                    const semDisplay =
                        item.semester && item.semester !== 'null' && item.semester !== '--'
                            ? item.semester
                            : '<span style="color: #888;">--</span>';
                    const unitsDisplay = isZeroAcademicUnitCourse(
                        item.rawName || item.curriculumSlot,
                        item.category,
                    )
                        ? `(${getCourseUnitValues(
                              item.rawName || item.curriculumSlot,
                              item.category,
                              item.units,
                          ).displayUnits})`
                        : item.units && item.units !== 'null' && item.units !== ''
                          ? item.units
                          : '<span style="color: #888;">--</span>';

                    const badgeBg = passed
                        ? '#d1e7dd'
                        : effectiveGrade === 'null'
                          ? '#f8f9fa'
                          : '#f8d7da';
                    const badgeColor = passed
                        ? '#0f5132'
                        : effectiveGrade === 'null'
                          ? '#666'
                          : '#842029';
                    const borderBottom =
                        idx < visibleItems.length - 1 ? 'border-bottom: 1px dotted #eee;' : '';

                    // Resolve the label shown in the mini checklist. Generic/bundled slots use
                    // the actual recorded attempt whenever the script can identify one.
                    let displayLabel = item.curriculumSlot;

                    if (['CS Electives', 'Free Electives', 'PE', 'NSTP'].includes(catName)) {
                        if (item.completedCourse && effectiveGrade !== 'null') {
                            displayLabel = cleanExtractedCourseTitle(item.completedCourse);
                        } else if (item.rawName) {
                            displayLabel = cleanExtractedCourseTitle(item.rawName);
                        }
                    } else if (/^CS\s*199\s*\/\s*(?:CS\s*)?200$/i.test(item.curriculumSlot || '')) {
                        // The curriculum combines CS 199 and CS 200 into one slot.
                        // Keep the original bundled slot label when no attempt has
                        // been recorded. Once an attempt exists, show CS 199 or
                        // CS 200 even when the grade is 4.00, 5.00, INC, DRP, or
                        // another non-passing mark.
                        if (item.completedCourse && effectiveGrade !== 'null') {
                            const attemptedCourse = cleanExtractedCourseTitle(
                                item.completedCourse,
                            );
                            if (/^CS\s+(199|200)$/i.test(attemptedCourse)) {
                                displayLabel = attemptedCourse.toUpperCase();
                            }
                        }
                    } else if (
                        catName === 'Required GE Courses' ||
                        /^GE\b/i.test(item.curriculumSlot)
                    ) {
                        // If a grade exists, substitute the multi-option string with the actual course completed.
                        if (item.completedCourse && effectiveGrade !== 'null') {
                            let takenCourse = cleanExtractedCourseTitle(item.completedCourse);

                            // Show the actual GE elective under the GE section, e.g. "GE Elective: BIO 1".
                            if (/GE\s*ELECTIVE/i.test(item.curriculumSlot || item.rawName || '')) {
                                takenCourse = takenCourse.replace(/^([A-Za-z]+)/, (subject) =>
                                    subject.toUpperCase(),
                                );
                                displayLabel = `GE Elective: ${takenCourse}`;
                            } else if (item.curriculumSlot.includes(':')) {
                                // Preserve the required-GE slot label, including
                                // Soc Sci entries (for example, "GE 3: Soc Sci 1").
                                const gePrefix = item.curriculumSlot.split(':')[0].trim(); // e.g., "GE 3"
                                displayLabel = `${gePrefix}: ${takenCourse}`;
                            } else {
                                displayLabel = takenCourse;
                            }
                        }
                    }

                    displayLabel = formatCourseDisplayName(displayLabel);

                    html += `
                    <tr style="${borderBottom}">
                        <td style="padding: 2px 5px;">
                            ${checkboxHtml}
                            <b style="vertical-align: middle;">${displayLabel}</b>
                        </td>
                        <td style="padding: 2px 2px; text-align: center; width: 32px; color: #555; white-space: nowrap;">
                            ${unitsDisplay}
                        </td>
                        <td style="padding: 2px 6px; text-align: center; width: 84px; color: #555; white-space: nowrap;">
                            ${semDisplay}
                        </td>
                        <td style="padding: 2px 5px; text-align: center; width: 60px;">
                            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; display: inline-block; min-width: 35px;">
                                ${gradeDisplay}
                            </span>
                        </td>
                    </tr>
                `;
                });

                html += `</table></div>`;
            }
        });

        if (visibleCourseCount === 0) {
            let emptyMessage = 'No checklist courses match the selected filters.';
            if (showSatisfiedChecklistCourses && !showUnsatisfiedChecklistCourses) {
                emptyMessage = 'No satisfied checklist courses found.';
            } else if (!showSatisfiedChecklistCourses && showUnsatisfiedChecklistCourses) {
                emptyMessage = 'No unsatisfied checklist courses found.';
            } else if (!showSatisfiedChecklistCourses && !showUnsatisfiedChecklistCourses) {
                emptyMessage = 'Select at least one course-status filter.';
            }

            html += `
                <div style="padding: 10px 6px; text-align: center; color: #664d03; background: #fff3cd; border: 1px solid #ffe69c; border-radius: 4px; font-size: 11px; font-weight: bold;">
                    ${emptyMessage}
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // Parses raw CSV text into a 2D array, handling quotes and commas inside cells
    // Parses CSV text into rows and columns while respecting quoted commas, escaped quotes, and common newline styles.
    function parseCSV(str) {
        const arr = [];
        let quote = false;
        let row = 0,
            col = 0;

        for (let c = 0; c < str.length; c++) {
            let cc = str[c],
                nc = str[c + 1];
            arr[row] = arr[row] || [];
            arr[row][col] = arr[row][col] || '';

            // Handle escaped quotes (double quotes inside a quoted string)
            if (cc === '"' && quote && nc === '"') {
                arr[row][col] += cc;
                ++c;
                continue;
            }
            // Toggle quote state
            if (cc === '"') {
                quote = !quote;
                continue;
            }
            // Handle column separators
            if (cc === ',' && !quote) {
                ++col;
                continue;
            }
            // Handle Windows newlines
            if (cc === '\r' && nc === '\n' && !quote) {
                ++row;
                col = 0;
                ++c;
                continue;
            }
            // Handle standard newlines
            if (cc === '\n' && !quote) {
                ++row;
                col = 0;
                continue;
            }
            // Handle Mac newlines
            if (cc === '\r' && !quote) {
                ++row;
                col = 0;
                continue;
            }

            // Add character to current cell
            arr[row][col] += cc;
        }
        return arr;
    }

    // Loads the public VSO roster with a short cache because the sheet is
    // continuously updated. A stale cache remains a fallback during a
    // temporary network failure so a known VSO student is not advised.
    function loadVsoStudentStatus(studentNumber) {
        const cachedCsv = localStorage.getItem(VSO_CACHE_KEY);
        const cachedAt = Number(localStorage.getItem(VSO_CACHE_TIME_KEY) || 0);
        const cachedRows = cachedCsv ? parseCSV(cachedCsv) : [];
        const cachedStudentNumbers = parseVsoStudentNumbers(cachedRows);
        const cacheIsFresh =
            cachedCsv && Date.now() - cachedAt < VSO_CACHE_EXPIRY_MS;

        if (cacheIsFresh) {
            return Promise.resolve(
                cachedStudentNumbers.has(normalizeStudentNumber(studentNumber)),
            );
        }

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: VSO_CSV_URL,
                timeout: 10000,
                onload(response) {
                    if (response.status < 200 || response.status >= 300) {
                        reject(
                            new Error(`VSO roster returned HTTP ${response.status}.`),
                        );
                        return;
                    }
                    if (isHTMLResponse(response.responseText)) {
                        reject(new Error('VSO roster access was denied.'));
                        return;
                    }

                    const rows = parseCSV(response.responseText || '');
                    const studentNumbers = parseVsoStudentNumbers(rows);
                    if (!studentNumbers.size) {
                        reject(new Error('VSO roster has no valid student numbers.'));
                        return;
                    }

                    localStorage.setItem(VSO_CACHE_KEY, response.responseText);
                    localStorage.setItem(VSO_CACHE_TIME_KEY, Date.now().toString());
                    resolve(
                        studentNumbers.has(normalizeStudentNumber(studentNumber)),
                    );
                },
                ontimeout() {
                    reject(new Error('VSO roster request timed out.'));
                },
                onerror() {
                    reject(new Error('Unable to connect to the VSO roster.'));
                },
            });
        }).catch((error) => {
            if (cachedStudentNumbers.size) {
                console.warn(
                    '[USAD-CS] VSO roster refresh failed; using stale cache:',
                    error,
                );
                return cachedStudentNumbers.has(
                    normalizeStudentNumber(studentNumber),
                );
            }
            throw error;
        });
    }

    // Parses the authoritative fourth-column offering codes. Accept common
    // separators while retaining only the supported First, Second, and
    // Midyear term codes.
    function parseSemesterOfferingTerms(value) {
        return String(value || '')
            .toUpperCase()
            .split(/[\s,;/]+/)
            .filter((term) => ['1', '2', 'M'].includes(term));
    }

    // Column 5 uses 1 for courses with a laboratory component and 0 for
    // courses without one.
    function parseHasLab(value) {
        return String(value ?? '').trim() === '1';
    }

    // Validates the fourth column by its data rather than requiring a specific
    // header label. The rules sheet's column position is authoritative, and
    // its heading may be renamed without changing the schema.
    function hasSemesterOfferingColumn(rulesRows) {
        if (!Array.isArray(rulesRows) || rulesRows.length < 2) return false;

        return rulesRows.slice(1).some((row) => {
            if (!String(row?.[0] || '').trim()) return false;

            const rawTerms = String(row?.[3] || '')
                .toUpperCase()
                .split(/[\s,;/]+/)
                .filter(Boolean);
            return (
                rawTerms.length > 0 &&
                rawTerms.every((term) => ['1', '2', 'M'].includes(term))
            );
        });
    }

    // Recognizes the authoritative fifth-column lab flags so a cached
    // four-column sheet is refreshed before progression loads are calculated.
    function hasLabFlagColumn(rulesRows) {
        if (!Array.isArray(rulesRows) || rulesRows.length < 2) return false;

        return rulesRows.slice(1).some((row) => {
            if (!String(row?.[0] || '').trim()) return false;
            return /^(?:0|1)$/.test(String(row?.[4] ?? '').trim());
        });
    }

    function hasProgressionMetadataColumns(rulesRows) {
        return (
            hasSemesterOfferingColumn(rulesRows) &&
            hasLabFlagColumn(rulesRows)
        );
    }

    // Google may return a sign-in or access-denied document instead of CSV.
    // Detect it explicitly so the panel reports the real problem.
    function isHTMLResponse(responseText) {
        return /^\s*(?:<!doctype\s+html|<html\b)/i.test(String(responseText || ''));
    }

    // -------------------------------------------------------------------------
    // 8. CRS schedule availability
    // -------------------------------------------------------------------------

    // Detects the active CRS schedule term and caches one result page per
    // subject initial. A course is available when an exact course-code match
    // appears in at least one CRS class row.
    const CRS_SCHEDULE_ROOT = 'https://crs.upd.edu.ph/schedule/';
    const CRS_SCHEDULE_CACHE_KEY = 'usad_crs_schedule_availability_v1';
    const CRS_SCHEDULE_CACHE_EXPIRY_MS = 15 * 60 * 1000;
    let crsScheduleTermBasePromise = null;
    const crsScheduleLetterPagePromises = new Map();
    let crsSchedulePersistentCache = (() => {
        try {
            const parsed = JSON.parse(localStorage.getItem(CRS_SCHEDULE_CACHE_KEY) || '{}');
            return {
                termBase: typeof parsed.termBase === 'string' ? parsed.termBase : '',
                cachedAt: Number(parsed.cachedAt) || 0,
                availability:
                    parsed.availability && typeof parsed.availability === 'object'
                        ? parsed.availability
                        : {},
            };
        } catch {
            return { termBase: '', cachedAt: 0, availability: {} };
        }
    })();

    function isCrsScheduleCacheFresh() {
        return (
            Boolean(crsSchedulePersistentCache.termBase) &&
            Date.now() - crsSchedulePersistentCache.cachedAt < CRS_SCHEDULE_CACHE_EXPIRY_MS
        );
    }

    function saveCrsSchedulePersistentCache() {
        try {
            localStorage.setItem(
                CRS_SCHEDULE_CACHE_KEY,
                JSON.stringify(crsSchedulePersistentCache),
            );
        } catch (error) {
            console.warn('[USAD-CS] Could not persist CRS schedule cache:', error);
        }
    }

    // Performs a cross-origin userscript GET request and resolves with the response body as text.
    function gmGetText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                timeout: 20000,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText || '');
                    } else {
                        reject(new Error(`CRS schedule returned HTTP ${response.status}`));
                    }
                },
                ontimeout: () => reject(new Error('CRS schedule request timed out')),
                onerror: () => reject(new Error('Unable to connect to the CRS schedule')),
            });
        });
    }

    // Performs a cross-origin userscript GET request and resolves with binary response data.
    function gmGetArrayBuffer(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType: 'arraybuffer',
                timeout: 30000,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300 && response.response) {
                        resolve(response.response);
                    } else {
                        reject(new Error(`GEC PDF returned HTTP ${response.status}`));
                    }
                },
                ontimeout: () => reject(new Error('GEC PDF request timed out')),
                onerror: () => reject(new Error('Unable to download the GEC PDF')),
            });
        });
    }

    // Deduplicates, sorts, normalizes, and stores the current GE course list and its source.
    function setGECourseList(courses, source = '') {
        const uniqueByCode = new Map();

        for (const rawCourse of courses || []) {
            const course = String(rawCourse || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!course) continue;

            const normalized = course.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (!normalized || uniqueByCode.has(normalized)) continue;
            uniqueByCode.set(normalized, course);
        }

        GE_COURSES_LIST = Array.from(uniqueByCode.values()).sort(naturalCourseSort);
        GE_COURSES_NORMALIZED = new Set(uniqueByCode.keys());
        geCourseListSource = source;
    }

    // Locates the most likely GE course-list PDF link from the GEC webpage.
    function findGECoursePdfUrl(pageHTML) {
        const doc = new DOMParser().parseFromString(pageHTML, 'text/html');
        const pdfLinks = Array.from(doc.querySelectorAll('a[href]'))
            .map((link) => ({
                href: link.href,
                text: (link.textContent || '').replace(/\s+/g, ' ').trim(),
            }))
            .filter((link) => /\.pdf(?:$|[?#])/i.test(link.href));

        if (!pdfLinks.length) {
            throw new Error('No PDF link was found on the GEC webpage');
        }

        const preferred = pdfLinks.find((link) =>
            /list\s+of\s+ge\s+courses\s+offered/i.test(`${link.text} ${link.href}`),
        );

        return (preferred || pdfLinks[0]).href;
    }

    // Validates and extracts a plausible course code from a short PDF text fragment.
    function extractCourseCodeCandidate(value) {
        const cleaned = String(value || '')
            .replace(/^\s*\d{1,3}\s*[.)-]\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();

        // A course code consists of a one- to three-word subject followed by its
        // catalog number. Examples: "Bio 1", "Art Stud 2", and "Soc Sci 1".
        const match = cleaned.match(
            /^([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*){0,2})\s+(\d+(?:\.\d+)?[A-Za-z]?)$/i,
        );

        return match ? `${match[1]} ${match[2]}` : '';
    }

    // Reads the linked GEC PDF with PDF.js and extracts a deduplicated list of GE course codes.
    async function extractGECoursesFromPdf(pdfArrayBuffer) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js did not load');
        }

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(pdfArrayBuffer),
            disableWorker: true,
        });
        const pdf = await loadingTask.promise;

        const found = [];
        const pageStrings = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const strings = textContent.items
                .map((item) =>
                    String(item.str || '')
                        .replace(/\s+/g, ' ')
                        .trim(),
                )
                .filter(Boolean);

            pageStrings.push(strings.join(' '));

            // Course codes may be stored as one PDF item or split across
            // adjacent items, such as "BIO" and "1".
            for (let index = 0; index < strings.length; index++) {
                const candidates = [
                    strings[index],
                    `${strings[index] || ''} ${strings[index + 1] || ''}`,
                    `${strings[index] || ''} ${strings[index + 1] || ''} ${
                        strings[index + 2] || ''
                    }`,
                ];

                for (const value of candidates) {
                    const candidate = extractCourseCodeCandidate(value);
                    if (candidate) found.push(candidate);
                }
            }
        }

        // Fallback for PDFs whose table cells are merged into longer text runs.
        if (found.length < 10) {
            const fullText = pageStrings.join(' ');
            const numberedCoursePattern =
                /(?:^|\s)\d{1,3}\s*[.)-]\s*([A-Za-z][A-Za-z]*(?:\s+[A-Za-z][A-Za-z]*){0,2}\s+\d+(?:\.\d+)?[A-Za-z]?)(?=\s)/gi;

            let match;
            while ((match = numberedCoursePattern.exec(fullText)) !== null) {
                const candidate = extractCourseCodeCandidate(match[1]);
                if (candidate) found.push(candidate);
            }
        }

        const unique = new Map();
        for (const course of found) {
            const normalized = course.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (!unique.has(normalized)) unique.set(normalized, course);
        }

        const courses = Array.from(unique.values()).sort(naturalCourseSort);
        if (courses.length < 10) {
            throw new Error(`Only ${courses.length} plausible GE course codes were extracted`);
        }

        return courses;
    }

    // Refreshes the GE cache from the current GEC webpage and linked PDF.
    async function refreshGECourseList(cachedCourses, cachedSource) {
        // Check the lightweight GEC webpage first. If it still links to the same
        // PDF, reuse the extracted list and renew its timestamp.
        const pageHTML = await gmGetText(GEC_GE_PAGE_URL);
        const pdfUrl = findGECoursePdfUrl(pageHTML);

        if (cachedCourses.length >= 10 && cachedSource && pdfUrl === cachedSource) {
            localStorage.setItem(GE_LIST_CACHE_TIME_KEY, String(Date.now()));
            setGECourseList(cachedCourses, cachedSource);
            console.log('[USAD-CS] GE PDF link is unchanged; reused extracted GE cache.');
            return GE_COURSES_LIST;
        }

        const pdfBytes = await gmGetArrayBuffer(pdfUrl);
        const courses = await extractGECoursesFromPdf(pdfBytes);

        localStorage.setItem(GE_LIST_CACHE_KEY, JSON.stringify(courses));
        localStorage.setItem(GE_LIST_CACHE_TIME_KEY, String(Date.now()));
        localStorage.setItem(GE_LIST_CACHE_SOURCE_KEY, pdfUrl);

        setGECourseList(courses, pdfUrl);
        return GE_COURSES_LIST;
    }

    // Loads fresh or stale GE data immediately and refreshes expired data in
    // the background. A brand-new installation proceeds without dynamic GE
    // data so an unavailable GEC server never blocks recommendations.
    function loadGECourseList() {
        const cachedCourses = (() => {
            try {
                const parsed = JSON.parse(localStorage.getItem(GE_LIST_CACHE_KEY) || '[]');
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        })();

        const cachedTime = Number(localStorage.getItem(GE_LIST_CACHE_TIME_KEY) || 0);
        const cachedSource = localStorage.getItem(GE_LIST_CACHE_SOURCE_KEY) || '';
        const hasUsableCache = cachedCourses.length >= 10;
        const cacheIsFresh =
            hasUsableCache &&
            Number.isFinite(cachedTime) &&
            Date.now() - cachedTime < GE_LIST_CACHE_EXPIRY_MS;

        if (cacheIsFresh) {
            setGECourseList(cachedCourses, cachedSource || 'GEC cache');
            return Promise.resolve(GE_COURSES_LIST);
        }

        if (hasUsableCache) {
            setGECourseList(cachedCourses, cachedSource || 'stale GEC cache');
        }

        const refreshPromise = refreshGECourseList(cachedCourses, cachedSource)
            .then((courses) => {
                // A first-time load may have continued after the short wait.
                // Re-evaluate once when dynamic GE data arrives so the fast
                // provisional result is replaced with an accurate one.
                if (
                    !hasUsableCache &&
                    checklistRecommendationDataReady &&
                    latestPrereqRulesRows
                ) {
                    evaluatePrereqAndEnlisted(latestPrereqRulesRows);
                }
                return courses;
            })
            .catch((error) => {
                if (hasUsableCache) {
                    console.warn(
                        '[USAD-CS] GE refresh failed; continuing with stale cache:',
                        error,
                    );
                    return GE_COURSES_LIST;
                }

                console.warn(
                    '[USAD-CS] GE refresh failed; continuing without dynamic GE data:',
                    error,
                );
                return [];
            });

        if (hasUsableCache) {
            console.log('[USAD-CS] Using stale GE cache while refreshing in the background.');
            return Promise.resolve(GE_COURSES_LIST);
        }

        console.log('[USAD-CS] Refreshing GE data in the background.');
        return Promise.resolve([]);
    }

    // Escapes regular-expression metacharacters in a literal text value.
    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Escapes unsafe HTML characters before inserting external text into generated markup.
    function escapeHTML(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderPeRequirement(box, passedCount) {
        if (!box) return;
        const isComplete = passedCount >= 4;
        box.innerHTML = `
            <div style="color: ${isComplete ? '#0f5132' : '#41464b'}; background-color: ${isComplete ? '#d1e7dd' : '#f8f9fa'}; border: 1px solid ${isComplete ? '#badbcc' : '#d3d6d8'}; padding: 6px; border-radius: 5px;">
                <b style="color: #7b1113; font-size: 13px;">📝 PE Requirement</b>
                <div style="font-size: 12px; margin-top: 2px;"> ${isComplete ? '✅ PE Courses Passed' : 'PE Courses Passed'}: <b>${passedCount} / 4</b> </div>
            </div>`;
    }

    function areMatchingNstpTracks(firstEntry, secondEntry) {
        if (!firstEntry || !secondEntry) return false;
        const firstTrack = firstEntry.track.toUpperCase();
        const secondTrack = secondEntry.track.toUpperCase();
        return (
            firstTrack === secondTrack ||
            firstTrack === 'NSTP' ||
            secondTrack === 'NSTP' ||
            firstEntry.rawName.toUpperCase().includes(secondTrack) ||
            secondEntry.rawName.toUpperCase().includes(firstTrack)
        );
    }

    function renderNstpRequirement(box, firstEntry, secondEntry) {
        if (!box) return;
        const showSecondEntry = areMatchingNstpTracks(firstEntry, secondEntry);
        const isComplete = Boolean(firstEntry && showSecondEntry);
        const background = isComplete ? '#d1e7dd' : '#f8f9fa';
        const border = isComplete ? '#badbcc' : '#dee2e6';
        const firstStatus = firstEntry
            ? `✅ NSTP 1 (${escapeHTML(firstEntry.rawName)}): <span style="font-size:11px;"><b>PASSED</b></span>`
            : '⬜ NSTP 1';
        const secondStatus = showSecondEntry
            ? `✅ NSTP 2 (${escapeHTML(secondEntry.rawName)}): <span style="font-size:11px;"><b>PASSED</b></span>`
            : '⬜ NSTP 2';

        box.innerHTML = `<div style="padding: 6px;background: ${background};border: 1px solid ${border};border-radius: 6px;">
        <b style="color: #7b1113; font-size: 13px; display: block; margin-bottom: 4px;">📝 NSTP Requirement</b><div style="margin-bottom:3px;">${firstStatus}</div><div>${secondStatus}</div></div>`;
    }

    function renderBulletedWarningList(items) {
        return `<ul style="margin: 3px 0 0 18px; padding: 0; font-weight: normal; font-size: 12px;">${items.map((item) => `<li style="font-size: 12px; margin-bottom: 2px; font-weight: normal;">${item}</li>`).join('')}</ul>`;
    }

    function renderEnlistmentStatus(
        container,
        enlistedCourseCount,
        ineligibleItems,
        csElectiveItems,
    ) {
        if (!container) return;
        if (enlistedCourseCount === 0) {
            container.innerHTML = `<div style="color: #664d03; background-color: #fff3cd; border: 1px solid #ffe69c; padding: 5px 6px; border-radius: 4px; font-weight: bold; margin-bottom: 5px; font-size: 13px;">⚠️ No enlistments found!</div>`;
            return;
        }

        const uniqueIneligible = [...new Set(ineligibleItems)];
        const uniqueCSElectives = [...new Set(csElectiveItems)];
        let warningHTML = '';

        if (uniqueIneligible.length > 0) {
            warningHTML += `<div style="color: #842029; background: #f8d7da; border: 1px solid #f5c2c7; padding: 6px; border-radius: 5px; margin-bottom: 5px;"><b style="font-size: 13px;">⛔️ Ineligible Enlisted Courses </b><div style="margin-top: 3px; margin-bottom: 3px; font-weight: normal; font-size: 12px;">The following enlisted subjects are <b>NOT ALLOWED</b> to be taken (${uniqueIneligible.length}):</div>${renderBulletedWarningList(uniqueIneligible)}</div>`;
        }
        if (uniqueCSElectives.length > 0) {
            warningHTML += `<div style="color: #662d00; background: #fff3e6; border: 1px solid #ffe0c2; padding: 6px; border-radius: 5px; margin-bottom: 5px;"><b style="font-size: 13px;">⚠️ CS Elective Verification</b><div style="margin-top: 3px; margin-bottom: 3px; font-weight: normal; font-size: 12px;">Verify that ${uniqueCSElectives.length > 1 ? 'these electives are' : 'this elective is'} allowed:</div>${renderBulletedWarningList(uniqueCSElectives)}</div>`;
        }

        container.innerHTML =
            warningHTML ||
            `<div style="color: #0f5132; background-color: #d1e7dd; border: 1px solid #badbcc; padding: 5px 6px; border-radius: 4px; font-weight: bold; margin-bottom: 5px; font-size: 13px;">🟢 All enlisted courses are eligible based on prerequisites!</div>`;
    }

    function renderElectivesRequirement(
        box,
        csElectivePassedCount,
        freeElectivePassedCount,
        geElectivePassedCount,
    ) {
        if (!box) return;
        const isComplete =
            csElectivePassedCount >= 1 &&
            freeElectivePassedCount >= 1 &&
            geElectivePassedCount >= 1;
        const background = isComplete ? '#d1e7dd' : '#f8f9fa';
        const border = isComplete ? '#badbcc' : '#dee2e6';

        box.innerHTML = `<div style="padding: 6px; background: ${background}; border: 1px solid ${border}; border-radius: 6px;"><b style="color: #7b1113; font-size: 13px; display: block; margin-bottom: 4px;">📝 Electives Requirement</b><div style="font-size: 12px; color: #333;">${csElectivePassedCount >= 1 ? '✅ ' : '⬜ '} CS Elective Passed: <b>${csElectivePassedCount} / 1</b><br>${freeElectivePassedCount >= 1 ? '✅ ' : '⬜ '} Free Elective Passed: <b>${freeElectivePassedCount} / 1</b><br>${geElectivePassedCount >= 1 ? '✅ ' : '⬜ '} GE Elective Passed: <b>${geElectivePassedCount} / 1</b></div></div>`;
    }

    function ensureRequirementSummaryBoxes(recommendationsList) {
        let container = document.getElementById('requirements-summary-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'requirements-summary-container';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '5px';
            container.style.marginTop = '6px';

            const recommendationsWrapper = recommendationsList?.parentElement;
            const layout = recommendationsWrapper?.parentElement;
            if (layout) {
                layout.insertBefore(container, recommendationsWrapper.nextSibling);
            } else if (recommendationsWrapper) {
                recommendationsWrapper.insertBefore(
                    container,
                    recommendationsList.nextSibling,
                );
            }
        }

        const getOrCreateBox = (id) => {
            let box = document.getElementById(id);
            if (!box) {
                box = document.createElement('div');
                box.id = id;
                container.appendChild(box);
            }
            return box;
        };

        return {
            nstpBox: getOrCreateBox('nstp-status-box'),
            peBox: getOrCreateBox('pe-status-box'),
            electivesBox: getOrCreateBox('electives-status-box'),
        };
    }

    // Reduces a display label to the uppercase subject-and-number form used in CRS schedule searches.
    function getSearchableCourseCode(courseName) {
        const cleaned = stripGEIndex(String(courseName || ''))
            .replace(/^GE\s*Elective\s*:\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Keep subject + catalog number only. Examples:
        // "Soc Sci 1" -> "SOC SCI 1"; "CS 138" -> "CS 138".
        const match = cleaned.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+(?:\.\d+)?[A-Za-z]?)\b/i);
        return match ? `${match[1].trim()} ${match[2].trim()}`.toUpperCase() : '';
    }

    // Discovers and caches the base URL for the currently active CRS schedule term.
    function getCrsScheduleTermBase() {
        if (crsScheduleTermBasePromise) return crsScheduleTermBasePromise;

        if (isCrsScheduleCacheFresh()) {
            crsScheduleTermBasePromise = Promise.resolve(crsSchedulePersistentCache.termBase);
            return crsScheduleTermBasePromise;
        }

        crsScheduleTermBasePromise = gmGetText(CRS_SCHEDULE_ROOT).then((html) => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a[href]'));
            const letterLink = links.find((link) =>
                /\/schedule\/\d+\/[A-Z](?:\/)?(?:[?#].*)?$/i.test(link.href),
            );
            if (!letterLink) throw new Error('Could not determine the active CRS schedule term');

            const match = letterLink.href.match(/^(https:\/\/crs\.upd\.edu\.ph\/schedule\/\d+\/)/i);
            if (!match) throw new Error('Unexpected CRS schedule URL format');

            crsSchedulePersistentCache = {
                termBase: match[1],
                cachedAt: Date.now(),
                availability: {},
            };
            saveCrsSchedulePersistentCache();
            return crsSchedulePersistentCache.termBase;
        });

        return crsScheduleTermBasePromise;
    }

    // Fetches and caches the active CRS schedule page for a subject's initial letter.
    function getCrsLetterPage(letter, termBase) {
        const initial = String(letter || '')
            .charAt(0)
            .toUpperCase();
        if (!/^[A-Z]$/.test(initial)) return Promise.resolve(null);
        const requestKey = `${termBase}${initial}`;
        if (crsScheduleLetterPagePromises.has(requestKey)) {
            return crsScheduleLetterPagePromises.get(requestKey);
        }

        const request = gmGetText(`${termBase}${initial}`)
            .then((html) => new DOMParser().parseFromString(html, 'text/html'));

        crsScheduleLetterPagePromises.set(requestKey, request);
        return request;
    }

    // Checks whether an exact course code appears in the active CRS class schedule.
    async function isCourseOfferedInCrs(courseName) {
        const courseCode = getSearchableCourseCode(courseName);
        if (!courseCode) return false;

        const termBase = await getCrsScheduleTermBase();
        if (
            isCrsScheduleCacheFresh() &&
            crsSchedulePersistentCache.termBase === termBase &&
            typeof crsSchedulePersistentCache.availability[courseCode] === 'boolean'
        ) {
            return crsSchedulePersistentCache.availability[courseCode];
        }

        const doc = await getCrsLetterPage(courseCode.charAt(0), termBase);
        if (!doc) return false;

        const exactCodePattern = escapeRegExp(courseCode).replace(/\\ /g, '\\s+');
        const classRowPattern = new RegExp(`^\\s*\\d+\\s+${exactCodePattern}(?=\\s|$)`, 'i');

        // CRS class rows begin with the numeric class code followed by the course.
        const offered = Array.from(doc.querySelectorAll('tr')).some((row) => {
            const rowText = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
            return classRowPattern.test(rowText);
        });

        crsSchedulePersistentCache.availability[courseCode] = offered;
        saveCrsSchedulePersistentCache();
        return offered;
    }

    // -------------------------------------------------------------------------
    // 9. Prerequisite, requirement, and enlistment evaluation
    // -------------------------------------------------------------------------
    // Returns the complete cached curriculum-rules CSV (all rows and columns)
    // immediately, then refreshes expired data from Google Sheets without
    // blocking recommendation rendering. A valid stale cache remains preferable
    // to the smaller bundled fallback when the sheet is temporarily unavailable.
    function loadPrereqRules() {
        const msgDiv = document.getElementById('prereq-status-msg');
        msgDiv.innerText = 'Evaluating course prerequisites...';

        const cachedRules =
            localStorage.getItem(CURRICULUM_RULES_CACHE_KEY) ||
            localStorage.getItem(LEGACY_PREREQ_CACHE_KEY);
        const cachedRulesTime =
            localStorage.getItem(CURRICULUM_RULES_CACHE_TIME_KEY) ||
            localStorage.getItem(LEGACY_PREREQ_CACHE_TIME_KEY);
        const cachedRulesRows = cachedRules ? parseCSV(cachedRules) : null;
        const cachedRulesAreValid = hasProgressionMetadataColumns(cachedRulesRows);
        const initialRulesRows = getImmediatePrereqRules(cachedRulesRows);

        // Transparently migrate the previous prerequisite-only cache name. Its
        // stored value was already the complete exported curriculum-rules CSV.
        if (
            cachedRulesAreValid &&
            !localStorage.getItem(CURRICULUM_RULES_CACHE_KEY)
        ) {
            localStorage.setItem(CURRICULUM_RULES_CACHE_KEY, cachedRules);
            if (cachedRulesTime) {
                localStorage.setItem(
                    CURRICULUM_RULES_CACHE_TIME_KEY,
                    cachedRulesTime,
                );
            }
        }

        if (
            cachedRulesAreValid &&
            cachedRulesTime &&
            Date.now() - parseInt(cachedRulesTime, 10) < CACHE_EXPIRY_MS
        ) {
            return Promise.resolve(initialRulesRows);
        }

        const refreshPromise = new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: PREREQ_CSV_URL,
                timeout: 10000,
                onload: function (res) {
                    if (res.status === 200) {
                        if (isHTMLResponse(res.responseText)) {
                            reject(new Error('Google Sheets access was denied.'));
                            return;
                        }

                        const freshRulesRows = parseCSV(res.responseText);
                        if (!hasProgressionMetadataColumns(freshRulesRows)) {
                            reject(
                                new Error(
                                    'Rules sheet is missing valid offering and lab metadata.',
                                ),
                            );
                            return;
                        }

                        localStorage.setItem(
                            CURRICULUM_RULES_CACHE_KEY,
                            res.responseText,
                        );
                        localStorage.setItem(
                            CURRICULUM_RULES_CACHE_TIME_KEY,
                            Date.now().toString(),
                        );
                        resolve(freshRulesRows);
                    } else {
                        reject(
                            new Error(
                                `Failed to load prerequisite rules sheet (HTTP ${res.status}).`,
                            ),
                        );
                    }
                },
                onerror: function () {
                    reject(new Error('Unable to connect to the prerequisite rules sheet.'));
                },
                ontimeout: function () {
                    reject(new Error('Prerequisite rules request timed out.'));
                },
            });
        })
            .then((freshRulesRows) => {
                const rulesChanged =
                    JSON.stringify(freshRulesRows) !== JSON.stringify(initialRulesRows);
                latestPrereqRulesRows = freshRulesRows;
                if (
                    rulesChanged &&
                    checklistRecommendationDataReady &&
                    vsoStatusResolved &&
                    !isVsoStudent
                ) {
                    evaluatePrereqAndEnlisted(freshRulesRows);
                }
                return freshRulesRows;
            })
            .catch((error) => {
                console.warn(
                    '[USAD-CS] Prerequisite refresh failed; continuing with immediate fallback:',
                    error,
                );
                return initialRulesRows;
            });

        // Keep the refresh alive, but do not put it on the initial render path.
        void refreshPromise;
        return Promise.resolve(initialRulesRows);
    }

    // Evaluates prerequisites, corequisites, completed courses, enlistments, recommendations, and requirement summaries.
    function evaluatePrereqAndEnlisted(rulesRows) {
        if (!vsoStatusResolved || isVsoStudent) return;

        const msgDiv = document.getElementById('prereq-status-msg');
        const evaluationVersion = ++recommendationEvaluationVersion;

        // Normalize the editable equivalency list with the same canonical
        // course-code rules used for checklist and enlisted-course matching.
        const curriculumOverlapCourseCodes = new Set(
            COURSES_WITH_TOPIC_OVERLAPS.map(normalizeCode).filter(Boolean),
        );

        try {
            const listDiv = document.getElementById('prereq-recommendations-list');
            const matcherStatusDiv = document.getElementById('matcher-status');
            const { nstpBox, peBox, electivesBox } =
                ensureRequirementSummaryBoxes(listDiv);

            if (!rulesRows || rulesRows.length <= 1) {
                msgDiv.innerText = 'No prerequisite rules found.';
                return;
            }

            const checklistEntries = Array.from(extractedStudentGrades.values());
            // Build normalized checklist indexes once so later pass and
            // metadata checks are constant-time.
            const {
                passedCodes,
                displayNameByCode,
                entryByCode: checklistEntryByCode,
            } = buildChecklistIndexes(checklistEntries);

            // Count passed units directly from the parsed Mini Checklist.
            // PE and NSTP units are excluded from this standing calculation.
            const { passedAcademicUnits } = checklistAcademicSummary;

            // Checks whether the student has passed a course or has reached a standing-based unit threshold.
            const hasPassed = (courseCode) => {
                const normalized = normalizeCode(courseCode);

                // Special standing prerequisites from the prerequisite rules sheet.
                // Underscores and spaces normalize to the same values here.
                const standingStatus = getStandingRequirementStatus(
                    normalized,
                    passedAcademicUnits,
                );
                if (standingStatus !== null) return standingStatus;

                return (
                    passedCodes.has(normalized) ||
                    passedAttemptCourseCodes.has(normalized)
                );
            };

            console.log(
                `[USAD-CS] Academic units used for standing: ${passedAcademicUnits}`,
            );
            console.log(
                '[USAD-CS] Passed course attempts:',
                Array.from(passedAttemptCourseCodes),
            );

            // Parse and normalize every prerequisite-sheet rule once before evaluation.
            const { rules, ruleByCode } = applyCurriculumSpecificRuleOverrides(
                parsePrerequisiteRules(rulesRows),
                checklistEntries,
            );

            // Evaluate curriculum-specific paired-GE substitutions and GE-elective credit rules.
            const passedSoc1 = hasPassed('SOC SCI 1') || hasPassed('SOCSCI1');
            const passedSoc2 = hasPassed('SOC SCI 2') || hasPassed('SOCSCI2');
            const passedSTS = hasPassed('STS 1') || hasPassed('STS') || hasPassed('STS1');
            const passedDRMAPS = hasPassed('DRMAPS 1') || hasPassed('DRMAPS') || hasPassed('DRMAPS1');

            let geElectivePassedCount = 0;
            if (checklistEntries.length) {
                checklistEntries.forEach((val) => {
                    if (typeof isPassingGrade === 'function' && !isPassingGrade(val.grade)) return;
                    if (isGeElectiveChecklistEntry(val)) geElectivePassedCount++;
                });
            }

            if (passedSoc1 && passedSoc2) geElectivePassedCount++;
            if (passedSTS && passedDRMAPS) geElectivePassedCount++;

            const isGeElectiveSatisfied = geElectivePassedCount >= 1;

            // Apply special eligibility rules for the paired Soc Sci and STS/DRMAPS GE options.
            // Evaluates special paired-GE substitution rules and returns eligibility with an explanatory reason.
            const checkPairedGeEligibility = (courseCode) => {
                if (!courseCode) return null;
                const norm = normalizeCode(courseCode);

                const isSoc1 =
                    /^SOC\s*SCI\s*1\b/i.test(courseCode) ||
                    norm === 'SOCSCI1' ||
                    norm === 'SOCSCI10';
                const isSoc2 =
                    /^SOC\s*SCI\s*2\b/i.test(courseCode) ||
                    norm === 'SOCSCI2' ||
                    norm === 'SOCSCI20';

                if (isSoc1 || isSoc2) {
                    const currentPassed = isSoc1 ? passedSoc1 : passedSoc2;
                    const otherPassed = isSoc1 ? passedSoc2 : passedSoc1;

                    if (currentPassed) return { eligible: false, reason: 'Course already passed' };
                    if (otherPassed && isGeElectiveSatisfied)
                        return { eligible: false, reason: 'Soc Sci requirement already satisfied' };
                    return { eligible: true };
                }

                const isSTS =
                    /^(STS|STS\s*1)\b/i.test(courseCode) ||
                    norm === 'STS' ||
                    norm === 'STS1' ||
                    norm === 'STS10';
                const isDRMAPS =
                    /^(DRMAPS|DRMAPS\s*1)\b/i.test(courseCode) ||
                    norm === 'DRMAPS' ||
                    norm === 'DRMAPS1' ||
                    norm === 'DRMAPS10';

                if (isSTS || isDRMAPS) {
                    const currentPassed = isSTS ? passedSTS : passedDRMAPS;
                    const otherPassed = isSTS ? passedDRMAPS : passedSTS;

                    if (currentPassed) return { eligible: false, reason: 'Course already passed' };
                    if (otherPassed && isGeElectiveSatisfied)
                        return {
                            eligible: false,
                            reason: 'STS/DRMAPS requirement already satisfied',
                        };
                    return { eligible: true };
                }

                return null;
            };

            // 9.1 Evaluate PE completion.
            let pePassedCount = 0;
            for (const data of checklistEntries) {
                if (/^PE\b/i.test(data.rawName || '') && isPassingGrade(data.grade))
                    pePassedCount++;
            }
            renderPeRequirement(peBox, pePassedCount);

            // 9.2 Index unfinished checklist entries and evaluate prerequisites.
            // Recommendations are restricted to courses/slots actually found in the
            // student's parsed curriculum checklist. This prevents unrelated rows in
            // the rules sheet from appearing as recommendations.
            const remainingChecklistCodes = new Set();
            const checklistDisplayByCode = new Map();

            for (const data of checklistEntries) {
                if (isPassingGrade(data.grade)) continue;

                for (const alias of getChecklistEntryLabels(data)) {
                    const normAlias = normalizeCode(alias);
                    if (!normAlias) continue;
                    remainingChecklistCodes.add(normAlias);
                    if (!checklistDisplayByCode.has(normAlias)) {
                        checklistDisplayByCode.set(normAlias, stripGEIndex(data.rawName || alias));
                    }
                }
            }

            // Evaluates one prerequisite expression, including alternative requirements separated by OR.
            const requirementGroupMet = (requirement) => {
                if (!requirement) return true;
                // Each CSV cell may contain alternatives such as "Math 21 or Math 22".
                return requirement.split(/\s+or\s+/i).some((option) => hasPassed(option.trim()));
            };

            const prereqSatisfiedSet = new Set();
            for (const rule of rules) {
                if (rule.prerequisites.every(requirementGroupMet)) {
                    prereqSatisfiedSet.add(rule.normCourse);
                }
            }

            // A corequisite may already be passed, or may be taken concurrently when
            // its own prerequisites are satisfied. Prerequisites and corequisites are
            // cumulative requirements (AND), not alternatives.
            // Determines whether all corequisites for a rule are passed or currently enlisted.
            const corequisiteStatus = (rule) => {
                const concurrent = [];

                for (const requirement of rule.corequisites) {
                    const options = requirement
                        .split(/\s+or\s+/i)
                        .map((s) => s.trim())
                        .filter(Boolean);
                    let met = false;
                    let concurrentChoice = '';

                    for (const option of options) {
                        const normOption = normalizeCode(option);
                        if (hasPassed(normOption)) {
                            met = true;
                            concurrentChoice = '';
                            break;
                        }
                        if (prereqSatisfiedSet.has(normOption)) {
                            met = true;
                            concurrentChoice = option;
                        }
                    }

                    if (!met) return { satisfied: false, concurrent: [] };
                    if (concurrentChoice) concurrent.push(concurrentChoice);
                }

                return { satisfied: true, concurrent };
            };

            // 9.3 Build the eligible, unenlisted recommendation set.
            const eligibleCoursesMap = new Map();
            const eligibleCodesSet = new Set();

            const getRecommendationMetadata = (normCode, displayTitle = '') => {
                const data =
                    checklistEntryByCode.get(normCode) ||
                    checklistEntryByCode.get(normalizeCode(displayTitle));
                const category =
                    data?.category ||
                    getCourseCategory(data?.curriculumSlot || displayTitle);
                const unitValues = getCourseUnitValues(
                    normCode || displayTitle,
                    category,
                    data?.units,
                );

                return {
                    ...unitValues,
                    category,
                    curriculumSlot: data?.curriculumSlot || displayTitle,
                };
            };

            for (const rule of rules) {
                const normCourse = rule.normCourse;
                if (hasPassed(normCourse) || !remainingChecklistCodes.has(normCourse)) continue;

                const prereqsSatisfied = prereqSatisfiedSet.has(normCourse);
                const coreqResult = corequisiteStatus(rule);
                const isEligible = prereqsSatisfied && coreqResult.satisfied;

                if (isEligible) {
                    const displayTitle =
                        checklistDisplayByCode.get(normCourse) ||
                        displayNameByCode.get(normCourse) ||
                        rule.course;
                    eligibleCoursesMap.set(normCourse, {
                        course: displayTitle,
                        concurrent: coreqResult.concurrent,
                        semesterOffered: rule.semesterOffered,
                        hasLab: rule.hasLab,
                        ...getRecommendationMetadata(normCourse, displayTitle),
                    });
                    eligibleCodesSet.add(normCourse);
                }
            }

            // 9.4 Add eligible NSTP and GE checklist slots.
            let nstp1PassedEntry = null;
            let nstp2PassedEntry = null;

            if (typeof extractedStudentGrades !== 'undefined' && extractedStudentGrades) {
                extractedStudentGrades.forEach((data, key) => {
                    const normCode = key.split('___')[0];
                    const match =
                        data.rawName.match(
                            /^(CWTS|LTS|ROTC(?:\s*Mil\s*Sci)?|Mil\s*Sci|NSTP)\s*([12])\b/i,
                        ) || normCode.match(/^(cwts|lts|rotc|milsci|nstp)[_\s]*([12])\b/i);
                    if (
                        match &&
                        typeof isPassingGrade === 'function' &&
                        isPassingGrade(data.grade)
                    ) {
                        const trackName = match[1].replace(/\s+/g, ' ');
                        const level = match[2];
                        if (level === '1')
                            nstp1PassedEntry = {
                                rawName: data.rawName,
                                grade: data.grade,
                                track: trackName,
                            };
                        if (level === '2')
                            nstp2PassedEntry = {
                                rawName: data.rawName,
                                grade: data.grade,
                                track: trackName,
                            };
                    }
                });

                extractedStudentGrades.forEach((data, key) => {
                    const normCode = normalizeCode(key.split('___')[0]);
                    if (typeof isPassingGrade === 'function' && isPassingGrade(data.grade)) return;
                    if (eligibleCodesSet.has(normCode)) return;

                    const isNstp1 =
                        /^(nstp|cwts|lts|rotc|milsci)1\b/i.test(normCode) ||
                        /^(NSTP|CWTS|LTS|ROTC|MIL\s*SCI)\s*1\b/i.test(data.rawName);
                    const isNstp2 =
                        /^(nstp|cwts|lts|rotc|milsci)2\b/i.test(normCode) ||
                        /^(NSTP|CWTS|LTS|ROTC|MIL\s*SCI)\s*2\b/i.test(data.rawName);
                    const isGe = isGeCourseCode(normCode) || isGeCourseCode(data.rawName);

                    const displayCourseName = data.rawName || normCode;

                    if (
                        isNstp1 &&
                        !nstp1PassedEntry &&
                        hasPassed(NSTP_1_STANDING_REQUIREMENT)
                    ) {
                        eligibleCoursesMap.set(normCode, {
                            course: displayCourseName,
                            concurrent: [],
                            ...getRecommendationMetadata(normCode, displayCourseName),
                        });
                        eligibleCodesSet.add(normCode);
                    } else if (isNstp2 && nstp1PassedEntry && !nstp2PassedEntry) {
                        eligibleCoursesMap.set(normCode, {
                            course: displayCourseName,
                            concurrent: [],
                            ...getRecommendationMetadata(normCode, displayCourseName),
                        });
                        eligibleCodesSet.add(normCode);
                    } else if (isGe) {
                        const pairedCheck = checkPairedGeEligibility(data.rawName || normCode);
                        if (!pairedCheck || pairedCheck.eligible) {
                            eligibleCoursesMap.set(normCode, {
                                course: displayCourseName,
                                concurrent: [],
                                ...getRecommendationMetadata(normCode, displayCourseName),
                            });
                            eligibleCodesSet.add(normCode);
                        }
                    }
                });
            }

            // 9.5 Cross-check currently enlisted courses.
            // Parse every enlisted class row once. The structured objects are
            // reused for duplicate detection, eligibility checks, NSTP matching,
            // and display text instead of repeatedly querying and parsing the DOM.
            const enlistedCourses = Array.from(
                document.querySelectorAll('table.classlist tr'),
            )
                .map((row) => {
                    const descriptionCell = row.querySelector('td.td_coursedesc');
                    const fullText = descriptionCell?.innerText.trim() || '';
                    if (!fullText) return null;

                    const lines = fullText
                        .split('\n')
                        .map((line) => line.trim())
                        .filter(Boolean);
                    const firstLine = lines[0] || '';
                    const secondLine = lines[1] || '';
                    const baseCode = parseCourseCodeFromClassDescription(fullText);
                    const hasCrsPrerequisiteSatisfied = Array.from(
                        descriptionCell.querySelectorAll('img'),
                    ).some((image) =>
                        /prereq(?:uisite)?[\s_-]*satisfied/i.test(
                            [image.alt, image.title, image.getAttribute('src')]
                                .filter(Boolean)
                                .join(' '),
                        ),
                    );

                    return {
                        row,
                        fullText,
                        firstLine,
                        secondLine,
                        fullClassWithSection: firstLine,
                        courseWithSecondLine: secondLine
                            ? `${firstLine} (${secondLine})`
                            : firstLine,
                        baseCode,
                        normalizedCode: normalizeCode(baseCode),
                        scheduleText: row.cells?.[2]?.textContent || '',
                        creditText: row.cells?.[3]?.textContent || '',
                        hasCrsPrerequisiteSatisfied,
                    };
                })
                .filter(Boolean);

            const enlistedBaseCodes = new Set(
                enlistedCourses.map((course) => course.normalizedCode),
            );

            const foundationLoadStatus = getFoundationLoadRuleStatus(
                totalUnits,
                enlistedCourses,
                hasPassed,
            );
            const foundationLoadStatusDiv = document.getElementById(
                'foundation-load-rule-status',
            );
            if (foundationLoadStatusDiv) {
                foundationLoadStatusDiv.innerHTML = foundationLoadStatus.satisfied
                    ? ''
                    : `<div style="color:#842029; background-color:#f8d7da; border:1px solid #f5c2c7; padding:5px 6px; border-radius:4px; margin-top:5px; font-size:13px; font-weight:bold;">🚫 50% CS/Math rule unsatisfied!</div>`;
            }

            // Paired GE options should not be recommended against one another
            // while either option is already enlisted.
            const enlistedPairedGeOptions = new Set(
                Array.from(enlistedBaseCodes)
                    .map(getPairedGeOption)
                    .filter(Boolean),
            );
            const conflictsWithEnlistedPairedGe = (courseCode) => {
                const option = getPairedGeOption(courseCode);
                if (option === 'SOCSCI1')
                    return enlistedPairedGeOptions.has('SOCSCI2');
                if (option === 'SOCSCI2')
                    return enlistedPairedGeOptions.has('SOCSCI1');
                if (option === 'STS1')
                    return enlistedPairedGeOptions.has('DRMAPS');
                if (option === 'DRMAPS')
                    return enlistedPairedGeOptions.has('STS1');
                return false;
            };

            // CRS lists enlisted classes with actual prerequisite requirements
            // in #tbl_prereq. This index prevents courses without CRS
            // prerequisites from being rejected solely because the external
            // spreadsheet has no matching rule.
            const crsCoursesWithPrerequisites = new Set();
            document.querySelectorAll('#tbl_prereq tbody tr').forEach((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;

                const crsCourseCode = parseCourseCodeFromClassDescription(cells[1].innerText || '');
                const normalizedCode = normalizeCode(crsCourseCode);
                if (normalizedCode) crsCoursesWithPrerequisites.add(normalizedCode);
            });

            console.log(
                '[USAD-CS] CRS courses with prerequisites:',
                Array.from(crsCoursesWithPrerequisites),
            );

            // Count completed CS and Free Elective requirements before checking
            // enlisted CS electives. These totals are also used to explain why
            // an enlisted CS 171-176 course still requires elective verification.
            let csElectivePassedCount = 0;
            let freeElectivePassedCount = 0;

            if (typeof extractedStudentGrades !== 'undefined' && extractedStudentGrades) {
                extractedStudentGrades.forEach((val, key) => {
                    if (typeof isPassingGrade === 'function' && !isPassingGrade(val.grade)) return;

                    const raw = (val.rawName || '').toUpperCase();
                    const norm = key.split('___')[0].toUpperCase();

                    if (
                        /^CS\s*17[1-6]\b/.test(raw) ||
                        /CS\s*ELECTIVE/.test(raw) ||
                        /^CS17[1-6]/.test(norm) ||
                        /CSELECTIVE/.test(norm)
                    ) {
                        csElectivePassedCount++;
                    } else if (
                        /FREE\s*ELECTIVE/i.test(raw) ||
                        /FREEELECTIVE/i.test(norm) ||
                        (/\bELECTIVE\b/i.test(raw) && !/GE/i.test(raw) && !/CS/i.test(raw))
                    ) {
                        freeElectivePassedCount++;
                    }
                });
            }

            // Returns the specific reason an eligible CS elective still needs
            // manual verification against the student's remaining elective slot.
            const getCSElectiveVerificationReason = () => {
                const csSatisfied = csElectivePassedCount >= 1;
                const freeSatisfied = freeElectivePassedCount >= 1;

                if (csSatisfied && freeSatisfied) {
                    return 'CS and Free Elective requirements are already satisfied';
                }
                if (csSatisfied) {
                    return 'CS Elective requirement is already satisfied; verify if this may count as a Free Elective';
                }
                if (freeSatisfied) {
                    return 'Free Elective requirement is already satisfied; verify if this may count as a CS Elective';
                }
                return 'Verify whether this course will count as a CS Elective or Free Elective';
            };

            const ineligibleEnlisted = [];
            const enlistedNstp2Courses = [];
            const csElectiveWarnings = [];
            const eligibleEnlistedCourseByCode = new Map();

            // Evaluate each pre-parsed enlisted course exactly once.
            enlistedCourses.forEach((enlistedCourse) => {
                const {
                    row,
                    fullText,
                    firstLine,
                    secondLine,
                    fullClassWithSection,
                    courseWithSecondLine,
                    baseCode,
                    normalizedCode: normBase,
                    hasCrsPrerequisiteSatisfied,
                } = enlistedCourse;

                const isPE = /^PE\b/i.test(baseCode);
                const isGenericNSTP = /^(CWTS|ROTC|LTS|Mil\s*Sci|NSTP)\b/i.test(baseCode);
                const isCSElective = /^CS\s*17[1-6]\b/i.test(baseCode);
                const isGE = isGeCourseCode(baseCode) || isGeCourseCode(normBase);

                const isNstp1 =
                    /^(CWTS|LTS|ROTC(?:\s*Mil\s*Sci)?|Mil\s*Sci|NSTP)\s*1\b/i.test(baseCode) ||
                    /^(cwts|lts|rotc|milsci|nstp)1$/i.test(normBase);
                const isNstp2 =
                    /^(CWTS|LTS|ROTC(?:\s*Mil\s*Sci)?|Mil\s*Sci|NSTP)\s*2\b/i.test(baseCode) ||
                    /^(cwts|lts|rotc|milsci|nstp)2$/i.test(normBase);

                if (isNstp2) {
                    enlistedNstp2Courses.push({
                        fullTitle: courseWithSecondLine,
                        baseCode: baseCode,
                    });
                }

                // Find rule matching this course (Strict Normalization Check)
                const matchingRule = ruleByCode.get(normBase);

                let isEligible = false;
                let reason = '';

                const pairedGeResult = checkPairedGeEligibility(baseCode);

                // Curriculum-equivalent courses are always ineligible. This
                // override is checked first so it takes priority over every
                // general eligibility rule and CS-elective verification.
                if (curriculumOverlapCourseCodes.has(normBase)) {
                    isEligible = false;
                    reason = 'Course has overlaps on the course/s in the curriculum';
                } else if (pairedGeResult !== null) {
                    isEligible = pairedGeResult.eligible;
                    if (!isEligible) reason = pairedGeResult.reason;
                } else if (isNstp1) {
                    if (nstp1PassedEntry || hasPassed(normBase)) {
                        isEligible = false;
                        reason = 'Course already passed';
                    } else if (!hasPassed(NSTP_1_STANDING_REQUIREMENT)) {
                        isEligible = false;
                        reason =
                            'Missing prerequisites: SOPHOMORE STANDING (37 academic units)';
                    } else {
                        isEligible = true;
                    }
                } else if (isNstp2) {
                    if (nstp2PassedEntry || hasPassed(normBase)) {
                        isEligible = false;
                        reason = 'Course already passed';
                    } else if (!nstp1PassedEntry) {
                        isEligible = false;
                        reason = 'Missing prerequisites: NSTP 1';
                    } else {
                        isEligible = true;
                    }
                } else if (
                    hasReachedPassedAttemptLimit(
                        normBase,
                        passedAttemptCourseCounts.get(normBase) ||
                            (hasPassed(normBase) ? 1 : 0),
                    )
                ) {
                    isEligible = false;
                    reason =
                        getPassedAttemptLimit(normBase) === 2
                            ? 'Course already passed twice'
                            : 'Course already passed';
                } else if (isPE || isGenericNSTP || isGE) {
                    isEligible = true;
                } else if (matchingRule) {
                    const prereqs = matchingRule.prerequisites;
                    const hasPrereqs = prereqs.length > 0;
                    const missingPrereqs = [];

                    prereqs.forEach((req) => {
                        if (req.toLowerCase().includes(' or ')) {
                            const opts = req.split(/\s+or\s+/i);
                            if (!opts.some((opt) => hasPassed(opt))) missingPrereqs.push(req);
                        } else if (!hasPassed(req)) {
                            missingPrereqs.push(req);
                        }
                    });

                    const prereqsMet = missingPrereqs.length === 0;

                    const coreqs = matchingRule.corequisites;
                    const hasCoreqs = coreqs.length > 0;
                    const missingCoreqs = [];

                    coreqs.forEach((req) => {
                        const normCoreq = normalizeCode(req);
                        const coreqPassed = hasPassed(normCoreq);
                        const coreqEnlisted = enlistedBaseCodes.has(normCoreq);

                        if (!coreqPassed && !coreqEnlisted) {
                            missingCoreqs.push(req);
                        }
                    });

                    const coreqsMet = missingCoreqs.length === 0;

                    // Prerequisites and corequisites are cumulative requirements.
                    isEligible = prereqsMet && coreqsMet;
                    if (!isEligible) {
                        const reasons = [];
                        if (!prereqsMet)
                            reasons.push(
                                `Missing prerequisites: ${missingPrereqs
                                    .map(formatRequirementForDisplay)
                                    .join(', ')}`,
                            );
                        if (!coreqsMet)
                            reasons.push(`Missing corequisites: ${missingCoreqs.join(', ')}`);
                        reason = reasons.join('; ');
                    }
                } else {
                    if (eligibleCodesSet.has(normBase)) {
                        isEligible = true;
                    } else if (hasCrsPrerequisiteSatisfied) {
                        // CRS evaluated the actual enlisted class and exposes
                        // an explicit satisfied marker. Trust that result when
                        // the external rules sheet has no matching course row.
                        isEligible = true;
                    } else if (!crsCoursesWithPrerequisites.has(normBase)) {
                        // CRS does not show a prerequisite entry for this
                        // enlisted course. Treat it as having no prerequisite,
                        // even when the external rules sheet has no row.
                        isEligible = true;
                    } else {
                        reason =
                            'course has prerequisite/s';
                    }
                }

                if (isEligible && normBase) {
                    eligibleEnlistedCourseByCode.set(normBase, baseCode);
                }

                // Ineligibility has priority over CS-elective verification.
                // A repeatable CS elective that already has two passing grades,
                // or otherwise fails an eligibility rule, belongs in the
                // ineligible list rather than elective verification.
                if (!isEligible) {
                    row.style.backgroundColor = '#f8d7da';
                    ineligibleEnlisted.push(
                        `<strong>${fullClassWithSection}</strong> <span style="font-weight: normal;">(${reason})</span>`,
                    );
                } else if (isCSElective) {
                    const electiveReason = getCSElectiveVerificationReason();
                    csElectiveWarnings.push(
                        `<strong>${courseWithSecondLine}</strong> <span style="font-weight: normal;">(${electiveReason})</span>`,
                    );
                    row.style.backgroundColor = '#ffe8cc';
                } else {
                    row.style.backgroundColor = '#d4edda';
                }
            });

            // 9.6 Render the NSTP completion summary.
            renderNstpRequirement(nstpBox, nstp1PassedEntry, nstp2PassedEntry);

            // 9.7 Render enlistment warnings and eligibility status.
            renderEnlistmentStatus(
                matcherStatusDiv,
                enlistedCourses.length,
                ineligibleEnlisted,
                csElectiveWarnings,
            );

            // 9.8 Render elective completion totals.
            renderElectivesRequirement(
                electivesBox,
                csElectivePassedCount,
                freeElectivePassedCount,
                geElectivePassedCount,
            );

            // 9.9 Build a balanced, semester-specific progression load.
            // Column 4 of the rules sheet is authoritative for core-course
            // placement. Required GEs remain eligible when they are in the
            // current checklist, while the GE-elective choice comes from the
            // current GEC offering list.
            const progressionStatusDiv = document.getElementById(
                'progression-recommender-status',
            );
            const progressionLoadDiv = document.getElementById(
                'progression-recommender-load',
            );

            const isCourseAllowedThisTerm = (item) =>
                !activeAcademicTermCode ||
                !item.semesterOffered?.length ||
                item.semesterOffered.includes(activeAcademicTermCode);

            const progressionCandidateByCode = new Map(
                Array.from(eligibleCoursesMap.entries())
                    .filter(([normCode, item]) => {
                        if (enlistedBaseCodes.has(normCode) || !isCourseAllowedThisTerm(item))
                            return false;
                        if (
                            conflictsWithEnlistedPairedGe(
                                item.course || item.curriculumSlot || normCode,
                            )
                        )
                            return false;

                        const name = String(item.course || '').trim();
                        const category =
                            item.category || getCourseCategory(item.curriculumSlot || name);
                        return (
                            !/^(cs|ge|free)\s*elective/i.test(name) &&
                            !/^cs\s*17[1-6]\b/i.test(name) &&
                            !/^(nstp|cwts|lts|rotc|milsci|pe)\b/i.test(name) &&
                            ![
                                COURSE_CATEGORIES.CS_ELECTIVE,
                                COURSE_CATEGORIES.FREE_ELECTIVE,
                                COURSE_CATEGORIES.NSTP,
                                COURSE_CATEGORIES.PE,
                            ].includes(category)
                        );
                    })
                    .map(([normCode, item]) => [
                        normCode,
                        {
                            ...item,
                            normCode,
                            units:
                                Number.isFinite(Number(item.units)) && Number(item.units) >= 0
                                    ? Number(item.units)
                                    : 3,
                            category:
                                item.category ||
                                getCourseCategory(item.curriculumSlot || item.course),
                        },
                    ]),
            );

            const reservedGeCourseCodes = new Set();
            checklistEntries.forEach((data) => {
                if (!data.isGE && data.category !== COURSE_CATEGORIES.REQUIRED_GE)
                    return;
                if (isGeElectiveChecklistEntry(data)) return;

                const requiredGeLabels = getChecklistEntryLabels(data);
                getChecklistEntryCodes(data).forEach((code) =>
                    reservedGeCourseCodes.add(code),
                );

                // Alternative required-GE labels normalize to their first
                // option (for example, Soc Sci 1/Soc Sci 2 -> SOCSCI1).
                // Reserve both choices so an enlisted second option cannot be
                // consumed as the student's separate GE-elective requirement.
                const combinedRequiredGeLabel = requiredGeLabels.join(' ');
                if (
                    /SOC\s*SCI\s*1\s*\/\s*(?:SOC\s*SCI\s*)?2/i.test(
                        combinedRequiredGeLabel,
                    )
                ) {
                    reservedGeCourseCodes.add(normalizeCode('Soc Sci 1'));
                    reservedGeCourseCodes.add(normalizeCode('Soc Sci 2'));
                }
                if (
                    /STS(?:\s*1)?\s*\/\s*DRMAPS/i.test(
                        combinedRequiredGeLabel,
                    )
                ) {
                    reservedGeCourseCodes.add(normalizeCode('STS 1'));
                    reservedGeCourseCodes.add(normalizeCode('DRMAPS'));
                }
            });

            const geElectiveCandidate = (() => {
                if (isGeElectiveSatisfied) return null;

                const course = GE_COURSES_LIST.find((geCourse) => {
                    const normCode = normalizeCode(geCourse);
                    return (
                        normCode &&
                        !hasPassed(normCode) &&
                        !enlistedBaseCodes.has(normCode) &&
                        !reservedGeCourseCodes.has(normCode) &&
                        !curriculumOverlapCourseCodes.has(normCode)
                    );
                });

                if (!course) {
                    return {
                        normCode: 'GEELECTIVE',
                        course: 'GE Elective',
                        units: 3,
                        category: 'GE Elective',
                        concurrent: [],
                        isPlaceholder: true,
                    };
                }

                return {
                    normCode: normalizeCode(course),
                    course,
                    units: 3,
                    category: 'GE Elective',
                    concurrent: [],
                    fromCurrentGeList: true,
                };
            })();

            // Prioritize courses that unlock the greatest number of unfinished
            // rule-sheet courses; use natural course order as a stable tie-break.
            const progressionDependencyScore = (candidate) =>
                rules.reduce((score, rule) => {
                    if (hasPassed(rule.normCourse)) return score;
                    const requirements = [...rule.prerequisites, ...rule.corequisites];
                    const unlocksRule = requirements.some((requirement) =>
                        requirement
                            .split(/\s+or\s+/i)
                            .some(
                                (option) =>
                                    normalizeCode(option.trim()) === candidate.normCode,
                            ),
                    );
                    return score + (unlocksRule ? 1 : 0);
                }, 0);

            const progressionCoreCandidates = Array.from(
                progressionCandidateByCode.values(),
            )
                .filter((item) => item.category !== COURSE_CATEGORIES.REQUIRED_GE)
                .sort(
                    (a, b) =>
                        progressionDependencyScore(b) - progressionDependencyScore(a) ||
                        naturalCourseSort(a.course, b.course),
                );
            const progressionRequiredGeCandidates = Array.from(
                progressionCandidateByCode.values(),
            )
                .filter((item) => item.category === COURSE_CATEGORIES.REQUIRED_GE)
                .sort((a, b) => naturalCourseSort(a.course, b.course));

            const enlistedProgressionCourses = enlistedCourses.map((course) => {
                const rule = ruleByCode.get(course.normalizedCode);
                return {
                    normCode: course.normalizedCode,
                    hasLab: Boolean(
                        rule?.hasLab || /\blab\b/i.test(course.scheduleText),
                    ),
                };
            });

            const buildProgressionLoad = () => {
                const selected = [];
                const selectedCodes = new Set();
                let totalUnits = 0;

                // Add a course and every not-yet-passed corequisite as one
                // atomic bundle. Regular terms allow 21 units when the
                // resulting load contains a lab course and 18 otherwise.
                const addCandidateBundle = (candidate, reason) => {
                    if (!candidate || selectedCodes.has(candidate.normCode)) return false;

                    const bundle = [candidate];
                    for (const corequisite of candidate.concurrent || []) {
                        const normCorequisite = normalizeCode(corequisite);
                        if (
                            !normCorequisite ||
                            selectedCodes.has(normCorequisite) ||
                            hasPassed(normCorequisite) ||
                            enlistedBaseCodes.has(normCorequisite)
                        )
                            continue;

                        const corequisiteCandidate =
                            progressionCandidateByCode.get(normCorequisite);
                        if (!corequisiteCandidate) return false;
                        bundle.push(corequisiteCandidate);
                    }

                    const uniqueBundle = bundle.filter(
                        (item, index, items) =>
                            !selectedCodes.has(item.normCode) &&
                            items.findIndex(
                                (other) => other.normCode === item.normCode,
                            ) === index,
                    );
                    const bundleUnits = uniqueBundle.reduce(
                        (sum, item) => sum + item.units,
                        0,
                    );
                    const maximumUnits = getProgressionMaximumUnits(
                        activeAcademicTermCode,
                        [...selected, ...uniqueBundle],
                    );
                    if (
                        !isValidProgressionCourseSet(
                            activeAcademicTermCode,
                            [...selected, ...uniqueBundle],
                        )
                    )
                        return false;
                    if (totalUnits + bundleUnits > maximumUnits) return false;

                    uniqueBundle.forEach((item) => {
                        selected.push({
                            ...item,
                            reason:
                                item.normCode === candidate.normCode
                                    ? reason
                                    : `Corequisite of ${candidate.course}`,
                        });
                        selectedCodes.add(item.normCode);
                        totalUnits += item.units;
                    });
                    return true;
                };

                const midyearCs195Candidate =
                    activeAcademicTermCode === 'M'
                        ? progressionCandidateByCode.get(cs195NormCode)
                        : null;

                if (midyearCs195Candidate) {
                    addCandidateBundle(
                        midyearCs195Candidate,
                        'Exclusive Midyear CS 195 load',
                    );
                } else {
                    // Reserve a balanced part of the load for GE progress
                    // before filling the remaining capacity with
                    // prerequisite-unlocking core courses and then any
                    // additional required GEs.
                    addCandidateBundle(
                        progressionRequiredGeCandidates[0],
                        'Unsatisfied required GE',
                    );
                    addCandidateBundle(
                        geElectiveCandidate,
                        geElectiveCandidate?.isPlaceholder
                            ? 'Choose from the current GEC list'
                            : 'Unsatisfied GE-elective requirement',
                    );
                    progressionCoreCandidates.forEach((item) =>
                        addCandidateBundle(
                            item,
                            'Advances the core-course sequence',
                        ),
                    );
                    progressionRequiredGeCandidates.slice(1).forEach((item) =>
                        addCandidateBundle(item, 'Unsatisfied required GE'),
                    );
                }

                return {
                    selected,
                    totalUnits,
                    maximumUnits: getProgressionMaximumUnits(
                        activeAcademicTermCode,
                        selected,
                    ),
                };
            };

            const renderProgressionRecommendation = (
                availabilityByCourse = null,
                lookupFailed = false,
            ) => {
                if (!progressionStatusDiv || !progressionLoadDiv) return;

                const { selected, totalUnits, maximumUnits } =
                    buildProgressionLoad();
                const currentTermLabel =
                    activeAcademicTermCode === '1'
                        ? 'first semester'
                        : activeAcademicTermCode === '2'
                          ? 'second semester'
                          : activeAcademicTermCode === 'M'
                            ? 'midyear'
                            : 'current term';

                if (!selected.length) {
                    progressionStatusDiv.style.color = '#664d03';
                    progressionStatusDiv.innerText =
                        'No eligible courses can be placed in the current load.';
                    progressionLoadDiv.innerHTML = '';
                    return;
                }

                const grouped = {
                    'Core Courses': selected.filter(
                        (item) =>
                            item.category !== 'Required GE Courses' &&
                            item.category !== 'GE Elective',
                    ),
                    'Required GEs': selected.filter(
                        (item) => item.category === 'Required GE Courses',
                    ),
                    'GE Elective': selected.filter(
                        (item) => item.category === 'GE Elective',
                    ),
                };

                let html = `<div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px; background:#fff; border:1px solid #e9d5ff; border-radius:4px;">
                    <span style="font-size:11px; font-weight:bold; color:#581c87;">Recommended ${escapeHTML(currentTermLabel)} load</span>
                    <span style="font-size:13px; font-weight:bold; color:#7b1113;">${totalUnits} / ${maximumUnits} units</span>
                </div>`;

                Object.entries(grouped).forEach(([label, items]) => {
                    if (!items.length) return;
                    html += `<div style="margin-top:5px;"><b style="font-size:11px; color:#7b1113;">${escapeHTML(label)}</b><ul style="margin:2px 0 0 18px; padding:0;">`;
                    items.forEach((item) => {
                        const checked = availabilityByCourse?.has(item.course);
                        const offered = availabilityByCourse?.get(item.course) === true;
                        const displayCourse = formatCourseDisplayName(item.course);
                        const availabilityIcon =
                            checked && offered
                                ? ' <span title="Available in CRS" aria-label="Available in CRS">✅</span>'
                                : item.fromCurrentGeList
                                  ? ' <span title="Listed by GEC for the current term" aria-label="Listed by GEC for the current term">✅</span>'
                                  : '';
                        const units = isZeroAcademicUnitCourse(
                            item.normCode || item.course,
                            item.category,
                        )
                            ? `(${item.displayUnits})`
                            : Number.isInteger(item.units)
                              ? item.units
                              : item.units.toFixed(1);
                        html += `<li style="margin-bottom:2px; font-size:11px;"><b>${escapeHTML(displayCourse)}</b>${availabilityIcon} — ${units} units <span style="color:#666;">(${escapeHTML(item.reason)})</span></li>`;
                    });
                    html += '</ul></div>';
                });

                progressionLoadDiv.innerHTML = html;
                progressionStatusDiv.style.color = lookupFailed ? '#856404' : '#666';
                progressionStatusDiv.innerText = activeAcademicTermCode
                    ? `Core-course placement follows column 4 of the rules sheet (${activeAcademicTermCode}); lab-aware unit caps follow column 5.`
                    : 'CRS term could not be identified; semester-placement filtering was not applied.';
            };

            // Builds consecutive prescribed loads until every unfinished
            // checklist slot has been placed. Each load projects successful
            // completion before evaluating the next term's prerequisites.
            const buildPrescribedProgression = () => {
                const remainingCandidates = [];
                const assignedEnlistedCodes = new Set();
                const addedUnresolvedPairedGeFamilies = new Set();
                const enlistedNstp2Continuation = (() => {
                    const enlistedNstp1 = Array.from(
                        eligibleEnlistedCourseByCode.entries(),
                    ).find(
                        ([normCode, course]) =>
                            getNstpLevel(normCode, course) === 1,
                    );
                    if (!enlistedNstp1) return '';

                    const displayCourse = cleanExtractedCourseTitle(
                        enlistedNstp1[1],
                        'NSTP',
                    );
                    return displayCourse.replace(/\s+1\b.*$/i, ' 2');
                })();
                const getUnresolvedPairedGeLabel = (family) => {
                    if (
                        family === 'SOCSCI' &&
                        !passedSoc1 &&
                        !passedSoc2 &&
                        !enlistedPairedGeOptions.has('SOCSCI1') &&
                        !enlistedPairedGeOptions.has('SOCSCI2')
                    )
                        return 'Soc Sci 1/2';
                    if (
                        family === 'STSDRMAPS' &&
                        !passedSTS &&
                        !passedDRMAPS &&
                        !enlistedPairedGeOptions.has('STS1') &&
                        !enlistedPairedGeOptions.has('DRMAPS')
                    )
                        return 'STS/DRMAPS';
                    return '';
                };

                const findEligibleEnlistedMatch = (
                    category,
                    aliases,
                    isGeElectiveSlot,
                ) => {
                    const requiredNstpLevel =
                        category === COURSE_CATEGORIES.NSTP
                            ? getNstpLevel(...aliases)
                            : null;
                    const pairedGeFamily =
                        category === COURSE_CATEGORIES.REQUIRED_GE
                            ? getPairedGeFamily(...aliases)
                            : '';
                    const exactMatch = aliases.find(
                        (alias) =>
                            eligibleEnlistedCourseByCode.has(alias) &&
                            !assignedEnlistedCodes.has(alias),
                    );
                    if (exactMatch) return exactMatch;

                    return Array.from(eligibleEnlistedCourseByCode.keys()).find(
                        (code) => {
                            if (assignedEnlistedCodes.has(code)) return false;
                            if (category === COURSE_CATEGORIES.CS_ELECTIVE)
                                return /^CS17[1-6]$/.test(code);
                            if (category === COURSE_CATEGORIES.PE)
                                return /^PE\d/.test(code);
                            if (category === COURSE_CATEGORIES.NSTP)
                                return (
                                    /^(?:NSTP|CWTS|LTS|ROTC|ROTCMILSCI|MILSCI)\d/.test(code) &&
                                    (!requiredNstpLevel ||
                                        getNstpLevel(
                                            code,
                                            eligibleEnlistedCourseByCode.get(
                                                code,
                                            ),
                                        ) === requiredNstpLevel)
                                );
                            if (pairedGeFamily) {
                                const pairedOption = getPairedGeOption(code);
                                if (pairedGeFamily === 'SOCSCI')
                                    return (
                                        pairedOption === 'SOCSCI1' ||
                                        pairedOption === 'SOCSCI2'
                                    );
                                if (pairedGeFamily === 'STSDRMAPS')
                                    return (
                                        pairedOption === 'STS1' ||
                                        pairedOption === 'DRMAPS'
                                    );
                            }
                            if (isGeElectiveSlot)
                                return (
                                    isGeCourseCode(code) &&
                                    !reservedGeCourseCodes.has(code)
                                );
                            if (category === COURSE_CATEGORIES.FREE_ELECTIVE)
                                return (
                                    !ruleByCode.has(code) &&
                                    !isGeCourseCode(code) &&
                                    !/^(?:PE|NSTP|CWTS|LTS|ROTC|ROTCMILSCI|MILSCI)\d/.test(code)
                                );
                            return false;
                        },
                    );
                };

                extractedStudentGrades.forEach((data, entryKey) => {
                    if (isPassingGrade(extractFinalGrade(data.grade))) return;

                    const category =
                        data.category ||
                        getCourseCategory(data.curriculumSlot || data.rawName || '');
                    const isGeElectiveSlot = isGeElectiveChecklistEntry(data);

                    // Paired-GE substitutions may satisfy the GE-elective slot
                    // even when the generic checklist row itself has no grade.
                    if (isGeElectiveSlot && isGeElectiveSatisfied) return;

                    const aliases = getChecklistEntryCodes(data);
                    const hasPassedConcreteAlias = aliases.some(
                        (alias) =>
                            !(
                                category === COURSE_CATEGORIES.PE &&
                                alias === COURSE_CATEGORIES.PE
                            ) &&
                            hasPassed(alias),
                    );
                    if (hasPassedConcreteAlias) return;

                    const enlistedNormCode = findEligibleEnlistedMatch(
                        category,
                        aliases,
                        isGeElectiveSlot,
                    );
                    if (enlistedNormCode)
                        assignedEnlistedCodes.add(enlistedNormCode);

                    const matchingRule =
                        ruleByCode.get(enlistedNormCode) ||
                        aliases.map((alias) => ruleByCode.get(alias)).find(Boolean);

                    let course = cleanExtractedCourseTitle(
                        data.rawName || data.curriculumSlot || 'Course',
                        category,
                    );
                    let normCode =
                        matchingRule?.normCourse ||
                        data.normalizedRawName ||
                        normalizeCode(course);

                    if (enlistedNormCode) {
                        course =
                            eligibleEnlistedCourseByCode.get(enlistedNormCode) ||
                            course;
                        normCode = enlistedNormCode;
                    } else if (isGeElectiveSlot && geElectiveCandidate) {
                        course = geElectiveCandidate.course;
                        normCode = geElectiveCandidate.normCode;
                    } else if (
                        category === COURSE_CATEGORIES.CS_ELECTIVE &&
                        /ELECTIVE/i.test(course)
                    ) {
                        course = 'CS Elective';
                    } else if (
                        category === COURSE_CATEGORIES.FREE_ELECTIVE &&
                        /ELECTIVE/i.test(course)
                    ) {
                        course = 'Free Elective';
                    } else if (
                        category === COURSE_CATEGORIES.PE &&
                        !/^PE\s+\d/i.test(course)
                    ) {
                        course = 'PE Course';
                    }

                    if (
                        category === COURSE_CATEGORIES.NSTP &&
                        getNstpLevel(normCode, course) === 2 &&
                        enlistedNstp2Continuation
                    ) {
                        course = enlistedNstp2Continuation;
                        normCode = normalizeCode(course);
                    }

                    const pairedGeFamily = getPairedGeFamily(
                        data.curriculumSlot,
                        data.rawName,
                        data.completedCourse,
                        course,
                        normCode,
                    );
                    const unresolvedPairedGeLabel =
                        getUnresolvedPairedGeLabel(pairedGeFamily);
                    if (unresolvedPairedGeLabel) {
                        if (
                            addedUnresolvedPairedGeFamilies.has(
                                pairedGeFamily,
                            )
                        )
                            return;
                        addedUnresolvedPairedGeFamilies.add(pairedGeFamily);
                        course = unresolvedPairedGeLabel;
                        normCode =
                            pairedGeFamily === 'SOCSCI'
                                ? 'SOCSCI1OR2'
                                : 'STSORDRMAPS';
                    }

                    if (conflictsWithEnlistedPairedGe(course || normCode)) return;

                    course = formatCourseDisplayName(course);

                    // Resolve the rule again from the final course code. This
                    // is the authoritative placement lookup for concrete
                    // enlisted courses and substituted checklist labels (for
                    // example, CS 195 must retain its M-only restriction).
                    const resolvedRule = ruleByCode.get(normCode) || matchingRule;
                    const { units, displayUnits } = getCourseUnitValues(
                        normCode || course,
                        category,
                        data.units,
                    );
                    const isRuleManagedCourse =
                        /^(?:CS|MATH|PHYSICS)\d/.test(normCode);
                    const isFlexibleNonAcademicRequirement =
                        category === COURSE_CATEGORIES.REQUIRED_GE ||
                        isGeElectiveSlot ||
                        NON_ACADEMIC_CATEGORIES.has(category);
                    const semesterOffered = resolvedRule
                        ? resolvedRule.semesterOffered
                        : isRuleManagedCourse
                          ? []
                          : isFlexibleNonAcademicRequirement
                            ? ['1', '2', 'M']
                            : category === COURSE_CATEGORIES.CS_ELECTIVE
                              ? ['1', '2']
                            : ['1', '2'];
                    const nstpLevel =
                        category === COURSE_CATEGORIES.NSTP
                            ? getNstpLevel(normCode, course)
                            : null;
                    const prerequisites = getNstpPrerequisites(
                        nstpLevel,
                        resolvedRule?.prerequisites || [],
                    );
                    if (
                        category === COURSE_CATEGORIES.CS_ELECTIVE &&
                        !prerequisites.some(
                            (requirement) =>
                                normalizeCode(requirement) === 'JRSTANDING',
                        )
                    )
                        prerequisites.push('JR_STANDING');

                    remainingCandidates.push({
                        id: entryKey,
                        normCode,
                        course,
                        units,
                        displayUnits,
                        category: isGeElectiveSlot
                            ? COURSE_CATEGORIES.GE_ELECTIVE
                            : category,
                        nstpLevel,
                        prerequisites,
                        corequisites: resolvedRule?.corequisites || [],
                        semesterOffered,
                        hasLab: Boolean(resolvedRule?.hasLab),
                        isCurrentlyEnlisted: Boolean(enlistedNormCode),
                        isPlaceholder:
                            /^(?:CS|GE|FREE)\s+ELECTIVE$/i.test(course) ||
                            course === 'PE Course',
                    });
                });

                // Keep the GE-elective requirement visible even when a generic
                // checklist row was omitted or labeled through a different alias.
                if (
                    !isGeElectiveSatisfied &&
                    geElectiveCandidate &&
                    !remainingCandidates.some(
                        (candidate) => candidate.category === 'GE Elective',
                    )
                ) {
                    const enlistedNormCode = findEligibleEnlistedMatch(
                        'Required GE Courses',
                        ['GEELECTIVE'],
                        true,
                    );
                    if (enlistedNormCode)
                        assignedEnlistedCodes.add(enlistedNormCode);

                    const course =
                        eligibleEnlistedCourseByCode.get(enlistedNormCode) ||
                        geElectiveCandidate.course;
                    const normCode =
                        enlistedNormCode || geElectiveCandidate.normCode;
                    const resolvedRule = ruleByCode.get(normCode);

                    remainingCandidates.push({
                        id: '__ge_elective__',
                        normCode,
                        course,
                        units: 3,
                        displayUnits: 3,
                        category: 'GE Elective',
                        nstpLevel: null,
                        prerequisites: resolvedRule?.prerequisites || [],
                        corequisites: resolvedRule?.corequisites || [],
                        semesterOffered:
                            resolvedRule?.semesterOffered?.length
                                ? resolvedRule.semesterOffered
                                : ['1', '2', 'M'],
                        hasLab: Boolean(resolvedRule?.hasLab),
                        isCurrentlyEnlisted: Boolean(enlistedNormCode),
                        isPlaceholder: Boolean(
                            geElectiveCandidate.isPlaceholder &&
                                !enlistedNormCode,
                        ),
                    });
                }

                // Checklist matching remains useful for assigning an enlisted
                // course to its curriculum slot, but it must not decide
                // whether a prerequisite-valid current enlistment appears in
                // the first term. Reuse an exact candidate when possible and
                // add a display-only progression candidate otherwise.
                const enlistedCourseByCode = new Map(
                    enlistedCourses.map((course) => [course.normalizedCode, course]),
                );
                const currentEnlistedCandidateByCode = new Map();
                eligibleEnlistedCourseByCode.forEach((courseName, normCode) => {
                    const enlistedCourse = enlistedCourseByCode.get(normCode);
                    if (!enlistedCourse) return;

                    let candidate = remainingCandidates.find(
                        (item) => item.normCode === normCode,
                    );
                    if (candidate) {
                        candidate.isCurrentlyEnlisted = true;
                        candidate.course = formatCourseDisplayName(
                            cleanExtractedCourseTitle(
                                courseName || enlistedCourse.baseCode,
                                candidate.category,
                            ),
                        );
                    } else {
                        candidate = buildEnlistedProgressionCandidate(
                            enlistedCourse,
                            ruleByCode.get(normCode),
                        );
                        remainingCandidates.push(candidate);
                    }
                    currentEnlistedCandidateByCode.set(normCode, candidate);
                });

                const plannedIds = new Set();
                const projectedPassedCodes = new Set();
                let projectedAcademicUnits = passedAcademicUnits;

                const projectedHasPassed = (requirement) => {
                    const normalized = normalizeCode(requirement);
                    const standingStatus = getStandingRequirementStatus(
                        normalized,
                        projectedAcademicUnits,
                    );
                    if (standingStatus !== null) return standingStatus;
                    return (
                        hasPassed(normalized) ||
                        projectedPassedCodes.has(normalized)
                    );
                };

                const projectedRequirementMet = (requirement) =>
                    requirement
                        .split(/\s+or\s+/i)
                        .some((option) => projectedHasPassed(option.trim()));

                const dependencyScore = (candidate) =>
                    remainingCandidates.reduce((score, other) => {
                        if (plannedIds.has(other.id)) return score;
                        const requirements = [
                            ...other.prerequisites,
                            ...other.corequisites,
                        ];
                        const unlocks = requirements.some((requirement) =>
                            requirement
                                .split(/\s+or\s+/i)
                                .some(
                                    (option) =>
                                        normalizeCode(option.trim()) ===
                                        candidate.normCode,
                                ),
                        );
                        return score + (unlocks ? 1 : 0);
                    }, 0);

                let termCode =
                    activeAcademicTermCode &&
                    ['1', '2', 'M'].includes(activeAcademicTermCode)
                        ? activeAcademicTermCode
                        : '1';
                let academicYearStart = activeAcademicYearStart;
                let academicYearRow = 0;
                const semesters = [];
                let emptyTermCount = 0;
                const maximumTerms = Math.max(12, remainingCandidates.length * 3 + 3);

                for (
                    let termAttempt = 0;
                    termAttempt < maximumTerms &&
                    plannedIds.size < remainingCandidates.length;
                    termAttempt++
                ) {
                    const semesterSelected = [];
                    const semesterIds = new Set();
                    const isCurrentEnlistmentTerm = termAttempt === 0;
                    let semesterAcademicUnits = isCurrentEnlistmentTerm
                        ? totalUnits
                        : 0;

                    const isAllowedThisTerm = (candidate) =>
                        candidate.semesterOffered.includes(termCode);
                    const prerequisitesMet = (candidate) => {
                        if (
                            candidate.nstpLevel === 2 &&
                            !nstp1PassedEntry &&
                            !Array.from(projectedPassedCodes).some(
                                (code) => getNstpLevel(code) === 1,
                            )
                        )
                            return false;
                        return candidate.prerequisites.every(
                            projectedRequirementMet,
                        );
                    };

                    const collectBundle = (candidate) => {
                        const bundle = [candidate];
                        const bundleIds = new Set([candidate.id]);

                        for (const requirement of candidate.corequisites) {
                            const options = requirement
                                .split(/\s+or\s+/i)
                                .map((option) => normalizeCode(option.trim()))
                                .filter(Boolean);
                            const metBeforeOrInSemester =
                                projectedRequirementMet(requirement) ||
                                semesterSelected.some((item) =>
                                    options.includes(item.normCode),
                                ) ||
                                bundle.some((item) => options.includes(item.normCode));
                            if (metBeforeOrInSemester) continue;

                            const corequisite = remainingCandidates.find(
                                (other) =>
                                    !plannedIds.has(other.id) &&
                                    !semesterIds.has(other.id) &&
                                    !bundleIds.has(other.id) &&
                                    options.includes(other.normCode) &&
                                    isAllowedThisTerm(other) &&
                                    prerequisitesMet(other),
                            );
                            if (!corequisite) return null;

                            bundle.push(corequisite);
                            bundleIds.add(corequisite.id);
                        }

                        return bundle;
                    };

                    const addCandidate = (candidate) => {
                        if (
                            !candidate ||
                            plannedIds.has(candidate.id) ||
                            semesterIds.has(candidate.id)
                        )
                            return false;

                        const bundle = collectBundle(candidate);
                        if (!bundle) return false;

                        const selectedPECount = isCurrentEnlistmentTerm
                            ? enlistedCourses.filter((course) =>
                                  /^PE\b/i.test(course.baseCode),
                              ).length +
                              semesterSelected.filter(
                                  (item) =>
                                      !item.isCurrentlyEnlisted &&
                                      item.category === COURSE_CATEGORIES.PE,
                              ).length
                            : semesterSelected.filter(
                                  (item) => item.category === COURSE_CATEGORIES.PE,
                              ).length;
                        const bundlePECount = bundle.filter(
                            (item) => item.category === COURSE_CATEGORIES.PE,
                        ).length;
                        const maximumPECount = 1;
                        if (selectedPECount + bundlePECount > maximumPECount)
                            return false;
                        const loadSummary = getProgressionLoadSummary(
                            termCode,
                            isCurrentEnlistmentTerm ? totalUnits : 0,
                            isCurrentEnlistmentTerm
                                ? enlistedProgressionCourses
                                : [],
                            isCurrentEnlistmentTerm
                                ? [
                                      ...semesterSelected.filter(
                                          (item) => !item.isCurrentlyEnlisted,
                                      ),
                                      ...bundle,
                                  ]
                                : [...semesterSelected, ...bundle],
                        );
                        if (
                            !isValidProgressionCourseSet(
                                termCode,
                                loadSummary.combinedCourses,
                            )
                        )
                            return false;
                        if (loadSummary.totalUnits > loadSummary.maximumUnits)
                            return false;

                        bundle.forEach((item) => {
                            semesterSelected.push(item);
                            semesterIds.add(item.id);
                            semesterAcademicUnits += item.units;
                        });
                        return true;
                    };

                    const currentlyEnlisted =
                        termAttempt === 0
                            ? Array.from(
                                  currentEnlistedCandidateByCode.values(),
                              ).filter(
                                  (candidate) => !plannedIds.has(candidate.id),
                              )
                            : [];
                    const eligible = remainingCandidates.filter(
                        (candidate) =>
                            !plannedIds.has(candidate.id) &&
                            isAllowedThisTerm(candidate) &&
                            prerequisitesMet(candidate),
                    );
                    const coreCourses = eligible
                        .filter(
                            (candidate) =>
                                candidate.category === COURSE_CATEGORIES.CORE,
                        )
                        .sort(
                            (a, b) =>
                                dependencyScore(b) - dependencyScore(a) ||
                                naturalCourseSort(a.course, b.course),
                        );
                    const geAndElectiveCourses = eligible
                        .filter((candidate) =>
                            POST_CORE_ACADEMIC_CATEGORIES.has(candidate.category),
                        )
                        .sort((a, b) => naturalCourseSort(a.course, b.course));
                    const peCourses = eligible
                        .filter(
                            (candidate) =>
                                candidate.category === COURSE_CATEGORIES.PE,
                        )
                        .sort((a, b) => naturalCourseSort(a.course, b.course));
                    const nstpCourses = eligible
                        .filter(
                            (candidate) =>
                                candidate.category === COURSE_CATEGORIES.NSTP,
                        )
                        .sort((a, b) => naturalCourseSort(a.course, b.course));
                    const otherCourses = eligible
                        .filter(
                            (candidate) =>
                                candidate.category !== COURSE_CATEGORIES.CORE &&
                                !POST_CORE_ACADEMIC_CATEGORIES.has(
                                    candidate.category,
                                ) &&
                                !NON_ACADEMIC_CATEGORIES.has(candidate.category),
                        )
                        .sort((a, b) => naturalCourseSort(a.course, b.course));

                    const midyearCs195Candidate =
                        termCode === TERM_CODES.MIDYEAR
                            ? eligible.find(isCs195Course)
                            : null;

                    // Current enlistments are fixed in the first term and are
                    // already included in CRS's authoritative total-units
                    // value. Add the matching checklist entries for display
                    // and progression credit without counting their units a
                    // second time.
                    currentlyEnlisted.forEach((item) => {
                        if (semesterIds.has(item.id)) return;
                        semesterSelected.push(item);
                        semesterIds.add(item.id);
                    });

                    if (midyearCs195Candidate) {
                        addCandidate(midyearCs195Candidate);
                    } else {
                        // Fill only the capacity left after current enlistments,
                        // prioritizing core courses, then GEs/electives, PE,
                        // and NSTP. Column 4 remains a strict term filter for
                        // every group.
                        coreCourses.forEach(addCandidate);
                        geAndElectiveCourses.forEach(addCandidate);
                        otherCourses.forEach(addCandidate);
                        peCourses.forEach(addCandidate);
                        nstpCourses.forEach(addCandidate);
                    }

                    if (
                        semesterSelected.length > 0 ||
                        (isCurrentEnlistmentTerm && totalUnits > 0)
                    ) {
                        emptyTermCount = 0;
                        const loadSummary = getProgressionLoadSummary(
                            termCode,
                            isCurrentEnlistmentTerm ? totalUnits : 0,
                            isCurrentEnlistmentTerm
                                ? enlistedProgressionCourses
                                : [],
                            isCurrentEnlistmentTerm
                                ? semesterSelected.filter(
                                      (item) => !item.isCurrentlyEnlisted,
                                  )
                                : semesterSelected,
                        );
                        semesterSelected.forEach((item) => plannedIds.add(item.id));
                        semesterSelected.forEach((item) =>
                            projectedPassedCodes.add(item.normCode),
                        );
                        projectedAcademicUnits += semesterSelected
                            .filter(
                                (item) =>
                                    !NON_ACADEMIC_CATEGORIES.has(item.category),
                            )
                            .reduce((sum, item) => sum + item.units, 0);

                        semesters.push({
                            termCode,
                            academicYearRow,
                            heading: buildProgressionTermHeading(
                                termCode,
                                academicYearStart,
                                termAttempt === 0,
                                advisingTermHeading,
                            ),
                            courses: semesterSelected,
                            totalUnits: semesterAcademicUnits,
                            maximumUnits: loadSummary.maximumUnits,
                        });
                    } else {
                        emptyTermCount++;
                        if (emptyTermCount >= 3) break;
                    }

                    const upcomingTerm = getNextTermCode(termCode);
                    if (
                        termCode === 'M' &&
                        upcomingTerm === '1'
                    ) {
                        academicYearRow++;
                        if (Number.isFinite(academicYearStart)) {
                            academicYearStart++;
                        }
                    }
                    termCode = upcomingTerm;
                }

                return {
                    semesters,
                    unplaced: remainingCandidates.filter(
                        (candidate) => !plannedIds.has(candidate.id),
                    ),
                };
            };

            const renderPrescribedProgression = () => {
                if (!progressionStatusDiv || !progressionLoadDiv) return;

                const progression = buildPrescribedProgression();
                let html = '';

                const formatProgressionCourseDisplayName = (course) => {
                    const displayName = formatCourseDisplayName(course.course);
                    if (
                        course.category === COURSE_CATEGORIES.PE &&
                        /^PE\s+COURSE$/i.test(displayName)
                    )
                        return '(PE)';
                    if (
                        course.category === COURSE_CATEGORIES.NSTP &&
                        /^NSTP\s+[12]$/i.test(displayName)
                    )
                        return `(${displayName})`;
                    if (/^(?:CS|FREE|GE)\s+ELECTIVE$/i.test(displayName))
                        return `(${displayName})`;
                    return displayName;
                };

                if (progression.semesters.length > 0) {
                    html +=
                        '<div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); grid-auto-rows:auto; align-items:stretch; gap:4px;">';
                }

                progression.semesters.forEach((semester) => {
                    const termColumn =
                        semester.termCode === '1'
                            ? 1
                            : semester.termCode === '2'
                              ? 2
                              : 3;
                    html += `<div style="grid-column:${termColumn}; grid-row:${semester.academicYearRow + 1}; min-width:0; height:100%; box-sizing:border-box; padding:5px; background:#fff; border:1px solid #e9d5ff; border-radius:4px;">
                        <div style="display:grid; grid-template-columns:minmax(0, 1fr) auto; align-items:start; gap:4px; padding-bottom:3px; border-bottom:1px solid #f3e8ff;">
                            <b style="min-width:0; font-size:10px; line-height:1.25; color:#581c87;">${escapeHTML(semester.heading)}</b>
                            <b title="Academic units" style="white-space:nowrap; padding:1px 4px; border-radius:8px; background:#f3e8ff; font-size:10px; line-height:1.25; color:#7b1113;">${semester.totalUnits}u</b>
                        </div>
                        <ol style="margin:3px 0 0 17px; padding:0;">`;

                    sortProgressionCourses(semester.courses).forEach((course) => {
                        const isNonCredit = isZeroAcademicUnitCourse(
                            course.normCode || course.course,
                            course.category,
                        );
                        const unitLabel =
                            isNonCredit
                                ? `(${course.displayUnits})`
                                : Number.isInteger(course.units)
                                  ? course.units
                                  : course.units.toFixed(1);
                        const displayCourse =
                            formatProgressionCourseDisplayName(course);
                        const enlistedRowStyle = course.isCurrentlyEnlisted
                            ? 'padding:1px 0; background:#d1e7dd; box-shadow:-17px 0 0 #d1e7dd; border-radius:2px;'
                            : 'padding:1px 0;';
                        html += `<li${course.isCurrentlyEnlisted ? ' title="Currently enlisted"' : ''} style="margin:0; ${enlistedRowStyle} font-size:10px; line-height:1.25;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; gap:4px;">
                                <b style="min-width:0; overflow-wrap:anywhere;">${course.isCurrentlyEnlisted ? '<span style="position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;">Currently enlisted: </span>' : ''}${escapeHTML(displayCourse)}</b>
                                <span style="flex:0 0 24px; text-align:center; white-space:nowrap; color:#666; font-size:9px;">${unitLabel}</span>
                            </div>
                        </li>`;
                    });

                    html += '</ol></div>';
                });

                if (progression.semesters.length > 0) {
                    html += '</div>';
                }

                if (progression.unplaced.length > 0) {
                    html += `<div style="margin-top:5px; padding:5px 6px; color:#842029; background:#f8d7da; border:1px solid #f5c2c7; border-radius:4px; font-size:11px;">
                        <b>Needs manual placement:</b> ${escapeHTML(
                            progression.unplaced
                                .map((course) => course.course)
                                .join(', '),
                        )}. A prerequisite, corequisite, or semester rule prevents automatic placement.
                    </div>`;
                }

                progressionLoadDiv.innerHTML =
                    html ||
                    '<div style="margin-top:4px; color:#0f5132; font-size:11px;">All checklist courses are already satisfied.</div>';
                progressionStatusDiv.style.color =
                    progression.unplaced.length > 0 ? '#856404' : '#666';
                progressionStatusDiv.innerText =
                    'Below is indicative sequence for the current enlistment and all remaining courses in the curriculum. Courses highlighed in green are currently enlisted.';
            };

            const schedulePrescribedProgression = () => {
                setTimeout(() => {
                    if (evaluationVersion === recommendationEvaluationVersion) {
                        renderPrescribedProgression();
                    }
                }, 0);
            };

            // 9.10 Group, render, and verify course recommendations.
            const unenlistedEligible = Array.from(eligibleCoursesMap.entries())
                .filter(([normCode]) => !enlistedBaseCodes.has(normCode))
                .filter(
                    ([normCode, item]) =>
                        !conflictsWithEnlistedPairedGe(
                            item.course || item.curriculumSlot || normCode,
                        ),
                )
                .map(([, data]) => data)
                .filter((item) => {
                    const name = (item.course || '').trim();
                    const isElectivePlaceholder = /^(cs|ge|free)\s*elective/i.test(name);
                    const isCsElectiveCourse =
                        /^cs\s*17[1-6]\b/i.test(name) || /^cs17[1-6]\b/i.test(name);
                    const isNstpCourse = /^(nstp|cwts|lts|rotc|milsci)/i.test(name);
                    const isPeCourse = /^pe\b/i.test(name);
                    return (
                        !isElectivePlaceholder &&
                        !isCsElectiveCourse &&
                        !isNstpCourse &&
                        !isPeCourse
                    );
                });

            if (unenlistedEligible.length === 0) {
                msgDiv.innerText = 'No remaining eligible courses available.';
                if (listDiv) listDiv.innerHTML = '';
                schedulePrescribedProgression();
                return;
            }

            const categories = { 'Core Courses': [], 'Required GE Courses': [] };

            unenlistedEligible.forEach((item) => {
                const courseName = (item.course || '').trim();
                const normName = normalizeCode(courseName);

                // Hard check: CS Core Courses (e.g. CS 138, CS 140) must always be retained as Core Courses
                const isExplicitCSCore =
                    /^CS\d+$/i.test(normName) && !/^CS17[1-6]$/i.test(normName);

                let cat = 'Core Courses';
                if (!isExplicitCSCore && typeof getCourseCategory === 'function') {
                    cat = getCourseCategory(courseName);
                }

                if (cat === 'Required GE Courses' || cat === 'GE') {
                    categories['Required GE Courses'].push(item);
                } else if (
                    !isExplicitCSCore &&
                    (cat === 'NSTP' ||
                        cat === 'PE' ||
                        cat === 'Physical Education' ||
                        cat === 'CS Electives' ||
                        cat === 'Free Electives' ||
                        cat === 'Electives')
                ) {
                    return; // Safely exclude placeholders
                } else {
                    categories['Core Courses'].push(item);
                }
            });

            msgDiv.style.color = '#666';
            msgDiv.innerText = 'Checking the current CRS schedule...';

            // Sort first so the temporary and final lists remain stable.
            Object.keys(categories).forEach((cat) => {
                const items = categories[cat];
                if (typeof naturalCourseSort === 'function')
                    items.sort((a, b) => naturalCourseSort(a.course, b.course));
                else items.sort((a, b) => a.course.localeCompare(b.course));
            });

            // Renders recommended courses after optional CRS availability results have been resolved.
            const renderRecommendations = (availabilityByCourse = null, lookupFailed = false) => {
                let html = '';

                Object.keys(categories).forEach((cat) => {
                    const items = categories[cat];
                    if (items.length === 0) return;

                    html += `<div style="margin-top: 6px;"><b style="color: #7b1113; font-size: 12px;">${escapeHTML(cat)} (${items.length}):</b><ul style="margin: 2px 0 0 0; padding-left: 18px; font-size: 12px;">`;

                    items.forEach((item) => {
                        const rawCourseName = item.course || '';
                        const courseName = formatCourseDisplayName(rawCourseName);
                        const offered =
                            availabilityByCourse?.get(rawCourseName) === true;
                        const checked = availabilityByCourse?.has(rawCourseName);

                        // Availability styling:
                        // at least one CRS result = course code followed by 🟢;
                        // no CRS result = course code followed by 🔴.
                        // Before the check finishes, use neutral gray without an icon.
                        const color = checked ? '#000000' : '#666';
                        const availabilityIcon =
                            checked
                                ? offered
                                    ? ' <span aria-label="Offered in CRS" title="Offered in CRS">🟢</span>'
                                    : ' <span aria-label="Not offered in CRS" title="Not offered in CRS">🔴</span>'
                                : '';
                        const safeCourse = escapeHTML(courseName);
                        const concurrentText =
                            item.concurrent && item.concurrent.length > 0
                                ? ` <span style="color: #856404; font-weight: normal; font-size: 11px;">(Take with: ${escapeHTML(item.concurrent.join(', '))})</span>`
                                : '';

                        html += `<li style="margin-bottom: 2px; font-size: 12px; color: ${color}; font-weight: normal;">${safeCourse}${availabilityIcon}${concurrentText}</li>`;
                    });

                    html += '</ul></div>';
                });

                if (lookupFailed) {
                    html += `<div style="margin-top:4px; color:#856404; font-size:10px;">Some CRS schedule lookups failed; those courses remain gray without an availability icon.</div>`;
                }

                if (listDiv) {
                    listDiv.style.overflowY = 'auto';
                    listDiv.style.paddingRight = '5px';
                    listDiv.innerHTML = html;
                }
            };

            renderRecommendations();
            if (!hasLoggedRecommendationRenderTime) {
                hasLoggedRecommendationRenderTime = true;
                const now =
                    typeof performance !== 'undefined' &&
                    typeof performance.now === 'function'
                        ? performance.now()
                        : Date.now();
                const elapsedMs = Math.max(0, Math.round(now - recommendationLoadStartedAt));
                if (listDiv) listDiv.dataset.initialRenderMs = String(elapsedMs);
                console.log(`[USAD-CS] Recommended courses rendered in ${elapsedMs} ms.`);
                if (elapsedMs > RECOMMENDATION_RENDER_TARGET_MS) {
                    console.warn(
                        `[USAD-CS] Recommendation render exceeded the ${RECOMMENDATION_RENDER_TARGET_MS} ms target.`,
                    );
                }
            }
            schedulePrescribedProgression();

            const allRecommendedItems = Object.values(categories).flat().filter(
                (item, index, items) =>
                    items.findIndex((other) => other.course === item.course) === index,
            );
            Promise.all(
                allRecommendedItems.map(async (item) => {
                    try {
                        return [item.course, await isCourseOfferedInCrs(item.course), null];
                    } catch (error) {
                        console.error(`CRS schedule lookup failed for ${item.course}:`, error);
                        return [item.course, false, error];
                    }
                }),
            ).then((results) => {
                if (evaluationVersion !== recommendationEvaluationVersion) return;

                // Only successful lookups establish availability. A network
                // failure must remain unknown instead of showing a false ❌.
                const availabilityByCourse = new Map(
                    results
                        .filter(([, , error]) => !error)
                        .map(([course, offered]) => [course, offered]),
                );
                const lookupFailed = results.some(([, , error]) => Boolean(error));
                renderRecommendations(availabilityByCourse, lookupFailed);

                msgDiv.style.color = lookupFailed ? '#856404' : '#666';
                msgDiv.innerText = lookupFailed
                    ? 'Recommendations checked; some CRS lookups failed.'
                    : 'Green circles are offered this semester; red circles are not offered.';
            });
        } catch (err) {
            console.error('Prereq Engine Crash:', err);
            msgDiv.style.color = 'red';
            msgDiv.innerText = `Evaluation crashed: ${err.message}. Check console for details.`;
        }
    }
})();
