const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('USAD-CS.main.js', 'utf8');
const context = {
    console,
    document: {
        title: '',
        querySelector: () => null,
        querySelectorAll: () => [],
    },
    __USAD_CS_TEST_MODE__: true,
};
context.globalThis = context;

vm.runInNewContext(source, context, { filename: 'USAD-CS.main.js' });

const {
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
    getStandingRequirementStatus,
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
    getImmediatePrereqRules,
    isFreshChecklistCacheEntry,
} = context.__USAD_CS_INTERNALS__;

assert.equal(normalizeCode('GE 3: Soc Sci 1 THV'), 'SOCSCI1');
assert.equal(normalizeCode('PE 2 PG SDE'), 'PE2PG');
assert.equal(normalizeCode('STS'), 'STS1');

assert.equal(formatCourseDisplayName('ENGG 150'), 'Engg 150');
assert.equal(formatCourseDisplayName('SOC SCI 1/2'), 'Soc Sci 1/2');
assert.equal(formatCourseDisplayName('ROTC MIL SCI 1'), 'ROTC Mil Sci 1');
assert.equal(formatCourseDisplayName('MS 1'), 'MS 1');
assert.equal(formatCourseDisplayName('Arts 1'), 'ARTS 1');
assert.equal(formatCourseDisplayName('Kas 1'), 'KAS 1');
assert.equal(formatCourseDisplayName('ARTS 1'), 'ARTS 1');

assert.equal(cleanExtractedCourseTitle('ROTC Mil Sci 1 MAB'), 'ROTC Mil Sci 1');
assert.equal(cleanExtractedCourseTitle('MS 1 THR'), 'MS 1');
assert.equal(cleanExtractedCourseTitle('ART STUD 2 THR'), 'Art Stud 2');
assert.equal(
    parseCourseCodeFromClassDescription('Soc Sci 1 THV\nFoundations of Social Science'),
    'SOC SCI 1',
);
assert.equal(parseCourseCodeFromClassDescription('DRMAPS THR'), 'DRMAPS');

assert.deepEqual(
    Array.from(parseRequirementList('Math 21 and Physics 71; CS 11')),
    ['Math 21', 'Physics 71', 'CS 11'],
);

const parsedRules = parsePrerequisiteRules([
    ['Course', 'Prerequisite', 'Corequisite', 'Semester', 'Lab'],
    ['CS 12', 'CS 11', 'None', '1,2', '0'],
    ['Physics 71', 'Math 21', 'Physics 71.1', '1;2;M', '1'],
]);
assert.equal(parsedRules.rules.length, 2);
assert.equal(parsedRules.ruleByCode.get('CS12').course, 'CS 12');
assert.deepEqual(
    Array.from(parsedRules.ruleByCode.get('PHYSICS71').semesterOffered),
    ['1', '2', 'M'],
);
assert.equal(parsedRules.ruleByCode.get('PHYSICS71').hasLab, true);

const curriculumRulesWithMath20 = applyCurriculumSpecificRuleOverrides(
    parsePrerequisiteRules([
        ['Course', 'Prerequisite', 'Corequisite', 'Semester', 'Lab'],
        ['Math 21', '', '', '1,2,M', '0'],
    ]),
    [
        {
            rawName: 'Math 20',
            curriculumSlot: 'Math 20',
            completedCourse: 'Math 20',
        },
    ],
);
assert.ok(curriculumRulesWithMath20.ruleByCode.has('MATH20'));
assert.deepEqual(
    Array.from(curriculumRulesWithMath20.ruleByCode.get('MATH21').prerequisites),
    ['Math 20'],
);

const checklistMissingEnlistedMath20 = new Map([
    [
        'MATH21___0',
        {
            rawName: 'Math 21',
            curriculumSlot: 'Math 21',
            completedCourse: 'Math 21',
        },
    ],
]);
assert.equal(
    ensureEnlistedMath20ChecklistEntry(
        checklistMissingEnlistedMath20,
        ['Math 20 TWHFU'],
    ),
    true,
);
assert.equal(checklistMissingEnlistedMath20.get('MATH20___enlisted').units, '(4)');
assert.equal(
    checklistMissingEnlistedMath20.get('MATH20___enlisted').category,
    'Core Courses',
);
assert.equal(
    ensureEnlistedMath20ChecklistEntry(
        checklistMissingEnlistedMath20,
        ['Math 20 TWHFU'],
    ),
    false,
);
const curriculumRulesFromSyntheticMath20 = applyCurriculumSpecificRuleOverrides(
    parsePrerequisiteRules([
        ['Course', 'Prerequisite', 'Corequisite', 'Semester', 'Lab'],
        ['Math 21', '', '', '1,2,M', '0'],
    ]),
    Array.from(checklistMissingEnlistedMath20.values()),
);
assert.deepEqual(
    Array.from(
        curriculumRulesFromSyntheticMath20.ruleByCode.get('MATH21').prerequisites,
    ),
    ['Math 20'],
);

const curriculumRulesWithoutMath20 = applyCurriculumSpecificRuleOverrides(
    parsePrerequisiteRules([
        ['Course', 'Prerequisite', 'Corequisite', 'Semester', 'Lab'],
        ['Math 21', '', '', '1,2,M', '0'],
    ]),
    [{ rawName: 'Math 21', curriculumSlot: 'Math 21' }],
);
assert.deepEqual(
    Array.from(curriculumRulesWithoutMath20.ruleByCode.get('MATH21').prerequisites),
    [],
);

assert.equal(isZeroAcademicUnitCourse('Math 20', 'Core Courses'), true);
const math20UnitValues = getCourseUnitValues('Math 20', 'Core Courses', '4');
assert.equal(math20UnitValues.units, 0);
assert.equal(math20UnitValues.displayUnits, 4);
const math21UnitValues = getCourseUnitValues('Math 21', 'Core Courses', '4');
assert.equal(math21UnitValues.units, 4);
assert.equal(math21UnitValues.displayUnits, 4);

assert.equal(getStandingRequirementStatus('SO_STANDING', 36), false);
assert.equal(getStandingRequirementStatus('SO STANDING', 37), true);
assert.equal(getStandingRequirementStatus('SOSTANDING', 38), true);
assert.equal(getStandingRequirementStatus('JR_STANDING', 73), false);
assert.equal(getStandingRequirementStatus('JR_STANDING', 74), true);
assert.equal(getStandingRequirementStatus('CS 12', 148), null);
assert.deepEqual(Array.from(getNstpPrerequisites(1)), ['SO_STANDING']);
assert.deepEqual(
    Array.from(getNstpPrerequisites(1, ['SO STANDING'])),
    ['SO STANDING'],
);
assert.deepEqual(Array.from(getNstpPrerequisites(2)), []);

const vsoRows = [
    ['', '', '', ''],
    ['Updated', '8/12/2026 20:26:00', '', ''],
    ['', '', '', ''],
    ['Student number', 'Last Name', 'First Name', 'Middle Name'],
    ['2022-07908', 'Gonzalo', 'Johanne', 'Pilapil'],
    ['202303243', 'Ladines', 'Ella Katrina', 'Abanes'],
];
assert.equal(normalizeStudentNumber('2022-07908'), '202207908');
assert.deepEqual(
    Array.from(parseVsoStudentNumbers(vsoRows)),
    ['202207908', '202303243'],
);
assert.equal(isStudentInVsoRows('2022-07908', vsoRows), true);
assert.equal(isStudentInVsoRows('202499999', vsoRows), false);
assert.equal(parseVsoStudentNumbers([['Updated', '8/12/2026']]).size, 0);

assert.equal(getCourseCategory('PI 100'), 'Core Courses');
assert.equal(getCourseCategory('NSTP 1'), 'NSTP');
assert.equal(getCourseCategory('MS 1'), 'Core Courses');
assert.equal(getCourseCategory('PE'), 'PE');
assert.equal(getCourseCategory('CS Elective'), 'CS Electives');

assert.equal(getPairedGeOption('Soc Sci 2'), 'SOCSCI2');
assert.equal(getPairedGeOption('STS'), 'STS1');
assert.equal(getPairedGeFamily('GE 3: Soc Sci 1/Soc Sci 2'), 'SOCSCI');
assert.equal(getPairedGeFamily('STS 1', 'DRMAPS'), 'STSDRMAPS');
assert.equal(getNstpLevel('CWTS 2'), 2);
assert.equal(getNstpLevel('ROTC Mil Sci 1'), 1);
assert.equal(getNstpLevel('MS 1'), null);

assert.equal(getProgressionMaximumUnits('1', [{ hasLab: false }]), 18);
assert.equal(getProgressionMaximumUnits('2', [{ hasLab: true }]), 21);
assert.equal(getProgressionMaximumUnits('M', [{ hasLab: true }]), 6);

const regularLoadSummary = getProgressionLoadSummary(
    '1',
    15,
    [{ normCode: 'CS132', hasLab: false }],
    [{ normCode: 'CS133', units: 3, hasLab: false }],
);
assert.equal(regularLoadSummary.currentUnits, 15);
assert.equal(regularLoadSummary.additionalUnits, 3);
assert.equal(regularLoadSummary.totalUnits, 18);
assert.equal(regularLoadSummary.maximumUnits, 18);

const labLoadSummary = getProgressionLoadSummary(
    '2',
    15,
    [{ normCode: 'CS198', hasLab: true }],
    [{ normCode: 'CS199', units: 3, hasLab: true }],
);
assert.equal(labLoadSummary.totalUnits, 18);
assert.equal(labLoadSummary.maximumUnits, 21);

const fullLoadSummary = getProgressionLoadSummary(
    '1',
    21,
    [{ normCode: 'CS198', hasLab: true }],
    [],
);
assert.equal(fullLoadSummary.additionalUnits, 0);
assert.equal(fullLoadSummary.totalUnits, 21);
assert.equal(fullLoadSummary.maximumUnits, 21);

const enlistedLabCandidate = buildEnlistedProgressionCandidate(
    {
        normalizedCode: 'CS198',
        baseCode: 'CS 198',
        creditText: '3.0',
        scheduleText: 'M 2-9PM lab TBA',
    },
    null,
);
assert.equal(enlistedLabCandidate.course, 'CS 198');
assert.equal(enlistedLabCandidate.units, 3);
assert.equal(enlistedLabCandidate.hasLab, true);
assert.equal(enlistedLabCandidate.isCurrentlyEnlisted, true);
assert.equal(enlistedLabCandidate.category, 'Free Electives');

const enlistedPeCandidate = buildEnlistedProgressionCandidate({
    normalizedCode: 'PE2SCD',
    baseCode: 'PE 2 SCD',
    creditText: '(2.0)',
    scheduleText: 'S 2-4PM',
});
assert.equal(enlistedPeCandidate.units, 0);
assert.equal(enlistedPeCandidate.displayUnits, 2);
assert.equal(enlistedPeCandidate.category, 'PE');

const enlistedMath20Candidate = buildEnlistedProgressionCandidate(
    {
        normalizedCode: 'MATH20',
        baseCode: 'Math 20',
        creditText: '4.0',
        scheduleText: 'MWF 8-9AM',
    },
    {
        prerequisites: [],
        corequisites: [],
        semesterOffered: ['1', '2', 'M'],
        hasLab: false,
    },
);
assert.equal(enlistedMath20Candidate.units, 0);
assert.equal(enlistedMath20Candidate.displayUnits, 4);
assert.equal(enlistedMath20Candidate.category, 'Core Courses');

assert.deepEqual(
    Array.from(
        sortProgressionCourses([
            {
                course: 'CS 140',
                category: 'Core Courses',
                isCurrentlyEnlisted: false,
            },
            {
                course: 'PE 2 PG',
                category: 'PE',
                isCurrentlyEnlisted: true,
            },
            {
                course: 'CS 138',
                category: 'Core Courses',
                isCurrentlyEnlisted: false,
            },
            {
                course: 'Theatre 12',
                category: 'Free Electives',
                isCurrentlyEnlisted: true,
            },
            {
                course: 'CS 175',
                category: 'Core Courses',
                isCurrentlyEnlisted: true,
            },
        ]),
        (course) => course.course,
    ),
    ['CS 175', 'Theatre 12', 'PE 2 PG', 'CS 138', 'CS 140'],
);

assert.equal(
    isValidProgressionCourseSet('M', [{ normCode: 'CS195' }]),
    true,
);
assert.equal(
    isValidProgressionCourseSet('M', [
        { normCode: 'CS195' },
        { normCode: 'PE2PG' },
    ]),
    false,
);

assert.equal(getNextTermCode('1'), '2');
assert.equal(getNextTermCode('2'), 'M');
assert.equal(getNextTermCode('M'), '1');
assert.equal(buildProgressionTermHeading('1', 2026, true, ''), 'First Sem 2627');
assert.equal(buildProgressionTermHeading('M', 2026, false, ''), 'Midyear 2027');

let loaderRequest = null;
const loaderContext = {
    console,
    GM_xmlhttpRequest: (request) => {
        loaderRequest = request;
    },
};
loaderContext.globalThis = loaderContext;
vm.runInNewContext(
    fs.readFileSync('USAD-CS.loader.user.js', 'utf8'),
    loaderContext,
    { filename: 'USAD-CS.loader.user.js' },
);
assert.equal(loaderRequest.method, 'GET');
assert.equal(loaderRequest.timeout, 30_000);
assert.match(
    loaderRequest.url,
    /^https:\/\/raw\.githubusercontent\.com\/UPD-DCS\/usad\/main\/USAD-CS\.main\.js\?usad_cs_time=\d+$/,
);
loaderRequest.onload({
    status: 200,
    responseText: 'globalThis.__USAD_CS_LOADER_TEST__ = true;',
});
assert.equal(loaderContext.__USAD_CS_LOADER_TEST__, true);

assert.ok(
    source.includes(
        "? 'padding:1px 0; background:#d1e7dd; box-shadow:-17px 0 0 #d1e7dd; border-radius:2px;'",
    ),
);
assert.ok(!source.includes('border-left:4px solid #198754;'));
assert.ok(
    source.includes(
        'white-space:nowrap; border:0;">Currently enlisted: </span>',
    ),
);
assert.ok(!source.includes('>(E)</span>'));
assert.ok(!source.includes('style="font-size:9px;">✅</span>'));
assert.ok(!source.includes('(enlisted)</span>'));
assert.ok(
    source.includes(
        'Below is indicative sequence for the current enlistment and all remaining courses in the curriculum. Courses highlighed in green are currently enlisted.',
    ),
);

assert.ok(source.includes('Using stale GE cache while refreshing in the background.'));
assert.ok(source.includes('prereqRulesReadyPromise = loadPrereqRules().catch'));
assert.ok(source.includes("'Prerequisite rules request timed out.'"));
assert.ok(source.includes('const CRS_SCHEDULE_CACHE_EXPIRY_MS = 15 * 60 * 1000;'));
assert.ok(source.includes('const CHECKLIST_SESSION_CACHE_EXPIRY_MS = 5 * 60 * 1000;'));
assert.ok(source.includes('const RECOMMENDATION_RENDER_TARGET_MS = 2000;'));
assert.ok(source.includes('listDiv.dataset.initialRenderMs = String(elapsedMs);'));
assert.ok(!source.includes('GE_LIST_INITIAL_WAIT_MS'));
assert.ok(!source.includes('function loadPrereqRulesAndEvaluate()'));
assert.ok(source.includes('🚫 <strong>Do not advise!</strong> (VSO student)'));
assert.ok(source.includes("document.getElementById('unit-status'),"));
assert.ok(!source.includes('>Do not advise (VSO student)</div>'));

const bundledRules = getImmediatePrereqRules(null);
assert.ok(bundledRules.length >= 40);
assert.equal(parsePrerequisiteRules(bundledRules).ruleByCode.get('CS153').course, 'CS 153');

const immediateCachedRules = [
    ['Course', 'Prerequisite', 'Corequisite', 'Semester Offered', 'with Lab?'],
    ['CS 12', 'CS 11', '', '1, 2', '1'],
];
assert.equal(getImmediatePrereqRules(immediateCachedRules), immediateCachedRules);

assert.equal(
    isFreshChecklistCacheEntry({ html: '<table></table>', cachedAt: 10_000 }, 10_500),
    true,
);
assert.equal(
    isFreshChecklistCacheEntry({ html: '<table></table>', cachedAt: 10_000 }, 310_000),
    false,
);

console.log('USAD-CS regression tests passed.');
