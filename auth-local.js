
"use strict";

/*
  BATTLE-ON v1.7 LOCAL

  Modo de demonstração SEM autenticação real.
  Não coleta nem armazena senhas.

  - Cadastro local de MC e organizador
  - Seleção de conta local
  - Manter conectado neste aparelho
  - Sair
  - Navegação conforme tipo de perfil
  - Confirmação de e-mail e recuperação:
    indisponíveis até integrar um servidor

  IMPORTANTE:
  Os controles de acesso são apenas visuais.
  Não protegem os dados contra manipulação.
*/

(() => {
  const USERS_KEY = "battle-on-local-users-v1";
  const REMEMBER_KEY = "battle-on-local-remember-v1";
  const SESSION_KEY = "battle-on-local-session-v1";

  const $ = id => document.getElementById(id);

  const adminPages = new Set([
    "config",
    "mcs",
    "chave",
    "arena",
    "historico"
  ]);

  const blockedIds = new Set([
    "config-form",
    "mc-form",
    "team-form",
    "draw-btn",
    "reset-bracket",
    "new-event",
    "save-votes",
    "finish-battle",
    "timer-start",
    "timer-reset"
  ]);

  let users = readUsers();
  let activeUser = null;
  let screen = "login";
  let role = "mc";

  function readUsers() {
    try {
      const value = JSON.parse(
        localStorage.getItem(USERS_KEY) || "[]"
      );

      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveUsers() {
    try {
      localStorage.setItem(
        USERS_KEY,
        JSON.stringify(users)
      );
      return true;
    } catch {
      alert(
        "Não foi possível salvar os perfis neste navegador."
      );
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
    );
  }

  function newId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2)
    );
  }

  function remember() {
    return localStorage.getItem(
      REMEMBER_KEY
    ) === "yes";
  }

  function storedSession() {
    return (
      sessionStorage.getItem(SESSION_KEY) ||
      (
        remember()
          ? localStorage.getItem(SESSION_KEY)
          : null
      )
    );
  }

  function saveSession(userId, persistent) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    localStorage.setItem(
      REMEMBER_KEY,
      persistent ? "yes" : "no"
    );

    const destination = persistent
      ? localStorage
      : sessionStorage;

    destination.setItem(
      SESSION_KEY,
      userId
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  const style = document.createElement("style");

  style.textContent = `
    #battle-local-auth {
      position:fixed;
      inset:0;
      z-index:9999;
      display:flex;
      align-items:center;
      justify-content:center;
      overflow:auto;
      padding:20px;
      box-sizing:border-box;
      background:
        radial-gradient(
          circle at 85% 15%,
          #58192a 0,
          transparent 38%
        ),
        repeating-linear-gradient(
          -35deg,
          transparent 0 24px,
          #ffffff04 25px 26px
        ),
        #0b0b0e;
      color:#fff;
      font-family:Arial,Helvetica,sans-serif;
    }

    #battle-local-auth[hidden] {
      display:none !important;
    }

    .bla-card {
      width:min(100%,450px);
      box-sizing:border-box;
      padding:30px;
      background:#17161b;
      border:1px solid #6d2c3e;
      border-radius:10px;
      box-shadow:7px 7px 0 #070609;
    }

    .bla-brand {
      text-align:center;
      margin-bottom:22px;
    }

    .bla-brand h1 {
      margin:0;
      color:#fff;
      font:44px Impact,Arial,sans-serif;
      letter-spacing:2px;
    }

    .bla-brand h1 span {
      color:#ef405c;
    }

    .bla-brand small {
      display:block;
      margin-top:5px;
      font-size:10px;
      letter-spacing:2px;
      color:#b9a9b1;
    }

    .bla-tag {
      display:inline-block;
      padding:6px 10px;
      margin-top:12px;
      background:#3b202a;
      border:1px solid #824056;
      border-radius:4px;
      color:#ffb2c0;
      font-size:10px;
      font-weight:800;
      letter-spacing:1px;
    }

    .bla-tabs {
      display:flex;
      gap:8px;
      margin-bottom:20px;
    }

    .bla-tabs button {
      flex:1;
      padding:12px 8px;
      background:#29252d;
      color:#ddd;
      border:1px solid #51404a;
      border-radius:5px;
      cursor:pointer;
      font-weight:800;
    }

    .bla-tabs button.active {
      background:#c42d4a;
      border-color:#f04461;
      color:#fff;
    }

    .bla-field {
      display:block;
      margin-bottom:15px;
      font-size:12px;
      font-weight:800;
      color:#eee;
    }

    .bla-field input,
    .bla-field select {
      display:block;
      width:100%;
      box-sizing:border-box;
      margin-top:7px;
      padding:13px;
      border:1px solid #58434e;
      border-radius:5px;
      outline:none;
      background:#0e0e13;
      color:#fff;
      font-size:14px;
    }

    .bla-field input:focus,
    .bla-field select:focus {
      border-color:#f04461;
    }

    .bla-check {
      display:flex;
      gap:9px;
      align-items:center;
      margin:14px 0;
      font-size:12px;
      color:#ddd;
      cursor:pointer;
    }

    .bla-check input {
      width:16px;
      height:16px;
      accent-color:#ef405c;
    }

    .bla-button {
      width:100%;
      padding:14px;
      border:0;
      border-radius:5px;
      background:#d52e4e;
      color:#fff;
      font-weight:900;
      letter-spacing:1px;
      cursor:pointer;
    }

    .bla-button:hover {
      background:#ed405f;
    }

    .bla-link {
      display:inline-block;
      padding:9px 0;
      background:none;
      border:0;
      color:#ff8ca1;
      text-decoration:underline;
      cursor:pointer;
      font-size:12px;
    }

    .bla-note {
      margin:14px 0;
      padding:12px;
      background:#2a2028;
      border-left:3px solid #e73757;
      color:#d9cbd2;
      font-size:12px;
      line-height:1.6;
    }

    .bla-message {
      min-height:18px;
      margin-top:12px;
      color:#ffc0cc;
      font-size:12px;
      line-height:1.5;
    }

    .bla-userbar {
      display:flex;
      align-items:center;
      justify-content:flex-end;
      flex-wrap:wrap;
      gap:10px;
      margin:10px 18px;
      padding:11px 13px;
      border:1px solid #563341;
      border-radius:5px;
      background:#1b171e;
      color:#fff;
      font-size:12px;
    }

    .bla-userbar strong {
      color:#ff8399;
    }

    .bla-userbar button {
      padding:9px 13px;
      border:0;
      border-radius:4px;
      background:#b52c47;
      color:#fff;
      cursor:pointer;
      font-weight:bold;
    }

    .bla-role-note {
      margin:10px 18px;
      padding:10px 12px;
      border-left:3px solid #e73757;
      background:#292028;
      color:#d9cbd2;
      font-size:12px;
      line-height:1.5;
    }

    @media(max-width:480px) {
      .bla-card {
        padding:22px;
      }

      .bla-brand h1 {
        font-size:37px;
      }
    }
  `;

  document.head.appendChild(style);

  const auth = document.createElement("div");
  auth.id = "battle-local-auth";

  document.body.appendChild(auth);

  function showMessage(text) {
    const el = $("bla-message");

    if (el) {
      el.textContent = text;
    }
  }

  function header() {
    return `
      <div class="bla-brand">
        <h1>BATTLE-<span>ON</span></h1>
        <small>SUA ARENA. SUA HISTÓRIA.</small>
        <span class="bla-tag">
          MODO LOCAL DE DEMONSTRAÇÃO
        </span>
      </div>
    `;
  }

  function renderAuth() {
    document.body.classList.remove(
      "battle-local-ready"
    );

    auth.hidden = false;

    const registering = screen === "register";

    auth.innerHTML = `
      <div class="bla-card">
        ${header()}

        <div class="bla-tabs">
          <button
            type="button"
            data-screen="login"
            class="${!registering ? "active" : ""}">
            ENTRAR
          </button>

          <button
            type="button"
            data-screen="register"
            class="${registering ? "active" : ""}">
            CRIAR PERFIL
          </button>
        </div>

        ${registering
          ? registerHTML()
          : loginHTML()}

        <div class="bla-message"
          id="bla-message"
          role="status"></div>
      </div>
    `;

    auth.querySelectorAll("[data-screen]")
      .forEach(button => {
        button.addEventListener("click", () => {
          screen = button.dataset.screen;
          renderAuth();
        });
      });

    if (registering) {
      bindRegister();
    } else {
      bindLogin();
    }
  }

  function loginHTML() {
    return `
      <form id="bla-login-form">
        <label class="bla-field">
          Selecione seu perfil neste aparelho

          <select id="bla-account" required>
            <option value="">
              Selecione uma conta local
            </option>

            ${users.map(user => `
              <option value="${escapeHTML(user.id)}">
                ${escapeHTML(user.name)}
                — ${user.role === "mc"
                  ? "MC"
                  : "Organizador"}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="bla-check">
          <input type="checkbox"
            id="bla-remember"
            ${remember() ? "checked" : ""}>
          Manter conectado neste aparelho
        </label>

        <button type="submit"
          class="bla-button">
          ENTRAR NA ARENA
        </button>
      </form>

      <div class="bla-note">
        Este é um acesso local de demonstração,
        sem senha e sem verificação de identidade.
        Não utilize para proteger eventos reais.
      </div>

      <button type="button"
        class="bla-link"
        id="bla-forgot">
        Esqueceu sua senha?
      </button>
    `;
  }

  function registerHTML() {
    return `
      <form id="bla-register-form">
        <label class="bla-field">
          Tipo de perfil

          <select id="bla-role">
            <option value="mc"
              ${role === "mc" ? "selected" : ""}>
              Sou MC
            </option>

            <option value="organizador"
              ${role === "organizador"
                ? "selected"
                : ""}>
              Sou organizador
            </option>
          </select>
        </label>

        <label class="bla-field">
          <span id="bla-name-label">
            ${role === "mc"
              ? "Vulgo do MC"
              : "Nome do organizador"}
          </span>

          <input
            id="bla-name"
            maxlength="80"
            minlength="2"
            required
            autocomplete="off"
            placeholder="${role === "mc"
              ? "Seu vulgo"
              : "Seu nome"}">
        </label>

        <label class="bla-field">
          E-mail

          <input
            id="bla-email"
            type="email"
            maxlength="254"
            required
            autocomplete="off"
            placeholder="email@exemplo.com">
        </label>

        <label class="bla-field"
          id="bla-city-field"
          ${role !== "mc" ? "hidden" : ""}>
          Cidade / bairro

          <input
            id="bla-city"
            maxlength="80"
            placeholder="Sua cidade">
        </label>

        <div class="bla-note">
          O e-mail será apenas registrado
          neste navegador. Ainda não enviamos
          links de confirmação.

          <span id="bla-organizer-note">
            ${role === "organizador"
              ? " A aprovação do desenvolvedor será exigida quando a autenticação real for ativada."
              : ""}
          </span>
        </div>

        <button type="submit"
          class="bla-button">
          CRIAR PERFIL LOCAL
        </button>
      </form>
    `;
  }

  function bindLogin() {
    $("bla-login-form").addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const id = $("bla-account").value;

        const user = users.find(
          item => item.id === id
        );

        if (!user) {
          showMessage(
            "Selecione um perfil existente."
          );
          return;
        }

        saveSession(
          user.id,
          $("bla-remember").checked
        );

        enter(user);
      }
    );

    $("bla-forgot").addEventListener(
      "click",
      () => {
        showMessage(
          "A recuperação de senha por e-mail será disponibilizada quando conectarmos um servidor. Nesta demonstração, não existem senhas."
        );
      }
    );
  }

  function bindRegister() {
    $("bla-role").addEventListener(
      "change",
      event => {
        role = event.target.value;

        $("bla-name-label").textContent =
          role === "mc"
            ? "Vulgo do MC"
            : "Nome do organizador";

        $("bla-name").placeholder =
          role === "mc"
            ? "Seu vulgo"
            : "Seu nome";

        $("bla-city-field").hidden =
          role !== "mc";

        $("bla-organizer-note").textContent =
          role === "organizador"
            ? " A aprovação do desenvolvedor será exigida quando a autenticação real for ativada."
            : "";
      }
    );

    $("bla-register-form").addEventListener(
      "submit",
      event => {
        event.preventDefault();

        const name = $("bla-name").value.trim();

        const email = $("bla-email")
          .value.trim().toLowerCase();

        const city = role === "mc"
          ? $("bla-city").value.trim()
          : "";

        if (name.length < 2) {
          showMessage(
            "Informe um nome com pelo menos dois caracteres."
          );
          return;
        }

        if (
          users.some(
            user => user.email === email
          )
        ) {
          showMessage(
            "Já existe um perfil local com este e-mail."
          );
          return;
        }

        const user = {
          id: newId(),
          name,
          email,
          city,
          role,
          createdAt: new Date().toISOString(),
          emailVerified: false,
          organizerApproved: false
        };

        users.push(user);

        if (!saveUsers()) {
          users.pop();
          return;
        }

        screen = "login";
        renderAuth();

        showMessage(
          "Perfil local criado! Selecione sua conta para entrar. O e-mail não foi verificado e nenhuma aprovação real foi realizada."
        );
      }
    );
  }

  function isOrganizer() {
    return activeUser?.role === "organizador";
  }

  function applyMenu() {
    document.querySelectorAll(
      ".nav-btn[data-page]"
    ).forEach(button => {
      const page = button.dataset.page;

      const visible =
        isOrganizer() ||
        !adminPages.has(page);

      button.hidden = !visible;

      button.style.display =
        visible ? "" : "none";
    });

    document.querySelectorAll(
      '[data-go="config"]'
    ).forEach(button => {
      button.hidden = !isOrganizer();

      button.style.display =
        isOrganizer() ? "" : "none";
    });
  }

  function userBar() {
    let bar = $("battle-local-userbar");

    if (!bar) {
      bar = document.createElement("div");

      bar.id = "battle-local-userbar";
      bar.className = "bla-userbar";

      const topbar = document.querySelector(
        ".topbar"
      );

      if (topbar) {
        topbar.insertAdjacentElement(
          "afterend",
          bar
        );
      }
    }

    bar.innerHTML = `
      <span>
        <strong>
          ${escapeHTML(activeUser.name)}
        </strong>

        · ${isOrganizer()
          ? "ORGANIZADOR (DEMO)"
          : "MC (DEMO)"}
      </span>

      <button type="button"
        id="bla-logout">
        SAIR
      </button>
    `;

    $("bla-logout").addEventListener(
      "click",
      logout
    );

    let note = $("battle-local-note");

    if (!note) {
      note = document.createElement("div");
      note.id = "battle-local-note";
      note.className = "bla-role-note";

      bar.insertAdjacentElement(
        "afterend",
        note
      );
    }

    note.textContent = isOrganizer()
      ? "Modo demonstração: o acesso de organizador não foi aprovado nem autenticado por um servidor."
      : "Modo demonstração: este perfil não tem autenticação real. Os controles administrativos ficam ocultos apenas na interface.";
  }

  function enter(user) {
    activeUser = user;

    auth.hidden = true;

    document.body.classList.add(
      "battle-local-ready"
    );

    applyMenu();
    userBar();

    const destination = isOrganizer()
      ? "dashboard"
      : "ranking";

    if (typeof go === "function") {
      go(destination);
    } else {
      document.querySelector(
        `.nav-btn[data-page="${destination}"]`
      )?.click();
    }
  }

  function logout() {
    clearSession();
    activeUser = null;

    document.body.classList.remove(
      "battle-local-ready"
    );

    const bar = $("battle-local-userbar");
    const note = $("battle-local-note");

    bar?.remove();
    note?.remove();

    screen = "login";
    renderAuth();
  }

  function blockAdminAction(event) {
    if (!activeUser || isOrganizer()) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const restrictedNavigation = target.closest(
      [
        '[data-page="config"]',
        '[data-page="mcs"]',
        '[data-page="chave"]',
        '[data-page="arena"]',
        '[data-page="historico"]',
        '[data-go="config"]'
      ].join(",")
    );

    const restrictedControl = [
      ...blockedIds
    ].some(id => Boolean(
      target.closest(`#${id}`)
    ));

    if (
      restrictedNavigation ||
      restrictedControl
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener(
    "click",
    blockAdminAction,
    true
  );

  document.addEventListener(
    "submit",
    blockAdminAction,
    true
  );

  function init() {
    const id = storedSession();

    const user = users.find(
      item => item.id === id
    );

    if (user) {
      enter(user);
    } else {
      clearSession();
      renderAuth();
    }
  }

  init();
})();
