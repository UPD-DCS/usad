const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = Number(process.env.USAD_E2E_PORT || 43123);
const CHECKLIST_PATH = process.env.USAD_E2E_CHECKLIST;
const PRE_REFACTOR_COMMIT = process.env.USAD_E2E_BASE_COMMIT || '7343cef';
const VSO_SPREADSHEET_ID = '1yYECEDmllyGMuL1c3lzmvuR00lWtedS1x6Kweronpp0';

if (!CHECKLIST_PATH) {
    throw new Error(
        'Set USAD_E2E_CHECKLIST to a saved UP CRS Online Advising HTML file.',
    );
}

const checklistHtml = fs.readFileSync(CHECKLIST_PATH, 'utf8');
const currentSource = fs.readFileSync(path.join(__dirname, 'USAD-CS.main.js'), 'utf8');
const previousSource = childProcess.execFileSync(
    'git',
    ['show', `${PRE_REFACTOR_COMMIT}:USAD-CS.main.js`],
    { cwd: __dirname, encoding: 'utf8' },
);

const curriculumCourses = [
    'CS 10',
    'CS 11',
    'CS 12',
    'CS 20',
    'CS 21',
    'CS 30',
    'CS 31',
    'CS 32',
    'CS 33',
    'CS 132',
    'CS 133',
    'CS 136',
    'CS 138',
    'CS 140',
    'CS 145',
    'CS 150',
    'CS 153',
    'CS 155',
    'CS 165',
    'CS 180',
    'CS 191',
    'CS 192',
    'CS 194',
    'CS 195',
    'CS 196',
    'CS 198',
    'CS 199',
    'CS 200',
    'Engg 150',
    'Math 21',
    'Math 22',
    'Math 23',
    'Math 40',
    'PI 100',
    'Physics 71',
    'Physics 72',
];

const prerequisiteCsv = [
    ['Course', 'Prerequisite', 'Corequisite', 'Semester Offered', 'Has Lab'],
    ...curriculumCourses.map((course, index) => [
        course,
        'None',
        'None',
        course === 'CS 195' ? 'M' : index % 3 === 0 ? '1' : index % 3 === 1 ? '2' : '1;2',
        /^(?:CS (?:21|32|33|140|145|165)|Physics (?:71|72))$/.test(course) ? '1' : '0',
    ]),
]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

const geCourses = [
    'ARTS 1',
    'Eng 13',
    'Eng 30',
    'Fil 40',
    'KAS 1',
    'Philo 1',
    'Science 11',
    'Soc Sci 1',
    'Soc Sci 2',
    'Speech 30',
    'STS 1',
    'DRMAPS',
];

function buildFixturePage(version) {
    const setupScript = `
        <script>
        (() => {
            document
                .querySelectorAll('#advising-panel-header')
                .forEach((header) => header.parentElement?.remove());

            const scenario =
                new URLSearchParams(window.location.search).get('scenario') || 'baseline';
            const classTable =
                document.querySelector('table.classlist tbody') ||
                document.querySelector('table.classlist');
            const removeEnlisted = (pattern) => {
                document.querySelectorAll('table.classlist tr').forEach((row) => {
                    const description = row.querySelector('td.td_coursedesc')?.textContent || '';
                    if (pattern.test(description)) row.remove();
                });
            };
            const addEnlisted = (courseDescription) => {
                if (!classTable) return;
                const row = document.createElement('tr');
                const descriptionCell = document.createElement('td');
                descriptionCell.className = 'td_coursedesc';
                descriptionCell.textContent = courseDescription;
                row.appendChild(descriptionCell);
                classTable.appendChild(row);
            };

            if (scenario === 'cwts1') addEnlisted('CWTS 1 THR');
            if (scenario === 'lts1') addEnlisted('LTS 1 THR');
            if (scenario === 'rotc1') addEnlisted('ROTC Mil Sci 1 THR');
            if (scenario === 'soc2') {
                removeEnlisted(/^\\s*Soc Sci 1\\b/i);
                addEnlisted('Soc Sci 2 THR');
            }
            if (scenario === 'sts') addEnlisted('STS 1 THR');
            if (scenario === 'drmaps') addEnlisted('DRMAPS THR');
            if (scenario === 'cs171') addEnlisted('CS 171 THR');
            if (scenario === 'underload') {
                removeEnlisted(/^\\s*CS 198\\b/i);
                removeEnlisted(/^\\s*CS 174\\b/i);
                document.querySelectorAll('span').forEach((span) => {
                    if (/Total Units:/i.test(span.parentElement?.textContent || '')) {
                        span.textContent = '15.0';
                    }
                });
            }
            if (scenario === 'midyear') {
                const heading = document.querySelector('h1.module-name-h1');
                if (heading) heading.textContent = 'Online Advising for Midyear AY 2026-2027';
            }

            const nativeFetch = window.fetch.bind(window);
            window.fetch = (url, options) => {
                if (String(url).includes('/curriculum_checklist/load_student')) {
                    return nativeFetch('/checklist-data', { cache: 'no-store' });
                }
                return nativeFetch(url, options);
            };

            window.__USAD_E2E_REQUESTS__ = [];
            const fixtureStudentId =
                (document.querySelector('td.tr_submit h1')?.textContent || '')
                    .replace(/\D/g, '');
            window.GM_xmlhttpRequest = (options) => {
                window.__USAD_E2E_REQUESTS__.push(String(options.url || ''));
                const respond = (response) => setTimeout(() => options.onload?.(response), 0);
                if (String(options.url).includes(${JSON.stringify(VSO_SPREADSHEET_ID)})) {
                    const listedStudentId =
                        scenario === 'vso' ? fixtureStudentId : '999999999';
                    respond({
                        status: 200,
                        responseText:
                            ',,,\\nUpdated,8/12/2026 20:26:00,,\\n,,,\\n' +
                            'Student number,Last Name,First Name,Middle Name\\n' +
                            listedStudentId + ',Test,VSO,Student',
                    });
                    return;
                }
                if (String(options.url).includes('/schedule/')) {
                    if (/\\/schedule\\/?$/.test(String(options.url))) {
                        respond({
                            status: 200,
                            responseText: '<a href="https://crs.upd.edu.ph/schedule/120261/A">A</a>',
                        });
                    } else {
                        respond({ status: 200, responseText: '<table><tbody></tbody></table>' });
                    }
                    return;
                }
                respond({ status: 404, responseText: '' });
            };

            localStorage.clear();
            sessionStorage.clear();
            localStorage.setItem('crs_prereq_sheet_data', ${JSON.stringify(prerequisiteCsv)});
            localStorage.setItem('crs_prereq_sheet_time', String(Date.now()));
            if (scenario !== 'ge-placeholder') {
                localStorage.setItem('upd_ge_course_list_dynamic', ${JSON.stringify(
                    JSON.stringify(geCourses),
                )});
                localStorage.setItem('upd_ge_course_list_dynamic_time', String(Date.now()));
                localStorage.setItem('upd_ge_course_list_dynamic_source', 'e2e-fixture');
            }
            localStorage.setItem('bscs_advising_panel_minimized', '0');
            localStorage.setItem('bscs_progression_recommender_hidden_v2', '0');
            window.__USAD_E2E_VERSION__ = ${JSON.stringify(version)};
            window.__USAD_E2E_SCENARIO__ = scenario;
        })();
        </script>
        <script src="/app-${version}.js"></script>
    `;

    return checklistHtml.replace(/<\/body>/i, `${setupScript}</body>`);
}

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/old' || url.pathname === '/new') {
        const version = url.pathname.slice(1);
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(buildFixturePage(version));
        return;
    }

    if (url.pathname === '/checklist-data') {
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(checklistHtml);
        return;
    }

    if (url.pathname === '/app-old.js' || url.pathname === '/app-new.js') {
        response.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(url.pathname.includes('old') ? previousSource : currentSource);
        return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`USAD-CS E2E fixture listening on http://127.0.0.1:${PORT}`);
});
