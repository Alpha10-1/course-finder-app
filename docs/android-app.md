# Android app (Trusted Web Activity)

The Android app is a thin wrapper around the live site, built as a Trusted Web
Activity (TWA). It opens `https://mycoursefinder.web.app` full screen in Chrome,
with no address bar, so every deploy to Firebase Hosting updates the app too. The
offline support, the app icon and push reminders all come from the website.

What's already done in this repo:

- `public/site.webmanifest` has everything Bubblewrap and PWABuilder read: name,
  colours, `start_url`, `scope`, 192 and 512 px icons and a maskable icon.
- `firebase.json` deploys `public/.well-known/`, where Android looks for
  `assetlinks.json`.
- `npm run assetlinks` writes that file for you (see step 4).
- `.gitignore` ignores keystores (`*.keystore`, `*.jks`) and APK/AAB build output.

What only you can do: create the signing key and keep it safe, build the app, and
publish it.

## 1. Build the app with Bubblewrap

You need Node.js. Bubblewrap downloads a JDK and the Android command-line tools
for you on first run.

```sh
npm install -g @bubblewrap/cli
mkdir android && cd android        # inside this repo; build output and keys are git-ignored
bubblewrap init --manifest=https://mycoursefinder.web.app/site.webmanifest
```

Suggested answers to its questions (the exact questions vary between Bubblewrap versions):

| Question | Answer |
|---|---|
| Domain | `mycoursefinder.web.app` |
| Application ID (package name) | `app.web.mycoursefinder.twa` (the default; `npm run assetlinks` assumes it) |
| App name / launcher name | `Course Finder` |
| Display mode | `standalone` |
| Status bar / splash colours | the defaults from the manifest (`#7e14ff`, `#1e1147`) |
| Notification delegation (if asked) | **Yes**, so push reminders show as the app's own notifications |
| Play Billing, location | No |
| Key store location / key name | the defaults (`./android.keystore`, `android`) |

Then build:

```sh
bubblewrap build
```

This produces two files:

- `app-release-signed.apk` — for installing directly on a phone (send it over
  WhatsApp or USB, or run `bubblewrap install` with the phone plugged in).
- `app-release-bundle.aab` — for uploading to Google Play.

Commit `twa-manifest.json` and the generated Android project if you like, so the
next build uses the same settings. Never commit `android.keystore` (it's ignored).

**Alternative without installing anything:** [PWABuilder](https://www.pwabuilder.com)
→ enter the site URL → *Package for stores* → *Android*. The download contains
the APK/AAB, a `signing.keystore`, a `signing-key-info.txt` with its passwords and
fingerprint, and an `assetlinks.json`. Treat that keystore exactly like step 2.

## 2. Back up the signing key

`android.keystore` and its passwords are the only way to publish updates to the
app. If they're lost, Google Play won't accept updates and you'd have to publish
a brand new app.

- Store the keystore file and both passwords in a password manager or another
  safe place outside this repo and outside OneDrive's shared folders.
- Never commit them. This repo has leaked secrets through git history before (see
  README → Known issues).

## 3. Get the fingerprints

Read your key's fingerprint with `keytool`. It comes with the JDK Bubblewrap
downloaded, but that JDK isn't on your PATH. Its folder is the `jdkPath` value
in `%USERPROFILE%\.bubblewrap\config.json` (`~/.bubblewrap/config.json` on macOS
or Linux). From the `android` folder in Git Bash:

```sh
"$(node -p "require(require('os').homedir()+'/.bubblewrap/config.json').jdkPath")/bin/keytool" -list -v -keystore android.keystore -alias android
```

On macOS the JDK's tools are under `<jdkPath>/Contents/Home/bin/keytool`. Copy
the `SHA256:` line (32 pairs of hex digits). Don't use the `SHA1:` one. If you
used PWABuilder, the fingerprint is already in `signing-key-info.txt`.

If you publish on Google Play with Play App Signing (the default), Google re-signs
the app with its own key. You then also need Play's fingerprint. In Play Console,
open your app, then go to *Protected with Play* → *Play Store distribution* →
*Go to Play app signing* → *App signing key certificate* and copy the SHA-256.
Older consoles show it under *Test and release* → *App integrity* → *App signing*.

## 4. Publish assetlinks.json

From the repo root, with one `--fingerprint` per key:

```sh
npm run assetlinks -- --fingerprint "AA:BB:...:FF" --fingerprint "11:22:...:99"
npm run build
firebase deploy --only hosting
```

This writes `public/.well-known/assetlinks.json` (commit it — fingerprints aren't
secret). The script checks the package name and fingerprint format, so a SHA-1 or
a truncated paste fails loudly instead of silently breaking verification.

Check it's live and that Google accepts it:

- <https://mycoursefinder.web.app/.well-known/assetlinks.json> should show the JSON.
- <https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://mycoursefinder.web.app&relation=delegate_permission/common.handle_all_urls>
  should list your package name.

Then reopen the app on the phone. If the address bar is gone, verification
worked. If it's still there, the fingerprint doesn't match the key that signed
the installed APK. A Play-installed copy is signed with Play's key; a sideloaded
APK is signed with yours.

## 5. Publish on Google Play (optional)

- A Play developer account has a one-off registration fee.
- Google currently requires new personal developer accounts to run a closed test
  with a minimum number of testers for two weeks before the app can go to
  production. Check the current rule in Play Console when you sign up.
- Play asks for a privacy policy URL and a Data safety form. The app collects
  learners' names, contact details and school marks, many of them minors. This
  ties in with the POPIA item in `ROADMAP.md`: have a privacy policy page and
  parental-consent wording in place first.
- Upload `app-release-bundle.aab`, then add Play's app signing fingerprint to
  `assetlinks.json` (step 4) and redeploy hosting.

## Updating the app

Website changes need no new app build. Rebuild the app only when
`site.webmanifest` changes (name, icon, colours or start URL):

1. Deploy the site first, so the live manifest has the change.
2. In the `android` folder, run `bubblewrap merge`. It fetches the live web
   manifest, copies its values into `twa-manifest.json` and bumps the version.
3. Run `bubblewrap update --skipVersionUpgrade` (merge already bumped the
   version), then `bubblewrap build`.

`bubblewrap update` on its own doesn't read the web manifest. You can also edit
`twa-manifest.json` by hand and then run `bubblewrap update` and `bubblewrap build`.
