// ==UserScript==
// @name         USAD-CS
// @namespace    https://crs.upd.edu.ph/
// @version      1.0
// @description  Loads the latest USAD-CS application code from its external JavaScript file.
// @author       JJV
// @match        https://crs.upd.edu.ph/online_advising/advise/*
// @grant        GM_xmlhttpRequest
// @connect      crs.upd.edu.ph
// @connect      gec.upd.edu.ph
// @connect      cdnjs.cloudflare.com
// @connect      raw.githubusercontent.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
// ==/UserScript==

(function () {
    'use strict';

    const EXTERNAL_SCRIPT_URL =
        'https://raw.githubusercontent.com/UPD-DCS/usad/main/USAD-CS.main.js';
    const REQUEST_TIMEOUT_MS = 30_000;

    function createFreshScriptUrl(scriptUrl) {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        return `${scriptUrl}${separator}usad_cs_time=${Date.now()}`;
    }

    function executeExternalScript(sourceCode) {
        // Direct eval keeps the application in the userscript sandbox, where
        // the loader's granted APIs and required libraries are available.
        eval(`${sourceCode}\n//# sourceURL=USAD-CS.main.js`);
    }

    function loadExternalScript(scriptUrl) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: createFreshScriptUrl(scriptUrl),
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'Cache-Control': 'no-cache',
            },
            onload(response) {
                if (response.status < 200 || response.status >= 300) {
                    console.error(
                        `[USAD-CS] External script request failed with HTTP ${response.status}.`,
                    );
                    return;
                }

                try {
                    executeExternalScript(response.responseText);
                } catch (error) {
                    console.error('[USAD-CS] External script failed to start.', error);
                }
            },
            ontimeout() {
                console.error('[USAD-CS] External script request timed out.');
            },
            onerror(error) {
                console.error('[USAD-CS] Could not download the external script.', error);
            },
        });
    }

    loadExternalScript(EXTERNAL_SCRIPT_URL);
})();
