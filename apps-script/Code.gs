/**
 * Nayboro waitlist → Google Sheet.
 * Paste this whole file into the sheet's Extensions → Apps Script, set the secret (step 3 in
 * docs/DEPLOY.md), then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 *
 * The website calls it with {secret, action, ...}. Actions: join, name, leave.
 * One tab, "Waitlist", one row per person. You can sort, filter and add columns to the right freely;
 * don't rename or reorder the first 10.
 */
var TAB = 'Waitlist';
var HEADERS = ['Joined at', 'Email', 'First name', 'City', 'Metro area', 'Home(s)', 'Invite code', 'Invited by', 'Network (scrambled)', 'Friends invited'];
var COL = { joined: 1, email: 2, name: 3, city: 4, metro: 5, homes: 6, code: 7, invitedBy: 8, net: 9, invites: 10 };
var MAX_PER_NETWORK_PER_HOUR = 5;

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || body.secret !== secret) return out_({ ok: false, error: 'Not allowed.' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (body.action === 'join') return out_(join_(body));
      if (body.action === 'name') return out_(setName_(body));
      if (body.action === 'leave') return out_(leave_(body));
      return out_({ ok: false, error: 'Unknown action.' });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return out_({ ok: false, error: 'Sheet error: ' + err });
  }
}

function doGet() { return out_({ ok: true, service: 'nayboro-waitlist' }); }

function join_(b) {
  var sh = tab_(), rows = rows_(sh), email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please check your email address.' };
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][COL.email - 1]).toLowerCase() === email) return { ok: true, ref_code: String(rows[i][COL.code - 1]), already: true };
  }
  if (b.ipHash) {
    var hourAgo = Date.now() - 3600 * 1000, n = 0;
    for (var j = 0; j < rows.length; j++) {
      var t = rows[j][COL.joined - 1];
      if (rows[j][COL.net - 1] === b.ipHash && t instanceof Date && t.getTime() > hourAgo) n++;
    }
    if (n >= MAX_PER_NETWORK_PER_HOUR) return { ok: false, error: 'Too many sign-ups from this network. Please try again in an hour.' };
  }
  var codes = {}, inviterRow = -1, ref = String(b.ref || '').trim().toLowerCase();
  for (var k = 0; k < rows.length; k++) {
    var c = String(rows[k][COL.code - 1]).toLowerCase();
    codes[c] = true;
    if (ref && c === ref) inviterRow = k;
  }
  var code;
  do { code = Utilities.getUuid().replace(/-/g, '').slice(0, 8); } while (codes[code]);
  sh.appendRow([new Date(), email, '', b.city || '', b.metro || '', b.homes || '', code, inviterRow >= 0 ? rows[inviterRow][COL.code - 1] : '', b.ipHash || '', 0]);
  if (inviterRow >= 0) {
    var cell = sh.getRange(inviterRow + 2, COL.invites);
    cell.setValue((Number(cell.getValue()) || 0) + 1);
  }
  if (b.mail && b.mail.subject) {
    var fill = function (x) { return String(x || '').split('{{CODE}}').join(code); };
    try { MailApp.sendEmail({ to: email, subject: fill(b.mail.subject), htmlBody: fill(b.mail.html), body: fill(b.mail.text), name: 'Nayboro' }); }
    catch (mailErr) { console.warn('Email not sent: ' + mailErr); }   // the sign-up still counts
  }
  return { ok: true, ref_code: code, already: false };
}

function setName_(b) {
  var sh = tab_(), rows = rows_(sh), email = String(b.email || '').trim().toLowerCase(), ref = String(b.ref || '');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][COL.email - 1]).toLowerCase() === email && String(rows[i][COL.code - 1]) === ref) {
      sh.getRange(i + 2, COL.name).setValue(String(b.name || '').trim().slice(0, 40));
      return { ok: true, updated: true };
    }
  }
  return { ok: true, updated: false };
}

function leave_(b) {
  var sh = tab_(), rows = rows_(sh), email = String(b.email || '').trim().toLowerCase();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][COL.email - 1]).toLowerCase() === email) { sh.deleteRow(i + 2); return { ok: true, removed: true }; }
  }
  return { ok: true, removed: false };
}

function tab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function rows_(sh) {
  var last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/** Run once from the editor (select setup → Run) to create the tab and save the secret. */
function setup() {
  tab_();
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    PropertiesService.getScriptProperties().setProperty('SECRET', secret);
  }
  console.log('Your SHEET_WEBHOOK_SECRET (copy into Vercel): ' + secret);
}
