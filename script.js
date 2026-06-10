const APP_VERSION = "2.9";
    const GITHUB_UPDATE_OWNER = "juancontreras1145";
    const GITHUB_UPDATE_REPO = "prisma-caja";

    const STORAGE_KEY = "cajaMinimalDataV2";
    const LEGACY_KEYS = ["cajaMinimalData", "cajaMinimalRealDataV2", "cajaMinimalRealDataV1", "cajaMinimalTermuxData"];

    const defaultData = {
      clients: [],
      products: [],
      movements: [],
      nextReceiptNumber: 1,
      settings: {
        appTitle: "Prisma",
        profitPin: ""
      }
    };

    let data = loadData();
    let selectedCart = {};
    let selectedClient = null;
    let selectedSaleStatus = "pagado";
    let selectedSaleMethod = "Efectivo";
    let selectedPaymentMethod = "Efectivo";
    let selectedPaymentSaleIds = [];
    let editingProductId = null;
    let previousScreen = "venta";
    let currentReceiptSaleId = null;
    let currentReceiptCustom = null;
    let historyTab = "boletas";
    let navStack = ["home"];

    function structuredDefault() {
      return JSON.parse(JSON.stringify(defaultData));
    }

    function loadData() {
      try {
        let raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          for (const key of LEGACY_KEYS) {
            raw = localStorage.getItem(key);
            if (raw) break;
          }
        }
        if (!raw) return normalizeLoadedData(structuredDefault());

        const saved = JSON.parse(raw);
        const imported = saved.data || saved;
        return normalizeLoadedData(imported);
      } catch (err) {
        console.error(err);
        return normalizeLoadedData(structuredDefault());
      }
    }

    function normalizeLoadedData(imported) {
      const base = structuredDefault();

      let clients = [];
      if (Array.isArray(imported.clients)) {
        clients = imported.clients.map((c, i) => ({
          id: c.id || "client-" + i + "-" + Date.now(),
          name: String(c.name || "").trim(),
          phone: sanitizePhone(c.phone || "")
        })).filter(c => c.name);
      } else if (Array.isArray(imported.names)) {
        clients = imported.names.map((name, i) => ({
          id: "legacy-" + i + "-" + Date.now(),
          name: String(name || "").trim(),
          phone: ""
        })).filter(c => c.name);
      }

      let products = Array.isArray(imported.products)
        ? imported.products.map(normalizeProduct).filter(p => String(p.name || "").trim())
        : [];

      let movements = Array.isArray(imported.movements) ? imported.movements.map(normalizeMovement) : [];
      movements.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      products = removeLegacyDefaultProducts(products);
      clients = removeLegacyDefaultClients(clients, movements);

      let maxBoleta = 0;
      movements.forEach(m => {
        if (m.type === "venta") {
          if (!m.boletaNumber) {
            maxBoleta += 1;
            m.boletaNumber = maxBoleta;
          } else {
            maxBoleta = Math.max(maxBoleta, Number(m.boletaNumber) || 0);
          }
        }
      });

      const nextReceiptNumber = Math.max(Number(imported.nextReceiptNumber || 1), maxBoleta + 1);

      movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const settings = normalizeSettings(imported.settings || {});

      return {
        clients,
        products,
        movements,
        nextReceiptNumber,
        settings
      };
    }

    function sanitizeVisualTheme(theme) {
      const allowed = ["neon", "carbon", "light", "retro", "aurora"];
      return allowed.includes(String(theme || "")) ? String(theme) : "neon";
    }

    function normalizeSettings(settings = {}) {
      const appTitle = String(settings.appTitle || "Prisma").trim() || "Prisma";
      const profitPin = String(settings.profitPin || "").replace(/\D/g, "").slice(0, 4);
      const visualTheme = sanitizeVisualTheme(settings.visualTheme || settings.theme || "neon");
      return { appTitle, profitPin, visualTheme };
    }

    function getSettings() {
      if (!data.settings) data.settings = normalizeSettings({});
      data.settings = normalizeSettings(data.settings);
      return data.settings;
    }

    function renderAppTitle() {
      const settings = getSettings();
      const title = settings.appTitle || "Prisma";
      const titleEl = document.getElementById("appTitle");
      if (titleEl) titleEl.textContent = title;
      document.title = title;
    }

    function applyVisualTheme(theme) {
      const selected = sanitizeVisualTheme(theme || getSettings().visualTheme);
      document.body.classList.remove(
        "theme-carbon",
        "theme-light",
        "theme-retro",
        "theme-aurora"
      );
      if (selected !== "neon") {
        document.body.classList.add("theme-" + selected);
      }
      renderVisualThemeOptions();
    }

    function renderVisualThemeOptions() {
      const selected = sanitizeVisualTheme(getSettings().visualTheme);
      document.querySelectorAll(".theme-option").forEach(button => {
        button.classList.toggle("active", button.dataset.theme === selected);
      });
    }

    function selectVisualTheme(theme) {
      const selected = sanitizeVisualTheme(theme);
      getSettings().visualTheme = selected;
      persist();
      applyVisualTheme(selected);
      toast("Diseño actualizado");
    }

    function normalizePin(value) {
      return String(value || "").replace(/\D/g, "").slice(0, 4);
    }

    function getProfitPin() {
      return normalizePin(getSettings().profitPin);
    }

    function normalizeMovement(m) {
      const createdAt = m.createdAt || new Date().toISOString();
      if (m.type === "venta") {
        const total = Number(m.total || 0);
        let amountPaid = Number(m.amountPaid ?? (m.status === "pagado" ? total : 0));
        if (Array.isArray(m.payments) && m.payments.length) {
          const paidFromPayments = m.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
          amountPaid = Math.max(amountPaid, paidFromPayments);
        }
        amountPaid = Math.min(Math.max(0, amountPaid), total);
        const paymentStatus = amountPaid >= total ? "pagado" : (amountPaid > 0 ? "abonado" : "fiado");

        return {
          id: m.id || makeId(),
          type: "venta",
          boletaNumber: m.boletaNumber ? Number(m.boletaNumber) : null,
          clientId: m.clientId || "",
          clientName: String(m.clientName || ""),
          clientPhone: sanitizePhone(m.clientPhone || ""),
          items: Array.isArray(m.items) ? m.items.map(item => ({
            id: item.id || makeId(),
            name: String(item.name || "Producto"),
            qty: Number(item.qty || 1),
            price: Number(item.price || 0),
            cost: Math.max(0, Number(item.cost || 0)),
            total: Number(item.total || (Number(item.price || 0) * Number(item.qty || 1))),
            stockBefore: normalizeStockValue(item.stockBefore ?? null),
            stockAfter: normalizeStockValue(item.stockAfter ?? null)
          })) : [],
          total,
          status: amountPaid >= total ? "pagado" : (m.status || "fiado"),
          method: m.method || "",
          lastPaymentMethod: m.lastPaymentMethod || m.method || "",
          amountPaid,
          paymentStatus,
          payments: Array.isArray(m.payments) ? m.payments.map(p => ({
            id: p.id || makeId(),
            amount: Number(p.amount || 0),
            method: p.method || "",
            createdAt: p.createdAt || createdAt
          })) : [],
          createdAt,
          day: m.day || localDayKey(createdAt)
        };
      }

      return {
        id: m.id || makeId(),
        type: "abono",
        clientId: m.clientId || "",
        clientName: String(m.clientName || ""),
        clientPhone: sanitizePhone(m.clientPhone || ""),
        amount: Number(m.amount || 0),
        method: m.method || "Efectivo",
        saleIds: Array.isArray(m.saleIds) ? m.saleIds : [],
        applied: Array.isArray(m.applied) ? m.applied.map(a => ({
          saleId: a.saleId || "",
          amount: Number(a.amount || 0),
          boletaNumber: a.boletaNumber ? Number(a.boletaNumber) : null
        })) : [],
        createdAt,
        day: m.day || localDayKey(createdAt)
      };
    }

    function persist() {
      data.settings = normalizeSettings(data.settings || {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      renderAppTitle();
      renderHomeStats();
    }

    function makeId() {
      return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    }

    function sanitizePhone(value) {
      const digits = String(value || "").replace(/[^\d]/g, "");
      if (digits.length === 8) return "569" + digits;
      if (digits.length === 9 && digits.startsWith("9")) return "56" + digits;
      if (digits.startsWith("56")) return digits;
      return digits;
    }

    function formatWhatsappPhone(phone) {
      const digits = sanitizePhone(phone);
      return digits ? "+" + digits : "";
    }

    function formatWhatsappPhonePretty(phone) {
      const digits = sanitizePhone(phone);
      if (digits.length === 11 && digits.startsWith("569")) {
        const rest = digits.slice(3);
        return "+56 9 " + rest.slice(0, 4) + " " + rest.slice(4);
      }
      if (digits.length === 9 && digits.startsWith("9")) {
        const rest = digits.slice(1);
        return "+56 9 " + rest.slice(0, 4) + " " + rest.slice(4);
      }
      return digits ? "+" + digits : "";
    }

    function whatsappLinkForPhone(phone, text = "") {
      const digits = sanitizePhone(phone);
      if (!digits) return "";
      const msg = text ? "?text=" + encodeURIComponent(text) : "";
      return "https://wa.me/" + digits + msg;
    }

    async function copyClientPhone(id) {
      const client = data.clients.find(c => c.id === id);
      if (!client || !client.phone) {
        alert("Este cliente no tiene WhatsApp guardado.");
        return;
      }

      const pretty = formatWhatsappPhonePretty(client.phone);

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(pretty);
          alert("Copiado: " + pretty);
          return;
        }
      } catch (err) {
        console.log(err);
      }

      prompt("Copia el número:", pretty);
    }

    function editClient(id) {
      const client = data.clients.find(c => c.id === id);
      if (!client) return;

      const currentPhone = client.phone ? formatWhatsappPhonePretty(client.phone) : "";
      const name = prompt("Nombre del cliente", client.name);
      if (name === null) return;

      const phone = prompt("WhatsApp. Puedes poner 8 dígitos o formato +56 9 9945 6548", currentPhone);
      if (phone === null) return;

      const cleanName = name.trim();
      if (!cleanName) {
        alert("El nombre no puede quedar vacío.");
        return;
      }

      client.name = cleanName;
      client.phone = sanitizePhone(phone);

      persist();
      renderEditClients();
      renderNamesPage && renderNamesPage();
      renderAbonoList && renderAbonoList();

      alert("Cliente actualizado.");
    }

    function openClientWhatsappTest(id) {
      const client = data.clients.find(c => c.id === id);
      if (!client || !client.phone) {
        alert("Este cliente no tiene WhatsApp guardado.");
        return;
      }

      const text = "Prueba de contacto desde Prisma";
      const digits = sanitizePhone(client.phone);

      if (window.AndroidBridge && typeof window.AndroidBridge.openWhatsapp === "function") {
        window.AndroidBridge.openWhatsapp(digits, text);
        return;
      }

      window.open(whatsappLinkForPhone(client.phone, text), "_blank");
    }

    function go(id, skipHistory = false) {
      if (!skipHistory) {
        const current = document.querySelector(".screen.active");
        const currentId = current ? current.id : null;
        if (currentId && currentId !== id) {
          const last = navStack[navStack.length - 1];
          if (last !== id) navStack.push(id);
          if (navStack.length > 20) navStack.shift();
        }
      }

      document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
      document.getElementById(id).classList.add("active");

      if (id === "home") renderHomeStats();
      if (id === "venta") renderProducts();
      if (id === "nombres") renderNamesPage();
      if (id === "historial") renderHistory();
      if (id === "editar") {
        closeEditPanels();
      }
      if (id === "abono") {
        document.getElementById("abonoSearch").value = "";
        renderAbonoList();
      }
    }

    function appBack() {
      const openModals = [...document.querySelectorAll(".modal.show")];
      if (openModals.length) {
        openModals[openModals.length - 1].classList.remove("show");
        return "handled";
      }

      const editScreen = document.getElementById("editar");
      if (editScreen && editScreen.classList.contains("active") && editScreen.classList.contains("edit-subpage")) {
        closeEditPanels();
        return "handled";
      }

      const active = document.querySelector(".screen.active");
      const activeId = active ? active.id : "home";

      if (activeId !== "home") {
        if (navStack.length > 1) {
          navStack.pop();
          const previous = navStack[navStack.length - 1] || "home";
          go(previous, true);
        } else {
          go("home", true);
        }
        return "handled";
      }

      return "handled";
    }

    function openVenta() {
      selectedCart = {};
      go("venta");
      updateSelectionUI();
    }

    function openAbono() {
      go("abono");
    }

    function formatMoney(value) {
      return "$" + Number(value || 0).toLocaleString("es-CL");
    }

    function formatDateTime(value) {
      return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
    }

    function formatCsvDateTime(value) {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    function formatDateOnly(value) {
      return new Date(value).toLocaleDateString("es-CL");
    }

    function formatReceiptNumber(n) {
      return String(Number(n || 0)).padStart(4, "0");
    }

    function localDayKey(value = new Date()) {
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }

    function movementDayKey(m) {
      return localDayKey((m && (m.createdAt || m.day)) || new Date()) || String((m && m.day) || "");
    }

    function todayKey() {
      return localDayKey();
    }

    function renderHomeStats() {
      const today = todayKey();
      const todays = data.movements.filter(m => movementDayKey(m) === today);
      const sales = todays.filter(m => m.type === "venta");
      const debt = sales.reduce((sum, s) => sum + getSaleRemaining(s), 0);
      const payments = todays.filter(m => m.type === "abono").reduce((sum, m) => sum + Number(m.amount || 0), 0);

      document.getElementById("todaySales").textContent = String(sales.length);
      document.getElementById("todayDebt").textContent = formatMoney(debt);
      document.getElementById("todayPayments").textContent = formatMoney(payments);
      document.getElementById("clientCount").textContent = String(data.clients.length);
    }

    function gradient(color) {
      return `linear-gradient(135deg, ${color}, ${darkenColor(color, 42)})`;
    }

    function darkenColor(hex, amount) {
      let c = String(hex || "#2f80ed").replace("#", "");
      if (c.length === 3) c = c.split("").map(x => x + x).join("");
      const num = parseInt(c, 16);
      let r = Math.max(0, (num >> 16) - amount);
      let g = Math.max(0, ((num >> 8) & 0xff) - amount);
      let b = Math.max(0, (num & 0xff) - amount);
      return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
    }

    function normalizeProduct(product, index = 0) {
      const cssColors = {
        chocman: "#8b5a2b",
        mani: "#f2c94c",
        bachata: "#eb5757",
        super8: "#ff7a00"
      };
      return {
        id: product.id || "product-" + index + "-" + Date.now(),
        name: String(product.name || "Producto"),
        price: Math.max(0, Number(product.price || 0)),
        cost: Math.max(0, Number(product.cost || product.unitCost || product.purchasePrice || 0)),
        color: product.color || cssColors[product.css] || "#2f80ed",
        stock: normalizeStockValue(product.stock ?? product.inventory ?? product.qtyStock ?? product.quantityStock ?? null)
      };
    }

    function normalizeStockValue(value) {
      if (value === null || value === undefined || value === "") return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.floor(n));
    }

    function productStock(product) {
      if (!product) return null;
      return normalizeStockValue(product.stock);
    }

    function productHasStockControl(product) {
      return productStock(product) !== null;
    }

    function stockInputId(productId) {
      return "stock-" + String(productId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function stockLabel(product) {
      const stock = productStock(product);
      if (stock === null) return "Stock libre";
      if (stock <= 0) return "Sin stock";
      return "Stock " + stock;
    }

    function parseOptionalStock(raw) {
      const text = String(raw ?? "").trim();
      if (text === "") return null;
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return Math.max(0, Math.floor(n));
    }

    function isLegacyDefaultProduct(product) {
      const legacy = {
        chocman: { name: "chocman", price: 350, color: "#8b5a2b" },
        mani: { name: "maní", altName: "mani", price: 650, color: "#f2c94c" },
        bachata: { name: "bachata", price: 400, color: "#eb5757" },
        super8: { name: "super 8", altName: "super8", price: 400, color: "#ff7a00" }
      };
      const id = String(product.id || "").toLowerCase();
      const item = legacy[id];
      if (!item) return false;

      const name = normalize(product.name || "");
      const expectedName = normalize(item.name);
      const expectedAltName = item.altName ? normalize(item.altName) : "";
      const price = Number(product.price || 0);
      const cost = Number(product.cost || 0);
      const color = String(product.color || "").toLowerCase();

      return (name === expectedName || (expectedAltName && name === expectedAltName))
        && price === item.price
        && cost === 0
        && color === item.color;
    }

    function removeLegacyDefaultProducts(products) {
      if (!Array.isArray(products)) return [];
      return products.filter(product => !isLegacyDefaultProduct(product));
    }

    function isLegacyDefaultClient(client) {
      const legacy = {
        c1: "ana",
        c2: "camila",
        c3: "claudio otaiza",
        c4: "juan"
      };
      const id = String(client.id || "").toLowerCase();
      const expectedName = legacy[id];
      if (!expectedName) return false;
      return normalize(client.name || "") === expectedName && !sanitizePhone(client.phone || "");
    }

    function removeLegacyDefaultClients(clients, movements = []) {
      if (!Array.isArray(clients)) return [];
      const usedClientIds = new Set((movements || [])
        .map(m => String(m.clientId || ""))
        .filter(Boolean));

      return clients.filter(client => {
        if (!isLegacyDefaultClient(client)) return true;
        return usedClientIds.has(String(client.id || ""));
      });
    }

    function renderProducts() {
      const target = document.getElementById("productButtons");
      if (!data.products.length) {
        target.innerHTML = '<div class="empty">No hay productos. Agrégalos en Editar &gt; Productos.</div>';
        updateSelectionUI();
        return;
      }

      const visibleProducts = data.products.filter(product => {
        const stock = productStock(product);
        return stock === null || stock > 0 || selectedCart[product.id];
      });

      if (!visibleProducts.length) {
        target.innerHTML = '<div class="empty">No hay productos con stock disponible. Agrega stock en Editar &gt; Productos.</div>';
        updateSelectionUI();
        return;
      }

      target.innerHTML = visibleProducts.map(product => {
        const qty = selectedCart[product.id] || 0;
        const stock = productStock(product);
        const limited = stock !== null;
        const reachedStock = limited && qty >= stock;
        const disabled = reachedStock;
        return `
          <button class="product ${qty ? "selected" : ""}" ${disabled ? "disabled" : ""} style="background:${gradient(product.color)}" onclick="addProductToSelection('${escapeJs(product.id)}')">
            <span>${escapeHtml(product.name)}<br><small>${formatMoney(product.price)}</small></span>
            ${qty ? `<b class="qty-badge">×${qty}</b>` : ""}
          </button>
        `;
      }).join("");
      updateSelectionUI();
    }

    function addProductToSelection(id) {
      const product = data.products.find(p => p.id === id);
      if (!product) return;
      const stock = productStock(product);
      const currentQty = selectedCart[id] || 0;
      if (stock !== null && currentQty >= stock) {
        toast("No queda más stock de " + product.name);
        return;
      }
      selectedCart[id] = currentQty + 1;
      renderProducts();
    }

    function getSelectedItems() {
      return data.products
        .filter(product => selectedCart[product.id])
        .map(product => ({
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
          cost: Math.max(0, Number(product.cost || 0)),
          color: product.color,
          stock: productStock(product),
          qty: selectedCart[product.id],
          total: Number(product.price || 0) * selectedCart[product.id]
        }));
    }

    function getSelectedTotal() {
      return getSelectedItems().reduce((sum, item) => sum + item.total, 0);
    }

    function updateSelectionUI() {
      const itemsTarget = document.getElementById("selectionItems");
      const totalTarget = document.getElementById("selectionTotal");
      const chooseBtn = document.getElementById("chooseClientBtn");
      const clearBtn = document.getElementById("clearSelectionBtn");
      if (!itemsTarget || !totalTarget || !chooseBtn || !clearBtn) return;

      const items = getSelectedItems();
      if (!items.length) {
        itemsTarget.textContent = "Aún no has seleccionado productos.";
        totalTarget.textContent = formatMoney(0);
        chooseBtn.disabled = true;
        clearBtn.disabled = true;
        return;
      }

      itemsTarget.innerHTML = items.map(item => {
        return `<div>${escapeHtml(item.name)} ×${item.qty} · ${formatMoney(item.total)}</div>`;
      }).join("");
      totalTarget.textContent = formatMoney(getSelectedTotal());
      chooseBtn.disabled = false;
      clearBtn.disabled = false;
    }

    function clearSelection() {
      selectedCart = {};
      renderProducts();
      toast("Selección borrada");
    }

    function openNamesForSale() {
      if (!getSelectedItems().length) {
        toast("Primero elige uno o más productos");
        return;
      }
      previousScreen = "venta";
      document.getElementById("namesTitle").textContent = "Cliente para venta";
      document.getElementById("nameSearch").value = "";
      go("nombres");
    }

    function normalize(text) {
      return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function sortedClients(filter = "") {
      const q = normalize(filter);
      return [...data.clients]
        .filter(client => normalize(client.name).includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    function renderNamesPage() {
      const target = document.getElementById("namesList");
      const list = sortedClients(document.getElementById("nameSearch").value);
      renderClientRows(target, list, "seleccionar", openSaleModal);
    }

    function renderAbonoList() {
      const target = document.getElementById("abonoList");
      const list = sortedClients(document.getElementById("abonoSearch").value)
        .map(client => ({ client, pendingTotal: getClientPendingTotal(client.id) }))
        .filter(entry => entry.pendingTotal > 0);

      if (!list.length) {
        target.innerHTML = '<div class="empty">No hay clientes con deuda pendiente.</div>';
        return;
      }

      renderDebtorClientRows(target, list, openPaymentModal);
    }

    function renderDebtorClientRows(target, list, callback) {
      target.innerHTML = "";
      let lastLetter = "";
      list.forEach(entry => {
        const client = entry.client;
        const letter = client.name.trim().charAt(0).toUpperCase();
        if (letter !== lastLetter) {
          lastLetter = letter;
          const title = document.createElement("div");
          title.className = "letter";
          title.textContent = letter;
          target.appendChild(title);
        }
        const row = document.createElement("div");
        row.className = "name-row";
        row.onclick = () => callback(client);
        row.innerHTML = `<div><strong>${escapeHtml(client.name)}</strong><small>${client.phone ? escapeHtml(formatWhatsappPhonePretty(client.phone)) : "sin WhatsApp"}</small></div><small>Debe ${formatMoney(entry.pendingTotal)}</small>`;
        target.appendChild(row);
      });
    }

    function renderClientRows(target, list, label, callback) {
      if (!list.length) {
        target.innerHTML = '<div class="empty">No hay clientes. Agrégalos desde Editar.</div>';
        return;
      }
      target.innerHTML = "";
      let lastLetter = "";
      list.forEach(client => {
        const letter = client.name.trim().charAt(0).toUpperCase();
        if (letter !== lastLetter) {
          lastLetter = letter;
          const title = document.createElement("div");
          title.className = "letter";
          title.textContent = letter;
          target.appendChild(title);
        }
        const row = document.createElement("div");
        row.className = "name-row";
        row.onclick = () => callback(client);
        row.innerHTML = `<div><strong>${escapeHtml(client.name)}</strong><small>${client.phone ? escapeHtml(formatWhatsappPhonePretty(client.phone)) : "sin WhatsApp"}</small></div><small>${label}</small>`;
        target.appendChild(row);
      });
    }

    function openSaleModal(client) {
      selectedClient = client;
      selectedSaleStatus = "pagado";
      selectedSaleMethod = "Efectivo";

      document.getElementById("paidBtn").classList.add("selected");
      document.getElementById("debtBtn").classList.remove("selected");
      document.getElementById("saleCashBtn").classList.add("selected");
      document.getElementById("saleTransferBtn").classList.remove("selected");
      document.getElementById("saleMethodArea").style.display = "block";

      document.getElementById("saleInfo").textContent = "Venta para " + client.name;
      document.getElementById("modalSelectionItems").innerHTML = getSelectedItems().map(item => `<div>${escapeHtml(item.name)} ×${item.qty} · ${formatMoney(item.total)}</div>`).join("");
      document.getElementById("modalSelectionTotal").textContent = formatMoney(getSelectedTotal());

      openModal("saleModal");
    }

    function setSaleStatus(status) {
      selectedSaleStatus = status;
      document.getElementById("paidBtn").classList.toggle("selected", status === "pagado");
      document.getElementById("debtBtn").classList.toggle("selected", status === "fiado");
      document.getElementById("saleMethodArea").style.display = status === "fiado" ? "none" : "block";
      if (status === "fiado") selectedSaleMethod = "";
      if (status === "pagado" && !selectedSaleMethod) setSaleMethod("Efectivo");
    }

    function setSaleMethod(method) {
      selectedSaleMethod = method;
      document.getElementById("saleCashBtn").classList.toggle("selected", method === "Efectivo");
      document.getElementById("saleTransferBtn").classList.toggle("selected", method === "Transferencia");
    }

    function validateStockForSale(items) {
      for (const item of items) {
        const product = data.products.find(p => p.id === item.id);
        const stock = productStock(product);
        if (stock !== null && Number(item.qty || 0) > stock) {
          return { product: product || item, stock, qty: Number(item.qty || 0) };
        }
      }
      return null;
    }

    function discountStockForSale(items) {
      items.forEach(item => {
        const product = data.products.find(p => p.id === item.id);
        const stock = productStock(product);
        if (!product || stock === null) return;
        product.stock = Math.max(0, stock - Number(item.qty || 0));
      });
    }

    function restoreStockForSale(sale) {
      if (!sale || !Array.isArray(sale.items)) return;
      sale.items.forEach(item => {
        const product = data.products.find(p => p.id === item.id)
          || data.products.find(p => normalize(p.name) === normalize(item.name));
        if (!product || !productHasStockControl(product)) return;
        product.stock = Math.max(0, Number(productStock(product) || 0) + Number(item.qty || 0));
      });
    }

    function saveSale() {
      const items = getSelectedItems();
      if (!items.length) {
        toast("No hay productos seleccionados");
        return;
      }

      const stockProblem = validateStockForSale(items);
      if (stockProblem) {
        toast(`${stockProblem.product.name || "Producto"}: stock ${stockProblem.stock}, seleccionado ${stockProblem.qty}`);
        return;
      }

      const now = new Date();
      const total = getSelectedTotal();
      const boletaNumber = data.nextReceiptNumber++;

      const newSale = {
        id: makeId(),
        type: "venta",
        boletaNumber,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: sanitizePhone(selectedClient.phone || ""),
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          cost: item.cost,
          total: item.total,
          stockBefore: item.stock,
          stockAfter: item.stock === null ? null : Math.max(0, Number(item.stock || 0) - Number(item.qty || 0))
        })),
        total,
        status: selectedSaleStatus,
        method: selectedSaleStatus === "pagado" ? selectedSaleMethod : "",
        lastPaymentMethod: selectedSaleStatus === "pagado" ? selectedSaleMethod : "",
        amountPaid: selectedSaleStatus === "pagado" ? total : 0,
        paymentStatus: selectedSaleStatus === "pagado" ? "pagado" : "fiado",
        payments: selectedSaleStatus === "pagado" ? [{
          id: makeId(),
          amount: total,
          method: selectedSaleMethod,
          createdAt: now.toISOString()
        }] : [],
        createdAt: now.toISOString(),
        day: localDayKey(now)
      };

      discountStockForSale(items);
      data.movements.unshift(newSale);

      persist();
      closeModal("saleModal");
      selectedCart = {};
      currentReceiptSaleId = newSale.id;

      const preview = document.getElementById("afterSaleReceiptPreview");
      if (preview) {
        preview.innerHTML = "";
        preview.appendChild(createReceiptNode(newSale));
      }

      openModal("afterSaleModal");
      toast(`Venta guardada · Boleta ${formatReceiptNumber(boletaNumber)}`);
    }

    function getSales() {
      return data.movements.filter(m => m.type === "venta");
    }

    function getSaleById(id) {
      return data.movements.find(m => m.type === "venta" && m.id === id);
    }

    function renumberReceipts() {
      const sales = data.movements
        .filter(m => m.type === "venta")
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      sales.forEach((sale, index) => {
        sale.boletaNumber = index + 1;
      });

      data.nextReceiptNumber = sales.length + 1;

      data.movements.forEach(m => {
        if (m.type !== "abono" || !Array.isArray(m.applied)) return;

        m.applied.forEach(app => {
          const sale = getSaleById(app.saleId);
          if (sale) app.boletaNumber = sale.boletaNumber;
        });
      });
    }

    function getSaleRemaining(sale) {
      return Math.max(0, Number(sale.total || 0) - Number(sale.amountPaid || 0));
    }

    function getSaleStateText(sale) {
      const remaining = getSaleRemaining(sale);
      if (remaining <= 0) return "Pagado";
      if (Number(sale.amountPaid || 0) > 0) return "Abonado";
      return "Fiado";
    }

    function getSaleBadgeClass(sale) {
      return getSaleRemaining(sale) <= 0 ? "paid" : "debt";
    }

    function getOpenSalesForClient(clientId) {
      return getSales()
        .filter(sale => sale.clientId === clientId && getSaleRemaining(sale) > 0)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    function getClientPendingTotal(clientId) {
      return getOpenSalesForClient(clientId).reduce((sum, sale) => sum + getSaleRemaining(sale), 0);
    }

    function openPaymentModal(client) {
      selectedClient = client;
      selectedPaymentMethod = "Efectivo";
      selectedPaymentSaleIds = [];

      document.getElementById("paymentInfo").textContent = "Abono de " + client.name;
      document.getElementById("paymentAmount").value = "";
      document.getElementById("paymentCashBtn").classList.add("selected");
      document.getElementById("paymentTransferBtn").classList.remove("selected");

      renderPaymentSales();
      openModal("paymentModal");
    }

    function renderPaymentSales() {
      const target = document.getElementById("paymentSalesList");
      const sales = getOpenSalesForClient(selectedClient.id);

      if (!sales.length) {
        target.innerHTML = '<div class="empty">Este cliente no tiene boletas pendientes.</div>';
        document.getElementById("paymentSelectedItems").textContent = "No hay boletas pendientes.";
        document.getElementById("paymentSelectedTotal").textContent = formatMoney(0);
        return;
      }

      target.innerHTML = sales.map(sale => {
        const remaining = getSaleRemaining(sale);
        const selected = selectedPaymentSaleIds.includes(sale.id);
        return `
          <div class="payment-sale-row ${selected ? "selected" : ""}" onclick="togglePaymentSale('${escapeJs(sale.id)}')">
            <strong>Boleta ${formatReceiptNumber(sale.boletaNumber)} · ${formatMoney(sale.total)}</strong>
            <small>${formatDateTime(sale.createdAt)}</small>
            <small>Pagado: ${formatMoney(sale.amountPaid || 0)} · Pendiente: ${formatMoney(remaining)}</small>
            <div class="payment-check">${selected ? "Seleccionada" : "Tocar para seleccionar"}</div>
          </div>
        `;
      }).join("");

      updatePaymentSelectionSummary();
    }

    function togglePaymentSale(id) {
      if (selectedPaymentSaleIds.includes(id)) {
        selectedPaymentSaleIds = selectedPaymentSaleIds.filter(x => x !== id);
      } else {
        selectedPaymentSaleIds.push(id);
      }
      renderPaymentSales();
    }

    function updatePaymentSelectionSummary() {
      const items = selectedPaymentSaleIds
        .map(id => getSaleById(id))
        .filter(Boolean);

      const itemsTarget = document.getElementById("paymentSelectedItems");
      const totalTarget = document.getElementById("paymentSelectedTotal");

      const amountInput = document.getElementById("paymentAmount");

      if (!items.length) {
        itemsTarget.textContent = "Selecciona una o más boletas.";
        totalTarget.textContent = formatMoney(0);
        if (amountInput) amountInput.value = "";
        return;
      }

      itemsTarget.innerHTML = items.map(sale => {
        const remaining = getSaleRemaining(sale);
        return `<div>Boleta ${formatReceiptNumber(sale.boletaNumber)} · Pendiente ${formatMoney(remaining)}</div>`;
      }).join("");

      const total = items.reduce((sum, sale) => sum + getSaleRemaining(sale), 0);
      totalTarget.textContent = formatMoney(total);
      if (amountInput) amountInput.value = total || "";
    }

    function setPaymentMethod(method) {
      selectedPaymentMethod = method;
      document.getElementById("paymentCashBtn").classList.toggle("selected", method === "Efectivo");
      document.getElementById("paymentTransferBtn").classList.toggle("selected", method === "Transferencia");
    }

    function setPayAllAmount() {
      const sales = selectedPaymentSaleIds.map(id => getSaleById(id)).filter(Boolean);
      if (!sales.length) {
        const all = getOpenSalesForClient(selectedClient.id);
        selectedPaymentSaleIds = all.map(sale => sale.id);
      }
      const total = selectedPaymentSaleIds
        .map(id => getSaleById(id))
        .filter(Boolean)
        .reduce((sum, sale) => sum + getSaleRemaining(sale), 0);

      document.getElementById("paymentAmount").value = total || "";
      renderPaymentSales();
      toast("Monto completo cargado");
    }

    function savePayment() {
      const chosenSales = selectedPaymentSaleIds.map(id => getSaleById(id)).filter(Boolean);
      if (!chosenSales.length) {
        toast("Selecciona una o más boletas");
        return;
      }

      let amount = Math.max(0, Number(document.getElementById("paymentAmount").value || 0));
      if (!amount) {
        toast("Ingresa el monto o usa Paga todo");
        return;
      }

      const totalPending = chosenSales.reduce((sum, sale) => sum + getSaleRemaining(sale), 0);
      amount = Math.min(amount, totalPending);

      const applied = [];
      let remainingAmount = amount;
      const now = new Date().toISOString();

      chosenSales.forEach(sale => {
        if (remainingAmount <= 0) return;
        const pending = getSaleRemaining(sale);
        const pay = Math.min(pending, remainingAmount);
        if (pay <= 0) return;

        sale.amountPaid = Number(sale.amountPaid || 0) + pay;
        sale.lastPaymentMethod = selectedPaymentMethod;
        sale.payments = Array.isArray(sale.payments) ? sale.payments : [];
        sale.payments.push({
          id: makeId(),
          amount: pay,
          method: selectedPaymentMethod,
          createdAt: now
        });
        sale.paymentStatus = getSaleRemaining(sale) <= 0 ? "pagado" : "abonado";
        sale.status = getSaleRemaining(sale) <= 0 ? "pagado" : "fiado";

        applied.push({
          saleId: sale.id,
          boletaNumber: sale.boletaNumber,
          amount: pay
        });

        remainingAmount -= pay;
      });

      data.movements.unshift({
        id: makeId(),
        type: "abono",
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientPhone: sanitizePhone(selectedClient.phone || ""),
        amount: amount - remainingAmount,
        method: selectedPaymentMethod,
        saleIds: applied.map(a => a.saleId),
        applied,
        createdAt: now,
        day: localDayKey(now)
      });

      persist();
      closeModal("paymentModal");
      toast("Abono guardado");
      historyTab = "boletas";
      go("historial");
      renderHistory();
    }




    function hideHistoryDeleteButtons() {
      const history = document.getElementById("historial") || document.getElementById("history");
      if (!history) return;

      history.querySelectorAll("button").forEach(button => {
        const text = (button.textContent || "").trim();
        const action = button.getAttribute("onclick") || "";

        if (text === "×" || /delete|remove|borrar/i.test(action)) {
          if (!/showReceipt|Boleta/i.test(action)) {
            button.classList.add("history-delete-hidden");
          }
        }
      });
    }


    function setHistoryTab(tab) {
      historyTab = ["boletas", "abonos", "pendientes"].includes(tab) ? tab : "boletas";
      renderHistory();
    }

    function updateHistoryTabs() {
      const boletasBtn = document.getElementById("historyTabBoletas");
      const abonosBtn = document.getElementById("historyTabAbonos");
      const pendientesBtn = document.getElementById("historyTabPendientes");
      const label = document.getElementById("historySectionLabel");
      if (boletasBtn) boletasBtn.classList.toggle("active", historyTab === "boletas");
      if (abonosBtn) abonosBtn.classList.toggle("active", historyTab === "abonos");
      if (pendientesBtn) pendientesBtn.classList.toggle("active", historyTab === "pendientes");
      if (label) {
        label.textContent = historyTab === "abonos"
          ? "Abonos"
          : historyTab === "pendientes"
            ? "Pendientes acumulados"
            : "Boletas";
      }
    }

    function renderHistory() {
      const target = document.getElementById("historyList");
      if (!target) return;
      updateHistoryTabs();

      if (historyTab === "pendientes") {
        target.innerHTML = renderPendingAccumulatedSection() || '<div class="empty">No hay clientes con boletas pendientes.</div>';
        setTimeout(hideHistoryDeleteButtons, 0);
        return;
      }

      const movements = data.movements.filter(m => historyTab === "abonos" ? m.type === "abono" : m.type === "venta");

      if (!movements.length) {
        target.innerHTML = '<div class="empty">Todavía no hay movimientos.</div>';
        setTimeout(hideHistoryDeleteButtons, 0);
        return;
      }

      const now = new Date();
      const groups = [
        { key: "recent", label: "Últimos 3 días", min: 0, max: 3, open: true },
        { key: "three", label: "3 días atrás", min: 3, max: 7, open: false },
        { key: "week", label: "1 semana atrás", min: 7, max: 30, open: false },
        { key: "month", label: "1 mes atrás", min: 30, max: Infinity, open: false }
      ];

      const byGroup = {
        recent: [],
        three: [],
        week: [],
        month: []
      };

      movements.forEach(m => {
        const diffDays = Math.floor((now - new Date(m.createdAt)) / 86400000);
        if (diffDays < 3) byGroup.recent.push(m);
        else if (diffDays < 7) byGroup.three.push(m);
        else if (diffDays < 30) byGroup.week.push(m);
        else byGroup.month.push(m);
      });

      const groupsHtml = groups
        .filter(group => byGroup[group.key].length)
        .map(group => renderHistoryGroup(group, byGroup[group.key]))
        .join("");

      target.innerHTML = groupsHtml;

      if (!target.innerHTML) {
        target.innerHTML = '<div class="empty">Todavía no hay movimientos.</div>';
      }
      setTimeout(hideHistoryDeleteButtons, 0);
    }

    function renderHistoryGroup(group, movements) {
      const body = movements.map(renderHistoryMovement).join("");

      if (group.open) {
        return `
          <div class="history-group open">
            <button class="history-group-btn" onclick="toggleHistoryGroup(this)">
              <span>${group.label}</span>
              <small>${movements.length}</small>
            </button>
            <div class="history-group-body">${body}</div>
          </div>
        `;
      }

      return `
        <div class="history-group">
          <button class="history-group-btn" onclick="toggleHistoryGroup(this)">
            <span>${group.label}</span>
            <small>${movements.length}</small>
          </button>
          <div class="history-group-body">${body}</div>
        </div>
      `;
    }

    function toggleHistoryGroup(button) {
      const group = button.closest(".history-group");
      if (group) group.classList.toggle("open");
    }

    function renderHistoryMovement(m) {
      const date = formatDateTime(m.createdAt);

      if (m.type === "venta") {
        const state = getSaleStateText(m);
        const remaining = getSaleRemaining(m);
        return `
          <div class="card">
            <div class="card-left">
              <strong>Boleta ${formatReceiptNumber(m.boletaNumber)} · ${escapeHtml(m.clientName || "")}</strong>
              <small>${plainMovementProducts(m)} · ${formatMoney(m.total)} · ${date}</small>
              <br><small>${state} · Pendiente ${formatMoney(remaining)}</small>
              <br><span class="badge ${getSaleBadgeClass(m)}">${state}</span>
            </div>
            <div class="card-actions">
              <button class="share-btn" onclick="showReceipt('${escapeJs(m.id)}')">Boleta</button>
              <span class="history-delete-hidden"><button class="delete" onclick="deleteMovement('${escapeJs(m.id)}')">×</button></span>
            </div>
          </div>
        `;
      }

      const paidReceipts = Array.isArray(m.applied) && m.applied.length
        ? m.applied.map(a => formatReceiptNumber(a.boletaNumber)).join(", ")
        : "-";

      return `
        <div class="card">
          <div class="card-left">
            <strong>Abono · ${escapeHtml(m.clientName || "")}</strong>
            <small>${formatMoney(m.amount)} · ${date}</small>
            <br><small>${escapeHtml(m.method || "Efectivo")} · Boletas ${escapeHtml(paidReceipts)}</small>
            <br><span class="badge paid">Abono</span>
          </div>
          <div class="card-actions">
            <span class="history-delete-hidden"><button class="delete" onclick="deleteMovement('${escapeJs(m.id)}')">×</button></span>
          </div>
        </div>
      `;
    }

    function getPendingAccumulatedClients() {
      const map = new Map();
      getSales().forEach(sale => {
        const remaining = getSaleRemaining(sale);
        if (remaining <= 0) return;
        const key = sale.clientId || normalize(sale.clientName || "cliente");
        if (!map.has(key)) {
          map.set(key, {
            key,
            clientId: sale.clientId || "",
            clientName: sale.clientName || "Cliente",
            clientPhone: sanitizePhone(sale.clientPhone || phoneForSale(sale) || ""),
            sales: [],
            totalPending: 0,
            itemCount: 0
          });
        }
        const group = map.get(key);
        group.sales.push(sale);
        group.totalPending += remaining;
        group.itemCount += (sale.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
        if (!group.clientPhone) group.clientPhone = sanitizePhone(sale.clientPhone || phoneForSale(sale) || "");
      });
      return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
    }

    function renderPendingAccumulatedSection() {
      const groups = getPendingAccumulatedClients();
      if (!groups.length) return "";

      const cards = groups.map(group => `
        <div class="pending-card">
          <div class="pending-card-main">
            <div>
              <strong>${escapeHtml(group.clientName)}</strong>
              <small>${group.sales.length} boleta${group.sales.length === 1 ? "" : "s"} pendiente${group.sales.length === 1 ? "" : "s"} · ${group.itemCount} producto${group.itemCount === 1 ? "" : "s"}</small>
            </div>
            <strong>${formatMoney(group.totalPending)}</strong>
          </div>
          <button class="share-btn" onclick="showAccumulatedReceipt('${escapeJs(group.key)}')">Boleta acumulada</button>
        </div>
      `).join("");

      return `
        <div class="pending-section">
          <div class="pending-head">
            <div>
              <strong>Boletas acumuladas pendientes</strong>
              <small>Comparte una sola boleta por cliente con todas sus ventas pendientes.</small>
            </div>
            <strong>${groups.length}</strong>
          </div>
          <div class="pending-list">${cards}</div>
        </div>
      `;
    }

    function shortReceiptDate(value) {
      const date = new Date(value || Date.now());
      if (Number.isNaN(date.getTime())) return "--/--";
      return String(date.getDate()).padStart(2, "0") + "/" + String(date.getMonth() + 1).padStart(2, "0");
    }

    function buildAccumulatedReceipt(group) {
      const items = [];
      group.sales.forEach(sale => {
        const saleRemaining = getSaleRemaining(sale);
        if (saleRemaining <= 0) return;
        const paidRatio = Number(sale.total || 0) > 0 ? Math.min(1, Math.max(0, Number(sale.amountPaid || 0) / Number(sale.total || 0))) : 0;
        (sale.items || []).forEach(item => {
          const itemTotal = Number(item.total || (Number(item.price || 0) * Number(item.qty || 1)));
          const itemPending = Math.max(0, Math.round(itemTotal * (1 - paidRatio)));
          if (itemPending <= 0) return;
          items.push({
            id: item.id || makeId(),
            name: item.name || "Producto",
            qty: Number(item.qty || 1),
            price: Number(item.price || 0),
            cost: Number(item.cost || 0),
            total: itemPending,
            date: shortReceiptDate(sale.createdAt),
            boletaNumber: sale.boletaNumber
          });
        });
      });

      return {
        id: "accumulated-" + group.key,
        type: "acumulada",
        accumulated: true,
        boletaNumber: "Pendientes",
        clientId: group.clientId,
        clientName: group.clientName,
        clientPhone: group.clientPhone,
        items,
        total: items.reduce((sum, item) => sum + Number(item.total || 0), 0),
        amountPaid: 0,
        paymentStatus: "fiado",
        status: "fiado",
        method: "",
        lastPaymentMethod: "",
        createdAt: new Date().toISOString(),
        sourceSales: group.sales.map(sale => sale.id)
      };
    }

    function showAccumulatedReceipt(key) {
      const group = getPendingAccumulatedClients().find(item => item.key === key);
      if (!group) {
        toast("No hay pendientes para este cliente");
        return;
      }
      currentReceiptSaleId = null;
      currentReceiptCustom = buildAccumulatedReceipt(group);
      const target = document.getElementById("receiptPreview");
      target.innerHTML = "";
      target.appendChild(createReceiptNode(currentReceiptCustom));
      document.querySelectorAll("#receiptModal .safe-delete-zone").forEach(node => node.remove());
      openModal("receiptModal");
    }

    function deleteMovement(id) {
      const movement = data.movements.find(m => m.id === id);
      if (!movement) return;

      if (movement.type === "abono") {
        (movement.applied || []).forEach(app => {
          const sale = getSaleById(app.saleId);
          if (!sale) return;
          sale.amountPaid = Math.max(0, Number(sale.amountPaid || 0) - Number(app.amount || 0));
          if (Array.isArray(sale.payments) && sale.payments.length) {
            let left = Number(app.amount || 0);
            sale.payments = sale.payments.filter(payment => {
              if (left <= 0) return true;
              if (payment.method === movement.method && Math.abs(Number(payment.amount || 0) - left) < 0.001) {
                left = 0;
                return false;
              }
              return true;
            });
          }
          sale.paymentStatus = getSaleRemaining(sale) <= 0 ? "pagado" : (Number(sale.amountPaid || 0) > 0 ? "abonado" : "fiado");
          sale.status = getSaleRemaining(sale) <= 0 ? "pagado" : "fiado";
        });
      }

      if (movement.type === "venta") {
        restoreStockForSale(movement);
        data.movements = data.movements.filter(m => {
          if (m.type !== "abono") return true;
          if (!Array.isArray(m.applied)) return true;
          m.applied = m.applied.filter(app => app.saleId !== movement.id);
          m.saleIds = (m.saleIds || []).filter(sid => sid !== movement.id);
          m.amount = m.applied.reduce((sum, app) => sum + Number(app.amount || 0), 0);
          return m.applied.length > 0;
        });
      }

      data.movements = data.movements.filter(m => m.id !== id);
      renumberReceipts();
      persist();
      renderHistory();
      toast("Movimiento eliminado");
    }

    function clearHistory() {
      if (!confirm("¿Borrar todo el historial?")) return;
      data.movements = [];
      data.nextReceiptNumber = 1;
      persist();
      renderHistory();
      toast("Historial borrado");
    }

    function plainMovementProducts(m) {
      if (Array.isArray(m.items) && m.items.length) {
        return m.items.map(item => `${item.name} x${item.qty}`).join(", ");
      }
      return "Producto";
    }


    function openEditPanel(panel) {
      closeEditPanels();
      const map = {
        clients: "editPanelClients",
        products: "editPanelProducts",
        settings: "editPanelSettings",
        backup: "editPanelBackup",
        data: "editPanelData"
      };
      const id = map[panel];
      if (!id) return;
      const editScreen = document.getElementById("editar");
      if (editScreen) editScreen.classList.add("edit-subpage");
      document.getElementById(id).classList.add("active");
      if (panel === "clients") renderEditClients();
      if (panel === "products") renderEditProducts();
      if (panel === "settings") renderSettingsPanel();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function closeEditPanels() {
      editingProductId = null;
      ["editPanelClients", "editPanelProducts", "editPanelSettings", "editPanelBackup", "editPanelData"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("active");
      });
      const editScreen = document.getElementById("editar");
      if (editScreen) editScreen.classList.remove("edit-subpage");
    }



    function renderSettingsPanel() {
      const settings = getSettings();
      const titleInput = document.getElementById("settingsAppTitle");
      const pinInput = document.getElementById("settingsProfitPin");
      if (titleInput) titleInput.value = settings.appTitle || "Prisma";
      if (pinInput) pinInput.value = "";
      applyVisualTheme(settings.visualTheme);
      renderVisualThemeOptions();
      renderUpdatePanel();
    }

    function saveAppTitleSetting() {
      const input = document.getElementById("settingsAppTitle");
      const title = input ? input.value.trim() : "";
      if (!title) {
        toast("Escribe un título");
        return;
      }
      getSettings().appTitle = title;
      persist();
      renderSettingsPanel();
      toast("Título actualizado");
    }

    function saveProfitPinFromSettings() {
      const input = document.getElementById("settingsProfitPin");
      const pin = normalizePin(input ? input.value : "");
      if (pin.length !== 4) {
        toast("La clave debe tener 4 números");
        return;
      }
      getSettings().profitPin = pin;
      persist();
      renderSettingsPanel();
      toast("Clave guardada");
    }


    let foundUpdateDownloadUrl = "";
    let foundUpdateVersion = "";

    function normalizeVersion(value) {
      return String(value || "")
        .trim()
        .replace(/^version\s*/i, "")
        .replace(/^v/i, "")
        .replace(/[^0-9.]/g, "");
    }

    function compareVersions(current, latest) {
      const a = normalizeVersion(current).split(".").filter(Boolean).map(n => Number(n) || 0);
      const b = normalizeVersion(latest).split(".").filter(Boolean).map(n => Number(n) || 0);
      const max = Math.max(a.length, b.length, 1);
      for (let i = 0; i < max; i++) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        if (bv > av) return 1;
        if (bv < av) return -1;
      }
      return 0;
    }

    function getInstalledVersionName() {
      try {
        if (window.AndroidBridge && typeof AndroidBridge.getVersionName === "function") {
          return AndroidBridge.getVersionName() || APP_VERSION;
        }
      } catch (error) {}
      return APP_VERSION;
    }

    function setUpdateMessage(message, type = "") {
      const el = document.getElementById("updateStatusMessage");
      if (!el) return;
      el.className = "update-message" + (type ? " " + type : "");
      el.textContent = message;
    }

    function renderUpdatePanel() {
      const installed = getInstalledVersionName();
      const installedEl = document.getElementById("installedVersionLabel");
      const latestEl = document.getElementById("latestVersionLabel");
      const downloadBtn = document.getElementById("downloadUpdateButton");
      const checkBtn = document.getElementById("checkUpdatesButton");

      if (installedEl) installedEl.textContent = installed;
      if (latestEl && foundUpdateVersion) latestEl.textContent = foundUpdateVersion;
      if (downloadBtn) downloadBtn.style.display = foundUpdateDownloadUrl ? "block" : "none";
      if (checkBtn) checkBtn.disabled = false;
    }

    function parseUpdatePayload(payload) {
      if (typeof payload === "string") {
        try { return JSON.parse(payload); } catch (error) { return { ok: false, error: payload }; }
      }
      return payload || { ok: false, error: "Respuesta vacía" };
    }

    function handleUpdateResult(payload) {
      const result = parseUpdatePayload(payload);
      const checkBtn = document.getElementById("checkUpdatesButton");
      const latestEl = document.getElementById("latestVersionLabel");
      const downloadBtn = document.getElementById("downloadUpdateButton");
      const installed = getInstalledVersionName();

      if (checkBtn) checkBtn.disabled = false;

      if (!result.ok) {
        foundUpdateDownloadUrl = "";
        foundUpdateVersion = "";
        if (latestEl) latestEl.textContent = "No encontrada";
        if (downloadBtn) downloadBtn.style.display = "none";
        setUpdateMessage("No se pudo buscar la actualización: " + (result.error || "Error desconocido"), "err");
        return;
      }

      const latest = normalizeVersion(result.tagName || result.version || result.name || "");
      foundUpdateVersion = latest || "Desconocida";
      foundUpdateDownloadUrl = result.apkUrl || result.downloadUrl || result.htmlUrl || "";

      if (latestEl) latestEl.textContent = foundUpdateVersion;

      if (!latest) {
        if (downloadBtn) downloadBtn.style.display = "none";
        setUpdateMessage("Se encontró el release, pero no se pudo leer el número de versión.", "warn");
        return;
      }

      if (compareVersions(installed, latest) > 0) {
        if (downloadBtn) downloadBtn.style.display = foundUpdateDownloadUrl ? "block" : "none";
        setUpdateMessage("Hay una nueva versión disponible: " + latest, "ok");
      } else {
        foundUpdateDownloadUrl = "";
        if (downloadBtn) downloadBtn.style.display = "none";
        setUpdateMessage("Ya tienes la última versión instalada.", "ok");
      }
    }

    window.onNativeUpdateResult = handleUpdateResult;

    function checkForUpdates() {
      const checkBtn = document.getElementById("checkUpdatesButton");
      const latestEl = document.getElementById("latestVersionLabel");
      const downloadBtn = document.getElementById("downloadUpdateButton");

      foundUpdateDownloadUrl = "";
      foundUpdateVersion = "";
      if (checkBtn) checkBtn.disabled = true;
      if (latestEl) latestEl.textContent = "Buscando...";
      if (downloadBtn) downloadBtn.style.display = "none";
      setUpdateMessage("Buscando actualización en GitHub...", "");

      try {
        if (window.AndroidBridge && typeof AndroidBridge.checkGithubUpdates === "function") {
          AndroidBridge.checkGithubUpdates();
          return;
        }
      } catch (error) {}

      checkForUpdatesBrowser();
    }

    async function checkForUpdatesBrowser() {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}/releases/latest`, {
          headers: { "Accept": "application/vnd.github+json" }
        });
        if (!response.ok) throw new Error("GitHub respondió " + response.status);
        const release = await response.json();
        const assets = Array.isArray(release.assets) ? release.assets : [];
        const apk = assets.find(asset => String(asset.name || "").toLowerCase().endsWith(".apk"));
        handleUpdateResult({
          ok: true,
          tagName: release.tag_name || release.name || "",
          name: release.name || "",
          htmlUrl: release.html_url || "",
          apkUrl: apk ? apk.browser_download_url : (release.html_url || "")
        });
      } catch (error) {
        handleUpdateResult({ ok: false, error: error.message || String(error) });
      }
    }

    function downloadFoundUpdate() {
      if (!foundUpdateDownloadUrl) {
        toast("Primero busca una actualización");
        return;
      }

      try {
        if (window.AndroidBridge && typeof AndroidBridge.openUpdateUrl === "function") {
          AndroidBridge.openUpdateUrl(foundUpdateDownloadUrl);
          return;
        }
      } catch (error) {}

      window.location.href = foundUpdateDownloadUrl;
    }

    function openClientEdit(id) {
      const client = data.clients.find(c => c.id === id);
      if (!client) return;

      document.getElementById("editClientId").value = client.id;
      document.getElementById("editClientName").value = client.name || "";
      document.getElementById("editClientPhone").value = client.phone ? formatWhatsappPhonePretty(client.phone) : "";
      openModal("clientEditModal");
    }

    function saveClientEdit() {
      const id = document.getElementById("editClientId").value;
      const client = data.clients.find(c => c.id === id);
      if (!client) return;

      const name = document.getElementById("editClientName").value.trim();
      const phone = document.getElementById("editClientPhone").value.trim();

      if (!name) {
        alert("El nombre no puede quedar vacío.");
        return;
      }

      client.name = name;
      client.phone = sanitizePhone(phone);

      persist();
      closeModal("clientEditModal");
      renderEditClients();

      if (typeof renderNamesPage === "function") {
        const namesScreen = document.getElementById("nombres");
        if (namesScreen && namesScreen.classList.contains("active")) renderNamesPage();
      }

      if (typeof renderAbonoList === "function") {
        const abonoScreen = document.getElementById("abono");
        if (abonoScreen && abonoScreen.classList.contains("active")) renderAbonoList();
      }

      alert(client.phone ? "Cliente guardado con WhatsApp." : "Cliente guardado sin WhatsApp.");
    }


    function renderEditClients() {
      const target = document.getElementById("editClients");
      if (!target) return;

      const list = sortedClients("");
      if (!list.length) {
        target.innerHTML = '<div class="empty">Aún no hay clientes guardados.</div>';
        return;
      }

      target.innerHTML = list.map(client => {
        const hasPhone = Boolean(client.phone);
        const phonePretty = hasPhone ? formatWhatsappPhonePretty(client.phone) : "";
        const link = hasPhone ? whatsappLinkForPhone(client.phone) : "";
        const editLabel = hasPhone ? "Editar" : "Agregar WhatsApp";

        return `
          <div class="compact-row">
            <div>
              <strong>${escapeHtml(client.name)}</strong>
              ${hasPhone ? `<span class="phone-pretty">${escapeHtml(phonePretty)}</span>` : `<small>Sin WhatsApp guardado</small>`}
              ${link ? `<span class="wa-link-mini">${escapeHtml(link)}</span>` : ""}
            </div>
            <div class="compact-actions">
              ${hasPhone ? `<button class="icon-btn" onclick="openClientWhatsappTest('${escapeJs(client.id)}')">WhatsApp</button>` : ""}
              ${hasPhone ? `<button class="icon-btn" onclick="copyClientPhone('${escapeJs(client.id)}')">Copiar</button>` : ""}
              <button class="icon-btn" onclick="openClientEdit('${escapeJs(client.id)}')">${editLabel}</button>
              <button class="icon-btn danger" onclick="removeClient('${escapeJs(client.id)}')">Borrar</button>
            </div>
          </div>
        `;
      }).join("");
    }

    function addClient() {
      const nameInput = document.getElementById("newName");
      const phoneInput = document.getElementById("newPhone");
      const name = nameInput.value.trim();
      const phone = sanitizePhone(phoneInput.value.trim());

      if (!name) {
        toast("Escribe un nombre");
        return;
      }
      if (data.clients.map(c => normalize(c.name)).includes(normalize(name))) {
        toast("Ese cliente ya existe");
        return;
      }

      data.clients.push({ id: makeId(), name, phone });
      nameInput.value = "";
      phoneInput.value = "";
      persist();
      renderEditClients();
      toast("Cliente agregado");
    }

    function removeClient(id) {
      const client = data.clients.find(c => c.id === id);
      if (!client) return;

      const pendingSales = data.movements.filter(m => m.type === "venta" && m.clientId === id && getSaleRemaining(m) > 0);
      const message = pendingSales.length
        ? `¿Borrar a ${client.name}? Tiene ${pendingSales.length} boleta(s) pendiente(s). El historial queda guardado, pero ya no aparecerá para nuevos abonos.`
        : `¿Borrar a ${client.name}? No borra ventas antiguas.`;

      if (!confirm(message)) return;

      data.clients = data.clients.filter(c => c.id !== id);
      if (selectedClient && selectedClient.id === id) selectedClient = null;

      persist();
      renderEditClients();

      const namesScreen = document.getElementById("nombres");
      if (namesScreen && namesScreen.classList.contains("active")) renderNamesPage();

      const abonoScreen = document.getElementById("abono");
      if (abonoScreen && abonoScreen.classList.contains("active")) renderAbonoList();

      toast("Cliente eliminado");
    }

    function addProduct() {
      const nameInput = document.getElementById("newProductName");
      const priceInput = document.getElementById("newProductPrice");
      const costInput = document.getElementById("newProductCost");
      const colorInput = document.getElementById("newProductColor");
      const stockInput = document.getElementById("newProductStock");
      const name = nameInput.value.trim();
      const price = Math.max(0, Number(priceInput.value || 0));
      const cost = Math.max(0, Number(costInput.value || 0));
      const color = colorInput.value || "#2f80ed";
      const stock = parseOptionalStock(stockInput ? stockInput.value : "");

      if (!name) {
        toast("Escribe el nombre del producto");
        return;
      }
      if (!price) {
        toast("Ingresa un precio");
        return;
      }
      if (stock === undefined) {
        toast("Ingresa un stock válido");
        return;
      }

      data.products.push({
        id: "prod-" + makeId(),
        name,
        price,
        cost,
        color,
        stock
      });

      nameInput.value = "";
      priceInput.value = "";
      costInput.value = "";
      if (stockInput) stockInput.value = "";
      persist();
      renderEditProducts();
      toast("Producto agregado");
    }

    function removeProduct(id) {
      if (!confirm("¿Quitar este producto? No borra ventas antiguas.")) return;
      data.products = data.products.filter(product => product.id !== id);
      delete selectedCart[id];
      persist();
      renderEditProducts();
      renderProducts();
      toast("Producto quitado");
    }

    function productEditInputId(productId, field) {
      return "edit-product-" + field + "-" + String(productId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function productColorOptions(selectedColor) {
      const colors = [
        ["#8b5a2b", "Café"],
        ["#f2c94c", "Amarillo"],
        ["#eb5757", "Rojo"],
        ["#ff7a00", "Naranja"],
        ["#28c76f", "Verde"],
        ["#2f80ed", "Azul"],
        ["#9b51e0", "Morado"],
        ["#111827", "Negro"]
      ];
      const value = String(selectedColor || "#2f80ed").toLowerCase();
      return colors.map(([color, label]) => `<option value="${escapeAttr(color)}" ${color.toLowerCase() === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
    }

    function renderEditProducts() {
      const target = document.getElementById("editProducts");
      if (!target) return;

      if (!data.products.length) {
        target.innerHTML = '<div class="empty">No hay productos guardados.</div>';
        return;
      }

      target.innerHTML = data.products.map(product => {
        const stock = productStock(product);
        const stockValue = stock === null ? "" : String(stock);
        const gain = Number(product.price || 0) - Number(product.cost || 0);

        if (editingProductId === product.id) {
          return `
            <div class="compact-row product-edit-row">
              <div class="product-edit-grid">
                <input class="wide" id="${escapeAttr(productEditInputId(product.id, "name"))}" value="${escapeAttr(product.name || "")}" placeholder="Nombre" autocomplete="off" />
                <input id="${escapeAttr(productEditInputId(product.id, "price"))}" type="number" min="0" step="10" value="${escapeAttr(product.price || 0)}" placeholder="Precio" />
                <input id="${escapeAttr(productEditInputId(product.id, "cost"))}" type="number" min="0" step="10" value="${escapeAttr(product.cost || 0)}" placeholder="Costo" />
                <input id="${escapeAttr(productEditInputId(product.id, "stock"))}" type="number" min="0" step="1" value="${escapeAttr(stockValue)}" placeholder="Stock vacío = libre" />
                <select id="${escapeAttr(productEditInputId(product.id, "color"))}">${productColorOptions(product.color)}</select>
                <button class="secondary-action" onclick="saveEditedProduct('${escapeJs(product.id)}')">Guardar</button>
                <button class="secondary-action" onclick="cancelEditProduct()">Cancelar</button>
                <button class="danger-action wide" onclick="removeProduct('${escapeJs(product.id)}')">Borrar producto</button>
              </div>
            </div>
          `;
        }

        return `
          <div class="compact-row product-compact-row">
            <div>
              <div class="product-main-line">
                <strong><span class="mini-color-dot" style="background:${escapeAttr(product.color || "#2f80ed")}"></span>${escapeHtml(product.name)}</strong>
                <span class="product-stock-chip">${escapeHtml(stockLabel(product))}</span>
              </div>
              <small>${formatMoney(product.price || 0)} venta · ${formatMoney(product.cost || 0)} costo · ${formatMoney(gain)} gana</small>
            </div>
            <div class="compact-actions">
              <button class="icon-btn" onclick="startEditProduct('${escapeJs(product.id)}')">Editar</button>
              <button class="icon-btn danger" onclick="removeProduct('${escapeJs(product.id)}')">Borrar</button>
            </div>
          </div>
        `;
      }).join("");
    }

    function startEditProduct(id) {
      editingProductId = id;
      renderEditProducts();
      setTimeout(() => {
        const input = document.getElementById(productEditInputId(id, "name"));
        if (input) input.focus();
      }, 0);
    }

    function cancelEditProduct() {
      editingProductId = null;
      renderEditProducts();
    }

    function saveEditedProduct(id) {
      const product = data.products.find(p => p.id === id);
      if (!product) return;

      const nameInput = document.getElementById(productEditInputId(id, "name"));
      const priceInput = document.getElementById(productEditInputId(id, "price"));
      const costInput = document.getElementById(productEditInputId(id, "cost"));
      const stockInput = document.getElementById(productEditInputId(id, "stock"));
      const colorInput = document.getElementById(productEditInputId(id, "color"));

      const name = nameInput ? nameInput.value.trim() : "";
      const price = Math.max(0, Number(priceInput ? priceInput.value || 0 : 0));
      const cost = Math.max(0, Number(costInput ? costInput.value || 0 : 0));
      const stock = parseOptionalStock(stockInput ? stockInput.value : "");
      const color = colorInput ? colorInput.value : product.color;

      if (!name) {
        toast("El nombre no puede quedar vacío");
        return;
      }
      if (!price) {
        toast("Ingresa un precio");
        return;
      }
      if (stock === undefined) {
        toast("Ingresa un stock válido");
        return;
      }

      product.name = name;
      product.price = price;
      product.cost = cost;
      product.stock = stock;
      product.color = color || "#2f80ed";

      editingProductId = null;
      persist();
      renderEditProducts();
      renderProducts();
      toast("Producto actualizado");
    }

    function quickEditProduct(id) {
      startEditProduct(id);
    }

    function saveProductsFromForm() {
      data.products = data.products.map(product => ({
        ...product,
        name: document.getElementById("prod-name-" + product.id).value.trim() || product.name,
        price: Math.max(0, Number(document.getElementById("prod-price-" + product.id).value || 0)),
        cost: Math.max(0, Number(document.getElementById("prod-cost-" + product.id).value || 0)),
        color: document.getElementById("prod-color-" + product.id).value || product.color || "#2f80ed",
        stock: parseOptionalStock(document.getElementById("prod-stock-" + product.id)?.value ?? product.stock) ?? null
      }));
      persist();
      renderEditProducts();
      renderProducts();
      toast("Productos guardados");
    }

    function resetAll() {
      if (!confirm("¿Borrar clientes, productos e historial?")) return;
      data = normalizeLoadedData(structuredDefault());
      selectedCart = {};
      persist();
      renderEditClients();
      renderEditProducts();
      renderHistory();
      toast("Datos reiniciados");
    }

    function exportCSV() {
      const rows = [["tipo", "cliente", "fecha", "boleta", "productos", "total", "costo", "ganancia", "pendiente", "estado", "metodo", "monto_abono"]];
      data.movements.slice().reverse().forEach(m => {
        if (m.type === "venta") {
          rows.push([
            "venta",
            m.clientName || "",
            formatCsvDateTime(m.createdAt),
            formatReceiptNumber(m.boletaNumber),
            plainMovementProducts(m),
            Number(m.total || 0),
            Number(getSaleCost(m) || 0),
            Number(getSaleProfit(m) || 0),
            Number(getSaleRemaining(m) || 0),
            getSaleStateText(m),
            m.method || m.lastPaymentMethod || "",
            ""
          ]);
        } else {
          rows.push([
            "abono",
            m.clientName || "",
            formatCsvDateTime(m.createdAt),
            (m.applied || []).map(a => formatReceiptNumber(a.boletaNumber)).join(", "),
            "",
            "",
            "",
            "",
            "",
            "Abono",
            m.method || "Efectivo",
            Number(m.amount || 0)
          ]);
        }
      });

      const csv = "sep=;\r\n" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
      const csvContent = "\ufeff" + csv;
      const filename = "prisma-historial.csv";

      if (window.AndroidBridge && typeof window.AndroidBridge.saveCsv === "function") {
        window.AndroidBridge.saveCsv(filename, csvContent);
        return;
      }

      downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8" }), filename);
      toast("CSV exportado");
    }

    function csvCell(value) {
      const clean = String(value ?? "")
        .replace(/\uFEFF/g, "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replaceAll('"', '""');
      return `"${clean}"`;
    }

    function crearPayloadRespaldo() {
      return {
        app: "Prisma",
        version: 4,
        exportedAt: new Date().toISOString(),
        data: {
          clients: data.clients,
          products: data.products,
          movements: data.movements,
          nextReceiptNumber: data.nextReceiptNumber,
          settings: getSettings()
        }
      };
    }

    function nombreArchivoRespaldo() {
      return "prisma-respaldo-" + localDayKey() + ".json";
    }

    function guardarRespaldoJSON() {
      try {
        const json = JSON.stringify(crearPayloadRespaldo(), null, 2);
        const filename = nombreArchivoRespaldo();

        if (window.AndroidBridge && typeof window.AndroidBridge.saveJson === "function") {
          window.AndroidBridge.saveJson(filename, json);
          return;
        }

        downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), filename);
        toast("Respaldo JSON generado");
      } catch (err) {
        console.error(err);
        alert("No se pudo guardar el respaldo JSON.");
      }
    }

    async function compartirRespaldoJSON() {
      try {
        const json = JSON.stringify(crearPayloadRespaldo(), null, 2);
        const filename = nombreArchivoRespaldo();

        if (window.AndroidBridge && typeof window.AndroidBridge.shareJson === "function") {
          window.AndroidBridge.shareJson(filename, json);
          return;
        }

        const file = new File([new Blob([json], { type: "application/json;charset=utf-8" })], filename, { type: "application/json" });
        if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ title: "Respaldo Prisma", files: [file] });
          toast("Respaldo compartido");
          return;
        }

        guardarRespaldoJSON();
      } catch (err) {
        console.error(err);
        guardarRespaldoJSON();
      }
    }

    function cargarRespaldoJSON(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = function() {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          const imported = parsed.data || parsed;

          if (!imported || typeof imported !== "object") {
            throw new Error("JSON vacío");
          }

          data = normalizeLoadedData(imported);
          if (typeof renumberReceipts === "function") renumberReceipts();
          persist();

          if (typeof renderEditClients === "function") renderEditClients();
          if (typeof renderEditProducts === "function") renderEditProducts();
          if (typeof renderHistory === "function") renderHistory();
          if (typeof renderProfitDashboard === "function") renderProfitDashboard();

          alert("Respaldo JSON cargado correctamente.");
        } catch (err) {
          console.error(err);
          alert("No se pudo cargar el respaldo. Revisa que sea un JSON válido de Prisma.");
        } finally {
          event.target.value = "";
        }
      };

      reader.readAsText(file, "utf-8");
    }



    let profitPinValue = "";

    function openProfitPin() {
      profitPinValue = "";
      if (!getProfitPin()) {
        const pin = document.getElementById("initialProfitPin");
        const confirmPin = document.getElementById("initialProfitPinConfirm");
        if (pin) pin.value = "";
        if (confirmPin) confirmPin.value = "";
        openModal("setProfitPinModal");
        return;
      }
      updateProfitPinDisplay();
      openModal("profitPinModal");
    }

    function pressProfitPin(number) {
      if (profitPinValue.length >= 4) return;
      profitPinValue += String(number);
      updateProfitPinDisplay();
      if (profitPinValue.length === 4) {
        setTimeout(submitProfitPin, 120);
      }
    }

    function deleteProfitPin() {
      profitPinValue = profitPinValue.slice(0, -1);
      updateProfitPinDisplay();
    }

    function updateProfitPinDisplay() {
      const display = document.getElementById("profitPinDisplay");
      if (!display) return;
      display.textContent = profitPinValue ? "•".repeat(profitPinValue.length) : "----";
    }

    function submitProfitPin() {
      if (profitPinValue !== getProfitPin()) {
        profitPinValue = "";
        updateProfitPinDisplay();
        toast("Clave incorrecta");
        return;
      }

      closeModal("profitPinModal");
      openModal("profitModal");
      const profitRange = document.getElementById("profitRange");
      if (profitRange) profitRange.value = "all";
      renderProfitDashboard();
    }

    function saveInitialProfitPin() {
      const pinInput = document.getElementById("initialProfitPin");
      const confirmInput = document.getElementById("initialProfitPinConfirm");
      const pin = normalizePin(pinInput ? pinInput.value : "");
      const confirmPin = normalizePin(confirmInput ? confirmInput.value : "");
      if (pin.length !== 4) {
        toast("La clave debe tener 4 números");
        return;
      }
      if (pin !== confirmPin) {
        toast("Las claves no coinciden");
        return;
      }

      getSettings().profitPin = pin;
      persist();
      closeModal("setProfitPinModal");
      openModal("profitModal");
      const profitRange = document.getElementById("profitRange");
      if (profitRange) profitRange.value = "all";
      renderProfitDashboard();
      toast("Clave creada");
    }


    function getProfitRangeDates() {
      const range = document.getElementById("profitRange") ? document.getElementById("profitRange").value : "today";
      const now = new Date();
      let start = new Date(0);
      let end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (range === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (range === "week") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      } else if (range === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }

      return { start, end, range };
    }

    function inRange(dateValue, start, end) {
      const d = new Date(dateValue);
      return d >= start && d < end;
    }

    function getItemUnitCost(item) {
      const explicit = Number(item.cost || 0);
      if (explicit > 0) return explicit;
      const product = data.products.find(p => p.id === item.id || normalize(p.name) === normalize(item.name));
      return Math.max(0, Number(product ? product.cost || 0 : 0));
    }

    function getSaleCost(sale) {
      return (sale.items || []).reduce((sum, item) => sum + getItemUnitCost(item) * Number(item.qty || 0), 0);
    }

    function getSaleProfit(sale) {
      return Number(sale.total || 0) - getSaleCost(sale);
    }

    function collectPaymentEvents() {
      const events = [];
      data.movements.forEach(m => {
        if (m.type !== "venta") return;
        if (Array.isArray(m.payments) && m.payments.length) {
          m.payments.forEach(p => {
            events.push({
              clientName: m.clientName,
              method: p.method || m.method || "Efectivo",
              amount: Number(p.amount || 0),
              createdAt: p.createdAt || m.createdAt,
              saleId: m.id,
              boletaNumber: m.boletaNumber
            });
          });
        } else if (Number(m.amountPaid || 0) > 0) {
          events.push({
            clientName: m.clientName,
            method: m.method || m.lastPaymentMethod || "Efectivo",
            amount: Number(m.amountPaid || 0),
            createdAt: m.createdAt,
            saleId: m.id,
            boletaNumber: m.boletaNumber
          });
        }
      });
      return events;
    }

    function renderProfitDashboard() {
      const target = document.getElementById("profitDashboard");
      if (!target) return;

      const rangeSelect = document.getElementById("profitRange");
      if (rangeSelect && !rangeSelect.value) rangeSelect.value = "all";

      const rangeData = getProfitRangeDates();
      const range = rangeSelect ? rangeSelect.value : (rangeData.range || "all");
      const startDate = rangeData.start;
      const endDate = rangeData.end;

      const allSales = typeof getSales === "function"
        ? getSales()
        : (data.movements || []).filter(m => m.type === "venta");

      const sales = allSales.filter(sale => {
        const date = new Date(sale.createdAt || sale.date || Date.now());
        return date >= startDate && date < endDate;
      });

      let totalSales = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let collected = 0;
      let pending = 0;
      let units = 0;

      const productMap = {};
      const clientMap = {};

      for (const sale of sales) {
        const saleTotal = Number(sale.total || 0);
        const salePaid = Number(sale.amountPaid ?? sale.paidAmount ?? 0);
        const saleBalance = typeof getSaleRemaining === "function"
          ? getSaleRemaining(sale)
          : Math.max(0, saleTotal - salePaid);

        totalSales += saleTotal;
        collected += salePaid;
        pending += saleBalance;

        const clientName = sale.clientName || "Sin cliente";
        if (!clientMap[clientName]) {
          clientMap[clientName] = {
            name: clientName,
            sales: 0,
            paid: 0,
            pending: 0,
            profit: 0,
            count: 0
          };
        }

        clientMap[clientName].sales += saleTotal;
        clientMap[clientName].paid += salePaid;
        clientMap[clientName].pending += saleBalance;
        clientMap[clientName].count += 1;

        const items = sale.items || [];
        for (const item of items) {
          const qty = Number(item.qty || item.quantity || 1);
          const price = Number(item.price || 0);
          const cost = typeof getItemUnitCost === "function"
            ? getItemUnitCost(item)
            : Number(item.cost || 0);

          const subtotal = Number(item.total ?? item.subtotal ?? price * qty);
          const itemCost = cost * qty;
          const itemProfit = subtotal - itemCost;

          units += qty;
          totalCost += itemCost;
          totalProfit += itemProfit;
          clientMap[clientName].profit += itemProfit;

          const key = item.name || "Producto";
          if (!productMap[key]) {
            productMap[key] = {
              name: key,
              units: 0,
              sales: 0,
              cost: 0,
              profit: 0
            };
          }

          productMap[key].units += qty;
          productMap[key].sales += subtotal;
          productMap[key].cost += itemCost;
          productMap[key].profit += itemProfit;
        }
      }

      const saleCount = sales.length;
      const margin = totalSales ? (totalProfit / totalSales) * 100 : 0;
      const averageTicket = saleCount ? totalSales / saleCount : 0;

      const products = Object.values(productMap).sort((a, b) => b.profit - a.profit);
      const clients = Object.values(clientMap).sort((a, b) => b.profit - a.profit);

      const starProduct = products[0];
      const biggestDebt = [...clients].sort((a, b) => b.pending - a.pending)[0];
      const maxProductProfit = Math.max(1, ...products.map(p => p.profit));

      const summaryHtml = `
        <div class="profit-hero-grid">
          <div class="profit-hero-card purple">
            <small>Ventas totales</small>
            <strong>${formatMoney(totalSales)}</strong>
            <div class="profit-mini-note">${saleCount} boleta(s) · ${units} un.</div>
          </div>
          <div class="profit-hero-card green">
            <small>Utilidad descontando costos</small>
            <strong>${formatMoney(totalProfit)}</strong>
            <div class="profit-mini-note">Costo mercadería ${formatMoney(totalCost)}</div>
          </div>
          <div class="profit-hero-card green">
            <small>Cobrado</small>
            <strong>${formatMoney(collected)}</strong>
            <div class="profit-mini-note">Entró a caja</div>
          </div>
          <div class="profit-hero-card">
            <small>Por cobrar</small>
            <strong>${formatMoney(pending)}</strong>
            <div class="profit-mini-note">Saldo pendiente</div>
          </div>
        </div>

        <div class="profit-card-compact">
          <h3>Resumen rápido</h3>
          <div class="profit-row">
            <div>
              <strong>Margen</strong>
              <small>Utilidad / ventas</small>
            </div>
            <b>${margin.toFixed(1)}%</b>
          </div>
          <div class="profit-row">
            <div>
              <strong>Ticket promedio</strong>
              <small>Venta promedio</small>
            </div>
            <b>${formatMoney(averageTicket)}</b>
          </div>
          <div class="profit-row">
            <div>
              <strong>Producto estrella</strong>
              <small>${starProduct ? starProduct.units + " unidades vendidas" : "Sin ventas"}</small>
            </div>
            <b>${starProduct ? escapeHtml(starProduct.name) : "-"}</b>
          </div>
          <div class="profit-row">
            <div>
              <strong>Mayor deuda</strong>
              <small>Pendiente</small>
            </div>
            <b>${biggestDebt && biggestDebt.pending > 0 ? escapeHtml(biggestDebt.name) + " · " + formatMoney(biggestDebt.pending) : "-"}</b>
          </div>
        </div>
      `;

      const productsHtml = `
        <div class="profit-card-compact">
          <h3>Productos</h3>
          ${products.length ? `
            <div class="profit-list-compact">
              ${products.slice(0, 8).map(product => {
                const pct = Math.max(4, Math.min(100, (product.profit / maxProductProfit) * 100));
                const itemMargin = product.sales ? (product.profit / product.sales) * 100 : 0;
                return `
                  <div class="profit-list-item">
                    <div class="profit-row">
                      <div>
                        <strong>${escapeHtml(product.name)}</strong>
                        <small>${product.units} un. · Venta ${formatMoney(product.sales)} · Costo ${formatMoney(product.cost)} · Margen ${itemMargin.toFixed(1)}%</small>
                      </div>
                      <b>${formatMoney(product.profit)}</b>
                    </div>
                    <div class="bar"><span style="width:${pct}%"></span></div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : '<div class="empty">Aún no hay productos vendidos en este rango.</div>'}
        </div>
      `;

      const clientsHtml = `
        <div class="profit-card-compact">
          <h3>Clientes</h3>
          ${clients.length ? `
            <div class="profit-list-compact">
              ${clients.slice(0, 10).map(client => `
                <div class="profit-list-item">
                  <div class="profit-row">
                    <div>
                      <strong>${escapeHtml(client.name)}</strong>
                      <small>Ventas ${formatMoney(client.sales)} · Cobrado ${formatMoney(client.paid)} · Pendiente ${formatMoney(client.pending)}</small>
                    </div>
                    <b>${formatMoney(client.profit)}</b>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : '<div class="empty">Aún no hay clientes en este rango.</div>'}
        </div>
      `;

      target.innerHTML = `
        <div class="profit-tabs">
          <button class="profit-tab active" onclick="profitGoSlide(0)">Resumen</button>
          <button class="profit-tab" onclick="profitGoSlide(1)">Productos</button>
          <button class="profit-tab" onclick="profitGoSlide(2)">Clientes</button>
        </div>

        <div id="profitSlider" class="profit-slider" onscroll="profitSyncTabs()">
          <section class="profit-slide">${summaryHtml}</section>
          <section class="profit-slide">${productsHtml}</section>
          <section class="profit-slide">${clientsHtml}</section>
        </div>

        <div class="pill">Rango: ${range === "all" ? "Todo" : range === "today" ? "Hoy" : range === "week" ? "Semana" : "Mes"}</div>
      `;
    }

    function profitGoSlide(index) {
      const slider = document.getElementById("profitSlider");
      if (!slider) return;

      const width = slider.clientWidth || 1;
      slider.scrollTo({ left: width * index, behavior: "smooth" });

      document.querySelectorAll(".profit-tab").forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
      });
    }

    function profitSyncTabs() {
      const slider = document.getElementById("profitSlider");
      if (!slider) return;

      const width = slider.clientWidth || 1;
      const index = Math.round(slider.scrollLeft / width);

      document.querySelectorAll(".profit-tab").forEach((tab, i) => {
        tab.classList.toggle("active", i === index);
      });
    }


    function rangeLabel(range) {
      if (range === "today") return "Hoy";
      if (range === "week") return "Últimos 7 días";
      if (range === "month") return "Este mes";
      return "Todo";
    }

    function profitCard(title, value, note, tone) {
      return `<div class="profit-card ${tone || ""}"><small>${escapeHtml(title)}</small><strong>${escapeHtml(value)}</strong><span class="kpi-pill">${escapeHtml(note)}</span></div>`;
    }

    function productProfitRow(product, maxProfit) {
      const margin = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0;
      const width = Math.max(4, Math.min(100, (Math.max(0, product.profit) / maxProfit) * 100));
      return `<div class="profit-row"><div><strong>${escapeHtml(product.name)}</strong><small>${product.qty} un. · Venta ${formatMoney(product.revenue)} · Costo ${formatMoney(product.cost)} · Margen ${margin.toFixed(1)}%</small><div class="profit-bar"><span style="width:${width}%"></span></div></div><div class="profit-money">${formatMoney(product.profit)}</div></div>`;
    }






    function safeDeleteReceiptFromList(id) {
      alert("Para borrar una boleta, abre la boleta y toca Eliminar boleta debajo de Cerrar.");
    }

    function safeDeleteCurrentReceipt() {
      const sale = currentSale && currentSale();
      if (!sale) {
        alert("No hay boleta seleccionada.");
        return;
      }
      if (sale.accumulated) {
        alert("La boleta acumulada solo se comparte. Para eliminar, abre una boleta individual.");
        return;
      }

      const number = sale.boletaNumber ? formatReceiptNumber(sale.boletaNumber) : "";
      const client = sale.clientName || "cliente";

      const ok = confirm(
        "¿Eliminar esta boleta?\\n\\n" +
        "Boleta " + number + " · " + client + "\\n\\n" +
        "Esta acción quitará la venta del historial y recalculará las boletas."
      );

      if (!ok) return;

      deleteMovement(sale.id);

      closeModal("receiptModal");
      closeModal("afterSaleModal");

      if (typeof renderHistory === "function") renderHistory();
      if (typeof renderHomeStats === "function") renderHomeStats();

      alert("Boleta eliminada.");
    }

    function ensureReceiptDeleteButton() {
      const modal = document.getElementById("receiptModal");
      if (!modal) return;

      const sheet = modal.querySelector(".sheet") || modal.querySelector(".modal-card") || modal;
      if (!sheet) return;

      if (sheet.querySelector(".safe-delete-zone")) return;

      const zone = document.createElement("div");
      zone.className = "safe-delete-zone";
      zone.innerHTML = '<button class="safe-delete-btn" onclick="safeDeleteCurrentReceipt()">Eliminar boleta</button>';

      sheet.appendChild(zone);
    }


    function showReceipt(id) {
      const sale = getSaleById(id);
      if (!sale) {
        toast("No encontré la boleta");
        return;
      }
      currentReceiptSaleId = id;
      currentReceiptCustom = null;
      const target = document.getElementById("receiptPreview");
      target.innerHTML = "";
      target.appendChild(createReceiptNode(sale));
      openModal("receiptModal");
      ensureReceiptDeleteButton();
    }

    function currentSale() {
      return currentReceiptCustom || getSaleById(currentReceiptSaleId);
    }

    function createReceiptNode(sale) {
      const card = document.createElement("div");
      card.className = "receipt-card" + (sale.accumulated ? " accumulated" : "");

      const remaining = getSaleRemaining(sale);
      const headerName = sale.clientName || "CLIENTE";
      const paymentLabel = sale.accumulated
        ? "Pendiente acumulado"
        : (remaining <= 0 ? (sale.lastPaymentMethod || sale.method || "Pagado") : (Number(sale.amountPaid || 0) > 0 ? "Abono parcial" : "Sin pago"));
      const stampHtml = sale.accumulated ? '' : (remaining <= 0
        ? '<div class="receipt-paid-stamp">PAGADO</div>'
        : (Number(sale.amountPaid || 0) > 0 ? '<div class="receipt-abonado-stamp">ABONADO</div>' : ''));

      const itemsHtml = (sale.items || []).map(item => sale.accumulated ? `
        <div class="receipt-item">
          <div class="receipt-item-name">${escapeHtml(item.name)}</div>
          <div class="receipt-item-qty">${item.qty}</div>
          <div class="receipt-item-total">${formatMoney(item.total)}</div>
          <div class="receipt-item-date">${escapeHtml(item.date || "")}</div>
        </div>
      ` : `
        <div class="receipt-item">
          <div class="receipt-item-name">${escapeHtml(item.name)}</div>
          <div class="receipt-item-qty">${item.qty}</div>
          <div class="receipt-item-total">${formatMoney(item.total)}</div>
        </div>
      `).join("");

      card.innerHTML = `
        <div class="receipt-head">
          <div class="receipt-title">CLIENTE: ${escapeHtml(headerName.toUpperCase())}</div>
          <div class="receipt-sub">${sale.accumulated ? "Pendientes al " + escapeHtml(shortReceiptDate(new Date())) : escapeHtml(formatDateTime(sale.createdAt))}</div>
        </div>

        <div class="receipt-meta">
          <div class="receipt-row"><span class="receipt-left">Boleta</span><span class="receipt-right">${sale.accumulated ? "Acumulada" : escapeHtml(formatReceiptNumber(sale.boletaNumber))}</span></div>
          <div class="receipt-row"><span class="receipt-left">Pago</span><span class="receipt-right">${escapeHtml(paymentLabel)}</span></div>
          <div class="receipt-row"><span class="receipt-left">Pendiente</span><span class="receipt-right">${escapeHtml(formatMoney(remaining))}</span></div>
        </div>
        <div class="receipt-section">
          <div class="receipt-table-head">
            <div>Producto</div>
            <div style="text-align:right">Cant.</div>
            <div style="text-align:right">Subtotal</div>
            ${sale.accumulated ? '<div style="text-align:right">Fecha</div>' : ''}
          </div>
          ${itemsHtml}
        </div>

        <div class="receipt-summary">
          <div class="receipt-line"><span>Total</span><strong>${formatMoney(sale.total)}</strong></div>
          <div class="receipt-line"><span>Abonado</span><span>${formatMoney(sale.amountPaid || 0)}</span></div>
          <div class="receipt-line"><span>Saldo</span><span>${formatMoney(remaining)}</span></div>
        </div>

        ${stampHtml}

        <div class="receipt-footer">
          <div>${sale.accumulated ? "Boleta acumulada de pendientes" : "Boleta " + escapeHtml(formatReceiptNumber(sale.boletaNumber))}</div>
          <div style="margin-top:8px;">Gracias por su compra</div>
        </div>
      `;
      return card;
    }

    let shareBusy = false;

    function setShareBusy(isBusy) {
      document.querySelectorAll('button[onclick="compartirImagenWhatsApp()"]').forEach(button => {
        if (!button.dataset.originalText) button.dataset.originalText = button.textContent || "Compartir con cliente";
        button.classList.toggle("share-busy", isBusy);
        button.textContent = isBusy ? "Abriendo WhatsApp..." : button.dataset.originalText;
      });
    }



    function phoneForSale(sale) {
      if (!sale) return "";

      const direct = sale.clientPhone || sale.phone || sale.whatsapp || "";
      if (direct) return sanitizePhone(direct);

      const client = data.clients.find(c =>
        c.id === sale.clientId ||
        normalize(c.name) === normalize(sale.clientName || "")
      );

      return client && client.phone ? sanitizePhone(client.phone) : "";
    }




    async function compartirImagenWhatsApp() {
      if (shareBusy) return;

      const sale = currentSale();
      if (!sale) {
        alert("No hay boleta seleccionada.");
        return;
      }

      shareBusy = true;
      setShareBusy(true);

      try {
        const blob = await buildReceiptImageCanvas(sale);
        const filename = sale.accumulated
          ? `boleta-acumulada-${safeFileName(sale.clientName || "cliente")}.png`
          : `boleta-${formatReceiptNumber(sale.boletaNumber)}-${safeFileName(sale.clientName || "cliente")}.png`;
        const phone = phoneForSale(sale);

        if (window.AndroidBridge && typeof window.AndroidBridge.shareImageToPhone === "function" && phone) {
          const dataUrl = await blobToDataUrl(blob);
          window.AndroidBridge.shareImageToPhone(dataUrl, filename, phone);

          setTimeout(() => {
            shareBusy = false;
            setShareBusy(false);
          }, 1800);

          return;
        }

        if (window.AndroidBridge && typeof window.AndroidBridge.shareImage === "function") {
          const dataUrl = await blobToDataUrl(blob);
          window.AndroidBridge.shareImage(dataUrl, filename);

          setTimeout(() => {
            shareBusy = false;
            setShareBusy(false);
          }, 1800);

          return;
        }

        const file = new File([blob], filename, { type: "image/png" });

        if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }

        alert("Tu navegador no permite compartir imagen.");
      } catch (err) {
        console.error(err);
        alert("No se pudo compartir la boleta.");
      } finally {
        if (!(window.AndroidBridge && typeof window.AndroidBridge.shareImage === "function")) {
          shareBusy = false;
          setShareBusy(false);
        }
      }
    }

    function blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    async function buildReceiptImageCanvas(sale) {
      const scale = window.AndroidBridge ? 1.35 : 2;
      const width = 720;
      const margin = 42;
      const items = sale.items || [];
      const remaining = getSaleRemaining(sale);
      const isAccumulated = !!sale.accumulated;
      const height = 700 + Math.max(1, items.length) * (isAccumulated ? 82 : 74);

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      let y = 58;
      const black = "#111111";
      const muted = "#4b5563";
      const dash = "#9ca3af";

      ctx.textAlign = "center";
      ctx.fillStyle = black;
      ctx.font = "900 36px Arial";
      fitCenteredCanvasText(ctx, "CLIENTE: " + (sale.clientName || "CLIENTE").toUpperCase(), width / 2, y, width - margin * 2);
      y += 36;

      ctx.fillStyle = muted;
      ctx.font = "24px Arial";
      ctx.fillText(isAccumulated ? "Pendientes al " + shortReceiptDate(new Date()) : formatDateTime(sale.createdAt), width / 2, y);
      y += 40;

      dashedLine(ctx, margin, y, width - margin, y, dash);
      y += 34;

      y = canvasPair(ctx, "Boleta", isAccumulated ? "Acumulada" : formatReceiptNumber(sale.boletaNumber), margin, width - margin, y);
      y = canvasPair(ctx, "Pago", isAccumulated ? "Pendiente acumulado" : (remaining <= 0 ? (sale.lastPaymentMethod || sale.method || "Pagado") : (Number(sale.amountPaid || 0) > 0 ? "Abono parcial" : "Sin pago")), margin, width - margin, y);
      y = canvasPair(ctx, "Pendiente", formatMoney(remaining), margin, width - margin, y);

      y += 12;
      dashedLine(ctx, margin, y, width - margin, y, dash);
      y += 38;

      ctx.fillStyle = muted;
      ctx.textAlign = "left";
      ctx.font = "900 18px Arial";
      ctx.fillText("PRODUCTO", margin, y);
      ctx.textAlign = "right";
      const qtyX = isAccumulated ? width - margin - 190 : width - margin - 130;
      const subtotalX = isAccumulated ? width - margin - 76 : width - margin;
      ctx.fillText("CANT.", qtyX, y);
      ctx.fillText("SUBTOTAL", subtotalX, y);
      if (isAccumulated) ctx.fillText("FECHA", width - margin, y);
      y += 22;

      dashedLine(ctx, margin, y, width - margin, y, dash);
      y += 42;

      items.forEach(item => {
        ctx.textAlign = "left";
        ctx.fillStyle = black;
        ctx.font = "900 26px Arial";
        fitLeftCanvasText(ctx, item.name, margin, y, isAccumulated ? 285 : 360, 26, 20);

        ctx.textAlign = "right";
        ctx.font = "26px Arial";
        ctx.fillText(String(item.qty), qtyX, y);

        ctx.font = "900 26px Arial";
        ctx.fillText(formatMoney(item.total), subtotalX, y);

        if (isAccumulated) {
          ctx.font = "22px Arial";
          ctx.fillStyle = muted;
          ctx.fillText(String(item.date || ""), width - margin, y);
        }
        y += isAccumulated ? 64 : 56;
      });

      y += 8;
      dashedLine(ctx, margin, y, width - margin, y, dash);
      y += 58;

      ctx.textAlign = "left";
      ctx.fillStyle = black;
      ctx.font = "28px Arial";
      ctx.fillText("TOTAL", margin, y);
      ctx.textAlign = "right";
      ctx.font = "900 44px Arial";
      ctx.fillText(formatMoney(sale.total), width - margin, y);
      y += 40;

      ctx.textAlign = "left";
      ctx.fillStyle = black;
      ctx.font = "24px Arial";
      ctx.fillText("ABONADO", margin, y);
      ctx.textAlign = "right";
      ctx.fillText(formatMoney(sale.amountPaid || 0), width - margin, y);
      y += 34;

      ctx.textAlign = "left";
      ctx.fillText("SALDO", margin, y);
      ctx.textAlign = "right";
      ctx.fillText(formatMoney(remaining), width - margin, y);
      y += 56;

      if (!isAccumulated && remaining <= 0) {
        ctx.save();
        ctx.translate(width / 2, y + 35);
        ctx.rotate(-0.12);
        ctx.strokeStyle = "#1f9d55";
        ctx.lineWidth = 4;
        roundRectStroke(ctx, -120, -32, 240, 64, 12);
        ctx.font = "900 30px Arial";
        ctx.fillStyle = "#1f9d55";
        ctx.textAlign = "center";
        ctx.fillText("PAGADO", 0, 10);
        ctx.restore();
        y += 90;
      } else if (!isAccumulated && Number(sale.amountPaid || 0) > 0) {
        ctx.save();
        ctx.translate(width / 2, y + 35);
        ctx.rotate(-0.12);
        ctx.strokeStyle = "#d97706";
        ctx.lineWidth = 4;
        roundRectStroke(ctx, -130, -32, 260, 64, 12);
        ctx.font = "900 30px Arial";
        ctx.fillStyle = "#d97706";
        ctx.textAlign = "center";
        ctx.fillText("ABONADO", 0, 10);
        ctx.restore();
        y += 90;
      }

      dashedLine(ctx, margin, y, width - margin, y, dash);
      y += 36;

      ctx.textAlign = "center";
      ctx.fillStyle = muted;
      ctx.font = "24px Arial";
      ctx.fillText(isAccumulated ? "Boleta acumulada de pendientes" : "Boleta " + formatReceiptNumber(sale.boletaNumber), width / 2, y);
      y += 30;
      ctx.fillText("Gracias por su compra", width / 2, y);

      return await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("No se pudo generar PNG"));
        }, "image/png");
      });
    }


    function fitLeftCanvasText(ctx, text, x, y, maxWidth, startSize = 26, minSize = 18) {
      let size = startSize;
      while (size > minSize) {
        ctx.font = "900 " + size + "px Arial";
        if (ctx.measureText(String(text || "")).width <= maxWidth) break;
        size -= 1;
      }
      ctx.textAlign = "left";
      ctx.fillText(String(text || ""), x, y);
    }

    function fitCenteredCanvasText(ctx, text, x, y, maxWidth) {
      let size = 36;
      while (size > 22) {
        ctx.font = "900 " + size + "px Arial";
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
      }
      ctx.textAlign = "center";
      ctx.fillText(text, x, y);
    }

    function canvasPair(ctx, left, right, x1, x2, y) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#4b5563";
      ctx.font = "24px Arial";
      ctx.fillText(left, x1, y);

      ctx.textAlign = "right";
      ctx.fillStyle = "#111111";
      ctx.font = "900 24px Arial";
      ctx.fillText(right, x2, y);
      return y + 36;
    }

    function dashedLine(ctx, x1, y1, x2, y2, color) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    function roundRectStroke(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.stroke();
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function openModal(id) {
      document.getElementById(id).classList.add("show");
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove("show");
    }

    function toast(text) {
      // Avisos visuales desactivados para no cortar pantalla completa.
      console.log(text);
    }

    async function toggleFullscreen() {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          toast("Pantalla completa activada");
        } else {
          await document.exitFullscreen();
          toast("Pantalla completa desactivada");
        }
      } catch {
        toast("El navegador no permitió pantalla completa");
      }
    }


    function safeFileName(text) {
      return String(text || "boleta").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\-]+/g, "-");
    }

    function escapeHtml(text) {
      return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttr(text) {
      return escapeHtml(text).replaceAll("`", "&#096;");
    }

    function escapeJs(text) {
      return String(text).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
    }

    applyVisualTheme();
    renderAppTitle();
    renderHomeStats();
    renderProducts();
