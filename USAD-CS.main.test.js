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
    getPairedGeOption,
    getPairedGeFamily,
    getNstpLevel,
    getProgressionMaximumUnits,
    getProgressionLoadSummary,
    buildEnlistedProgressionCandidate,
    isValidProgressionCourseSet,
    getNextTermCode,
    buildProgressionTermHeading,
} = context.__USAD_CS_INTERNALS__;

assert.equal(normalizeCode('GE 3: Soc Sci 1 THV'), 'SOCSCI1');
assert.equal(normalizeCode('PE 2 PG SDE'), 'PE2PG');
assert.equal(normalizeCode('STS'), 'STS1');

assert.equal(formatCourseDisplayName('ENGG 150'), 'Engg 150');
assert.equal(formatCourseDisplayName('SOC SCI 1/2'), 'Soc Sci 1/2');
assert.equal(formatCourseDisplayName('ROTC MIL SCI 1'), 'ROTC Mil Sci 1');
assert.equal(formatCourseDisplayName('Arts 1'), 'ARTS 1');
assert.equal(formatCourseDisplayName('Kas 1'), 'KAS 1');
assert.equal(formatCourseDisplayName('ARTS 1'), 'ARTS 1');

assert.equal(cleanExtractedCourseTitle('ROTC Mil Sci 1 MAB'), 'ROTC Mil Sci 1');
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

assert.equal(getCourseCategory('PI 100'), 'Core Courses');
assert.equal(getCourseCategory('NSTP 1'), 'NSTP');
assert.equal(getCourseCategory('PE'), 'PE');
assert.equal(getCourseCategory('CS Elective'), 'CS Electives');

assert.equal(getPairedGeOption('Soc Sci 2'), 'SOCSCI2');
assert.equal(getPairedGeOption('STS'), 'STS1');
assert.equal(getPairedGeFamily('GE 3: Soc Sci 1/Soc Sci 2'), 'SOCSCI');
assert.equal(getPairedGeFamily('STS 1', 'DRMAPS'), 'STSDRMAPS');
assert.equal(getNstpLevel('CWTS 2'), 2);
assert.equal(getNstpLevel('ROTC Mil Sci 1'), 1);

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
    [{ normCode: 'CS199', units: 3, hasLab: false }],
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
        "? 'padding:1px 0; background:#d1e7dd; border-radius:2px;'",
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
        'Below is indicative sequence for the current enlistment and all remaining courses in the curriculum. Pale-green entries are currently enlisted.',
    ),
);

console.log('USAD-CS regression tests passed.');
