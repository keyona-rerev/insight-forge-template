// Insight Forge: Google Drive folder intake
// Reads the files in ONE Drive folder and sends each one to your Insight Forge app.
// The app makes a source card from each file. It uses the three values at the top of Code.gs.
//
// Set the one value below. Then run importFolder() once.
// Type NONE instead of a link if you have no folder. The script then does nothing.

var SOURCE_FOLDER_URL = 'PASTE_FOLDER_URL';   // e.g. https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp

var MAX_FILES_PER_RUN = 25;     // per run, so one run stays under Google's time limit
var MAX_CHARS = 45000;          // the app keeps the first 50,000 characters of each file

function importFolder() {
  if (SOURCE_FOLDER_URL.indexOf('PASTE_') === 0) {
    throw new Error('Replace PASTE_FOLDER_URL at the top of this file, save, then run importFolder() again.');
  }
  if (/^none$/i.test(SOURCE_FOLDER_URL.trim())) { Logger.log('No folder set (NONE). Nothing to do.'); return; }
  if (SUPABASE_URL.indexOf('PASTE_') === 0 || ANON_KEY.indexOf('PASTE_') === 0 || USER_ID.indexOf('PASTE_') === 0) {
    throw new Error('Set the three PASTE_ values at the top of Code.gs first.');
  }
  var m = SOURCE_FOLDER_URL.match(/folders\/([A-Za-z0-9_-]{10,})/);
  if (!m) throw new Error('SOURCE_FOLDER_URL is not a Drive folder address. It must have /folders/ in it.');

  ensureDailyTrigger_();
  var props = PropertiesService.getScriptProperties();
  var files = [];
  collectDriveFiles_(DriveApp.getFolderById(m[1]), files, 0);

  var sent = 0, skipped = 0, readErrors = 0, unreadable = {}, retry = false;
  for (var i = 0; i < files.length && sent < MAX_FILES_PER_RUN; i++) {
    var f = files[i], key = 'drv_' + f.getId();
    var state = props.getProperty(key);
    if (state && state !== 'short') continue;                   // already handled ('short' files are checked again)
    var text = readDriveText_(f);
    if (text === undefined) { readErrors++; continue; }        // read failed: try again next run
    if (text === null) {                                        // a type this script cannot read
      var t = f.getMimeType(); unreadable[t] = (unreadable[t] || 0) + 1;
      props.setProperty(key, 'unreadable'); skipped++; continue;
    }
    if (text.length < 100) { props.setProperty(key, 'short'); skipped++; continue; }
    var r = sendDriveFile_(f, text);
    if (r === 'retry') { retry = true; break; }                 // app unreachable: try again next run
    props.setProperty(key, r === 'ok' ? 'sent' : 'bad');
    if (r === 'ok') sent++;
    Utilities.sleep(500);
  }
  var left = 0;
  files.forEach(function (f) { var s = props.getProperty('drv_' + f.getId()); if (!s || s === 'short') left++; });
  var summary = 'Found ' + files.length + ' file(s). Sent ' + sent + '. Skipped ' + skipped + '. Still waiting: ' + left + '.' +
    (readErrors ? ' Could not read ' + readErrors + ' file(s) this run; the script tries them again next run.' : '') +
    (retry ? (appNotReady_
      ? ' The app is not ready yet: the install has not run, or a value in Code.gs is wrong. Nothing was lost. The script tries again every day, or run importFolder() again after the install.'
      : ' The app was unreachable. The script tries again tomorrow.') : '');
  Logger.log(summary);
  Object.keys(unreadable).forEach(function (k) {
    Logger.log('Could not read ' + unreadable[k] + ' file(s) of type ' + k + '. Save them as a Google Doc or a text file.');
  });
  if (left > 0 && !retry) Logger.log('Run importFolder() again, or wait for tomorrow. Each run sends up to ' + MAX_FILES_PER_RUN + ' files.');
  return summary;
}

// Names below are unique on purpose. Apps Script puts every file in one shared space,
// so a second function named send_ would replace the one in Code.gs and break the Gmail intake.
function collectDriveFiles_(folder, out, depth) {
  var it = folder.getFiles();
  while (it.hasNext()) out.push(it.next());
  if (depth >= 3) return;                                       // folders inside folders, 3 levels
  var sub = folder.getFolders();
  while (sub.hasNext()) collectDriveFiles_(sub.next(), out, depth + 1);
}

function readDriveText_(file) {
  // Returns the text, null for a type this script cannot read, or undefined when the read failed.
  var mime = file.getMimeType();
  if (mime === MimeType.GOOGLE_DOCS) {
    try { return DocumentApp.openById(file.getId()).getBody().getText().trim().slice(0, MAX_CHARS); }
    catch (e) { Logger.log('DocumentApp could not open ' + file.getName() + '. Trying the plain-text export.'); }
    try {                                                       // some Docs (big tables, add-on content) fail in DocumentApp
      var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + file.getId() + '/export?mimeType=text/plain', {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) return res.getContentText().trim().slice(0, MAX_CHARS);
      Logger.log('Export failed for ' + file.getName() + ': HTTP ' + res.getResponseCode());
    } catch (e2) { Logger.log('Export failed for ' + file.getName() + ': ' + e2); }
    return undefined;
  }
  if (mime === MimeType.PLAIN_TEXT || mime === 'text/markdown' || mime === 'text/vtt' || mime === 'application/x-subrip' ||
      /\.(txt|md|vtt|srt)$/i.test(file.getName())) {
    try { return file.getBlob().getDataAsString().trim().slice(0, MAX_CHARS); }
    catch (e3) { Logger.log('Could not read ' + file.getName() + ': ' + e3); return undefined; }
  }
  return null;
}

function sendDriveFile_(file, text) {
  var payload = {
    user_id: USER_ID,
    subject: file.getName(),
    sender: 'drive-folder',
    body: text,
    message_id: 'drive:' + file.getId()      // the app skips a file it already has
  };
  try {
    var res = UrlFetchApp.fetch(SUPABASE_URL + '/functions/v1/ingest-gmail-content', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    Logger.log(code + ' ' + file.getName() + ' ' + res.getContentText().slice(0, 120));
    if (code >= 200 && code < 300) return 'ok';
    // 401/403/404: the app is not installed yet, or a value in Code.gs is wrong. Keep the file and try again later.
    if (code === 401 || code === 403 || code === 404) { appNotReady_ = true; return 'retry'; }
    return code >= 500 || code === 429 ? 'retry' : 'bad';
  } catch (e) {
    Logger.log('Network error: ' + e);
    return 'retry';
  }
}

var appNotReady_ = false;

function ensureDailyTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'importFolder'; });
  if (!has) ScriptApp.newTrigger('importFolder').timeBased().everyDays(1).create();
}
