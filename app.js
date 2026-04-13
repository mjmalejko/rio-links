const PAR = 2;
    const HOLES = 20;
    const COURSE_PAR = PAR * HOLES;
    const STORAGE_KEY = "backyard-putting_v1";

    const HOLE_NAMES = [
      "First Flight", "Arrow Line", "Hunter’s Hook", "Rising Edge", "Gravity Glide",
      "Climbing Turn", "The Drop Point", "Gauntlet Ridge", "Perch Line", "Switchback",
      "Moon Curve", "The Ascent", "Silent Path", "Hollow Ridge", "The Horseshoe",
      "Reverse Shoe", "Second Ridge", "True North", "Slope Run", "Home Roost"
    ];

    const HOLE_DESCRIPTIONS = [
      "Flag 1 to 2", "Flag 2 to 3", "Flag 3 to 4", "Flag 4 to 5", "Flag 5 to 1",
      "Flag 1 to 5", "Flag 5 to 4", "Flag 4 to 3", "Flag 3 to 2", "Flag 2 to 1",
      "Flag 1 to 4", "Flag 4 to 2", "Flag 2 to 3", "Flag 3 to 5", "Flag 5 to 2",
      "Flag 2 to 5", "Flag 5 to 3", "Flag 3 to 2", "Flag 2 to 4", "Flag 4 to 1"
    ];

    function fmtDiff(n) {
      const num = Number(n);
      if (Number.isNaN(num)) return "-";
      if (num > 0) return `+${num.toFixed ? num.toFixed(1) : num}`;
      if (num === 0) return "E";
      return `${num.toFixed ? num.toFixed(1) : num}`;
    }

    const FAMILY_ACCESS_CODE = "1989";

    function initAccessGate() {
      const gate = document.getElementById("accessGate");
      const btn = document.getElementById("accessOpenBtn");
      const error = document.getElementById("accessError");
      const boxes = Array.from(document.querySelectorAll(".codeBox"));
      const readCode = () => boxes.map(b => b.value).join("");
      boxes[0]?.focus();
      boxes.forEach((box, i) => {
        box.addEventListener("input", () => {
          box.value = (box.value || "").replace(/[^0-9]/g, "").slice(0, 1);
          if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
        });
        box.addEventListener("keydown", e => {
          if (e.key === "Backspace" && !box.value && i > 0) boxes[i - 1].focus();
          if (e.key === "Enter") btn.click();
        });
      });
      btn.onclick = () => {
        if (readCode() === FAMILY_ACCESS_CODE) {
          gate.style.display = "none";
        } else {
          error.style.display = "block";
          boxes.forEach(b => (b.value = ""));
          boxes[0]?.focus();
        }
      };
    }

    let appData = { players: [], rounds: [] };
    let currentRound = null;
    let editModeRoundId = null;
    let handicapChartInstance = null;
    let db = null;
    let expandedPlayerStats = {};

    function loadLocal() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { appData = JSON.parse(raw); } catch (e) { console.error("Error parsing local storage:", e); }
      }
      if (!appData.players) appData.players = [];
      if (!appData.rounds) appData.rounds = [];
    }

    function saveLocal() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    }

    const firebaseConfig = {
      apiKey: "AIzaSyCX9C7uy5JNklprp3tZeKV3tPGr410ix28",
      authDomain: "rio-links.firebaseapp.com",
      projectId: "rio-links",
      storageBucket: "rio-links.firebasestorage.app",
      messagingSenderId: "260295353704",
      appId: "1:260295353704:web:8700c3a72ccf786d1762dd",
      measurementId: "G-6MVV3ZFT3T"
    };

    function initFirebase() {
      try {
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
        firebase.auth().signInAnonymously().then(() => console.log("Firebase: anonymous session started")).catch(error => console.warn("Firebase anonymous auth failed", error));
        db = firebase.firestore();
        loadFromFirebase();
      } catch (e) {
        console.warn("Firebase init failed; app will run local-only:", e);
      }
    }

    function getFamilyDocRef() {
      if (!db) return null;
      return db.collection("backyardPutting").doc("family-1");
    }

    async function loadFromFirebase() {
      try {
        const ref = getFamilyDocRef();
        if (!ref) return;
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data();
          if (data.players && data.rounds) {
            appData = data;
            saveLocal();
            renderPlayers();
          }
        } else {
          await ref.set(appData);
        }
      } catch (e) {
        console.warn("Firebase load error:", e);
      }
    }

    async function saveToFirebase() {
      try {
        const ref = getFamilyDocRef();
        if (!ref) return;
        const incompleteExists = appData.rounds.some(r => Object.values(r.scores || {}).some(arr => arr.includes(null)));
        if (incompleteExists) {
          console.warn("Skipped Firebase sync: incomplete round present.");
          return;
        }
        await ref.set(appData);
      } catch (e) {
        console.warn("Firebase save error:", e);
      }
    }

    function showScreen(id) {
      document.querySelectorAll("main section").forEach(s => s.classList.add("hidden"));
      const el = document.getElementById(id);
      if (el) el.classList.remove("hidden");
    }

    function getPlayer(id) {
      return appData.players.find(p => p.id === id);
    }

    function getPlayerRounds(id) {
      return appData.rounds.filter(r => r.scores && r.scores[id]).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    function computeHandicap(id) {
      const rounds = getPlayerRounds(id).slice(-10);
      if (!rounds.length) return 0;
      const diffs = rounds.map(r => r.scores[id].reduce((a, b) => a + b, 0) - COURSE_PAR);
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      return Number(avg.toFixed(1));
    }

    function getHandicapTimeline(id) {
      const rounds = getPlayerRounds(id);
      const timeline = [];
      for (let i = 0; i < rounds.length; i++) {
        const slice = rounds.slice(Math.max(0, i - 9), i + 1);
        const diffs = slice.map(r => r.scores[id].reduce((a, b) => a + b, 0) - COURSE_PAR);
        const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        timeline.push({ date: new Date(rounds[i].date), handicap: Number(avg.toFixed(1)) });
      }
      return timeline;
    }

    function getHoleStatsForPlayer(pid, holeIdx) {
      const rounds = getPlayerRounds(pid);
      const holeScores = rounds.map(r => r.scores[pid][holeIdx]).filter(v => v !== null && v !== undefined);
      const last10HoleScores = holeScores.slice(-10);
      const avg = holeScores.length ? holeScores.reduce((a, b) => a + b, 0) / holeScores.length : null;
      const avg10 = last10HoleScores.length ? last10HoleScores.reduce((a, b) => a + b, 0) / last10HoleScores.length : null;
      const birdies = holeScores.filter(v => v < PAR).length;
      const bogeys = holeScores.filter(v => v > PAR).length;
      let currentBogeyFreeStreak = 0;
      for (let i = rounds.length - 1; i >= 0; i--) {
        const score = rounds[i].scores[pid][holeIdx];
        if (score === null || score === undefined || score > PAR) break;
        currentBogeyFreeStreak++;
      }
      return {
        avg,
        avg10,
        birdiePct: holeScores.length ? (birdies / holeScores.length) * 100 : null,
        bogeyPct: holeScores.length ? (bogeys / holeScores.length) * 100 : null,
        bogeyFreeHoleStreak: currentBogeyFreeStreak
      };
    }

    function getBestBogeyFreeStreak(pid) {
      const rounds = getPlayerRounds(pid);
      let best = 0;
      let current = 0;
      rounds.forEach(r => {
        r.scores[pid].forEach(score => {
          if (score <= PAR) {
            current++;
            if (current > best) best = current;
          } else {
            current = 0;
          }
        });
      });
      return best;
    }

    function getCurrentBogeyFreeStreak(pid) {
      const rounds = getPlayerRounds(pid);
      const allScores = [];

      // include historical rounds
      rounds.forEach(r => {
        r.scores[pid].forEach(score => {
          if (score !== null && score !== undefined) allScores.push(score);
        });
      });

      // include current round (live gameplay)
      if (currentRound && currentRound.scores[pid]) {
        currentRound.scores[pid].forEach(score => {
          if (score !== null && score !== undefined) allScores.push(score);
        });
      }

      let streak = 0;
      for (let i = allScores.length - 1; i >= 0; i--) {
        if (allScores[i] <= PAR) streak++;
        else break;
      }
      return streak;
    }

    function getHoleDifficultyData(pid = "all") {
      const holeStats = Array(HOLES).fill(null).map((_, i) => ({ hole: i + 1, name: HOLE_NAMES[i], scores: [] }));
      appData.rounds.forEach(r => {
        Object.keys(r.scores).forEach(playerId => {
          if (pid !== "all" && playerId !== pid) return;
          r.scores[playerId].forEach((score, i) => {
            if (score !== null) holeStats[i].scores.push(score);
          });
        });
      });
      const data = holeStats.map(h => {
        const avg = h.scores.length ? h.scores.reduce((a, b) => a + b, 0) / h.scores.length : null;
        const diff = avg === null ? null : avg - PAR;
        return { ...h, avg, diff };
      });
      const ranked = data.filter(h => h.diff !== null).slice().sort((a, b) => b.diff - a.diff);
      const handicapMap = {};
      ranked.forEach((h, idx) => { handicapMap[h.hole] = idx + 1; });
      data.forEach(h => { h.handicap = handicapMap[h.hole] || null; });
      return data;
    }

    function renderPlayers() {
      const ul = document.getElementById("playersList");
      if (!appData.players.length) {
        ul.innerHTML = "<li>No players yet.</li>";
        return;
      }
      ul.innerHTML = appData.players.map(p => {
        const hc = computeHandicap(p.id);
        const hcText = hc > 0 ? `+${hc.toFixed(1)}` : hc.toFixed(1);
        return `<li>${p.name}<span class="pill">hcp ${hcText}</span></li>`;
      }).join("");
    }

    function renderPlayerSelection() {
      const ul = document.getElementById("playerSelectList");
      if (!appData.players.length) {
        ul.innerHTML = "<li>No players yet.</li>";
        return;
      }
      ul.innerHTML = appData.players.map(p => `
        <li>
          <label style="display:flex;justify-content:space-between;align-items:center;">
            <span>${p.name}</span>
            <input type="checkbox" value="${p.id}">
          </label>
        </li>
      `).join("");
    }

    function updateCourseFilterOptions() {
      const select = document.getElementById("courseFilter");
      const current = select.value || "all";
      select.innerHTML = `<option value="all">Everyone</option>${appData.players.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}`;
      if ([...select.options].some(o => o.value === current)) select.value = current;
    }

    function updateSaveButtonState() {
      const btn = document.getElementById("btnFinishRoundBottom");
      if (!currentRound) {
        btn.disabled = true;
        btn.style.opacity = "0.4";
        return;
      }
      const allFilled = currentRound.playerIds.every(pid => currentRound.scores[pid].every(s => s !== null));
      btn.disabled = !allFilled;
      btn.style.opacity = allFilled ? "1" : "0.4";
    }

    function renderRound() {
      if (!currentRound) return;
      const h = currentRound.currentHole;
      const hIndex = h - 1;
      const difficulty = getHoleDifficultyData("all");
      const holeHcp = difficulty[hIndex]?.handicap || "-";
      const roundHoleLabel = document.getElementById("roundHoleLabel");
      const holeTitle = document.getElementById("holeTitle");
      const banner = document.getElementById("roundScoreBanner");
      const container = document.getElementById("scoreButtonsContainer");
      roundHoleLabel.textContent = `Hole ${h}/${HOLES} · HCP ${holeHcp}`;
      const courseName = h <= 10 ? "Barred Owl" : "Great Horned Owl";
      holeTitle.textContent = `${courseName} · ${HOLE_NAMES[h - 1]} (Par ${PAR}) — ${HOLE_DESCRIPTIONS[h - 1]}`;
      let bannerHtml = "";
      currentRound.playerIds.forEach(pid => {
        const scores = currentRound.scores[pid];
        const played = scores.filter(v => v !== null);
        const total = played.reduce((a, b) => a + b, 0);
        const diff = played.length ? total - played.length * PAR : 0;
        bannerHtml += `<div>${getPlayer(pid).name}: ${total || 0} (${fmtDiff(diff)})</div>`;
      });
      banner.innerHTML = bannerHtml || "No scores yet.";
      container.innerHTML = "";
      currentRound.playerIds.forEach(pid => {
        const row = document.createElement("div");
        row.className = "player-row";
        const stats = getHoleStatsForPlayer(pid, hIndex);
        const header = document.createElement("div");
        header.className = "player-header-row";
        const collapseStats = currentRound.playerIds.length > 1;
        const isExpanded = !!expandedPlayerStats[pid];
        if (collapseStats) row.classList.add("compact");

        const nameBtn = document.createElement("button");
        nameBtn.className = "player-name-btn";
        nameBtn.textContent = getPlayer(pid).name;
        nameBtn.type = "button";
        nameBtn.onclick = () => {
          if (!collapseStats) return;
          expandedPlayerStats[pid] = !expandedPlayerStats[pid];
          renderRound();
        };
        header.appendChild(nameBtn);
        row.appendChild(header);

        const statsInline = document.createElement("div");
        statsInline.className = `inline-stats${collapseStats && !isExpanded ? " collapsed" : ""}`;
        statsInline.innerHTML = `
          Avg:${stats.avg !== null ? stats.avg.toFixed(2) : "-"} |
          L10:${stats.avg10 !== null ? stats.avg10.toFixed(2) : "-"} |
          HoleStreak:${stats.bogeyFreeHoleStreak} |
          CurrStreak:${getCurrentBogeyFreeStreak(pid)} |
          Birdie%:${stats.birdiePct !== null ? stats.birdiePct.toFixed(1) + "%" : "-"} |
          Bogey%:${stats.bogeyPct !== null ? stats.bogeyPct.toFixed(1) + "%" : "-"}
        `;
        header.appendChild(statsInline);
        const btnRow = document.createElement("div");
        btnRow.className = "score-buttons";
        [1, 2, 3, 4, 5].forEach(num => {
          const btn = document.createElement("button");
          btn.textContent = num;
          if (currentRound.scores[pid][hIndex] === num) btn.classList.add("selected");
          btn.onclick = () => {
            currentRound.scores[pid][hIndex] = num;
            renderRound();
            updateSaveButtonState();
            renderScorecard();
            const allPlayersScored = currentRound.playerIds.every(pid2 => currentRound.scores[pid2][hIndex] !== null);
            if (allPlayersScored && currentRound.currentHole < HOLES) {
              setTimeout(() => {
                currentRound.currentHole++;
                renderRound();
                updateSaveButtonState();
                renderScorecard();
              }, 300);
            }
          };
          btnRow.appendChild(btn);
        });
        row.appendChild(btnRow);
        container.appendChild(row);
      });
      container.classList.add("fade-in");
      setTimeout(() => container.classList.remove("fade-in"), 250);
      updateSaveButtonState();
    }

    function renderScorecard() {
      if (!currentRound) return;
      const container = document.getElementById("scorecardTableContainer");
      if (!container) return;
      container.innerHTML = "";
      const table = document.createElement("table");
      let headerHtml = "<tr><th>Player</th>";
      for (let i = 1; i <= HOLES; i++) headerHtml += `<th>${i}</th>`;
      headerHtml += "<th>Total</th><th>±</th></tr>";
      table.innerHTML = headerHtml;
      currentRound.playerIds.forEach(pid => {
        const player = getPlayer(pid);
        const scores = currentRound.scores[pid];
        let rowHtml = `<tr><td>${player ? player.name : "Player"}</td>`;
        scores.forEach((s, idx) => {
          let cls = "scorecell";
          if (s === 1) cls += " ace";
          else if (s === 2) cls += " birdie";
          else if (s !== null && s > PAR) cls += " bogey";
          rowHtml += `<td class="${cls}" data-player="${pid}" data-hole="${idx}">${s ?? "-"}</td>`;
        });
        const playedScores = scores.filter(v => v !== null);
        const playedCount = playedScores.length;
        let displayTotal = "-";
        let displayDiff = "-";
        if (playedCount > 0) {
          const partialTotal = playedScores.reduce((a, b) => a + b, 0);
          const expectedPar = playedCount * PAR;
          const partialDiff = partialTotal - expectedPar;
          displayTotal = partialTotal;
          displayDiff = fmtDiff(partialDiff);
        }
        rowHtml += `<td>${displayTotal}</td><td>${displayDiff}</td></tr>`;
        table.innerHTML += rowHtml;
      });
      container.appendChild(table);
    }

    function handleOrientation() {
      if (!currentRound) return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const visibleSection = document.querySelector("main section:not(.hidden)");
      const currentId = visibleSection ? visibleSection.id : null;
      if (isLandscape) {
        if (currentId === "screen-round" || currentId === "screen-scorecard") {
          renderScorecard();
          showScreen("screen-scorecard");
        }
      } else if (currentId === "screen-scorecard") {
        showScreen("screen-round");
      }
    }

    async function finalizeRound() {
      if (!currentRound) return;
      const allFilled = currentRound.playerIds.every(pid => currentRound.scores[pid].every(s => s !== null));
      if (!allFilled) {
        alert("Please enter a score for every hole for every player.");
        return;
      }
      if (editModeRoundId) {
        const idx = appData.rounds.findIndex(r => r.id === editModeRoundId);
        if (idx >= 0) appData.rounds[idx] = currentRound;
      } else {
        appData.rounds.push(currentRound);
      }
      saveLocal();
      await saveToFirebase();
      renderSummary(currentRound);
      currentRound = null;
      editModeRoundId = null;
      showScreen("screen-summary");
    }

    function renderSummary(round) {
      const div = document.getElementById("summaryContent");
      const date = new Date(round.date).toLocaleString();
      let html = `<div><strong>${date}</strong></div>`;
      let bestDiff = null;
      let winners = [];
      round.playerIds.forEach(pid => {
        const scores = round.scores[pid];
        const total = scores.reduce((a, b) => a + b, 0);
        const diff = total - COURSE_PAR;
        if (bestDiff === null || diff < bestDiff) {
          bestDiff = diff;
          winners = [getPlayer(pid).name];
        } else if (diff === bestDiff) {
          winners.push(getPlayer(pid).name);
        }
        const front = scores.slice(0, 10).reduce((a, b) => a + b, 0);
        const back = scores.slice(10).reduce((a, b) => a + b, 0);
        html += `<div style="margin-top:6px;"><strong>${getPlayer(pid).name}</strong>: ${total} (${fmtDiff(diff)})<br>Front (Barred Owl): ${front} · Back (Great Horned): ${back}</div>`;
      });
      html += `<div style="margin-top:10px;">🏆 Winner: ${winners.join(", ")}</div>`;
      div.innerHTML = html;
    }

    function renderHistory() {
      const div = document.getElementById("historyContent");
      if (!appData.rounds.length) {
        div.innerHTML = "<p>No rounds yet.</p>";
        return;
      }
      div.innerHTML = appData.rounds.slice().reverse().map(r => {
        const date = new Date(r.date).toLocaleString();
        let playersHtml = "";
        Object.keys(r.scores).forEach(pid => {
          const scores = r.scores[pid];
          const total = scores.reduce((a, b) => a + b, 0);
          const diff = total - COURSE_PAR;
          playersHtml += `${getPlayer(pid)?.name ?? "Player"}: ${total} (${fmtDiff(diff)})<br>`;
        });
        return `<div class="history-card"><strong>${date}</strong><br>${playersHtml}<button class="btn-small" onclick="editRound('${r.id}')">Edit</button><button class="btn-small btn-secondary" onclick="deleteRound('${r.id}')">Delete</button></div>`;
      }).join("");
    }

    window.deleteRound = async function(id) {
      if (!confirm("Delete round?")) return;
      appData.rounds = appData.rounds.filter(r => r.id !== id);
      saveLocal();
      await saveToFirebase();
      renderHistory();
    };

    window.editRound = function(id) {
      const r = appData.rounds.find(x => x.id === id);
      if (!r) return;
      editModeRoundId = id;
      currentRound = JSON.parse(JSON.stringify(r));
      renderRound();
      handleOrientation();
      showScreen("screen-round");
    };

    function computeAnalytics(pid) {
      const rounds = getPlayerRounds(pid);
      if (!rounds.length) return null;
      const totals = [];
      const frontTotals = [];
      const backTotals = [];
      let totalCareerPutts = 0;
      rounds.forEach(r => {
        const scores = r.scores[pid];
        const front = scores.slice(0, 10).reduce((a, b) => a + b, 0);
        const back = scores.slice(10).reduce((a, b) => a + b, 0);
        const total = front + back;
        frontTotals.push(front);
        backTotals.push(back);
        totals.push(total);
        totalCareerPutts += total;
      });
      const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
      const avgFront = frontTotals.reduce((a, b) => a + b, 0) / frontTotals.length;
      const avgBack = backTotals.reduce((a, b) => a + b, 0) / backTotals.length;
      return {
        rounds: rounds.length,
        avg: Number(avgTotal.toFixed(1)),
        avgFront: Number(avgFront.toFixed(1)),
        avgBack: Number(avgBack.toFixed(1)),
        best: Math.min(...totals),
        worst: Math.max(...totals),
        handicap: computeHandicap(pid),
        totalPutts: totalCareerPutts,
        bestBogeyFreeStreak: getBestBogeyFreeStreak(pid),
        currentBogeyFreeStreak: getCurrentBogeyFreeStreak(pid)
      };
    }

    function renderAnalyticsPlayerList() {
      const ul = document.getElementById("analyticsPlayerList");
      if (!appData.players.length) {
        ul.innerHTML = "<li>No players yet.</li>";
        return;
      }
      ul.innerHTML = appData.players.map(p => `<li style="padding:6px 0;cursor:pointer;" onclick="showAnalytics('${p.id}')">${p.name}</li>`).join("");
    }

    window.showAnalytics = function(pid) {
      const info = computeAnalytics(pid);
      const div = document.getElementById("analyticsResults");
      const canvas = document.getElementById("handicapChart");
      if (!info) {
        div.innerHTML = "<p>No rounds yet for this player.</p>";
        canvas.style.display = "none";
        return;
      }
      const hcText = info.handicap > 0 ? `+${info.handicap.toFixed(1)}` : info.handicap.toFixed(1);
      div.innerHTML = `
        <p><strong>${getPlayer(pid).name}</strong></p>
        <p>Rounds Played: ${info.rounds}</p>
        <p>Total Career Putts: ${info.totalPutts}</p>
        <p>Average Score: ${info.avg.toFixed(1)}</p>
        <p>Front 10 Avg: ${info.avgFront.toFixed(1)}</p>
        <p>Back 10 Avg: ${info.avgBack.toFixed(1)}</p>
        <p>Best Round: ${info.best}</p>
        <p>Worst Round: ${info.worst}</p>
        <p>Handicap: ${hcText}</p>
        <p>Best Bogey-Free Streak: ${info.bestBogeyFreeStreak} holes</p>
        <p>Current Bogey-Free Streak: ${info.currentBogeyFreeStreak} holes</p>
      `;
      const timeline = getHandicapTimeline(pid);
      if (!timeline.length) {
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "block";
      const labels = timeline.map(t => t.date.toLocaleDateString());
      const data = timeline.map(t => t.handicap);
      if (handicapChartInstance) handicapChartInstance.destroy();
      handicapChartInstance = new Chart(canvas, {
        type: "line",
        data: { labels, datasets: [{ label: "Handicap", data, borderWidth: 3, tension: 0.3, pointRadius: 3 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
      });
    };

    function generateLeaderboards() {
      const rounds = appData.rounds;
      const results = [];
      rounds.forEach(r => {
        Object.keys(r.scores).forEach(pid => {
          const player = getPlayer(pid)?.name ?? "Player";
          const scores = r.scores[pid];
          const total = scores.reduce((a, b) => a + b, 0);
          const diffTotal = total - COURSE_PAR;
          const front = scores.slice(0, 10).reduce((a, b) => a + b, 0);
          const diffFront = front - (10 * PAR);
          const back = scores.slice(10).reduce((a, b) => a + b, 0);
          const diffBack = back - (10 * PAR);
          results.push({ player, date: new Date(r.date), total, diffTotal, front, diffFront, back, diffBack });
        });
      });
      return {
          function getTopWithTies(arr, key, limit = 15) {
  const sorted = arr.slice().sort((a, b) => a[key] - b[key]);
  if (sorted.length <= limit) return sorted;
  const cutoffValue = sorted[limit - 1][key];
  return sorted.filter(item => item[key] <= cutoffValue);
}

function generateLeaderboards() {
  const results = [];
  appData.rounds.forEach(r => {
    Object.keys(r.scores).forEach(pid => {
      const player = getPlayer(pid)?.name ?? "Player";
      const scores = r.scores[pid];
      const total = scores.reduce((a, b) => a + b, 0);
      const diffTotal = total - COURSE_PAR;
      const front = scores.slice(0, 10).reduce((a, b) => a + b, 0);
      const diffFront = front - (10 * PAR);
      const back = scores.slice(10).reduce((a, b) => a + b, 0);
      const diffBack = back - (10 * PAR);
      results.push({ player, date: new Date(r.date), total, diffTotal, front, diffFront, back, diffBack });
    });
  });

  return {
    overall: getTopWithTies(results, "total", 15),
    barred: getTopWithTies(results, "front", 15),
    horned: getTopWithTies(results, "back", 15)
  };
}
     
      };
    }

    function renderLeaderboards() {
      const data = generateLeaderboards();
      document.getElementById("leaderboardOverall").innerHTML = "<h3>🏆 Best Combined (20 holes)</h3>" + (data.overall.length ? "<ol>" + data.overall.map(r => `<li>${r.player}: ${r.total} (${fmtDiff(r.diffTotal)}) — ${r.date.toLocaleDateString()}</li>`).join("") + "</ol>" : "<p>No rounds yet.</p>");
      document.getElementById("leaderboardBarred").innerHTML = "<h3>🦅 Barred Owl (Front 10)</h3>" + (data.barred.length ? "<ol>" + data.barred.map(r => `<li>${r.player}: ${r.front} (${fmtDiff(r.diffFront)}) — ${r.date.toLocaleDateString()}</li>`).join("") + "</ol>" : "<p>No rounds yet.</p>");
      document.getElementById("leaderboardHorned").innerHTML = "<h3>🦉 Great Horned (Back 10)</h3>" + (data.horned.length ? "<ol>" + data.horned.map(r => `<li>${r.player}: ${r.back} (${fmtDiff(r.diffBack)}) — ${r.date.toLocaleDateString()}</li>`).join("") + "</ol>" : "<p>No rounds yet.</p>");
    }

    function renderCourseAnalytics() {
      const container = document.getElementById("courseAnalyticsContainer");
      const filter = document.getElementById("courseFilter")?.value || "all";
      container.innerHTML = "";
      if (!appData.rounds.length) {
        container.innerHTML = "<p>No rounds recorded yet.</p>";
        return;
      }
      const difficultyData = getHoleDifficultyData(filter).slice().sort((a, b) => (b.diff ?? -999) - (a.diff ?? -999));
      let html = "<table><tr><th>Rank</th><th>#</th><th>Hole</th><th>Avg</th><th>Δ</th><th>HCP</th></tr>";
      difficultyData.forEach((h, idx) => {
        html += `<tr><td>${idx + 1}</td><td>${h.hole}</td><td>${h.name}</td><td>${h.avg !== null ? h.avg.toFixed(2) : "-"}</td><td>${h.diff !== null ? fmtDiff(h.diff) : "-"}</td><td>${h.handicap ?? "-"}</td></tr>`;
      });
      html += "</table>";
      container.innerHTML = html;
    }

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
        console.warn("CSV share failed, falling back to download:", e);
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

    function exportBackupJSON() {
      const json = JSON.stringify(appData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backyard-putting-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    function importBackupJSON(file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.players || !data.rounds) {
            alert("Invalid backup file.");
            return;
          }
          appData = data;
          saveLocal();
          await saveToFirebase();
          alert("Backup restored successfully!");
          renderPlayers();
          updateCourseFilterOptions();
          showScreen("screen-home");
        } catch (e) {
          console.error(e);
          alert("Error reading backup file.");
        }
      };
      reader.readAsText(file);
    }

    function preventDoubleTapZoom() {
      let lastTouchEnd = 0;
      document.addEventListener("touchend", e => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
      }, { passive: false });
    }

    document.addEventListener("change", e => {
      if (e.target && e.target.id === "courseFilter") renderCourseAnalytics();
    });

    function initButtons() {
      document.getElementById("btnHomeStart").onclick = () => {
        renderPlayerSelection();
        showScreen("screen-select-players");
      };
      document.getElementById("btnHomePlayers").onclick = () => {
        renderPlayers();
        showScreen("screen-players");
      };
      document.getElementById("btnHomeHistory").onclick = () => {
        renderHistory();
        showScreen("screen-history");
      };
      document.getElementById("btnHomeAnalytics").onclick = () => {
        renderAnalyticsPlayerList();
        document.getElementById("analyticsResults").innerHTML = "";
        document.getElementById("handicapChart").style.display = "none";
        showScreen("screen-analytics");
      };
      document.getElementById("btnHomeLeaderboard").onclick = () => {
        renderLeaderboards();
        showScreen("screen-leaderboards");
      };
      document.getElementById("btnHomeCourseAnalytics").onclick = () => {
        updateCourseFilterOptions();
        renderCourseAnalytics();
        showScreen("screen-course-analytics");
      };
      document.getElementById("btnHomeCourseMap").onclick = () => showScreen("screen-course-map");
      document.getElementById("btnBackFromCourseMap").onclick = () => showScreen("screen-home");
      document.getElementById("btnHomeExport").onclick = exportCSV;
      document.getElementById("btnExportJSON").onclick = exportBackupJSON;
      document.getElementById("btnImportBackup").onclick = () => document.getElementById("backupFileInput").click();
      document.getElementById("backupFileInput").onchange = e => {
        const file = e.target.files[0];
        if (file) importBackupJSON(file);
      };
      document.getElementById("btnAddPlayer").onclick = async () => {
        const input = document.getElementById("playerNameInput");
        const name = input.value.trim();
        if (!name) return;
        appData.players.push({ id: "p_" + Date.now(), name });
        input.value = "";
        saveLocal();
        await saveToFirebase();
        renderPlayers();
        updateCourseFilterOptions();
      };
      document.getElementById("btnBackFromPlayers").onclick = () => showScreen("screen-home");
      document.getElementById("btnBackFromSelect").onclick = () => showScreen("screen-home");
      document.getElementById("btnBackFromHistory").onclick = () => showScreen("screen-home");
      document.getElementById("btnBackFromAnalytics").onclick = () => showScreen("screen-home");
      document.getElementById("btnBackFromLeaderboards").onclick = () => showScreen("screen-home");
      document.getElementById("btnBackFromCourseAnalytics").onclick = () => showScreen("screen-home");
      document.getElementById("btnStartRoundFromSelection").onclick = () => {
        const ids = [...document.querySelectorAll("#playerSelectList input:checked")].map(cb => cb.value);
        if (!ids.length) {
          alert("Select at least one player.");
          return;
        }
        currentRound = { id: "r_" + Date.now(), date: new Date().toISOString(), playerIds: ids.slice(), currentHole: 1, scores: Object.fromEntries(ids.map(id => [id, Array(HOLES).fill(null)])) };
        editModeRoundId = null;
        expandedPlayerStats = {};
        renderRound();
        handleOrientation();
        showScreen("screen-round");
      };
      document.getElementById("btnPrevHole").onclick = () => {
        if (!currentRound) return;
        currentRound.currentHole = Math.max(1, currentRound.currentHole - 1);
        renderRound();
        renderScorecard();
      };
      document.getElementById("btnNextHole").onclick = () => {
        if (!currentRound) return;
        currentRound.currentHole = Math.min(HOLES, currentRound.currentHole + 1);
        renderRound();
        renderScorecard();
      };
      document.getElementById("btnFinishRoundBottom").onclick = finalizeRound;
      document.getElementById("btnBackFromRound").onclick = () => {
        if (confirm("Cancel this round? Unsaved changes will be lost.")) {
          currentRound = null;
          editModeRoundId = null;
          showScreen("screen-home");
        }
      };
      document.getElementById("btnSummaryDone").onclick = () => showScreen("screen-home");
      document.addEventListener("click", e => {
        if (!currentRound || !e.target.classList.contains("scorecell")) return;
        const pid = e.target.dataset.player;
        const holeIdx = parseInt(e.target.dataset.hole, 10);
        if (!pid || Number.isNaN(holeIdx)) return;
        const existing = currentRound.scores[pid][holeIdx];
        const input = prompt(`Score for ${getPlayer(pid)?.name || "Player"} on Hole ${holeIdx + 1}:`, existing ?? "");
        if (input === null) return;
        const val = parseInt(input, 10);
        if (!Number.isInteger(val) || val < 1 || val > 10) return;
        currentRound.scores[pid][holeIdx] = val;
        renderScorecard();
        renderRound();
        updateSaveButtonState();
      });
      let touchStartX = 0;
      document.addEventListener("touchstart", e => {
        if (!e.changedTouches || !e.changedTouches.length) return;
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      document.addEventListener("touchend", e => {
        if (!currentRound || !e.changedTouches || !e.changedTouches.length) return;
        const dx = e.changedTouches[0].screenX - touchStartX;
        if (dx > 60) {
          currentRound.currentHole = Math.max(1, currentRound.currentHole - 1);
          renderRound();
          renderScorecard();
        } else if (dx < -60) {
          currentRound.currentHole = Math.min(HOLES, currentRound.currentHole + 1);
          renderRound();
          renderScorecard();
        }
      }, { passive: true });
      window.addEventListener("orientationchange", handleOrientation);
      window.addEventListener("resize", handleOrientation);
    }

    initAccessGate();
    loadLocal();
    renderPlayers();
    updateCourseFilterOptions();
    showScreen("screen-home");
    initButtons();
    preventDoubleTapZoom();
    initFirebase();
