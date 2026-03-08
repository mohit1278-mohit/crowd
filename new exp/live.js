/* ──────────────────────────────────────────
   Crowd Monitoring Dashboard — live.js
   ────────────────────────────────────────── */

const API = "http://127.0.0.1:5000";

let limit       = 100;
let alertSent   = false;
let peakCount   = 0;
let alertsSent  = 0;
let startTime   = Date.now();

/* ── Uptime counter ── */
function updateUptime() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    const el = document.getElementById("uptimeDisplay");
    if (el) el.textContent = `${h}:${m}:${s}`;
}
setInterval(updateUptime, 1000);

/* ── Navigation ── */
function goHome() {
    window.location.href = "index.html";
}

/* ── Error banner ── */
function showBanner(msg) {
    const banner = document.getElementById("errorBanner");
    const msgEl  = document.getElementById("errorMsg");
    if (!banner) return;
    if (msgEl) msgEl.textContent = msg;
    banner.hidden = false;
}

function dismissBanner() {
    const banner = document.getElementById("errorBanner");
    if (banner) banner.hidden = true;
}

/* ── Video feed loading / error ── */
function hideFeedSpinner() {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) spinner.style.display = "none";
}

function onFeedError() {
    const spinner = document.getElementById("loadingSpinner");
    if (spinner) {
        spinner.innerHTML = "<p style='color:#ff6b8a;padding:20px;text-align:center'>⚠️ Video feed unavailable.<br>Make sure the backend is running.</p>";
    }
    showBanner("Video feed unavailable. Is the backend server running on port 5000?");
}

/* ── ADD PHONE (chip style) ── */
function addPhone() {
    const input = document.getElementById("newPhoneInput");
    const val   = (input ? input.value : "").trim();

    if (!val) {
        input && input.focus();
        return;
    }

    const container = document.getElementById("phoneContainer");
    if (!container) return;

    const chip = document.createElement("div");
    chip.className   = "phone-chip";
    chip.dataset.phone = val;
    chip.innerHTML   = `<span>${escapeHTML(val)}</span><button class="phone-chip-del" aria-label="Remove ${escapeHTML(val)}">✕</button>`;
    chip.querySelector("button").addEventListener("click", () => chip.remove());

    container.appendChild(chip);

    if (input) input.value = "";
    input && input.focus();
}

/* Allow pressing Enter in the phone input */
document.addEventListener("DOMContentLoaded", () => {
    const inp = document.getElementById("newPhoneInput");
    if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") addPhone(); });
});

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ── Collect phone numbers ── */
function getPhoneNumbers() {
    return Array.from(document.querySelectorAll(".phone-chip"))
                .map(c => c.dataset.phone)
                .filter(Boolean);
}

/* ── SET LIMIT ── */
function setLimit() {
    const input = document.getElementById("limitInput");
    if (!input) return;

    const raw   = input.value.trim();
    const val   = parseInt(raw, 10);

    if (!raw || isNaN(val) || val <= 0 || !Number.isInteger(val)) {
        showBanner("Limit must be a positive integer greater than 0.");
        input.focus();
        return;
    }

    limit = val;
    const display = document.getElementById("limitDisplay");
    if (display) display.textContent = limit;
    input.value = "";

    // Reset alert flag so a new alert can be sent for the new limit
    alertSent = false;
}

/* ── STEPPER ── */
function adjustLimit(delta) {
    const newVal = Math.max(1, limit + delta);
    limit = newVal;
    const display = document.getElementById("limitDisplay");
    if (display) display.textContent = limit;
    alertSent = false;
}

/* ── SEND ALERT to backend ── */
async function sendAlertToBackend(phones, message) {
    try {
        const res = await fetch(`${API}/alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phones, message }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        alertsSent += phones.length;
        const alertsEl = document.getElementById("alertsSentCount");
        if (alertsEl) alertsEl.textContent = alertsSent;
    } catch (err) {
        console.warn("Alert request failed:", err);
    }
}

/* ── UPDATE CROWD STATUS UI ── */
function updateStatus(people) {
    const statusText  = document.getElementById("statusText");
    const bigDot      = document.getElementById("bigDot");
    const pulseRing   = document.getElementById("pulseRing");
    const smallDot    = document.getElementById("smallDot");
    const progressBar = document.getElementById("progressBar");
    const progressLbl = document.getElementById("progressLabel");
    const peopleEl    = document.getElementById("peopleCount");

    const pct = limit > 0 ? Math.min(100, Math.round((people / limit) * 100)) : 0;

    if (progressBar) progressBar.style.width = pct + "%";
    if (progressLbl) progressLbl.textContent = `${people} / ${limit}`;

    let color, status, cls;

    if (people >= limit) {
        color  = "var(--danger)";
        status = "CROWD HIGH";
        cls    = "danger";
        if (progressBar) progressBar.style.background = "linear-gradient(90deg, var(--medium), var(--danger))";
    } else if (people >= limit / 2) {
        color  = "var(--medium)";
        status = "CROWD MEDIUM";
        cls    = "medium";
        if (progressBar) progressBar.style.background = "linear-gradient(90deg, var(--safe), var(--medium))";
    } else {
        color  = "var(--safe)";
        status = "CROWD SAFE";
        cls    = "safe";
        if (progressBar) progressBar.style.background = "linear-gradient(90deg, var(--safe), var(--accent))";
    }

    if (statusText)  { statusText.textContent = status; statusText.style.color = color; }
    if (bigDot)      { bigDot.style.background = color; bigDot.style.boxShadow = `0 0 16px ${color}`; }
    if (pulseRing)   { pulseRing.style.borderColor = color; }
    if (smallDot)    { smallDot.style.background = color; smallDot.style.boxShadow = `0 0 8px ${color}`; }
    if (peopleEl)    { peopleEl.className = "people-number " + cls; }

    /* ── Alert threshold logic (send once per crossing) ── */
    if (people >= limit) {
        if (!alertSent) {
            alertSent = true;
            const phones = getPhoneNumbers();
            if (phones.length > 0) {
                sendAlertToBackend(phones, `⚠️ Crowd limit exceeded! Current count: ${people}`);
            }
        }
    } else {
        // Reset flag when crowd drops back below limit
        alertSent = false;
    }
}

/* ── Server status check via /health ── */
async function checkServerStatus() {
    const dot   = document.getElementById("statusDotNav");
    const label = document.getElementById("statusLabel");

    try {
        const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            if (dot)   { dot.className = "status-dot-nav online"; }
            if (label) label.textContent = "Connected";
            return true;
        }
    } catch (_) {}

    if (dot)   { dot.className = "status-dot-nav offline"; }
    if (label) label.textContent = "Disconnected";
    return false;
}

/* ── FETCH PEOPLE COUNT ── */
async function updatePeople() {
    try {
        const res = await fetch(`${API}/count`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data   = await res.json();
        const people = data.people ?? 0;

        const el = document.getElementById("peopleCount");
        if (el) el.textContent = people;

        // Track peak
        if (people > peakCount) {
            peakCount = people;
            const peakEl = document.getElementById("peakCount");
            if (peakEl) peakEl.textContent = peakCount;
        }

        updateStatus(people);
        dismissBanner();

    } catch (error) {
        showBanner("Unable to connect to the server. Make sure the backend is running on port 5000.");
    }
}

/* ── Initialise ── */
(async function init() {
    await checkServerStatus();
    await updatePeople();

    setInterval(updatePeople, 1000);
    setInterval(checkServerStatus, 5000);
})();