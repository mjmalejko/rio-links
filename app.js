// --- CONSTANTS ---
const PAR = 2, HOLES = 20, COURSE_PAR = PAR * HOLES, STORAGE_KEY = "backyard-putting_v1";

// --- DATA ---
let appData = { players: [], rounds: [] };
let currentRound = null;
let editModeRoundId = null;
let expandedPlayerStats = {};
let lastCompletedRound = null;

// --- HELPERS ---
function getPlayer(id) { return appData.players.find(p => p.id === id); }

// --- LOAD/SAVE ---
function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) appData = JSON.parse(raw);
}
function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// --- CSV EXPORT (FIXED) ---
async function exportCSV() {
  if (!appData.rounds.length) {
    alert("No rounds to export yet.");
    return;
  }

  const rows = ["Date,Player,Hole,Score"];

  appData.rounds.forEach(r => {
    Object.keys(r.scores).forEach(pid => {
      const player = getPlayer(pid)?.name ?? "Player";
      r.scores[pid].forEach((score, idx) => {
        rows.push(`${r.date},${player},${idx + 1},${score}`);
      });
    });
  });

  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const filename = `backyard-putting-scores-${new Date().toISOString().split("T")[0]}.csv`;
  const file = new File([blob], filename, { type: "text/csv" });

  try {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Backyard Putting Scores",
        text: "Backyard Putting score export",
        files: [file]
      });
      return;
    }
  } catch (e) {
    console.warn("CSV share failed, fallback to download:", e);
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

// --- ROUND FLOW (simplified core) ---
function startRound(playerIds) {
  currentRound = {
    id: "r_" + Date.now(),
    date: new Date().toISOString(),
    playerIds,
    currentHole: 1,
    scores: Object.fromEntries(playerIds.map(id => [id, Array(HOLES).fill(null)]))
  };
  expandedPlayerStats = {};
}

// --- FINALIZE ROUND ---
function finalizeRound() {
  const allFilled = currentRound.playerIds.every(pid =>
    currentRound.scores[pid].every(s => s !== null)
  );

  if (!allFilled) {
    alert("Complete all holes first.");
    return;
  }

  appData.rounds.push(currentRound);
  saveLocal();

  lastCompletedRound = JSON.parse(JSON.stringify(currentRound));
  currentRound = null;
}

// --- INIT ---
loadLocal();
