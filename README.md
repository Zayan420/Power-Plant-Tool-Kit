# Power Plant Toolkit (v4)

Offline-first Android toolkit for plant operating records (Capacitor APK built by GitHub Actions).

## Tabs
- **Operating Hours** — validated HH:MM entry, "Now" button
- **Auxiliary Power** — buses, totals, % of generation
- **Generation** — hourly (Current − Previous) × MF per meter, Common MF ON/OFF, Next Hour carry-forward, daily 00:00–24:00 Export/Import with Active or Reactive choice and unlimited meters
- **Saved Records**, **Formulas** (all formulas and parameters), **Settings** (tab visibility, online backup, help)
- Every tab has a Clear Data button

## Online backup
Optional. Data is always stored on the device first. With a GitHub token (classic, `gist` scope only) the app backs up to a secret Gist whenever the device is online.

## Build APK
1. Upload all files to the root of the `main` branch of a repository.
2. Create `.github/workflows/main.yml` (copy from this project) if the hidden folder was not uploaded.
3. Actions → Build Power Plant Toolkit APK → Run workflow.
4. Download artifact `power-plant-toolkit-apk`.
