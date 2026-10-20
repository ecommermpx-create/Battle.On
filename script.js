
"use strict";

// BATTLE-ON v1.2.1
// Controle de rounds por tempo ou quantidade de versos

const STORAGE_KEY = "battle-on-v1";
const OLD_KEY = "batalha-on-v1";
const $ = id => document.getElementById(id);

function initialState() {
  return {
    config: {
      name: "BATTLE-ON",
      teamSize: 1,
      mode: "ambos",
      judgeCount: 3,
      judgeWeight: 50,
      roundTime: 45,
      roundMode: "tempo",
      verseLimit: 8
    },
    mcs: [],
    teams: [],
    rounds: [],
    currentBattle: null,
    history: [],
    createdAt: new Date().toISOString()
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(OLD_KEY);

    if (!raw) return initialState();

    const data = JSON.parse(raw);

    if (!data || !Array.isArray(data.mcs) ||
        !Array.isArray(data.teams) ||
        !Array.isArray(data.rounds)) {
      throw Error("Dados inválidos");
    }

    data.config = {
      ...initialState().config,
      ...data.config
    };

    // Compatibilidade com os dados da versão anterior.
    if (data.config.rhymeLimit !== undefined &&
        (!data.config.verseLimit ||
         data.config.verseLimit === 8)) {
      data.config.verseLimit = data.config.rhymeLimit;
    }

    data.history ||= [];

    data.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (!match.verseCount) {
          match.verseCount = match.rhymeCount
            ? { ...match.rhymeCount }
            : { a: 0, b: 0 };
        }
        match.tiebreaks ||= [];
      });
    });

    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
    }

    return data;
  } catch {
    alert("Não foi possível recuperar os dados salvos.");
    return initialState();
  }
}

let state = loadState();
let timerSeconds = state.config.roundTime;
let timerInterval = null;
let toastTimeout = null;
let selectedPhase = 0;
let timerDeadline = null;

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    alert("Erro ao salvar dados no navegador.");
    return false;
  }
}

function id() {
  return globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    $("toast").classList.remove("show");
  }, 3500);
}

function hasDraw() {
  return state.rounds.length > 0;
}

function findMC(mid) {
  return state.mcs.find(m => m.id === mid);
}

function participantName(pid) {
  if (pid === null || pid === undefined) return "A definir";

  if (state.config.teamSize === 1) {
    return findMC(pid)?.name || "MC não encontrado";
  }

  return state.teams.find(t => t.id === pid)?.name ||
    "Equipe não encontrada";
}

function participants() {
  return state.config.teamSize === 1
    ? state.mcs.map(m => m.id)
    : state.teams.map(t => t.id);
}

function allMatches() {
  return state.rounds.flatMap(r => r.matches);
}

function findMatch(mid) {
  return allMatches().find(m => m.id === mid);
}

function matchReady(m) {
  return !!(m && m.a !== null && m.b !== null &&
    !m.winner && !m.bye);
}

function roundName(index, total) {
  const n = 2 ** (total - index);

  if (n === 2) return "Final";
  if (n === 4) return "Semifinal";
  if (n === 8) return "Quartas de final";
  if (n === 16) return "Oitavas de final";
  if (n === 32) return "16 avos de final";

  return `Rodada ${index + 1}`;
}

// ==========================================
// MENU RESPONSIVO
// ==========================================

function openMenu() {
  $("sidebar").classList.add("open");
  $("overlay").classList.add("show");
  document.body.classList.add("menu-open");
}

function closeMenu() {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
  document.body.classList.remove("menu-open");
}

$("open-menu").addEventListener("click", openMenu);
$("close-menu").addEventListener("click", closeMenu);
$("overlay").addEventListener("click", closeMenu);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeMenu();
});

function go(page) {
  document.querySelectorAll(".page").forEach(el => {
    el.classList.toggle("active", el.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-btn").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  const titles = {
    dashboard: "Visão geral",
    config: "Configurações",
    mcs: "Participantes",
    chave: "Chaveamento",
    arena: "Arena e votação",
    historico: "Histórico"
  };

  $("page-title").textContent = titles[page] || "BATTLE-ON";

  closeMenu();
  window.scrollTo(0, 0);

  if (page === "arena") renderArena();
}

document.querySelectorAll("[data-page]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(b => {
  b.addEventListener("click", () => go(b.dataset.go));
});

// ==========================================
// CONFIGURAÇÕES DE ROUND
// ==========================================

function installRoundSettings() {
  const timeLabel = $("round-time").closest("label");

  const container = document.createElement("div");
  container.className = "full";
  container.id = "round-settings";

  container.innerHTML = `
    <div style="
      background:#101117;
      border:1px solid #30323e;
      border-radius:12px;
      padding:20px;
    ">
      <h3 style="
        color:#f02e43;
        font-size:26px;
        margin-bottom:15px;
      ">CONTROLE DE ROUNDS</h3>

      <label>Tipo de contagem
        <select id="round-mode">
          <option value="tempo">Por tempo</option>
          <option value="versos">Por quantidade de versos</option>
        </select>
      </label>

      <div id="verse-settings" style="margin-top:17px">
        <label>Quantidade de versos por MC/equipe
          <input
            id="verse-limit"
            type="number"
            min="1"
            max="1000"
            step="1"
            value="8"
          >
        </label>

        <p class="muted" style="margin-top:10px">
          Cada lado terá seu próprio contador de versos.
          A votação continuará decidindo o vencedor.
        </p>
      </div>
    </div>
  `;

  timeLabel.after(container);

  $("round-mode").addEventListener("change", updateRoundFields);
}

function updateRoundFields() {
  const mode = $("round-mode").value;
  const locked = hasDraw();

  $("round-time").closest("label").style.display =
    mode === "tempo" ? "flex" : "none";

  $("verse-settings").style.display =
    mode === "versos" ? "block" : "none";

  $("round-mode").disabled = locked;
  $("verse-limit").disabled = locked;
}

function renderConfig() {
  const c = state.config;

  $("event-name").value = c.name;
  $("team-size").value = c.teamSize;
  $("vote-mode").value = c.mode;
  $("judge-count").value = c.judgeCount;
  $("judge-weight").value = c.judgeWeight;
  $("round-time").value = c.roundTime;
  $("round-mode").value =
    c.roundMode === "rimas" ? "versos" : c.roundMode;
  $("verse-limit").value = c.verseLimit;

  document.querySelectorAll(
    "#config-form input,#config-form select"
  ).forEach(el => el.disabled = hasDraw());

  $("config-form").querySelector('[type="submit"]')
    .disabled = hasDraw();

  $("judge-count").disabled =
    hasDraw() || c.mode === "publico";

  $("judge-weight").disabled =
    hasDraw() || c.mode !== "ambos";

  updateRoundFields();
}

$("vote-mode").addEventListener("change", () => {
  const mode = $("vote-mode").value;

  $("judge-count").disabled = mode === "publico";
  $("judge-weight").disabled = mode !== "ambos";
});

$("config-form").addEventListener("submit", e => {
  e.preventDefault();

  if (hasDraw()) {
    return notify("Apague a chave para alterar as regras.");
  }

  const c = {
    name: $("event-name").value.trim(),
    teamSize: Number($("team-size").value),
    mode: $("vote-mode").value,
    judgeCount: Number($("judge-count").value),
    judgeWeight: Number($("judge-weight").value),
    roundTime: Number($("round-time").value),
    roundMode: $("round-mode").value,
    verseLimit: Number($("verse-limit").value)
  };

  if (!c.name ||
      !Number.isInteger(c.teamSize) ||
      c.teamSize < 1 || c.teamSize > 20 ||
      !Number.isInteger(c.judgeCount) ||
      c.judgeCount < 1 || c.judgeCount > 50 ||
      !Number.isInteger(c.judgeWeight) ||
      c.judgeWeight < 0 || c.judgeWeight > 100 ||
      !Number.isInteger(c.roundTime) ||
      c.roundTime < 10 || c.roundTime > 3600 ||
      !Number.isInteger(c.verseLimit) ||
      c.verseLimit < 1 || c.verseLimit > 1000 ||
      !["tempo", "versos"].includes(c.roundMode)) {
    return notify("Revise os valores informados.");
  }

  if (state.config.teamSize !== c.teamSize &&
      state.teams.length) {
    if (!confirm("A alteração apagará as equipes. Continuar?")) {
      return;
    }
    state.teams = [];
  }

  state.config = c;

  stopTimer();
  timerSeconds = c.roundTime;

  save();
  renderAll();
  notify("Configurações salvas!");
});

$("new-event").addEventListener("click", () => {
  if (!confirm("Apagar todo o evento e seus resultados?")) return;
  if (!confirm("Esta ação não pode ser desfeita. Confirmar?")) return;

  stopTimer();

  state = initialState();
  timerSeconds = state.config.roundTime;
  selectedPhase = 0;

  save();
  renderAll();
  go("dashboard");
});

// ==========================================
// CADASTRO DE PARTICIPANTES
// ==========================================

$("mc-form").addEventListener("submit", e => {
  e.preventDefault();

  if (hasDraw()) return notify("O sorteio já foi realizado.");

  const name = $("mc-name").value.trim();
  const city = $("mc-city").value.trim();

  if (!name) return notify("Informe o nome do MC.");

  if (state.mcs.some(m =>
    m.name.toLowerCase() === name.toLowerCase())) {
    return notify("Este MC já está cadastrado.");
  }

  state.mcs.push({ id: id(), name, city });

  $("mc-form").reset();
  save();
  renderAll();
  notify("MC cadastrado!");
});

function removeMC(mid) {
  if (hasDraw()) return;
  if (!confirm("Remover este MC?")) return;

  state.mcs = state.mcs.filter(m => m.id !== mid);
  state.teams = state.teams.filter(t => !t.members.includes(mid));

  save();
  renderAll();
}

function removeTeam(tid) {
  if (hasDraw()) return;

  state.teams = state.teams.filter(t => t.id !== tid);

  save();
  renderAll();
}

function renderMCs() {
  $("mc-list").innerHTML = state.mcs.length
    ? state.mcs.map((m, i) => `
      <div class="mc-item">
        <div>
          <strong>${i + 1}. ${esc(m.name)}</strong>
          <small>${esc(m.city || "Cidade não informada")}</small>
        </div>
        <button class="btn danger remove-mc"
          data-id="${m.id}" ${hasDraw() ? "disabled" : ""}>
          REMOVER
        </button>
      </div>
    `).join("")
    : '<div class="empty">Nenhum MC cadastrado.</div>';

  document.querySelectorAll(".remove-mc").forEach(b => {
    b.addEventListener("click", () => removeMC(b.dataset.id));
  });

  const used = new Set(state.teams.flatMap(t => t.members));
  const available = state.mcs.filter(m => !used.has(m.id));

  $("team-form").style.display =
    state.config.teamSize === 1 ? "none" : "block";

  $("team-options").innerHTML = available.length
    ? available.map(m => `
      <label>
        <input type="checkbox" name="team-member"
          value="${m.id}" ${hasDraw() ? "disabled" : ""}>
        ${esc(m.name)}
      </label>
    `).join("")
    : '<span class="muted">Nenhum MC disponível.</span>';

  $("team-form").querySelector('[type="submit"]')
    .disabled = hasDraw();

  $("team-list").innerHTML = state.config.teamSize === 1
    ? '<p class="muted">Modalidade individual: cada MC participa sozinho.</p>'
    : state.teams.length
      ? state.teams.map(t => `
        <div class="mc-item">
          <div>
            <strong>${esc(t.name)}</strong>
            <small>${t.members.map(mid =>
              esc(findMC(mid)?.name || "?")).join(" + ")}</small>
          </div>
          <button class="btn danger remove-team"
            data-id="${t.id}" ${hasDraw() ? "disabled" : ""}>
            REMOVER
          </button>
        </div>
      `).join("")
      : '<div class="empty">Nenhuma equipe formada.</div>';

  document.querySelectorAll(".remove-team").forEach(b => {
    b.addEventListener("click", () => removeTeam(b.dataset.id));
  });
}

$("team-form").addEventListener("submit", e => {
  e.preventDefault();

  if (hasDraw() || state.config.teamSize === 1) return;

  const members = [...document.querySelectorAll(
    'input[name="team-member"]:checked'
  )].map(el => el.value);

  if (members.length !== state.config.teamSize) {
    return notify(`Selecione ${state.config.teamSize} MCs.`);
  }

  const name = $("team-name").value.trim() ||
    members.map(mid => findMC(mid)?.name).join(" & ");

  if (state.teams.some(t =>
    t.name.toLowerCase() === name.toLowerCase())) {
    return notify("Já existe uma equipe com esse nome.");
  }

  state.teams.push({ id: id(), name, members });

  $("team-name").value = "";

  save();
  renderAll();
  notify("Equipe criada!");
});

// ==========================================
// SORTEIO E CHAVEAMENTO
// ==========================================

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    let j;

    if (globalThis.crypto?.getRandomValues) {
      const n = new Uint32Array(1);
      crypto.getRandomValues(n);
      j = n[0] % (i + 1);
    } else {
      j = Math.floor(Math.random() * (i + 1));
    }

    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function makeMatch(a = null, b = null) {
  return {
    id: id(),
    a,
    b,
    winner: null,
    bye: false,
    votes: null,
    tiebreaks: [],
    verseCount: { a: 0, b: 0 }
  };
}

function advanceWinner(ri, mi, winner) {
  const next = state.rounds[ri + 1];
  if (!next) return;

  const target = next.matches[Math.floor(mi / 2)];

  if (mi % 2 === 0) target.a = winner;
  else target.b = winner;
}

function createBracket() {
  const people = participants();

  if (people.length < 2) {
    return notify("Cadastre pelo menos 2 participantes.");
  }

  if (people.length > 256) {
    return notify("Limite de 256 participantes.");
  }

  if (state.config.teamSize > 1) {
    const used = new Set(state.teams.flatMap(t => t.members));

    if (used.size !== state.mcs.length) {
      return notify("Coloque todos os MCs em equipes completas.");
    }
  }

  if (hasDraw() && !confirm(
    "Refazer o sorteio apagará os resultados. Continuar?"
  )) return;

  stopTimer();

  const shuffled = shuffle(people);
  const size = 2 ** Math.ceil(Math.log2(shuffled.length));
  const totalRounds = Math.log2(size);
  const byes = size - shuffled.length;

  state.rounds = [];
  state.history = [];
  state.currentBattle = null;

  for (let ri = 0; ri < totalRounds; ri++) {
    const count = size / (2 ** (ri + 1));

    state.rounds.push({
      name: roundName(ri, totalRounds),
      matches: Array.from(
        { length: count },
        () => makeMatch()
      )
    });
  }

  let cursor = 0;

  state.rounds[0].matches.forEach((m, mi) => {
    m.a = shuffled[cursor++];

    if (mi < byes) {
      m.b = null;
      m.winner = m.a;
      m.bye = true;
      advanceWinner(0, mi, m.a);
    } else {
      m.b = shuffled[cursor++];
    }
  });

  selectedPhase = 0;
  timerSeconds = state.config.roundTime;

  save();
  renderAll();
  go("chave");
  notify("Sorteio realizado!");
}

$("draw-btn").addEventListener("click", createBracket);

$("reset-bracket").addEventListener("click", () => {
  if (!hasDraw()) return notify("Não existe chaveamento.");

  if (!confirm("Apagar toda a chave e seus resultados?")) return;

  stopTimer();

  state.rounds = [];
  state.history = [];
  state.currentBattle = null;
  selectedPhase = 0;
  timerSeconds = state.config.roundTime;

  save();
  renderAll();
});

function renderBracket() {
  $("phase-select").innerHTML = state.rounds.map((r, i) =>
    `<option value="${i}">${esc(r.name)}</option>`
  ).join("");

  if (selectedPhase >= state.rounds.length) selectedPhase = 0;

  $("phase-select").value = String(selectedPhase);

  $("bracket").innerHTML = hasDraw()
    ? state.rounds.map((r, ri) => `
      <div class="round ${ri === selectedPhase ? "mobile-active" : ""}">
        <h3>${esc(r.name)}</h3>

        ${r.matches.map((m, mi) => `
          <div class="match-card">
            <div class="match-head">CONFRONTO ${mi + 1}</div>

            ${["a", "b"].map(side => {
              const p = m[side];

              const cls = m.winner
                ? m.winner === p && p !== null
                  ? "winner" : "loser"
                : "";

              return `
                <div class="match-player ${cls}">
                  ${esc(participantName(p))}
                </div>
              `;
            }).join("")}

            <div class="match-footer">
              ${m.bye ? "Avanço automático" :
                m.winner ? "Finalizado" :
                matchReady(m) ? "Aguardando batalha" :
                "Aguardando classificados"}
            </div>
          </div>
        `).join("")}
      </div>
    `).join("")
    : '<div class="empty">Realize o sorteio para gerar a chave.</div>';

  $("draw-btn").textContent = hasDraw()
    ? "⚡ REFAZER SORTEIO"
    : "⚡ REALIZAR SORTEIO";

  $("reset-bracket").disabled = !hasDraw();
}

$("phase-select").addEventListener("change", e => {
  selectedPhase = Number(e.target.value);

  document.querySelectorAll(".round").forEach((el, i) => {
    el.classList.toggle("mobile-active", i === selectedPhase);
  });
});

// ==========================================
// CONTROLE DE ROUND
// ==========================================

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerDeadline = null;
}

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:` +
    `${String(s % 60).padStart(2, "0")}`;
}

function renderTimer() {
  $("timer-display").textContent = formatTime(timerSeconds);
  $("timer-display").classList.toggle("ended", timerSeconds === 0);
}

function installVerseCounter() {
  const timer = document.querySelector(".timer");

  const container = document.createElement("div");
  container.id = "verse-counter";

  container.style.cssText = `
    border-top:1px solid #30323e;
    padding:25px 0;
    text-align:center;
  `;

  timer.after(container);
}

function changeVerse(side, amount) {
  const match = findMatch(state.currentBattle);

  if (!matchReady(match)) return;

  match.verseCount ||= { a: 0, b: 0 };

  const limit = state.config.verseLimit;
  const current = match.verseCount[side] || 0;

  match.verseCount[side] = Math.max(
    0,
    Math.min(limit, current + amount)
  );

  save();
  renderVerseCounter();
}

function renderVerseCounter() {
  const container = $("verse-counter");

  if (!["versos", "rimas"].includes(state.config.roundMode)) {
    container.style.display = "none";
    document.querySelector(".timer").style.display = "block";
    return;
  }

  document.querySelector(".timer").style.display = "none";
  container.style.display = "block";

  const match = findMatch(state.currentBattle);

  if (!matchReady(match)) {
    container.innerHTML =
      '<div class="empty">Selecione uma batalha.</div>';
    return;
  }

  match.verseCount ||= { a: 0, b: 0 };

  const limit = state.config.verseLimit;

  container.innerHTML = `
    <h3 style="
      font-size:27px;
      color:#f02e43;
      margin-bottom:8px;
    ">CONTAGEM DE VERSOS</h3>

    <p class="muted">
      ${limit} versos por MC/equipe
    </p>

    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
      gap:15px;
      margin-top:20px;
    ">
      ${["a", "b"].map(side => {
        const count = match.verseCount[side];
        const done = count >= limit;

        return `
          <div style="
            background:#101117;
            border:1px solid ${done ? "#2fd79c" : "#30323e"};
            border-radius:12px;
            padding:20px;
            min-width:0;
          ">
            <div style="
              font-size:15px;
              font-weight:800;
              overflow-wrap:anywhere;
            ">${esc(participantName(match[side]))}</div>

            <div style="
              font-family:Impact,sans-serif;
              font-size:55px;
              margin:12px 0;
              color:${done ? "#2fd79c" : "#fff"};
            ">
              ${count}
              <span style="font-size:22px;color:#999ba9">
                / ${limit}
              </span>
            </div>

            <div style="
              display:flex;
              justify-content:center;
              gap:10px;
            ">
              <button class="btn secondary verse-change"
                data-side="${side}" data-amount="-1"
                ${count === 0 ? "disabled" : ""}>
                −1
              </button>

              <button class="btn primary verse-change"
                data-side="${side}" data-amount="1"
                ${done ? "disabled" : ""}>
                +1 VERSO
              </button>
            </div>

            ${done ? `
              <div style="
                color:#2fd79c;
                font-weight:800;
                margin-top:14px;
              ">✓ VERSOS CONCLUÍDOS</div>
            ` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.querySelectorAll(".verse-change").forEach(button => {
    button.addEventListener("click", () => {
      changeVerse(
        button.dataset.side,
        Number(button.dataset.amount)
      );
    });
  });
}

$("timer-start").addEventListener("click", () => {
  if (!matchReady(findMatch(state.currentBattle))) {
    return notify("Selecione uma batalha.");
  }

  if (timerInterval) {
    timerSeconds = Math.max(
      0,
      Math.ceil((timerDeadline - Date.now()) / 1000)
    );
    stopTimer();
    renderTimer();
    return;
  }

  if (timerSeconds === 0) {
    timerSeconds = state.config.roundTime;
  }

  timerDeadline = Date.now() + timerSeconds * 1000;

  timerInterval = setInterval(() => {
    timerSeconds = Math.max(
      0,
      Math.ceil((timerDeadline - Date.now()) / 1000)
    );

    renderTimer();

    if (timerSeconds === 0) {
      stopTimer();
      notify("Tempo encerrado!");
    }
  }, 100);
});

$("timer-reset").addEventListener("click", () => {
  stopTimer();
  timerSeconds = state.config.roundTime;
  renderTimer();
});

// ==========================================
// ARENA E VOTAÇÃO
// ==========================================

function emptyVotes() {
  return {
    judges: Array(state.config.judgeCount).fill("empate"),
    publicA: 0,
    publicB: 0
  };
}

function renderBattleSelect() {
  const available = allMatches().filter(matchReady);

  if (!available.some(m => m.id === state.currentBattle)) {
    state.currentBattle = available[0]?.id || null;
  }

  $("battle-select").innerHTML = available.length
    ? available.map(m => `
      <option value="${m.id}"
        ${m.id === state.currentBattle ? "selected" : ""}>
        ${esc(participantName(m.a))}
        VS
        ${esc(participantName(m.b))}
      </option>
    `).join("")
    : '<option value="">Nenhuma batalha disponível</option>';
}

$("battle-select").addEventListener("change", e => {
  stopTimer();

  state.currentBattle = e.target.value || null;
  timerSeconds = state.config.roundTime;

  save();
  renderArena();
});

function renderArena() {
  renderBattleSelect();

  const m = findMatch(state.currentBattle);

  $("arena-match").innerHTML = m
    ? `
      <div class="fighter">${esc(participantName(m.a))}</div>
      <div class="vs">VS</div>
      <div class="fighter">${esc(participantName(m.b))}</div>
    `
    : '<div class="empty">Nenhuma batalha disponível.</div>';

  $("voting-panel").style.display = m ? "block" : "none";
  $("timer-start").disabled = !m;
  $("timer-reset").disabled = !m;

  renderTimer();
  renderVerseCounter();

  if (!m) return;

  const c = state.config;
  const votes = m.votes || emptyVotes();

  let html = "";

  if (c.mode !== "publico") {
    html += "<h3>VOTOS DOS JURADOS</h3>";

    for (let i = 0; i < c.judgeCount; i++) {
      html += `
        <div class="vote-row">
          <strong>JURADO ${i + 1}</strong>
          <div class="vote-choice">
            ${[
              ["a", participantName(m.a)],
              ["b", participantName(m.b)],
              ["empate", "Empate / abstenção"]
            ].map(([value, label]) => `
              <label>
                <input type="radio"
                  name="judge-${i}"
                  value="${value}"
                  ${(votes.judges?.[i] || "empate") === value
                    ? "checked" : ""}>
                ${esc(label)}
              </label>
            `).join("")}
          </div>
        </div>
      `;
    }
  }

  if (c.mode !== "jurados") {
    html += `
      <h3 style="margin-top:25px">VOTOS DO PÚBLICO</h3>
      <p class="muted">
        Registre a quantidade de votos de cada lado.
      </p>

      <div class="vote-grid">
        <label>${esc(participantName(m.a))}
          <input id="public-a"
            type="number" min="0" step="1"
            value="${votes.publicA ?? 0}">
        </label>

        <label>${esc(participantName(m.b))}
          <input id="public-b"
            type="number" min="0" step="1"
            value="${votes.publicB ?? 0}">
        </label>
      </div>
    `;
  }

  $("vote-fields").innerHTML = html;

  $("vote-result").innerHTML = m.tiebreaks?.length
    ? `<div class="warning-box">
        Desempate ${m.tiebreaks.length}:
        registre uma nova votação.
      </div>`
    : "";
}

function readVotes() {
  const c = state.config;
  const judges = [];

  if (c.mode !== "publico") {
    for (let i = 0; i < c.judgeCount; i++) {
      const selected = document.querySelector(
        `input[name="judge-${i}"]:checked`
      );

      if (!selected) {
        throw Error(`Informe o voto do jurado ${i + 1}.`);
      }

      judges.push(selected.value);
    }
  }

  if (c.mode !== "jurados" &&
      ($("public-a").value.trim() === "" ||
       $("public-b").value.trim() === "")) {
    throw Error("Informe os votos do público.");
  }

  const publicA = c.mode === "jurados"
    ? 0 : Number($("public-a").value);

  const publicB = c.mode === "jurados"
    ? 0 : Number($("public-b").value);

  if (![publicA, publicB].every(n =>
    Number.isSafeInteger(n) && n >= 0)) {
    throw Error("Informe quantidades inteiras e válidas.");
  }

  return { judges, publicA, publicB };
}

function calculate(v) {
  const c = state.config;

  const ja = v.judges.filter(x => x === "a").length;
  const jb = v.judges.filter(x => x === "b").length;

  const jt = ja + jb;
  const pt = v.publicA + v.publicB;

  const jw = c.mode === "jurados"
    ? 1
    : c.mode === "publico"
      ? 0
      : c.judgeWeight / 100;

  const pw = 1 - jw;

  if (jw > 0 && jt === 0) {
    throw Error("Faltam votos válidos dos jurados.");
  }

  if (pw > 0 && pt === 0) {
    throw Error("Faltam votos do público.");
  }

  const scoreA =
    (jt ? ja / jt : 0) * jw +
    (pt ? v.publicA / pt : 0) * pw;

  const scoreB =
    (jt ? jb / jt : 0) * jw +
    (pt ? v.publicB / pt : 0) * pw;

  const diff = scoreA - scoreB;

  return {
    scoreA,
    scoreB,
    winnerSide: Math.abs(diff) < 1e-10
      ? null
      : diff > 0 ? "a" : "b",
    judgeA: ja,
    judgeB: jb,
    validPublic: pt
  };
}

$("save-votes").addEventListener("click", () => {
  const m = findMatch(state.currentBattle);

  if (!matchReady(m)) return;

  try {
    m.votes = readVotes();
    save();
    notify("Votos salvos!");
  } catch (e) {
    notify(e.message);
  }
});

$("finish-battle").addEventListener("click", () => {
  const m = findMatch(state.currentBattle);

  if (!matchReady(m)) {
    return notify("Batalha indisponível.");
  }

  let votes, result;

  try {
    votes = readVotes();
    result = calculate(votes);
  } catch (e) {
    return notify(e.message);
  }

  if (result.winnerSide === null) {
    if (!confirm("Empate! Registrar e iniciar desempate?")) {
      return;
    }

    m.tiebreaks ||= [];

    m.tiebreaks.push({
      votes: structuredClone(votes),
      result,
      date: new Date().toISOString()
    });

    m.votes = emptyVotes();
    m.verseCount = { a: 0, b: 0 };

    stopTimer();
    timerSeconds = state.config.roundTime;

    save();
    renderArena();
    notify("Nova votação de desempate aberta.");
    return;
  }

  const winner = m[result.winnerSide];
  const winnerName = participantName(winner);

  if (!confirm(
    `Vencedor calculado: ${winnerName}. Confirmar apuração?`
  )) return;

  const ri = state.rounds.findIndex(r =>
    r.matches.some(x => x.id === m.id)
  );

  const mi = state.rounds[ri].matches.findIndex(
    x => x.id === m.id
  );

  m.winner = winner;
  m.votes = votes;

  state.history.push({
    matchId: m.id,
    round: state.rounds[ri].name,
    a: participantName(m.a),
    b: participantName(m.b),
    winner: winnerName,
    votes: structuredClone(votes),
    result,
    verseCount: structuredClone(
      m.verseCount || { a: 0, b: 0 }
    ),
    tiebreaks: structuredClone(m.tiebreaks || []),
    date: new Date().toISOString()
  });

  advanceWinner(ri, mi, winner);

  stopTimer();
  timerSeconds = state.config.roundTime;
  state.currentBattle = null;

  save();
  renderAll();
  notify(`${winnerName} venceu e avançou!`);
});

// ==========================================
// DASHBOARD E HISTÓRICO
// ==========================================

function renderDashboard() {
  const matches = allMatches();
  const done = matches.filter(m => m.winner && !m.bye);
  const next = matches.find(matchReady);

  $("event-pill").textContent = state.config.name;
  $("stat-mcs").textContent = state.mcs.length;
  $("stat-total").textContent =
    matches.filter(m => !m.bye).length;
  $("stat-done").textContent = done.length;

  const round = state.rounds.find(r =>
    r.matches.some(matchReady)
  );

  $("stat-phase").textContent = round?.name ||
    (hasDraw() ? "Encerrada" : "—");

  $("next-battle").innerHTML = next
    ? `
      <div class="arena-match">
        <div class="fighter">${esc(participantName(next.a))}</div>
        <div class="vs">VS</div>
        <div class="fighter">${esc(participantName(next.b))}</div>
      </div>
      <button id="go-next" class="btn primary">
        ABRIR ARENA →
      </button>
    `
    : '<div class="empty">Nenhum confronto pendente.</div>';

  $("go-next")?.addEventListener("click", () => {
    state.currentBattle = next.id;
    save();
    go("arena");
  });

  const champion = state.rounds.at(-1)?.matches[0]?.winner;

  $("champion-box").innerHTML = champion
    ? `<div class="result-box" style="margin-top:20px">
        🏆 CAMPEÃO: ${esc(participantName(champion))}
      </div>`
    : "";
}

function renderHistory() {
  $("history-list").innerHTML = state.history.length
    ? [...state.history].reverse().map(h => {
      const verses = h.verseCount || h.rhymeCount;

      return `
        <div class="mc-item">
          <div>
            <strong>${esc(h.a)} VS ${esc(h.b)}</strong>
            <small>${esc(h.round)} ·
              ${new Date(h.date).toLocaleString("pt-BR")}
            </small>
            <small>
              Placar:
              ${(h.result.scoreA * 100).toFixed(1)}% ×
              ${(h.result.scoreB * 100).toFixed(1)}%
            </small>
            <small>
              Desempates: ${h.tiebreaks?.length || 0}
            </small>
            ${verses ? `
              <small>
                Versos registrados:
                ${verses.a} × ${verses.b}
              </small>
            ` : ""}
          </div>
          <strong style="color:var(--green)">
            🏆 ${esc(h.winner)}
          </strong>
        </div>
      `;
    }).join("")
    : '<div class="empty">Nenhuma batalha finalizada.</div>';
}

function renderAll() {
  renderConfig();
  renderMCs();
  renderBracket();
  renderDashboard();
  renderHistory();
  renderArena();
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

installRoundSettings();
installVerseCounter();
renderAll();
go("dashboard");
