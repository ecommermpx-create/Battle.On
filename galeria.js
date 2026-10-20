
"use strict";
/* BATTLE-ON v1.5 - Galeria de fotos do evento */
(() => {
  const root = document.getElementById("galeria-grid");
  const status = document.getElementById("galeria-status");
  if (!root || !status) return;

  const css = document.createElement("style");
  css.textContent = `
    .galeria-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px}
    .galeria-card{min-width:0;overflow:hidden;border:1px solid #62353f;border-radius:5px;background:#111114;box-shadow:4px 4px 0 #080809}
    .galeria-card h3{font-family:Anton,Impact,sans-serif;font-size:23px;font-weight:400;letter-spacing:1px;margin:0;padding:16px 17px;background:repeating-linear-gradient(-35deg,transparent 0 17px,#ffffff08 18px 19px),#381c26}
    .galeria-frame{position:relative;display:grid;place-items:center;aspect-ratio:4/3;overflow:hidden;background:radial-gradient(circle at 50% 30%,#43212b,#17161a 65%);border-bottom:1px solid #4d3940}
    .galeria-frame::before{content:"BATTLE ON";position:absolute;transform:rotate(-12deg);font:70px Anton,Impact,sans-serif;color:#ffffff0a;white-space:nowrap;pointer-events:none}
    .galeria-frame img{position:relative;width:100%;height:100%;object-fit:cover;cursor:zoom-in}
    .galeria-placeholder{position:relative;z-index:1;text-align:center;padding:20px;color:#c6b5bb}
    .galeria-placeholder span{display:block;font-size:49px;margin-bottom:12px}
    .galeria-placeholder strong{display:block;font-size:13px;letter-spacing:1px}
    .galeria-details{padding:15px 17px}
    .galeria-details p{color:#b9aeb3;font-size:12px;line-height:1.6;margin:0 0 12px}
    .galeria-actions{display:flex;gap:9px;flex-wrap:wrap}
    .galeria-actions .btn{flex:1;min-width:110px}
    .galeria-lock{display:inline-block;padding:8px 11px;background:#29262c;border:1px solid #49444d;border-radius:3px;font-size:11px;font-weight:800;color:#b5adb4}
    .galeria-modal{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:30px;background:#000e}
    .galeria-modal[hidden]{display:none}
    .galeria-modal img{max-width:95vw;max-height:88vh;object-fit:contain}
    .galeria-close{position:absolute;top:15px;right:20px;min-width:45px;min-height:45px;border:1px solid #777;background:#231b20;color:#fff;font-size:26px;cursor:pointer}
    @media(max-width:650px){.galeria-grid{grid-template-columns:1fr}.galeria-card h3{font-size:21px}}
  `;
  document.head.appendChild(css);

  const items = [
    {
      type: "campeao",
      title: "🏆 CAMPEÃO COM A FOLHINHA",
      description: "O registro do campeão segurando a arte da premiação.",
      icon: "🏆"
    },
    {
      type: "galera",
      title: "🙌 A GALERA QUE COLOU",
      description: "A foto da roda, do público e de quem fortaleceu a batalha.",
      icon: "🙌"
    }
  ];

  let databasePromise;
  let renderVersion = 0;
  let lastSignature = "";
  const imageUrls = new Map();

  function database() {
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("battle-on-fotos-v1", 1);

        request.onupgradeneeded = () => {
          request.result.createObjectStore("fotos");
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return databasePromise;
  }

  async function readPhoto(key) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const req = db.transaction("fotos", "readonly")
        .objectStore("fotos").get(key);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function writePhoto(key, blob) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("fotos", "readwrite");
      tx.objectStore("fotos").put(blob, key);

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function deletePhoto(key) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("fotos", "readwrite");
      tx.objectStore("fotos").delete(key);

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function eventSignature() {
    const first = state.rounds?.[0]?.matches?.[0]?.id;
    return first
      ? `${state.createdAt || "evento"}:${first}`
      : "";
  }

  function finished() {
    const final = state.rounds?.at(-1)?.matches?.[0];

    return Boolean(
      final?.winner &&
      state.rounds.every(round =>
        round.matches.every(match => Boolean(match.winner))
      )
    );
  }

  function photoKey(signature, type) {
    return `${signature}:${type}`;
  }

  function clearUrls() {
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    imageUrls.clear();
  }

  async function renderGallery() {
    const version = ++renderVersion;
    const signature = eventSignature();
    const unlocked = finished();

    if (signature !== lastSignature) {
      clearUrls();
      lastSignature = signature;
    }

    status.textContent = unlocked
      ? "Batalha encerrada! Adicione os dois registros oficiais desta edição."
      : "🔒 As fotos serão liberadas automaticamente após a definição do campeão na final.";

    root.innerHTML = items.map(item => `
      <article class="galeria-card" data-type="${item.type}">
        <h3>${item.title}</h3>

        <div class="galeria-frame" data-frame="${item.type}">
          <div class="galeria-placeholder">
            <span>${item.icon}</span>
            <strong>
              ${unlocked
                ? "ADICIONE A FOTO"
                : "AGUARDANDO O ENCERRAMENTO"}
            </strong>
          </div>
        </div>

        <div class="galeria-details">
          <p>${item.description}</p>

          <div class="galeria-actions" data-actions="${item.type}">
            ${unlocked
              ? `<button class="btn primary"
                   type="button"
                   data-upload="${item.type}">
                   📷 ADICIONAR FOTO
                 </button>`
              : `<span class="galeria-lock">
                   🔒 UPLOAD BLOQUEADO
                 </span>`}
          </div>
        </div>
      </article>
    `).join("");

    if (!unlocked || !signature) return;

    for (const item of items) {
      try {
        const blob = await readPhoto(
          photoKey(signature, item.type)
        );

        if (version !== renderVersion) return;
        if (!blob) continue;

        const url = URL.createObjectURL(blob);
        const old = imageUrls.get(item.type);

        if (old) URL.revokeObjectURL(old);
        imageUrls.set(item.type, url);

        const frame = root.querySelector(
          `[data-frame="${item.type}"]`
        );

        const actions = root.querySelector(
          `[data-actions="${item.type}"]`
        );

        frame.innerHTML = `
          <img
            src="${url}"
            alt="${item.description}"
            title="Clique para ampliar"
          >
        `;

        actions.innerHTML = `
          <button
            class="btn secondary"
            type="button"
            data-upload="${item.type}">
            TROCAR FOTO
          </button>

          <button
            class="btn danger"
            type="button"
            data-remove="${item.type}">
            REMOVER
          </button>
        `;
      } catch (error) {
        console.error("Erro ao carregar foto:", error);
        notify("Não foi possível acessar as fotos salvas neste navegador.");
        break;
      }
    }
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        return reject(Error("Selecione um arquivo de imagem."));
      }

      const sourceUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(sourceUrl);

        const scale = Math.min(
          1,
          1600 / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
          1,
          Math.round(image.width * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(image.height * scale)
        );

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          return reject(
            Error("Não foi possível processar a imagem.")
          );
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          blob => blob
            ? resolve(blob)
            : reject(Error("Erro ao preparar a foto.")),
          "image/jpeg",
          0.84
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(sourceUrl);
        reject(Error("Não foi possível abrir a imagem."));
      };

      image.src = sourceUrl;
    });
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  let uploadType = null;
  let uploadSignature = null;

  root.addEventListener("click", async event => {
    const upload = event.target.closest("[data-upload]");
    const remove = event.target.closest("[data-remove]");
    const image = event.target.closest(".galeria-frame img");

    if (image) {
      const modal = document.createElement("div");
      modal.className = "galeria-modal";

      modal.innerHTML = `
        <button
          class="galeria-close"
          aria-label="Fechar">
          ×
        </button>
        <img alt="Foto ampliada">
      `;

      modal.querySelector("img").src = image.src;

      modal.addEventListener("click", e => {
        if (e.target !== modal.querySelector("img")) {
          modal.remove();
        }
      });

      document.body.appendChild(modal);
      return;
    }

    if (!finished()) return;

    if (upload) {
      uploadType = upload.dataset.upload;
      uploadSignature = eventSignature();
      fileInput.value = "";
      fileInput.click();
    }

    if (remove) {
      const signature = eventSignature();

      if (!confirm("Remover esta foto da galeria?")) return;

      if (!finished() || signature !== eventSignature()) {
        return;
      }

      try {
        await deletePhoto(
          photoKey(signature, remove.dataset.remove)
        );

        await renderGallery();
        notify("Foto removida.");
      } catch {
        notify("Não foi possível remover a foto.");
      }
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];

    if (!file || !uploadType || !uploadSignature) {
      return;
    }

    const type = uploadType;
    const signature = uploadSignature;

    try {
      const blob = await compressImage(file);

      if (!finished() || eventSignature() !== signature) {
        return notify(
          "O evento mudou. Selecione a foto novamente."
        );
      }

      await writePhoto(photoKey(signature, type), blob);
      await renderGallery();

      notify("Foto salva com sucesso!");
    } catch (error) {
      notify(error.message || "Erro ao salvar foto.");
    }
  });

  new MutationObserver(() => {
    renderGallery();
  }).observe(
    document.getElementById("champion-box"),
    {
      childList: true,
      subtree: true
    }
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document.querySelector(".galeria-modal")?.remove();
    }
  });

  renderGallery();
})();
