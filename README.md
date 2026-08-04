# USAD-CS Installation

The **Unified Student Advising and Degree-Progression Recommender Tool (USAD-CS)** runs on the CRS Online Advising page through a small Tampermonkey loader.

## Requirements

- A browser with [Tampermonkey](https://www.tampermonkey.net/) installed
- Access to UP Diliman CRS Online Advising Module

## Install the loader

1. Open your browser's **Tampermonkey Dashboard**.
2. Select the **Utilities** tab.
3. Under **Import from file**, click **Choose File**.
4. Select `USAD-CS.loader.user.js`.
5. Review the userscript, then click **Install**.
6. Confirm that **USAD-CS** appears in the Tampermonkey Dashboard and is enabled.

If your version of Tampermonkey does not show **Import from file**:

1. Open the Tampermonkey Dashboard.
2. Click the **+** button to create a new userscript.
3. Delete the sample code in the editor.
4. Open `USAD-CS.loader.user.js` in a text editor and copy all of its contents.
5. Paste the code into Tampermonkey.
6. Save it with **File > Save** or `Ctrl+S` on Windows/Linux or `Command+S` on macOS.

Do not install `USAD-CS.main.js` as a separate userscript. The loader downloads and runs that file automatically.

## Use USAD-CS

1. Sign in to [UP Diliman CRS](https://crs.upd.edu.ph/).
2. Open a student page under **Online Advising**.
3. USAD-CS will start automatically on addresses matching:

   ```text
   https://crs.upd.edu.ph/online_advising/advise/*
   ```

4. If the advising page was already open during installation, reload the page.

## Updates

The loader downloads the latest application code from:

```text
https://raw.githubusercontent.com/jjsvillar/usad/main/USAD-CS.main.js
```

It requests a fresh copy whenever a matching CRS advising page loads, so normal application updates do not require reinstalling the loader. Because the current `main` branch is executed automatically, only use the loader if you trust that repository and its maintainers.

Reinstall the loader only when `USAD-CS.loader.user.js` itself changes, such as when its permissions or supported page address changes.

## Troubleshooting

If USAD-CS does not appear:

1. Check that Tampermonkey and the **USAD-CS** userscript are enabled.
2. Confirm that the page address starts with `https://crs.upd.edu.ph/online_advising/advise/`.
3. Reload the page. If necessary, perform a hard refresh.
4. Confirm that your internet connection can access `raw.githubusercontent.com` and `cdnjs.cloudflare.com`.
5. Open the browser's developer console and look for messages beginning with `[USAD-CS]`.

The first installation may ask you to approve access to these domains:

- `crs.upd.edu.ph`
- `gec.upd.edu.ph`
- `cdnjs.cloudflare.com`
- `raw.githubusercontent.com`

These permissions allow the loader to run on CRS and obtain the application code and required data or libraries.

## Disable or remove

Open the Tampermonkey Dashboard, locate **USAD-CS**, then use its toggle to disable it or its delete button to remove it.
