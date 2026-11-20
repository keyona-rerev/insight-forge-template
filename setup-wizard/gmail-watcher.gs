// Insight Forge: Gmail newsletter intake
// Reads emails that carry the Gmail label "loom-queue" and sends each one to your
// Insight Forge app. The app makes a source card from it. Then this script moves
// the email to the label "loom-processed".
//
// Set the three values below. Then run start() once.

var SUPABASE_URL = 'PASTE_SUPABASE_URL';   // e.g. https://abcdefghijklmnopqrst.supabase.co
var ANON_KEY     = 'PASTE_ANON_KEY';       // Supabase > Project Settings > API Keys > legacy anon key (a public key)
var USER_ID      = 'PASTE_USER_ID';        // Supabase > Authentication > Users > User UID of your one login

var QUEUE_LABEL = 'loom-queue';
var DONE_LABEL  = 'loom-processed';
var ERROR_LABEL = 'loom-error';
var MAX_THREADS = 20;                      // per run, so one run stays under Google's time limit

function start() {
  if (SUPABASE_URL.indexOf('PASTE_') === 0 || ANON_KEY.indexOf('PASTE_') === 0 || USER_ID.indexOf('PASTE_') === 0) {
    throw new Error('Replace the three PASTE_ values at the top of the script, save, then run start() again.');
  }
  getLabel_(QUEUE_LABEL); getLabel_(DONE_LABEL); getLabel_(ERROR_LABEL);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processQueue') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(5).create();
  Logger.log('Ready. The script checks the label "' + QUEUE_LABEL + '" every 5 minutes.');
  processQueue();
}

function processQueue() {
  var queue = getLabel_(QUEUE_LABEL), done = getLabel_(DONE_LABEL), err = getLabel_(ERROR_LABEL);
  var threads = queue.getThreads(0, MAX_THREADS);
  threads.forEach(function (thread) {
    var outcome = 'done';
    var messages = thread.getMessages();
    for (var i = 0; i < messages.length; i++) {
      var r = send_(messages[i]);
      if (r === 'retry') { outcome = 'retry'; break; }   // app unreachable: leave the thread in the queue
      if (r === 'bad') outcome = 'error';                // the app refused this email: do not retry forever
    }
    if (outcome === 'retry') return;
    thread.removeLabel(queue);
    thread.addLabel(outcome === 'error' ? err : done);
  });
}

function send_(message) {
  var body = message.getPlainBody();
  if (!body || body.trim().length < 10) body = stripHtml_(message.getBody());
  var payload = {
    user_id: USER_ID,
    subject: message.getSubject() || 'Newsletter',
    sender: message.getFrom(),
    body: body.trim(),
    message_id: message.getId()
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
    Logger.log(code + ' ' + payload.subject + ' ' + res.getContentText().slice(0, 200));
    if (code >= 200 && code < 300) return 'ok';
    return code >= 500 || code === 429 ? 'retry' : 'bad';
  } catch (e) {
    Logger.log('Network error: ' + e);
    return 'retry';
  }
}

function getLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function stripHtml_(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
