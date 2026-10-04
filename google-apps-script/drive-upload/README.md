# Murshid — anonymous Drive upload (Google Apps Script)

Lets anyone upload a file to the **الملفات (Files)** Drive folder from the desktop app
without signing into Google. The script runs with the deployer's authority; callers stay anonymous.

## One-time setup

1. Go to <https://script.google.com> → **New project**.
2. Delete the placeholder `myFunction`, paste in all of `Code.gs`.
3. Verify `TARGET_FOLDER_ID` is the Files folder id
   (`1pNFVBUHEr0pRlo2w2b_r-JIGHdFJYo8I`) — it must match `DRIVE_FOLDERS.files` in `src/lib/publicDrive.ts`.
4. **Deploy → New deployment → type: Web app**, then:
   - **Execute as: Me**
   - **Who has access: Anyone**
   - *(A Google Workspace admin may restrict "Anyone"; in that case pick an org-internal audience and accept that only staff on the domain can upload.)*
5. Copy the **Script URL** — it ends in `/exec`.
6. Paste it into `DRIVE_UPLOAD_ENDPOINT` in `electron/main.cjs`, or set the
   `MURSHID_DRIVE_UPLOAD_URL` environment variable before building.
7. `npm run build`, then confirm the Files tab's upload button works.

## Verifying it works

Open the script URL in a browser. You should get JSON like:

```json
{"ok":true,"service":"murshid-drive-upload","folderId":"1pNF...","requiresKey":false,"maxBytes":20971520,"time":"..."}
```

That same GET is what the app calls on the Files tab to show whether uploads are configured.

## Notes

- **Use the `/exec` URL, never `/dev`.** `/dev` only works for the script owner.
- **Uploads are open to anyone with the URL.** The deployment id is long and effectively
  unguessable, but it is not a password. To restrict uploads, set `UPLOAD_KEY` in `Code.gs`
  (re-deploy) and send the same value in the request body.
- **Uploader name is written into the file name** as `YYYY-MM-DD - name - title.ext`,
  because the app lists the folder with no Drive auth and can only see names.
  The uploader name, date, and description are also stored in the file description.
- **Size limit is 20 MB.** Apps Script caps a POST body at roughly 50 MB and base64
  inflates by about a third; 20 MB is comfortably inside that.
- **Scope:** `drive.file` only. If `DriveApp` is refused at runtime, switch `oauthScopes`
  in `appsscript.json` to `https://www.googleapis.com/auth/drive` and redeploy.