
"use strict";

/* BATTLE-ON v1.6 — Ranking geral, temporadas e perfis */
(() => {
  const KEY = "battle-on-ranking-v1";
  const $r = id => document.getElementById(id);

  const safe = value => String(value ?? "")
    .replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const normalize = value => String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

  const defaultSeason = () =>
    String(new Date(state.createdAt || Date.now()).getFullYear());

  const fresh = () => ({
    events: {},
    seasons: {},
    profiles: {}
  });

  let db;

  try {
    db = {
      ...fresh(),
      ...JSON.parse(localStorage.getItem(KEY) || "{}")
    };
  } catch {
    db = fresh();
  }

  db.events ||= {};
  db.seasons ||= {};
  db.profiles ||= {};

  let filterSeason = "geral";
  let filterMode = "individual";
  let selectedMC = "";

  const style = document.createElement("style");

  style.textContent = `
    .rk-controls {
      display:flex;
      gap:12px;
      flex-wrap:wrap;
      align-items:end;
      margin-bottom:18px;
    }

    .rk-controls label {
      display:grid;
      gap:7px;
      flex:1;
      min-width:160px;
      font-weight:700;
      font-size:12px;
    }

    .rk-controls select,
    .rk-controls input {
      width:100%;
      min-width:0;
      padding:12px;
      background:#17171d;
      border:1px solid #51434b;
      color:#fff;
      border-radius:5px;
    }

    .rk-table {
      width:100%;
      border-collapse:collapse;
      text-align:left;
    }

    .rk-table th,
    .rk-table td {
      padding:13px 10px;
      border-bottom:1px solid #42333b;
    }

    .rk-table th {
      font-size:11px;
      color:#d6a9b6;
      letter-spacing:1px;
    }

    .rk-table tr:hover td {
      background:#ffffff08;
    }

    .rk-link {
      border:0;
      background:none;
      color:#fff;
      font-weight:800;
      text-align:left;
      cursor:pointer;
      text-decoration:underline;
      text-decoration-color:#e93655;
      text-underline-offset:4px;
    }

    .rk-scroll {
      overflow-x:auto;
    }

    .rk-small {
      color:#aaa1a8;
      font-size:12px;
    }

    .rk-profile-head {
      display:flex;
      align-items:center;
      gap:20px;
      flex-wrap:wrap;
    }

    .rk-avatar {
      width:110px;
      height:110px;
      object-fit:cover;
      border-radius:12px;
      border:2px solid #ef3a59;
      background:#27232a;
      display:grid;
      place-items:center;
      font-size:55px;
    }

    .rk-metrics {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:12px;
      margin:20px 0;
    }

    .rk-metric {
      background:#1a1920;
      border:1px solid #49343f;
      padding:15px;
      text-align:center;
      border-radius:6px;
    }

    .rk-metric strong {
      display:block;
      font-size:28px;
      color:#fff;
    }

    .rk-metric span {
      font-size:11px;
      color:#b8abb2;
    }

    .rk-history {
      display:grid;
      gap:8px;
      margin-top:12px;
    }

    .rk-result {
      display:flex;
      justify-content:space-between;
      gap:15px;
      padding:12px;
      background:#1b1920;
      border-left:3px solid #ef3a59;
    }

    .rk-note {
      color:#bfb0b8;
      font-size:12px;
      line-height:1.6;
      margin:10px 0;
    }

    @media(max-width:650px) {
      .rk-metrics {
        grid-template-columns:repeat(2,minmax(0,1fr));
      }

      .rk-table th,
      .rk-table td {
        padding:10px 6px;
        font-size:12px;
      }
    }
  `;

  document.head.appendChild(style);

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch {
      notify("Não foi possível salvar os dados do ranking.");
      return false;
    }
  }

  function eventId() {
    const first = state.rounds?.[0]?.matches?.[0]?.id;

    return first
      ? `${state.createdAt || "evento"}:${first}`
      : "";
  }

  function eventFinished() {
    return Boolean(
      state.rounds?.at(-1)?.matches?.[0]?.winner &&
      state.rounds.every(r =>
        r.matches.every(m => m.winner)
      )
    );
  }

  function mode() {
    return Number(state.config.teamSize) === 1
      ? "individual"
      : `equipe-${state.config.teamSize}`;
  }

  function currentSeason() {
    return db.seasons[eventId()] || defaultSeason();
  }

  function person(id) {
    return state.mcs.find(m => m.id === id);
  }

  function members(participantId) {
    if (Number(state.config.teamSize) === 1) {
      const mc = person(participantId);

      return mc
        ? [{ name: mc.name, city: mc.city || "" }]
        : [];
    }

    const team = state.teams.find(
      t => t.id === participantId
    );

    return (team?.members || [])
      .map(id => person(id))
      .filter(Boolean)
      .map(mc => ({
        name: mc.name,
        city: mc.city || ""
      }));
  }

  function snapshot() {
    if (!eventId()) return null;

    const final = state.rounds.at(-1)?.matches?.[0];

    const battles = state.rounds.flatMap(
      (round, ri) => round.matches
        .filter(m => m.winner && !m.bye)
        .map(m => ({
          id: m.id,
          round: round.name,
          final: ri === state.rounds.length - 1,
          a: members(m.a),
          b: members(m.b),
          winner: m.winner === m.a ? "a" : "b"
        }))
    );

    return {
      id: eventId(),
      name: state.config.name,
      season: currentSeason(),
      date: state.createdAt || new Date().toISOString(),
      mode: mode(),
      complete: eventFinished(),
      battles,
      champion: final?.winner
        ? members(final.winner)
        : [],
      runnerUp: final?.winner
        ? members(
            final.winner === final.a
              ? final.b
              : final.a
          )
        : []
    };
  }

  function sync() {
    const current = snapshot();

    if (current?.complete) {
      const before = JSON.stringify(
        db.events[current.id]
      );

      if (before !== JSON.stringify(current)) {
        db.events[current.id] = current;
        persist();
      }
    }

    return current;
  }

  function allEvents() {
    const current = sync();
    const events = Object.values(db.events);

    if (
      current &&
      !current.complete &&
      current.battles.length
    ) {
      events.push(current);
    }

    return events;
  }

  function tally() {
    const result = new Map();
    const seasons = new Set([defaultSeason()]);
    const events = allEvents();

    const get = mc => {
      const key = normalize(mc.name);

      if (!result.has(key)) {
        result.set(key, {
          key,
          name: mc.name,
          city: mc.city ||
            db.profiles[key]?.city || "",
          wins: 0,
          losses: 0,
          titles: 0,
          seconds: 0,
          points: 0,
          history: [],
          seasons: new Set()
        });
      }

      const row = result.get(key);

      if (mc.city) row.city = mc.city;

      return row;
    };

    for (const event of events) {
      seasons.add(event.season);

      if (
        filterSeason !== "geral" &&
        event.season !== filterSeason
      ) {
        continue;
      }

      if (filterMode !== event.mode) continue;

      for (const battle of event.battles) {
        for (const side of ["a", "b"]) {
          const other = side === "a" ? "b" : "a";

          const opponents = battle[other]
            .map(m => m.name)
            .join(" / ");

          for (const mc of battle[side]) {
            const row = get(mc);
            const win = side === battle.winner;

            if (win) {
              row.wins++;
              row.points += 3;
            } else {
              row.losses++;
            }

            row.seasons.add(event.season);

            row.history.push({
              event: event.name,
              season: event.season,
              round: battle.round,
              opponent: opponents,
              win,
              date: event.date
            });
          }
        }
      }

      if (event.complete) {
        for (const mc of event.champion) {
          const row = get(mc);
          row.titles++;
          row.points += 5;
        }

        for (const mc of event.runnerUp) {
          const row = get(mc);
          row.seconds++;
          row.points += 2;
        }
      }
    }

    if (
      filterSeason === "geral" ||
      filterSeason === currentSeason()
    ) {
      if (filterMode === mode()) {
        state.mcs.forEach(mc => get(mc));
      }
    }

    return {
      rows: [...result.values()].sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          b.titles - a.titles ||
          a.name.localeCompare(b.name)
      ),

      seasons: [...seasons].sort(
        (a, b) =>
          b.localeCompare(
            a,
            "pt-BR",
            { numeric: true }
          )
      )
    };
  }

  function controls() {
    const data = tally();

    return `
      <div class="rk-controls">
        <label>
          Classificação

          <select id="rk-season">
            <option value="geral">
              Ranking geral (todas as temporadas)
            </option>

            ${data.seasons.map(s => `
              <option value="${safe(s)}"
                ${filterSeason === s ? "selected" : ""}>
                Temporada ${safe(s)}
              </option>
            `).join("")}
          </select>
        </label>

        <label>
          Modalidade

          <select id="rk-mode">
            <option value="individual"
              ${filterMode === "individual" ? "selected" : ""}>
              Individual
            </option>

            ${[
              2, 3, 4, 5, 6, 7, 8, 9, 10,
              11, 12, 13, 14, 15, 16,
              17, 18, 19, 20
            ].map(n => `
              <option value="equipe-${n}"
                ${filterMode === `equipe-${n}`
                  ? "selected"
                  : ""}>
                ${n === 2
                  ? "Duplas"
                  : n === 3
                    ? "Trios"
                    : `Equipes de ${n}`}
              </option>
            `).join("")}
          </select>
        </label>
      </div>
    `;
  }

  function renderRanking() {
    const target = $r("ranking-content");

    if (!target) return;

    const { rows } = tally();

    target.innerHTML = `
      <div class="panel">
        ${controls()}

        <div class="rk-scroll">
          <table class="rk-table">
            <thead>
              <tr>
                <th>POS.</th>
                <th>MC</th>
                <th>V</th>
                <th>D</th>
                <th>TÍTULOS</th>
                <th>PONTOS</th>
              </tr>
            </thead>

            <tbody>
              ${rows.length
                ? rows.map((r, i) => `
                  <tr>
                    <td>
                      ${i === 0
                        ? "🥇"
                        : i === 1
                          ? "🥈"
                          : i === 2
                            ? "🥉"
                            : i + 1 + "º"}
                    </td>

                    <td>
                      <button class="rk-link"
                        data-mc="${safe(r.key)}">
                        ${safe(r.name)}
                      </button>

                      <div class="rk-small">
                        ${safe(r.city)}
                      </div>
                    </td>

                    <td>${r.wins}</td>
                    <td>${r.losses}</td>
                    <td>${r.titles}</td>
                    <td><strong>${r.points}</strong></td>
                  </tr>
                `).join("")
                : `
                  <tr>
                    <td colspan="6">
                      Nenhum resultado registrado
                      nesta classificação.
                    </td>
                  </tr>
                `}
            </tbody>
          </table>
        </div>

        <p class="rk-note">
          Pontuação: vitória +3 · campeão +5 · vice +2.
          Empates na pontuação são ordenados por
          vitórias e títulos. As modalidades são separadas.
        </p>
      </div>
    `;

    wireControls(target);

    target.querySelectorAll("[data-mc]").forEach(
      button => button.addEventListener("click", () => {
        selectedMC = button.dataset.mc;
        go("perfis");
        renderProfiles();
      })
    );
  }

  function wireControls(target) {
    target.querySelector("#rk-season")
      ?.addEventListener("change", e => {
        filterSeason = e.target.value;
        renderRanking();
        renderProfiles();
      });

    target.querySelector("#rk-mode")
      ?.addEventListener("change", e => {
        filterMode = e.target.value;
        selectedMC = "";
        renderRanking();
        renderProfiles();
      });
  }

  function renderProfiles() {
    const target = $r("perfis-content");

    if (!target) return;

    const { rows } = tally();

    if (!rows.some(r => r.key === selectedMC)) {
      selectedMC = rows[0]?.key || "";
    }

    const mc = rows.find(
      r => r.key === selectedMC
    );

    const profile = db.profiles[selectedMC] || {};

    const games = mc
      ? mc.wins + mc.losses
      : 0;

    target.innerHTML = `
      <div class="panel">
        ${controls()}

        <div class="rk-controls">
          <label>
            Selecionar MC

            <select id="rk-person">
              ${rows.map(r => `
                <option value="${safe(r.key)}"
                  ${r.key === selectedMC
                    ? "selected"
                    : ""}>
                  ${safe(r.name)}
                </option>
              `).join("")}
            </select>
          </label>
        </div>

        ${mc ? `
          <div class="rk-profile-head">
            ${profile.photo
              ? `
                <img class="rk-avatar"
                  src="${profile.photo}"
                  alt="Foto de ${safe(mc.name)}">
              `
              : `
                <div class="rk-avatar">🎤</div>
              `}

            <div>
              <h2>${safe(mc.name)}</h2>

              <p class="rk-small">
                📍 ${safe(
                  mc.city || "Cidade não informada"
                )}
              </p>

              <label class="btn secondary"
                style="display:inline-block;cursor:pointer;margin-top:10px">
                📷 ${profile.photo
                  ? "TROCAR FOTO"
                  : "ADICIONAR FOTO"}

                <input type="file"
                  id="rk-photo"
                  accept="image/*"
                  hidden>
              </label>

              ${profile.photo
                ? `
                  <button class="btn danger"
                    id="rk-remove-photo"
                    type="button">
                    REMOVER FOTO
                  </button>
                `
                : ""}
            </div>
          </div>

          <div class="rk-metrics">
            ${[
              ["Batalhas", games],
              ["Vitórias", mc.wins],
              ["Derrotas", mc.losses],
              ["Títulos", mc.titles],
              ["Vice-campeonatos", mc.seconds],
              [
                "Aproveitamento",
                games
                  ? (mc.wins / games * 100).toFixed(1) + "%"
                  : "0%"
              ],
              ["Pontos", mc.points]
            ].map(([label, value]) => `
              <div class="rk-metric">
                <strong>${value}</strong>
                <span>${label}</span>
              </div>
            `).join("")}
          </div>

          <h3>HISTÓRICO DE CONFRONTOS</h3>

          <div class="rk-history">
            ${mc.history.length
              ? [...mc.history].reverse().map(h => `
                <div class="rk-result">
                  <div>
                    <strong>${safe(h.event)}</strong>

                    <div class="rk-small">
                      Temporada ${safe(h.season)}
                      · ${safe(h.round)}
                      · VS ${safe(h.opponent)}
                    </div>
                  </div>

                  <strong style="color:${
                    h.win ? "#42d49a" : "#ff637a"
                  }">
                    ${h.win ? "VITÓRIA" : "DERROTA"}
                  </strong>
                </div>
              `).join("")
              : `
                <p class="rk-note">
                  Este MC ainda não tem confrontos
                  registrados nesta classificação.
                </p>
              `}
          </div>
        ` : `
          <p class="rk-note">
            Cadastre participantes ou selecione
            outra temporada e modalidade.
          </p>
        `}
      </div>
    `;

    wireControls(target);

    target.querySelector("#rk-person")
      ?.addEventListener("change", e => {
        selectedMC = e.target.value;
        renderProfiles();
      });

    target.querySelector("#rk-remove-photo")
      ?.addEventListener("click", () => {
        if (!confirm(
          "Remover a foto deste perfil?"
        )) return;

        delete db.profiles[selectedMC]?.photo;

        persist();
        renderProfiles();
      });

    target.querySelector("#rk-photo")
      ?.addEventListener("change", async e => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
          return notify(
            "Selecione uma imagem válida."
          );
        }

        const key = selectedMC;

        try {
          const photo = await shrinkPhoto(file);

          db.profiles[key] ||= {};
          db.profiles[key].photo = photo;

          if (persist()) {
            renderProfiles();
            notify("Foto do perfil salva!");
          }
        } catch {
          notify(
            "Não foi possível processar a foto."
          );
        }
      });
  }

  function shrinkPhoto(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);

        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;

        const ctx = canvas.getContext("2d");

        if (!ctx) return reject();

        const side = Math.min(
          img.width,
          img.height
        );

        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          320,
          320
        );

        resolve(
          canvas.toDataURL("image/jpeg", 0.76)
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };

      img.src = url;
    });
  }

  function installSeason() {
    const config = $r("config-form");
    const holder = document.createElement("div");

    holder.className = "full";

    holder.innerHTML = `
      <div class="panel"
        style="margin:0;padding:16px">

        <h3>♛ TEMPORADA DO EVENTO</h3>

        <p class="rk-note">
          Ex.: 2026, Temporada 1 ou Circuito de Inverno.
          A temporada identifica esta edição no ranking.
        </p>

        <div class="rk-controls">
          <label>
            Temporada atual

            <input id="rk-current-season"
              maxlength="40"
              placeholder="2026">
          </label>

          <button class="btn secondary"
            id="rk-save-season"
            type="button">
            SALVAR TEMPORADA
          </button>
        </div>
      </div>
    `;

    config.appendChild(holder);

    $r("rk-current-season").value =
      currentSeason();

    $r("rk-save-season")
      .addEventListener("click", () => {
        const season = $r("rk-current-season")
          .value.trim();

        if (!season) {
          return notify(
            "Informe o nome da temporada."
          );
        }

        const key = eventId();

        if (!key) {
          return notify(
            "Realize o sorteio antes de vincular a temporada."
          );
        }

        db.seasons[key] = season;

        if (db.events[key]) {
          db.events[key].season = season;
        }

        persist();
        renderRanking();
        renderProfiles();

        notify("Temporada salva!");
      });
  }

  function refresh() {
    sync();

    $r("rk-current-season").value =
      currentSeason();

    renderRanking();
    renderProfiles();
  }

  document.querySelectorAll(
    '[data-page="ranking"],[data-page="perfis"]'
  ).forEach(button => {
    button.addEventListener("click", () => {
      $r("page-title").textContent =
        button.dataset.page === "ranking"
          ? "Ranking dos MCs"
          : "Perfil dos MCs";

      refresh();
    });
  });

  new MutationObserver(refresh).observe(
    $r("champion-box"),
    {
      childList: true,
      subtree: true
    }
  );

  const originalGo = go;

  go = function(page) {
    originalGo(page);

    if (
      page === "ranking" ||
      page === "perfis"
    ) {
      $r("page-title").textContent =
        page === "ranking"
          ? "Ranking dos MCs"
          : "Perfil dos MCs";

      refresh();
    }
  };

  installSeason();

  filterMode = mode();

  refresh();
})();
