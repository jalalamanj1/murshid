/**
 * Murshid — anonymous upload endpoint for the "الملفات" (Files) Drive folder.
 *
 * Deployed as a Google Apps Script Web App:
 *   Execute as  : Me
 *   Who has access: Anyone
 *
 * That combination is what lets the Murshid desktop app upload without any
 * Google login: the script runs with the deployer's authority, while callers
 * stay anonymous.
 *
 * Request  (POST, Content-Type: application/json):
 *   { fileName, mimeType, dataBase64, uploaderName, title, description }
 * Response (JSON):
 *   { ok: true, id, name }  |  { ok: false, error }
 *
 * The request is JSON + base64 rather than multipart/form-data because Apps
 * Script cannot reliably parse binary multipart bodies — a base64 string is
 * just text, so e.postData.contents survives intact.
 *
 * NOTE: anyone holding the deployment URL can upload. That is intentional.
 * To restrict uploads later, set UPLOAD_KEY below and have the app send it.
 */

var TARGET_FOLDER_ID = '1pNFVBUHEr0pRlo2w2b_r-JIGHdFJYo8I';

/** Leave empty to allow anonymous uploads from anyone with the URL. */
var UPLOAD_KEY = '';

/** Keep under the ~50MB Apps Script request-body ceiling (base64 inflates ~33%). */
var MAX_BYTES = 20 * 1024 * 1024;

/**
 * Extension allow-list, not a mime prefix match. This folder is world-readable,
 * so an uploaded .html/.svg/.exe served from a Google domain is a phishing and
 * stored-XSS vector for whoever opens the link. Extension is also the reliable
 * signal, because many clients send an empty or generic type for documents.
 */
var ALLOWED_EXT = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx',
  'odt', 'ods', 'odp', 'rtf', 'txt',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic',
  'zip',
];

var BLOCKED_MIME = /^(text\/html|application\/xhtml|image\/svg|application\/(x-)?javascript|application\/x-msdownload|application\/x-msdos-program|application\/vnd\.microsoft\.portable-executable|application\/x-?(sh|shellscript)|application\/x-?(executable|dosexec)|application\/java-archive)$/i;

function doGet(e) {
  return json_({
    ok: true,
    service: 'murshid-drive-upload',
    folderId: TARGET_FOLDER_ID,
    requiresKey: !!UPLOAD_KEY,
    maxBytes: MAX_BYTES,
    time: new Date().toISOString(),
  });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (!raw) return json_({ ok: false, error: 'empty request body' });

    var body = JSON.parse(raw);

    if (UPLOAD_KEY && body.key !== UPLOAD_KEY) {
      return json_({ ok: false, error: 'invalid upload key' });
    }

    var uploader = clean_(body.uploaderName, 80);
    if (!uploader) return json_({ ok: false, error: 'uploaderName is required' });

    var dataB64 = String(body.dataBase64 || '');
    if (!dataB64) return json_({ ok: false, error: 'dataBase64 is required' });

    var bytes = Utilities.base64Decode(dataB64);
    if (!bytes || !bytes.length) return json_({ ok: false, error: 'file is empty' });
    if (bytes.length > MAX_BYTES) {
      return json_({ ok: false, error: 'file exceeds ' + Math.floor(MAX_BYTES / 1048576) + 'MB limit' });
    }

    var mime = String(body.mimeType || 'application/octet-stream');
    if (!isAllowedFile_(String(body.fileName || ''), mime)) {
      return json_({ ok: false, error: 'unsupported file type: ' + mime + ' (' + fileName_(body.fileName) + ')' });
    }

    var folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
    var blob = Utilities.newBlob(bytes, mime, buildName_(body, uploader));

    var desc = clean_(body.description, 1000);
    var note = 'رفع بواسطة: ' + uploader + '\nالتاريخ: ' + Utilities.formatDate(new Date(), 'Asia/Baghdad', 'yyyy-MM-dd HH:mm');
    if (desc) note += '\nالوصف: ' + desc;

    var file = folder.createFile(blob);
    file.setDescription(note);

    return json_({ ok: true, id: file.getId(), name: file.getName(), size: file.getSize() });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

/**
 * Final visible name: "2026-10-03 - uploader - title.ext".
 * The uploader name lives in the file name on purpose — the desktop app lists
 * this folder without any Drive authentication and can only see file names,
 * so this is the only place every staff member will actually read it.
 */
function buildName_(body, uploader) {
  var original = String(body.fileName || 'file');
  var rawExt = fileName_(original);
  var ext = rawExt ? '.' + rawExt : '';
  var stem = rawExt ? original.slice(0, original.length - rawExt.length - 1) : original;

  var title = clean_(body.title, 120) || clean_(stem, 120) || 'ملف';

  var day = Utilities.formatDate(new Date(), 'Asia/Baghdad', 'yyyy-MM-dd');
  return clean_(day, 20) + ' - ' + uploader + ' - ' + title + ext;
}

/** Collapse whitespace and strip characters that break file systems/Drive. */
function clean_(value, maxLen) {
  var s = String(value == null ? '' : value)
    .replace(/[\\/:*?"<>|#%{}~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s;
}

function isAllowedFile_(name, mime) {
  var ext = fileName_(name);
  if (!ext || ALLOWED_EXT.indexOf(ext.toLowerCase()) === -1) return false;
  if (BLOCKED_MIME.test(mime)) return false;
  return true;
}

/** Lower-cased extension without the dot, or '' when there is none. */
function fileName_(name) {
  var s = String(name == null ? '' : name);
  var i = s.lastIndexOf('.');
  if (i <= 0 || i === s.length - 1) return '';
  return s.slice(i + 1).replace(/[^A-Za-z0-9]/g, '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}