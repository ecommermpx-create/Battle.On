
"use strict";

/*
  BATTLE-ON v1.7.1
  Correção da tela preta.

  MODO LOCAL DE DEMONSTRAÇÃO.

  Não existe autenticação real nesta versão.
  Não são solicitadas nem armazenadas senhas.
  O papel de organizador não é verificado.
  Os dados continuam no navegador.
*/

(() => {
  const USERS_KEY = "battle-on-local-users-v1";
  const REMEMBER_KEY = "battle-on-local-remember-v1";
  const SESSION_KEY = "battle-on-local-session-v1";

  const $ = id => document.getElementById(id);

  const auth = $("battle-local-auth");
  const content = $("bla-content");

  if (!auth || !content) {
    return;
  }

  let users = [];
  let currentUser = null;
  let currentScreen = "login";
  let selectedRole = "mc";

  const adminPages = [
    "config",
    "mcs",
    "chave",
    "arena",
    "historico"
  ];

  const adminControls = [
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
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  function readUsers() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(USERS_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? saved.filter(user =>
            user &&
            typeof user.id === "string" &&
            typeof user.name === "string" &&
            ["mc", "organizador"].includes(user.role)
          )
        : [];
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
      showMessage(
        "Não foi possível salvar neste navegador."
      );

      return false;
    }
  }

  function getRemember() {
    try {
      return localStorage.getItem(
        REMEMBER_KEY
      ) === "yes";
    } catch {
      return false;
    }
  }

  function getSession() {
    try {
      const temporary = sessionStorage.getItem(
        SESSION_KEY
      );

      if (temporary) {
        return temporary;
      }

      if (getRemember()) {
        return localStorage.getItem(SESSION_KEY);
      }

      return null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Armazenamento indisponível.
    }
  }

  function saveSession(id, persistent) {
    try {
      clearSession();

      localStorage.setItem(
        REMEMBER_KEY,
        persistent ? "yes" : "no"
      );

      if (persistent) {
        localStorage.setItem(SESSION_KEY, id);
      } else {
        sessionStorage.setItem(SESSION_KEY, id);
      }

      return true;
    } catch {
      showMessage(
        "Não foi possível lembrar a conta neste navegador."
      );

      return false;
    }
  }

  function makeId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2)
    );
  }

  function showMessage(text) {
    const element = $("bla-message");

    if (element) {
      element.textContent = text;
    }
  }

  function tabsHTML() {
    return `
      <div class="bla-tabs">
        <button
          type="button"
          id="bla-tab-login"
          class="${currentScreen === "login"
            ? "active"
            : ""}">
          ENTRAR
        </button>

        <button
          type="button"
          id="bla-tab-register"
          class="${currentScreen === "register"
            ? "active"
            : ""}">
          CRIAR PERFIL
        </button>
      </div>
    `;
  }

  function loginHTML() {
    return `
      <form id="bla-login-form">
        <label class="bla-field">
          Perfil neste aparelho

          <select id="bla-account" required>
            <option value="">
              Selecione um perfil
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
          <input
            type="checkbox"
            id="bla-remember"
            ${getRemember() ? "checked" : ""}>
          Manter conectado neste aparelho
        </label>

        <button type="submit" class="bla-button">
          ENTRAR NA ARENA
        </button>
      </form>

      <div class="bla-note">
        Acesso local para testes.
        Não existe verificação de identidade
        ou senha nesta versão.
      </div>

      <button
        type="button"
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
              ${selectedRole === "mc"
                ? "selected"
                : ""}>
              Sou MC
            </option>

            <option value="organizador"
              ${selectedRole === "organizador"
                ? "selected"
                : ""}>
              Sou organizador
            </option>
          </select>
        </label>

        <label class="bla-field">
          <span id="bla-name-label">
            ${selectedRole === "mc"
              ? "Vulgo do MC"
              : "Nome do organizador"}
          </span>

          <input
            id="bla-name"
            type="text"
            minlength="2"
            maxlength="80"
            required
            placeholder="Digite seu nome">
        </label>

        <label class="bla-field">
          E-mail

          <input
            id="bla-email"
            type="email"
            maxlength="254"
            required
            placeholder="seuemail@exemplo.com">
        </label>

        <label
          class="bla-field"
          id="bla-city-field"
          ${selectedRole === "mc"
            ? ""
            : "hidden"}>
          Cidade / bairro

          <input
            id="bla-city"
            maxlength="80"
            placeholder="Sua cidade">
        </label>

        <div class="bla-note">
          O e-mail será registrado apenas
          neste navegador, sem confirmação real.

          <span id="bla-role-note">
            ${selectedRole === "organizador"
              ? " A aprovação do desenvolvedor ainda não está disponível neste modo de demonstração."
              : ""}
          </span>
        </div>

        <button type="submit" class="bla-button">
          CRIAR PERFIL LOCAL
        </button>
      </form>
    `;
  }

  function renderAuth() {
    auth.hidden = false;

    content.innerHTML = `
      ${tabsHTML()}

      ${currentScreen === "register"
        ? registerHTML()
        : loginHTML()}

      <div
        id="bla-message"
        class="bla-message"
        role="status">
      </div>
    `;

    $("bla-tab-login").addEventListener(
      "click",
      () => {
        currentScreen = "login";
        renderAuth();
      }
    );

    $("bla-tab-register").addEventListener(
      "click",
      () => {
        currentScreen = "register";
        renderAuth();
      }
    );

    if (currentScreen === "register") {
      bindRegister();
    } else {
      bindLogin();
    }
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
            "Selecione um perfil cadastrado."
          );
          return;
        }

        const persistent = $("bla-remember").checked;

        if (!saveSession(user.id, persistent)) {
          return;
        }

        enterApp(user);
      }
    );

    $("bla-forgot").addEventListener(
      "click",
      () => {
        showMessage(
          "A recuperação por e-mail será ativada quando tivermos um servidor. Nesta versão local não existem senhas."
        );
      }
    );
  }

  function bindRegister() {
    $("bla-role").addEventListener(
      "change",
      event => {
        selectedRole = event.target.value;

        $("bla-name-label").textContent =
          selectedRole === "mc"
            ? "Vulgo do MC"
            : "Nome do organizador";

        $("bla-city-field").hidden =
          selectedRole !== "mc";

        $("bla-role-note").textContent =
          selectedRole === "organizador"
            ? " A aprovação do desenvolvedor ainda não está disponível neste modo de demonstração."
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

        const city = selectedRole === "mc"
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
            "Este e-mail já possui um perfil local."
          );
          return;
        }

        const user = {
          id: makeId(),
          name,
          email,
          city,
          role: selectedRole,
          createdAt: new Date().toISOString(),
          emailVerified: false,
          organizerApproved: false
        };

        users.push(user);

        if (!saveUsers()) {
          users.pop();
          return;
        }

        currentScreen = "login";
        renderAuth();

        showMessage(
          "Perfil criado! Agora selecione sua conta para entrar. O e-mail ainda não foi confirmado."
        );
      }
    );
  }

  function isOrganizerDemo() {
    return currentUser?.role === "organizador";
  }

  function updateMenu() {
    const organizer = isOrganizerDemo();

    document.querySelectorAll(
      ".nav-btn[data-page]"
    ).forEach(button => {
      const page = button.dataset.page;

      const visible =
        organizer || !adminPages.includes(page);

      button.hidden = !visible;
      button.style.display =
        visible ? "" : "none";
    });

    document.querySelectorAll(
      '[data-go="config"]'
    ).forEach(button => {
      button.hidden = !organizer;
      button.style.display =
        organizer ? "" : "none";
    });
  }

  function updateUserBar() {
    let bar = $("bla-userbar");

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "bla-userbar";
      bar.className = "bla-userbar";

      const topbar = document.querySelector(
        ".topbar"
      );

      if (topbar) {
        topbar.insertAdjacentElement(
          "afterend",
          bar
        );
      } else {
        document.querySelector("main")?.prepend(bar);
      }
    }

    bar.innerHTML = `
      <span>
        <strong>
          ${escapeHTML(currentUser.name)}
        </strong>

        · ${isOrganizerDemo()
          ? "ORGANIZADOR (DEMO)"
          : "MC (DEMO)"}
      </span>

      <button type="button" id="bla-logout">
        SAIR
      </button>
    `;

    $("bla-logout").addEventListener(
      "click",
      logout
    );
  }

  function enterApp(user) {
    currentUser = user;

    auth.hidden = true;

    document.body.classList.add(
      "battle-local-ready"
    );

    updateMenu();
    updateUserBar();

    const destination = isOrganizerDemo()
      ? "dashboard"
      : "ranking";

    // Navegação compatível com o script.js
    // original e com o ranking.js.
    try {
      if (typeof go === "function") {
        go(destination);
      } else {
        document.querySelector(
          `.nav-btn[data-page="${destination}"]`
        )?.click();
      }
    } catch (error) {
      console.warn(
        "A navegação inicial não foi concluída:",
        error
      );
    }
  }

  function logout() {
    clearSession();

    currentUser = null;

    $("bla-userbar")?.remove();

    document.body.classList.remove(
      "battle-local-ready"
    );

    currentScreen = "login";
    renderAuth();
  }

  function blockAdminAction(event) {
    if (!currentUser || isOrganizerDemo()) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const adminNavigation = target.closest(
      [
        '[data-page="config"]',
        '[data-page="mcs"]',
        '[data-page="chave"]',
        '[data-page="arena"]',
        '[data-page="historico"]',
        '[data-go="config"]'
      ].join(",")
    );

    const adminControl = adminControls.some(
      id => target.closest(`#${id}`)
    );

    if (adminNavigation || adminControl) {
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
    users = readUsers();

    const sessionId = getSession();

    const user = users.find(
      item => item.id === sessionId
    );

    if (user) {
      enterApp(user);
    } else {
      clearSession();
      renderAuth();
    }
  }

  try {
    init();
  } catch (error) {
    console.error(
      "Falha ao iniciar o login local:",
      error
    );

    content.innerHTML = `
      <div class="bla-note">
        Ocorreu um erro ao iniciar o acesso local.
        Seus dados de batalha não foram apagados.
      </div>

      <button
        type="button"
        class="bla-button"
        id="bla-retry">
        TENTAR NOVAMENTE
      </button>
    `;

    $("bla-retry").addEventListener(
      "click",
      () => {
        currentScreen = "login";
        renderAuth();
      }
    );
  }
})();
