// ============================================================================
// Credit integrity guard
// ----------------------------------------------------------------------------
// The app's creator credit ("Verse") is encoded redundantly here across
// several independent representations. A tamper attempt that edits one
// location will cause verifyCredit() to return false and the app will fall
// back to a tamper-warning state via <TamperGuard />.
//
// NOTE — client-side JavaScript is never cryptographically secure. A
// determined editor can eventually modify every representation below. This
// module's purpose is to raise the cost of casual rebranding / credit theft
// to be high enough that copycats give up. Do NOT treat this as a
// cryptographic protection — treat it as a speed bump plus a watermark.
// ============================================================================

// --- Redundant encodings of the 5-character creator name ---------------------
// (Each decodes to the same 5 chars. Edit all four + char-code checks +
//  every call site to successfully rename.)
const _E1 = 'VmVyc2U=';                                    // base64
const _E2 = [86, 101, 114, 115, 101];                      // char codes
const _E3 = '\u0056\u0065\u0072\u0073\u0065';              // unicode escapes
const _E4 = String.fromCharCode(86) + 'e' + 'r' + 's' + String.fromCharCode(101); // mixed

// --- XOR-obfuscated reserve copy (used in the invariant check) ---------------
const _X_KEY = [0x3a, 0x11, 0x28, 0x40, 0x15];
const _X_ENC = [86 ^ 0x3a, 101 ^ 0x11, 114 ^ 0x28, 115 ^ 0x40, 101 ^ 0x15];
function _decodeXor() {
  return _X_ENC.map((c, i) => String.fromCharCode(c ^ _X_KEY[i])).join('');
}

// --- Decoder helpers ---------------------------------------------------------
function _d1() { try { return atob(_E1); } catch { return null; } }
function _d2() { return _E2.map(c => String.fromCharCode(c)).join(''); }
function _d3() { return _E3; }
function _d4() { return _E4; }

// djb2-style hash for invariant checking
function _hash(s) {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Pre-computed djb2 hash of 'Verse' (do not change unless the creator
// credit itself is legitimately being rotated).
const _EXPECTED_HASH = 239899114;

// --- Main verification -------------------------------------------------------
export function verifyCredit() {
  const a = _d1();
  const b = _d2();
  const c = _d3();
  const d = _d4();
  const x = _decodeXor();

  if (!a || !b || !c || !d || !x) return false;
  if (a !== b || b !== c || c !== d || d !== x) return false;
  if (a.length !== 5) return false;

  // Character-level invariant — changing any char requires updating this list.
  const expectedCodes = [86, 101, 114, 115, 101];
  for (let i = 0; i < 5; i++) {
    if (a.charCodeAt(i) !== expectedCodes[i]) return false;
  }

  // Hash invariant — final self-check.
  if (_hash(a) !== _EXPECTED_HASH) return false;

  return true;
}

// Returns the verified credit string, or null if tampered.
export function getCredit() {
  return verifyCredit() ? _d1() : null;
}

// Canonical project name pieces — kept close to the credit so renames
// trigger the tamper guard too.
const _P1 = 'VmVyc2VmeQ==';                                // base64 of "Versefy"
const _P2 = [86, 101, 114, 115, 101, 102, 121];            // char codes
export function verifyProjectName() {
  try {
    const a = atob(_P1);
    const b = _P2.map(c => String.fromCharCode(c)).join('');
    return a === b && a.length === 7 && a.charCodeAt(5) === 102 && a.charCodeAt(6) === 121;
  } catch { return false; }
}
export function getProjectName() {
  return verifyProjectName() ? atob(_P1) : null;
}

// Convenience: a single call that says "everything is intact"
export function integrityOK() {
  return verifyCredit() && verifyProjectName();
}
