/* ============================================================
   E-School Finance — Application de gestion financière
   Stockage : localStorage (aucune base de données externe)
   ============================================================ */

const STORAGE_KEY = "esf_data_v1";
const SESSION_KEY = "esf_session_v1";

const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

/* ---------- Default state ---------- */
function defaultState() {
  return {
    auth: { password: "tresorier2026" },
    formateurs: [],
    paiements: [],   // {id, formateurId, mois(0-11), annee, montant, date, statut:'paye'}
    entrees: [],     // {id, type, description, montant, date}
    depenses: [],    // {id, categorie, description, montant, date, mode}
    settings: { montantStandard: 25000 },
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, auth: { ...defaultState().auth, ...(parsed.auth||{}) }, settings: { ...defaultState().settings, ...(parsed.settings||{}) } };
  } catch (e) {
    console.error("Erreur de lecture du stockage local", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  pushStateToRemote();
}

/* ============================================================
   SYNCHRONISATION EN LIGNE (npoint.io — données partagées)
   ============================================================ */
const REMOTE_URL = "https://api.npoint.io/c8ba7505622a8dbd4ab9";
const SYNC_INTERVAL_MS = 7000; // fréquence de vérification des mises à jour distantes
let applyingRemoteUpdate = false; // évite les boucles d'écriture
let remoteSyncEnabled = true;

function setSyncBadge(mode) {
  const badge = document.getElementById("syncStatus");
  if (!badge) return;
  badge.classList.remove("sync-online", "sync-offline", "sync-error");
  if (mode === "online") { badge.textContent = "● En ligne — données partagées"; badge.classList.add("sync-online"); }
  else if (mode === "error") { badge.textContent = "● Erreur de connexion"; badge.classList.add("sync-error"); }
  else { badge.textContent = "● Mode local (non partagé)"; badge.classList.add("sync-offline"); }
}

function isMeaningfulRemoteState(remote) {
  if (!remote || typeof remote !== "object") return false;
  return Array.isArray(remote.formateurs) || Array.isArray(remote.paiements) ||
         Array.isArray(remote.entrees) || Array.isArray(remote.depenses);
}

async function fetchRemoteState() {
  try {
    const res = await fetch(REMOTE_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const remote = await res.json();
    setSyncBadge("online");
    if (isMeaningfulRemoteState(remote)) {
      applyingRemoteUpdate = true;
      state = {
        ...defaultState(), ...remote,
        auth: { ...defaultState().auth, ...(remote.auth || {}) },
        settings: { ...defaultState().settings, ...(remote.settings || {}) },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyingRemoteUpdate = false;
      renderAll();
    } else {
      // Le bin est vide : on y envoie l'état local actuel pour l'initialiser
      pushStateToRemote();
    }
  } catch (e) {
    console.error("Erreur de synchronisation (lecture) :", e);
    setSyncBadge("error");
  }
}

async function pushStateToRemote() {
  if (!remoteSyncEnabled || applyingRemoteUpdate) return;
  try {
    const res = await fetch(REMOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    setSyncBadge("online");
  } catch (e) {
    console.error("Erreur de synchronisation (écriture) :", e);
    setSyncBadge("error");
    showToast("Échec de la synchronisation en ligne — la donnée reste enregistrée localement.", "error");
  }
}

function initRemoteSync() {
  fetchRemoteState();
  setInterval(fetchRemoteState, SYNC_INTERVAL_MS);
}

function isTresorier() {
  return sessionStorage.getItem(SESSION_KEY) === "tresorier";
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtMontant(n) {
  return (Number(n) || 0).toLocaleString("fr-FR") + " FCFA";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function showToast(message, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2600);
}

/* ---------- Year handling ---------- */
function getAllYears() {
  const years = new Set();
  const now = new Date().getFullYear();
  years.add(now);
  state.paiements.forEach(p => years.add(p.annee));
  state.entrees.forEach(e => years.add(new Date(e.date).getFullYear()));
  state.depenses.forEach(d => years.add(new Date(d.date).getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

function getSelectedYear() {
  const sel = document.getElementById("yearSelect");
  return sel && sel.value ? Number(sel.value) : new Date().getFullYear();
}

function populateYearSelect() {
  const sel = document.getElementById("yearSelect");
  const current = sel.value || String(new Date().getFullYear());
  sel.innerHTML = "";
  getAllYears().forEach(y => {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

/* ---------- Transactions (unified view) ---------- */
function getAllTransactions() {
  const list = [];
  state.paiements.forEach(p => {
    const f = state.formateurs.find(x => x.id === p.formateurId);
    list.push({
      id: "pai_" + p.id,
      raw: p, kind: "paiement",
      date: p.date,
      description: `Paiement formateur — ${f ? f.nom : "Formateur supprimé"} (${MOIS[p.mois]})`,
      type: "Dépense",
      montant: p.montant,
    });
  });
  state.entrees.forEach(e => {
    list.push({
      id: "ent_" + e.id,
      raw: e, kind: "entree",
      date: e.date,
      description: `${e.type} — ${e.description}`,
      type: "Recette",
      montant: e.montant,
    });
  });
  state.depenses.forEach(d => {
    list.push({
      id: "dep_" + d.id,
      raw: d, kind: "depense",
      date: d.date,
      description: `${d.categorie} — ${d.description}`,
      type: "Dépense",
      montant: d.montant,
    });
  });
  return list.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function getTransactionsForYear(year) {
  return getAllTransactions().filter(t => t.date && new Date(t.date).getFullYear() === year);
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const allTx = getAllTransactions();
  const soldeTotal = allTx.reduce((sum, t) => sum + (t.type === "Recette" ? t.montant : -t.montant), 0);

  const monthTx = allTx.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  });
  const recettesMois = monthTx.filter(t => t.type === "Recette").reduce((s, t) => s + t.montant, 0);
  const depensesMois = monthTx.filter(t => t.type === "Dépense").reduce((s, t) => s + t.montant, 0);

  document.getElementById("cardSolde").textContent = fmtMontant(soldeTotal);
  document.getElementById("cardRecettes").textContent = fmtMontant(recettesMois);
  document.getElementById("cardDepenses").textContent = fmtMontant(depensesMois);
  document.getElementById("cardFormateurs").textContent = state.formateurs.length;

  const aJour = state.formateurs.filter(f =>
    state.paiements.some(p => p.formateurId === f.id && p.mois === curMonth && p.annee === curYear)
  ).length;
  document.getElementById("cardAJour").textContent = aJour;

  const body = document.getElementById("derniersOperationsBody");
  const empty = document.getElementById("derniersOperationsEmpty");
  const recent = allTx.slice(0, 8);
  body.innerHTML = "";
  empty.classList.toggle("hidden", recent.length > 0);
  recent.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td class="${t.type === "Recette" ? "type-recette" : "type-depense"}">${t.type}</td>
      <td class="num">${t.type === "Recette" ? "+" : "−"} ${fmtMontant(t.montant)}</td>`;
    body.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

/* ---------- Formateurs tab ---------- */
function renderFormateurs() {
  const tresorier = isTresorier();
  const now = new Date();
  const body = document.getElementById("formateursBody");
  const empty = document.getElementById("formateursEmpty");
  document.getElementById("formateursAccessNote").classList.toggle("hidden", tresorier);
  body.innerHTML = "";
  empty.classList.toggle("hidden", state.formateurs.length > 0);

  state.formateurs.forEach(f => {
    const payeCetteAnnee = state.paiements
      .filter(p => p.formateurId === f.id && p.annee === getSelectedYear())
      .reduce((s, p) => s + p.montant, 0);
    const statutMois = state.paiements.some(p => p.formateurId === f.id && p.mois === now.getMonth() && p.annee === now.getFullYear());

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(f.nom)}</td>
      <td>${escapeHtml(f.matiere)}</td>
      <td class="num">${tresorier ? fmtMontant(f.montantStandard) : "•••••"}</td>
      <td class="num">${tresorier ? fmtMontant(payeCetteAnnee) : "•••••"}</td>
      <td>${tresorier ? `<span class="pill ${statutMois ? "pill-success" : "pill-danger"}">${statutMois ? "Payé" : "Non payé"}</span> <button class="icon-btn" data-modifier-statut="${f.id}">Modifier</button>` : `<span class="pill pill-neutral">Accès restreint</span>`}</td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll("[data-modifier-statut]").forEach(btn => {
    btn.addEventListener("click", () => goToMarquerPaiement(btn.dataset.modifierStatut));
  });

  renderEtatPaiements(tresorier);
}

function goToMarquerPaiement(formateurId) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="tresorier"]').classList.add("active");
  document.getElementById("tab-tresorier").classList.add("active");

  const now = new Date();
  const pFormateur = document.getElementById("pFormateur");
  const pMois = document.getElementById("pMois");
  if (pFormateur) pFormateur.value = formateurId;
  if (pMois) pMois.value = now.getMonth();

  const existing = state.paiements.find(p => p.formateurId === formateurId && p.mois === now.getMonth() && p.annee === now.getFullYear());
  const pMontant = document.getElementById("pMontant");
  const pDate = document.getElementById("pDate");
  const pMode = document.getElementById("pMode");
  if (existing) {
    if (pMontant) pMontant.value = existing.montant;
    if (pDate) pDate.value = existing.date;
    if (pMode && existing.mode) pMode.value = existing.mode;
  }
  document.getElementById("formPaiement").scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("Corrigez le paiement puis validez « Marquer payé ».");
}

function renderEtatPaiements(tresorier) {
  const wrap = document.getElementById("etatPaiementsPanel");
  const table = document.getElementById("etatPaiementsTable");
  if (!tresorier) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const year = getSelectedYear();

  let html = "<thead><tr><th>Formateur</th>" + MOIS.map(m => `<th>${m.slice(0,3)}</th>`).join("") + "<th>Total</th></tr></thead><tbody>";
  if (state.formateurs.length === 0) {
    html += `<tr><td colspan="${MOIS.length + 2}" style="text-align:center;color:var(--ink-soft);">Aucun formateur enregistré.</td></tr>`;
  }
  state.formateurs.forEach(f => {
    let total = 0;
    html += `<tr><td>${escapeHtml(f.nom)}</td>`;
    MOIS.forEach((_, i) => {
      const paid = state.paiements.find(p => p.formateurId === f.id && p.mois === i && p.annee === year);
      if (paid) total += paid.montant;
      html += `<td>${paid ? "✓" : "—"}</td>`;
    });
    html += `<td class="num">${fmtMontant(total)}</td></tr>`;
  });
  html += "</tbody>";
  table.innerHTML = html;
}

/* ---------- Historique tab ---------- */
function renderHistorique() {
  const year = getSelectedYear();
  document.getElementById("historiqueYearLabel").textContent = year;
  const tx = getTransactionsForYear(year);
  document.getElementById("historiqueCount").textContent = tx.length;

  const body = document.getElementById("historiqueBody");
  const empty = document.getElementById("historiqueEmpty");
  body.innerHTML = "";
  empty.classList.toggle("hidden", tx.length > 0);
  const tresorier = isTresorier();

  tx.forEach(t => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.description)}</td>
      <td class="${t.type === "Recette" ? "type-recette" : "type-depense"}">${t.type}</td>
      <td class="num">${t.type === "Recette" ? "+" : "−"} ${fmtMontant(t.montant)}</td>
      <td>${tresorier ? `<button class="icon-btn" data-edit-tx="${t.id}">Modifier</button> <button class="icon-btn danger" data-delete-tx="${t.id}">Supprimer</button>` : "—"}</td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll("[data-delete-tx]").forEach(btn => {
    btn.addEventListener("click", () => askDeleteTransaction(btn.dataset.deleteTx));
  });
  body.querySelectorAll("[data-edit-tx]").forEach(btn => {
    btn.addEventListener("click", () => openModifierTransaction(btn.dataset.editTx));
  });
}

function askDeleteTransaction(txId) {
  openConfirm({
    title: "Supprimer la transaction",
    message: "Cette opération sera définitivement retirée de l'historique.",
    onConfirm: () => {
      const [kind, id] = [txId.split("_")[0], txId.split("_").slice(1).join("_")];
      if (kind === "pai") state.paiements = state.paiements.filter(p => p.id !== id);
      if (kind === "ent") state.entrees = state.entrees.filter(e => e.id !== id);
      if (kind === "dep") state.depenses = state.depenses.filter(d => d.id !== id);
      saveState();
      renderAll();
      showToast("Transaction supprimée.", "success");
    },
  });
}

/* ---------- Modifier une transaction de l'historique ---------- */
function openModifierTransaction(txId) {
  const tx = getAllTransactions().find(t => t.id === txId);
  if (!tx) return;

  document.getElementById("editTxId").value = tx.id;
  document.getElementById("editTxKind").value = tx.kind;

  document.getElementById("editTxGroupType").classList.toggle("hidden", tx.kind !== "entree");
  document.getElementById("editTxGroupCategorie").classList.toggle("hidden", tx.kind !== "depense");
  document.getElementById("editTxGroupDescription").classList.toggle("hidden", tx.kind === "paiement");
  document.getElementById("editTxGroupMode").classList.toggle("hidden", tx.kind === "entree");
  document.getElementById("editTxGroupFormateurInfo").classList.toggle("hidden", tx.kind !== "paiement");

  document.getElementById("editTxMontant").value = tx.raw.montant;
  document.getElementById("editTxDate").value = tx.raw.date;

  if (tx.kind === "entree") {
    document.getElementById("editTxType").value = tx.raw.type;
    document.getElementById("editTxDescription").value = tx.raw.description;
  } else if (tx.kind === "depense") {
    document.getElementById("editTxCategorie").value = tx.raw.categorie;
    document.getElementById("editTxDescription").value = tx.raw.description;
    document.getElementById("editTxMode").value = tx.raw.mode || "Espèces";
  } else if (tx.kind === "paiement") {
    document.getElementById("editTxMode").value = tx.raw.mode || "Espèces";
    const f = state.formateurs.find(x => x.id === tx.raw.formateurId);
    document.getElementById("editTxFormateurInfo").textContent = `${f ? f.nom : "Formateur supprimé"} — ${MOIS[tx.raw.mois]} ${tx.raw.annee}`;
  }

  document.getElementById("modalModifierTransaction").classList.remove("hidden");
}

document.getElementById("btnAnnulerModifierTransaction").addEventListener("click", () => {
  document.getElementById("modalModifierTransaction").classList.add("hidden");
});

document.getElementById("formModifierTransaction").addEventListener("submit", e => {
  e.preventDefault();
  const kind = document.getElementById("editTxKind").value;
  const id = document.getElementById("editTxId").value.split("_").slice(1).join("_");
  const montant = Number(document.getElementById("editTxMontant").value);
  const date = document.getElementById("editTxDate").value;

  if (kind === "entree") {
    const e2 = state.entrees.find(x => x.id === id);
    if (e2) {
      e2.type = document.getElementById("editTxType").value;
      e2.description = document.getElementById("editTxDescription").value.trim();
      e2.montant = montant;
      e2.date = date;
    }
  } else if (kind === "depense") {
    const d = state.depenses.find(x => x.id === id);
    if (d) {
      d.categorie = document.getElementById("editTxCategorie").value;
      d.description = document.getElementById("editTxDescription").value.trim();
      d.montant = montant;
      d.date = date;
      d.mode = document.getElementById("editTxMode").value;
    }
  } else if (kind === "paiement") {
    const p = state.paiements.find(x => x.id === id);
    if (p) {
      p.montant = montant;
      p.date = date;
      p.annee = new Date(date).getFullYear();
      p.mode = document.getElementById("editTxMode").value;
    }
  }

  saveState();
  document.getElementById("modalModifierTransaction").classList.add("hidden");
  renderAll();
  showToast("Transaction modifiée.", "success");
});

/* ---------- Trésorier workspace ---------- */
function renderTresorierWorkspace() {
  const loggedIn = isTresorier();
  document.getElementById("loginPanel").classList.toggle("hidden", loggedIn);
  document.getElementById("tresorierWorkspace").classList.toggle("hidden", !loggedIn);
  document.getElementById("loginBtn").classList.toggle("hidden", loggedIn);
  document.getElementById("logoutBtn").classList.toggle("hidden", !loggedIn);

  const badge = document.getElementById("sessionBadge");
  badge.textContent = loggedIn ? "Trésorier connecté" : "Direction (lecture seule)";
  badge.classList.toggle("tresorier", loggedIn);

  if (!loggedIn) return;

  // Populate formateur select for paiements
  const pSel = document.getElementById("pFormateur");
  pSel.innerHTML = state.formateurs.map(f => `<option value="${f.id}">${escapeHtml(f.nom)}</option>`).join("");

  // Populate mois select
  const mSel = document.getElementById("pMois");
  if (!mSel.dataset.filled) {
    mSel.innerHTML = MOIS.map((m, i) => `<option value="${i}">${m}</option>`).join("");
    mSel.value = new Date().getMonth();
    mSel.dataset.filled = "1";
  }

  document.getElementById("paramMontant").value = state.settings.montantStandard;

  // Gestion formateurs table
  const body = document.getElementById("gestionFormateursBody");
  body.innerHTML = "";
  if (state.formateurs.length === 0) {
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-soft);">Aucun formateur enregistré.</td></tr>`;
  }
  state.formateurs.forEach(f => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(f.nom)}</td>
      <td>${escapeHtml(f.matiere)}</td>
      <td class="num">${f.nombreEcoles || 0}</td>
      <td>${escapeHtml(f.nomEcoles || "—")}</td>
      <td class="num">${fmtMontant(f.montantStandard)}</td>
      <td>
        <button class="icon-btn" data-edit-formateur="${f.id}">Modifier</button>
        <button class="icon-btn danger" data-delete-formateur="${f.id}">Supprimer</button>
      </td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("[data-delete-formateur]").forEach(btn => {
    btn.addEventListener("click", () => askDeleteFormateur(btn.dataset.deleteFormateur));
  });
  body.querySelectorAll("[data-edit-formateur]").forEach(btn => {
    btn.addEventListener("click", () => openModifierFormateur(btn.dataset.editFormateur));
  });
}

/* ---------- Modifier un formateur ---------- */
function openModifierFormateur(id) {
  const f = state.formateurs.find(x => x.id === id);
  if (!f) return;
  document.getElementById("editFormateurId").value = f.id;
  document.getElementById("editNom").value = f.nom;
  document.getElementById("editMatiere").value = f.matiere;
  document.getElementById("editNombreEcoles").value = f.nombreEcoles || 0;
  document.getElementById("editNomEcoles").value = f.nomEcoles || "";
  document.getElementById("editMontant").value = f.montantStandard;
  document.getElementById("modalModifierFormateur").classList.remove("hidden");
}

document.getElementById("btnAnnulerModifierFormateur").addEventListener("click", () => {
  document.getElementById("modalModifierFormateur").classList.add("hidden");
});

document.getElementById("formModifierFormateur").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("editFormateurId").value;
  const f = state.formateurs.find(x => x.id === id);
  if (!f) return;
  f.nom = document.getElementById("editNom").value.trim();
  f.matiere = document.getElementById("editMatiere").value.trim();
  f.nombreEcoles = Number(document.getElementById("editNombreEcoles").value);
  f.nomEcoles = document.getElementById("editNomEcoles").value.trim();
  f.montantStandard = Number(document.getElementById("editMontant").value);
  saveState();
  document.getElementById("modalModifierFormateur").classList.add("hidden");
  renderAll();
  showToast("Formateur modifié.", "success");
});

function askDeleteFormateur(id) {
  const f = state.formateurs.find(x => x.id === id);
  if (!f) return;
  openConfirm({
    title: "Supprimer le formateur",
    message: `Supprimer « ${f.nom} » ainsi que l'historique de ses paiements ?`,
    onConfirm: () => {
      state.formateurs = state.formateurs.filter(x => x.id !== id);
      state.paiements = state.paiements.filter(p => p.formateurId !== id);
      saveState();
      renderAll();
      showToast("Formateur supprimé.", "success");
    },
  });
}

/* ---------- Confirmation modal (password-protected) ---------- */
let pendingConfirm = null;

function openConfirm({ title, message, onConfirm }) {
  pendingConfirm = onConfirm;
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmPassword").value = "";
  document.getElementById("confirmError").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("hidden");
  document.getElementById("confirmPassword").focus();
}

function closeConfirm() {
  document.getElementById("confirmModal").classList.add("hidden");
  pendingConfirm = null;
}

document.getElementById("confirmCancel").addEventListener("click", closeConfirm);
document.getElementById("confirmOk").addEventListener("click", () => {
  const pwd = document.getElementById("confirmPassword").value;
  if (pwd !== state.auth.password) {
    document.getElementById("confirmError").classList.remove("hidden");
    return;
  }
  const fn = pendingConfirm;
  closeConfirm();
  if (fn) fn();
});

/* ---------- Render orchestration ---------- */
function renderAll() {
  populateYearSelect();
  renderDashboard();
  renderFormateurs();
  renderHistorique();
  renderTresorierWorkspace();
}

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

document.getElementById("loginBtn").addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="tresorier"]').classList.add("active");
  document.getElementById("tab-tresorier").classList.add("active");
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  renderAll();
  showToast("Déconnecté de l'espace Trésorier.");
});

document.getElementById("yearSelect").addEventListener("change", () => {
  renderFormateurs();
  renderHistorique();
});

/* ---------- Login form ---------- */
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const pwd = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  if (pwd === state.auth.password) {
    sessionStorage.setItem(SESSION_KEY, "tresorier");
    errEl.classList.add("hidden");
    document.getElementById("loginForm").reset();
    renderAll();
    showToast("Bienvenue, Trésorier.", "success");
  } else {
    errEl.classList.remove("hidden");
  }
});

/* ---------- Formateur form ---------- */
document.getElementById("formFormateur").addEventListener("submit", e => {
  e.preventDefault();
  const nom = document.getElementById("fNom").value.trim();
  const matiere = document.getElementById("fMatiere").value.trim();
  const nombreEcoles = Number(document.getElementById("fNombreEcoles").value);
  const nomEcoles = document.getElementById("fNomEcoles").value.trim();
  const montant = Number(document.getElementById("fMontant").value);
  if (!nom || !matiere || !nomEcoles) return;
  state.formateurs.push({ id: uid(), nom, matiere, nombreEcoles, nomEcoles, montantStandard: montant });
  saveState();
  e.target.reset();
  renderAll();
  showToast("Formateur ajouté.", "success");
});

/* ---------- Paiement form ---------- */
document.getElementById("formPaiement").addEventListener("submit", e => {
  e.preventDefault();
  const formateurId = document.getElementById("pFormateur").value;
  const mois = Number(document.getElementById("pMois").value);
  const montant = Number(document.getElementById("pMontant").value);
  const date = document.getElementById("pDate").value;
  const mode = document.getElementById("pMode").value;
  if (!formateurId || !date) { showToast("Veuillez sélectionner un formateur et une date.", "error"); return; }
  const annee = new Date(date).getFullYear();

  const existing = state.paiements.find(p => p.formateurId === formateurId && p.mois === mois && p.annee === annee);
  if (existing) {
    existing.montant = montant; existing.date = date; existing.mode = mode;
  } else {
    state.paiements.push({ id: uid(), formateurId, mois, annee, montant, date, mode, statut: "paye" });
  }
  saveState();
  renderAll();
  showToast("Paiement enregistré.", "success");
});

document.getElementById("btnAnnulerPaiement").addEventListener("click", () => {
  const formateurId = document.getElementById("pFormateur").value;
  const mois = Number(document.getElementById("pMois").value);
  const date = document.getElementById("pDate").value;
  const annee = date ? new Date(date).getFullYear() : new Date().getFullYear();
  const existing = state.paiements.find(p => p.formateurId === formateurId && p.mois === mois && p.annee === annee);
  if (!existing) { showToast("Aucun paiement à annuler pour ce mois.", "error"); return; }
  openConfirm({
    title: "Annuler le paiement",
    message: "Le paiement de ce formateur pour ce mois sera supprimé.",
    onConfirm: () => {
      state.paiements = state.paiements.filter(p => p.id !== existing.id);
      saveState();
      renderAll();
      showToast("Paiement annulé.", "success");
    },
  });
});

/* ---------- Entrée form ---------- */
document.getElementById("formEntree").addEventListener("submit", e => {
  e.preventDefault();
  const type = document.getElementById("eType").value;
  const description = document.getElementById("eDescription").value.trim();
  const montant = Number(document.getElementById("eMontant").value);
  const date = document.getElementById("eDate").value;
  if (!description || !date) return;
  state.entrees.push({ id: uid(), type, description, montant, date });
  saveState();
  e.target.reset();
  renderAll();
  showToast("Entrée enregistrée.", "success");
});

/* ---------- Dépense form ---------- */
document.getElementById("formDepense").addEventListener("submit", e => {
  e.preventDefault();
  const categorie = document.getElementById("dCategorie").value;
  const description = document.getElementById("dDescription").value.trim();
  const montant = Number(document.getElementById("dMontant").value);
  const date = document.getElementById("dDate").value;
  const mode = document.getElementById("dMode").value;
  if (!description || !date) return;
  state.depenses.push({ id: uid(), categorie, description, montant, date, mode });
  saveState();
  e.target.reset();
  renderAll();
  showToast("Dépense enregistrée.", "success");
});

/* ---------- Paramètres form ---------- */
document.getElementById("formParametres").addEventListener("submit", e => {
  e.preventDefault();
  state.settings.montantStandard = Number(document.getElementById("paramMontant").value) || 0;
  saveState();
  showToast("Paramètres enregistrés.", "success");
});

/* ---------- Change password form ---------- */
document.getElementById("formMotDePasse").addEventListener("submit", e => {
  e.preventDefault();
  const actuel = document.getElementById("mdpActuel").value;
  const nouveau = document.getElementById("mdpNouveau").value;
  const confirm = document.getElementById("mdpConfirm").value;
  const err = document.getElementById("mdpError");
  const ok = document.getElementById("mdpSuccess");
  err.classList.add("hidden"); ok.classList.add("hidden");

  if (actuel !== state.auth.password) {
    err.textContent = "Le mot de passe actuel est incorrect.";
    err.classList.remove("hidden");
    return;
  }
  if (nouveau.length < 4) {
    err.textContent = "Le nouveau mot de passe doit contenir au moins 4 caractères.";
    err.classList.remove("hidden");
    return;
  }
  if (nouveau !== confirm) {
    err.textContent = "La confirmation ne correspond pas au nouveau mot de passe.";
    err.classList.remove("hidden");
    return;
  }
  state.auth.password = nouveau;
  saveState();
  ok.classList.remove("hidden");
  e.target.reset();
  showToast("Mot de passe mis à jour.", "success");
});

/* ---------- Default dates to today ---------- */
function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  ["pDate", "eDate", "dDate"].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

/* ---------- Init ---------- */
setDefaultDates();
initRemoteSync();
renderAll(); // affichage immédiat avec le cache local ; sera mis à jour dès la première synchronisation
