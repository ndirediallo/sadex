// ==========================================================================
// SADEX — Espace Admin
// Connexion, formulaires, génération des documents (attestation, CV)
// ==========================================================================

// Hash SHA-256 du mot de passe admin (le mot de passe en clair n'est jamais
// stocké dans le code : seule son empreinte est comparée).
const ADMIN_PASSWORD_HASH = "afc66c45b1f60ee2dae36f1c92af89e81199cd046e02fc4ebd22cd87c67d5bbe";

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGNF(n) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " GNF";
}

// Convertit un nombre entier en toutes lettres (français standard :
// soixante-dix, quatre-vingts, quatre-vingt-dix). Suffisant pour des
// montants de facturation courants (jusqu'au milliard).
function numberToFrenchWords(n) {
  n = Math.round(n);
  if (n === 0) return "zéro";
  if (n < 0) return "moins " + numberToFrenchWords(-n);

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tensWords = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante", 7: "soixante", 8: "quatre-vingt", 9: "quatre-vingt" };

  function twoDigits(num) {
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    const t = Math.floor(num / 10);
    const u = num % 10;
    if (t === 7 || t === 9) {
      const base = tensWords[t];
      if (u === 0) return base + "-dix";
      if (u === 1) return base + (t === 7 ? "-et-onze" : "-onze");
      return base + "-" + teens[u];
    }
    const base = tensWords[t];
    if (u === 0) return t === 8 ? base + "s" : base;
    if (u === 1 && t !== 8) return base + "-et-un";
    return base + "-" + units[u];
  }

  function threeDigits(num) {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    let str = "";
    if (h > 0) {
      str = (h === 1 ? "cent" : units[h] + " cent") + (rest === 0 && h > 1 ? "s" : "");
      if (rest > 0) str += " ";
    }
    if (rest > 0) str += twoDigits(rest);
    return str;
  }

  const groups = [
    { value: 1000000000, singular: "milliard", plural: "milliards" },
    { value: 1000000, singular: "million", plural: "millions" },
    { value: 1000, singular: "mille", plural: "mille" },
  ];

  let remainder = n;
  const parts = [];

  for (const g of groups) {
    const count = Math.floor(remainder / g.value);
    if (count > 0) {
      if (g.value === 1000 && count === 1) {
        parts.push("mille");
      } else {
        parts.push(threeDigits(count) + " " + (count > 1 ? g.plural : g.singular));
      }
      remainder -= count * g.value;
    }
  }

  if (remainder > 0 || parts.length === 0) {
    parts.push(threeDigits(remainder));
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function formatDateFr(value) {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  if (isNaN(d)) return value;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

document.addEventListener("DOMContentLoaded", function () {
  const loginGate = document.getElementById("loginGate");
  const adminApp = document.getElementById("adminApp");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("passwordInput");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");

  function showApp() {
    loginGate.hidden = true;
    adminApp.hidden = false;
  }

  // Session déjà validée sur cet onglet/navigateur ?
  if (sessionStorage.getItem("sadexAdminAuth") === "1") {
    showApp();
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const hash = await sha256(passwordInput.value);
    if (hash === ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem("sadexAdminAuth", "1");
      loginError.hidden = true;
      showApp();
    } else {
      loginError.hidden = false;
      passwordInput.value = "";
      passwordInput.focus();
    }
  });

  logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem("sadexAdminAuth");
    adminApp.hidden = true;
    loginGate.hidden = false;
    passwordInput.value = "";
  });

  // ---------- Onglets ----------
  const tabs = document.querySelectorAll(".admin-tab");
  const panels = {
    attestation: document.getElementById("panel-attestation"),
    cv: document.getElementById("panel-cv"),
    facture: document.getElementById("panel-facture"),
    photos: document.getElementById("panel-photos"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      Object.keys(panels).forEach((key) => {
        panels[key].hidden = key !== tab.dataset.tab;
      });
    });
  });

  // ---------- Valeurs par défaut ----------
  const today = new Date().toISOString().slice(0, 10);
  const emissionInput = document.getElementById("att-emission");
  if (emissionInput) emissionInput.value = today;

  const numeroInput = document.getElementById("att-numero");
  if (numeroInput) {
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    numeroInput.value = `SADEX-FORM-${year}-${rand}`;
  }

  const docDateInput = document.getElementById("doc-date");
  if (docDateInput) docDateInput.value = today;

  function suggestDocNumber() {
    const docNumeroInput = document.getElementById("doc-numero");
    const type = document.getElementById("doc-type").value;
    const prefix = type === "facture" ? "SADEX-FACT" : "SADEX-REC";
    const year = new Date().getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    docNumeroInput.value = `${prefix}-${year}-${rand}`;
  }

  const docTypeSelect = document.getElementById("doc-type");
  if (docTypeSelect) {
    docTypeSelect.addEventListener("change", suggestDocNumber);
    suggestDocNumber();
  }

  // ---------- Lignes répétables (CV) ----------
  function addRow(containerId, templateId) {
    const container = document.getElementById(containerId);
    const template = document.getElementById(templateId);
    const clone = template.content.cloneNode(true);
    const row = clone.querySelector(".repeatable-row");
    row.querySelector(".repeatable-remove").addEventListener("click", function () {
      row.remove();
    });
    container.appendChild(clone);
  }

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", function () {
      const type = btn.dataset.add;
      if (type === "formation") addRow("cv-formations", "tpl-formation-row");
      if (type === "experience") addRow("cv-experiences", "tpl-experience-row");
      if (type === "ligne") addRow("doc-lignes", "tpl-line-row");
    });
  });

  // Une première ligne de chaque par défaut
  addRow("cv-formations", "tpl-formation-row");
  addRow("cv-experiences", "tpl-experience-row");
  if (document.getElementById("doc-lignes")) addRow("doc-lignes", "tpl-line-row");

  // ---------- Aperçu / impression ----------
  const previewOverlay = document.getElementById("previewOverlay");
  const documentPreview = document.getElementById("documentPreview");
  const closePreviewBtn = document.getElementById("closePreview");
  const printBtn = document.getElementById("printBtn");

  // L'orientation d'impression (portrait/paysage) est injectée dynamiquement,
  // car un même document peut avoir besoin de l'une ou l'autre.
  function setPrintOrientation(orientation) {
    let style = document.getElementById("printOrientationStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "printOrientationStyle";
      document.head.appendChild(style);
    }
    style.textContent = `@media print { @page { size: A4 ${orientation}; margin: 0; } }`;
  }

  function showPreview(html, { landscape = false } = {}) {
    documentPreview.innerHTML = html;
    documentPreview.classList.toggle("doc-landscape", landscape);
    setPrintOrientation(landscape ? "landscape" : "portrait");
    previewOverlay.hidden = false;
    adminApp.hidden = true;
    window.scrollTo(0, 0);
  }

  closePreviewBtn.addEventListener("click", function () {
    previewOverlay.hidden = true;
    adminApp.hidden = false;
  });

  printBtn.addEventListener("click", function () {
    window.print();
  });

  // Flourish décoratif de coin (bleu marine + liseré or), réutilisé aux
  // deux coins opposés du certificat (le second est simplement pivoté à 180°).
  const CERT_CORNER_SVG = `
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,0 L270,0 C185,8 100,55 45,145 C18,190 3,225 0,255 Z" fill="#16305c"/>
      <path d="M0,270 C12,232 28,192 50,155 C102,62 185,18 280,6" fill="none" stroke="#e4a72e" stroke-width="9" stroke-linecap="round"/>
    </svg>
  `;

  // ---------- Génération : ATTESTATION ----------
  const attestationForm = document.getElementById("attestationForm");
  attestationForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const civilite = document.getElementById("att-civilite").value;
    const nom = document.getElementById("att-nom").value.trim();
    const formation = document.getElementById("att-formation").value.trim();
    const domaine = document.getElementById("att-domaine").value.trim();
    const description = document.getElementById("att-description").value.trim();
    const debut = document.getElementById("att-debut").value;
    const fin = document.getElementById("att-fin").value;
    const heures = document.getElementById("att-duree").value.trim();
    const mention = document.getElementById("att-mention").value.trim() || "avec succès";
    const organisme = document.getElementById("att-organisme").value.trim() || "SADEX";
    const lieu = document.getElementById("att-lieu").value.trim();
    const responsable = document.getElementById("att-responsable").value.trim();
    const numero = document.getElementById("att-numero").value.trim();
    const emission = document.getElementById("att-emission").value;

    // Accord masculin / féminin selon la civilité choisie
    const nomAvecCivilite = `${civilite} ${nom}`;
    const vuAccord = civilite === "Mme" ? "vue" : "vu";

    // « organisée par ORG[, du DATE au DATE][, pour une durée de X heures]. »
    let organisePhrase = `organisée par <strong>${escapeHtml(organisme)}</strong>`;
    if (debut && fin) {
      organisePhrase += `, du <strong>${formatDateFr(debut)}</strong> au <strong>${formatDateFr(fin)}</strong>`;
    }
    if (heures) {
      organisePhrase += `, pour une durée de <strong>${escapeHtml(heures)} heures</strong>`;
    }
    organisePhrase += ".";

    const html = `
      <div class="cert">
        <div class="cert-pinstripes"></div>
        <div class="cert-corner cert-corner-tl">${CERT_CORNER_SVG}</div>
        <div class="cert-corner cert-corner-br">${CERT_CORNER_SVG}</div>
        <div class="cert-frame-outer"></div>
        <div class="cert-frame-inner"></div>

        <div class="cert-badge">
          <div class="cert-badge-circle">S</div>
          <div class="cert-badge-ribbons"></div>
          <div class="cert-badge-sub">Sadex</div>
        </div>

        <div class="cert-content">
          <div class="cert-kicker">Sadex · Construire · Former · Innover</div>
          <h1 class="cert-title-serif">ATTESTATION</h1>
          <div class="cert-subtitle-serif">DE FORMATION</div>

          <div class="cert-ribbon-banner">Nous attestons par la présente que</div>

          <div class="cert-name-script">${escapeHtml(nomAvecCivilite)}</div>
          <div class="cert-name-underline"></div>

          <div class="cert-body-text">
            <p>a participé ${escapeHtml(mention)} à la formation :</p>
            <p class="cert-formation-line">« ${escapeHtml(formation)} »</p>
            <p>${organisePhrase}</p>
            ${domaine ? `<p>Cette formation avait pour objectif de permettre au participant d'acquérir et de renforcer ses connaissances et compétences dans le domaine de <strong>${escapeHtml(domaine)}</strong>.</p>` : ""}
            ${description ? `<p class="cert-description">${escapeHtml(description)}</p>` : ""}
            <p>Au terme de cette formation, <strong>${escapeHtml(nomAvecCivilite)}</strong> a satisfait aux exigences prévues et s'est ${vuAccord} délivrer la présente attestation.</p>
          </div>

          <div class="cert-signatures">
            <div class="cert-sign-block">
              <div class="cert-sign-line"></div>
              <div class="cert-sign-label">Fait à ${escapeHtml(lieu)}, le ${formatDateFr(emission)}</div>
            </div>
            <div class="cert-sign-block">
              <div class="cert-sign-line"></div>
              <div class="cert-sign-label">
                Le Responsable de la formation<br>
                ${responsable ? escapeHtml(responsable) + "<br>" : ""}
                Signature et cachet
              </div>
            </div>
          </div>
        </div>

        <div class="cert-number">N° ${escapeHtml(numero)}</div>
      </div>
    `;

    showPreview(html, { landscape: true });
  });

  // ---------- Génération : CV ----------
  const cvForm = document.getElementById("cvForm");
  const photoInput = document.getElementById("cv-photo");

  function readPhotoAsDataUrl() {
    return new Promise((resolve) => {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function initials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  cvForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nom = document.getElementById("cv-nom").value.trim();
    const titre = document.getElementById("cv-titre").value.trim();
    const telephone = document.getElementById("cv-telephone").value.trim();
    const email = document.getElementById("cv-email").value.trim();
    const adresse = document.getElementById("cv-adresse").value.trim();
    const naissance = document.getElementById("cv-naissance").value;
    const profil = document.getElementById("cv-profil").value.trim();
    const competences = document.getElementById("cv-competences").value.split("\n").map((s) => s.trim()).filter(Boolean);
    const langues = document.getElementById("cv-langues").value.split("\n").map((s) => s.trim()).filter(Boolean);

    const formations = Array.from(document.querySelectorAll("#cv-formations .repeatable-row")).map((row) => ({
      diplome: row.querySelector(".f-diplome").value.trim(),
      annee: row.querySelector(".f-annee").value.trim(),
      etablissement: row.querySelector(".f-etablissement").value.trim(),
    })).filter((f) => f.diplome || f.etablissement);

    const experiences = Array.from(document.querySelectorAll("#cv-experiences .repeatable-row")).map((row) => ({
      poste: row.querySelector(".e-poste").value.trim(),
      periode: row.querySelector(".e-periode").value.trim(),
      entreprise: row.querySelector(".e-entreprise").value.trim(),
      description: row.querySelector(".e-description").value.trim(),
    })).filter((exp) => exp.poste || exp.entreprise);

    const photoDataUrl = await readPhotoAsDataUrl();

    const photoHtml = photoDataUrl
      ? `<img class="cv-photo" src="${photoDataUrl}" alt="Photo de ${escapeHtml(nom)}">`
      : `<div class="cv-photo-fallback">${escapeHtml(initials(nom || "?"))}</div>`;

    const skillsHtml = competences.map((c) => `<span class="cv-skill-pill">${escapeHtml(c)}</span>`).join("");

    const languesHtml = langues.map((l) => `<div class="cv-side-item">${escapeHtml(l)}</div>`).join("");

    const formationsHtml = formations.map((f) => `
      <div class="cv-entry">
        <div class="cv-entry-top">
          <span class="cv-entry-title">${escapeHtml(f.diplome)}</span>
          ${f.annee ? `<span class="cv-entry-period">${escapeHtml(f.annee)}</span>` : ""}
        </div>
        ${f.etablissement ? `<div class="cv-entry-sub">${escapeHtml(f.etablissement)}</div>` : ""}
      </div>
    `).join("");

    const experiencesHtml = experiences.map((exp) => `
      <div class="cv-entry">
        <div class="cv-entry-top">
          <span class="cv-entry-title">${escapeHtml(exp.poste)}</span>
          ${exp.periode ? `<span class="cv-entry-period">${escapeHtml(exp.periode)}</span>` : ""}
        </div>
        ${exp.entreprise ? `<div class="cv-entry-sub">${escapeHtml(exp.entreprise)}</div>` : ""}
        ${exp.description ? `<div class="cv-entry-desc">${escapeHtml(exp.description)}</div>` : ""}
      </div>
    `).join("");

    const html = `
      <div class="cv-doc">
        <div class="cv-sidebar">
          ${photoHtml}
          <div class="cv-name">${escapeHtml(nom)}</div>
          ${titre ? `<div class="cv-title">${escapeHtml(titre)}</div>` : ""}

          <div class="cv-side-section">
            <div class="cv-side-heading">Contact</div>
            ${telephone ? `<div class="cv-side-item">📞 ${escapeHtml(telephone)}</div>` : ""}
            ${email ? `<div class="cv-side-item">✉️ ${escapeHtml(email)}</div>` : ""}
            ${adresse ? `<div class="cv-side-item">📍 ${escapeHtml(adresse)}</div>` : ""}
            ${naissance ? `<div class="cv-side-item">🎂 ${formatDateFr(naissance)}</div>` : ""}
          </div>

          ${competences.length ? `
          <div class="cv-side-section">
            <div class="cv-side-heading">Compétences</div>
            <div>${skillsHtml}</div>
          </div>` : ""}

          ${langues.length ? `
          <div class="cv-side-section">
            <div class="cv-side-heading">Langues</div>
            ${languesHtml}
          </div>` : ""}
        </div>

        <div class="cv-main">
          ${profil ? `
          <div class="cv-main-section">
            <div class="cv-main-heading">Profil</div>
            <p class="cv-profil-text">${escapeHtml(profil)}</p>
          </div>` : ""}

          ${experiences.length ? `
          <div class="cv-main-section">
            <div class="cv-main-heading">Expérience professionnelle</div>
            ${experiencesHtml}
          </div>` : ""}

          ${formations.length ? `
          <div class="cv-main-section">
            <div class="cv-main-heading">Formation</div>
            ${formationsHtml}
          </div>` : ""}
        </div>

        <div class="cv-footer-note">CV généré par SADEX</div>
      </div>
    `;

    showPreview(html);
  });

  // ---------- Génération : FACTURE / REÇU ----------
  const factureForm = document.getElementById("factureForm");
  if (factureForm) {
    factureForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const type = document.getElementById("doc-type").value; // "facture" | "recu"
      const motif = document.getElementById("doc-motif").value.trim();
      const civilite = document.getElementById("doc-civilite").value;
      const client = document.getElementById("doc-client").value.trim();
      const telephone = document.getElementById("doc-telephone").value.trim();
      const paiement = document.getElementById("doc-paiement").value;
      const statut = document.getElementById("doc-statut").value;
      const verseInput = document.getElementById("doc-verse").value.trim();
      const note = document.getElementById("doc-note").value.trim();
      const lieu = document.getElementById("doc-lieu").value.trim();
      const numero = document.getElementById("doc-numero").value.trim();
      const date = document.getElementById("doc-date").value;
      const responsable = document.getElementById("doc-responsable").value.trim();

      const lignes = Array.from(document.querySelectorAll("#doc-lignes .repeatable-row"))
        .map((row) => {
          const description = row.querySelector(".l-description").value.trim();
          const quantite = parseFloat(row.querySelector(".l-quantite").value) || 0;
          const prix = parseFloat(row.querySelector(".l-prix").value) || 0;
          return { description, quantite, prix, montant: quantite * prix };
        })
        .filter((l) => l.description);

      const total = lignes.reduce((sum, l) => sum + l.montant, 0);
      const verse = verseInput ? parseFloat(verseInput) : total;
      const solde = total - verse;

      const nomAvecCivilite = `${civilite} ${client}`;
      const titre = type === "facture" ? "FACTURE" : "REÇU DE PAIEMENT";
      const introLabel = type === "facture" ? "Facturé à" : "Reçu de";
      const montantLettres = numberToFrenchWords(total) + " francs guinéens";

      const lignesHtml = lignes.map((l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
          <td class="inv-num">${l.quantite}</td>
          <td class="inv-num">${formatGNF(l.prix)}</td>
          <td class="inv-num">${formatGNF(l.montant)}</td>
        </tr>
      `).join("");

      const signaturesHtml = type === "recu"
        ? `
          <div class="inv-signatures">
            <div class="inv-sign-block">
              <div class="inv-sign-line"></div>
              <div class="inv-sign-label">Le Client<br>${escapeHtml(nomAvecCivilite)}</div>
            </div>
            <div class="inv-sign-block">
              <div class="inv-sign-line"></div>
              <div class="inv-sign-label">Pour SADEX<br>${responsable ? escapeHtml(responsable) : "Signature et cachet"}</div>
            </div>
          </div>`
        : `
          <div class="inv-signatures">
            <div class="inv-sign-block"></div>
            <div class="inv-sign-block">
              <div class="inv-sign-line"></div>
              <div class="inv-sign-label">Pour SADEX<br>${responsable ? escapeHtml(responsable) : "Signature et cachet"}</div>
            </div>
          </div>`;

      const html = `
        <div class="inv-doc">
          <div class="inv-header">
            <div>
              <svg class="logo-wordmark" style="height:32px;" viewBox="0 0 132 48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sadex">
                <defs><linearGradient id="sSplitInv" x1="0" y1="0" x2="0" y2="1"><stop offset="50%" stop-color="#16305c"/><stop offset="50%" stop-color="#e4a72e"/></linearGradient></defs>
                <text x="3" y="36" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="35"><tspan fill="url(#sSplitInv)">S</tspan><tspan fill="#16305c">adex</tspan></text>
              </svg>
              <div class="inv-header-company">
                Fassiah Marché, Sanoyah, Guinée<br>
                626 43 23 23 · sadexgn@gmail.com
              </div>
            </div>
            <div class="inv-header-title">
              <h1>${titre}</h1>
              <div class="inv-header-meta">N° <strong>${escapeHtml(numero)}</strong></div>
              <div class="inv-header-meta">Date : <strong>${formatDateFr(date)}</strong></div>
            </div>
          </div>

          <div class="inv-client">
            <div class="inv-client-label">${introLabel}</div>
            <div class="inv-client-name">${escapeHtml(nomAvecCivilite)}</div>
            ${telephone ? `<div class="inv-client-detail">${escapeHtml(telephone)}</div>` : ""}
            ${motif ? `<div class="inv-client-detail">Motif : ${escapeHtml(motif)}</div>` : ""}
          </div>

          <table class="inv-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="inv-num">Qté</th>
                <th class="inv-num">Prix unitaire</th>
                <th class="inv-num">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${lignesHtml}
            </tbody>
          </table>

          <div class="inv-totals">
            <div class="inv-totals-row inv-total-main">
              <span>Total</span>
              <span>${formatGNF(total)}</span>
            </div>
            <div class="inv-totals-row">
              <span>Montant versé</span>
              <span>${formatGNF(verse)}</span>
            </div>
            ${solde > 0 ? `
            <div class="inv-totals-row inv-solde">
              <span>Solde restant dû</span>
              <span>${formatGNF(solde)}</span>
            </div>` : ""}
          </div>

          <div class="inv-lettres">Arrêté le présent ${type === "facture" ? "document" : "reçu"} à la somme de : <strong>${montantLettres}</strong>.</div>

          <div class="inv-meta-grid">
            <div class="inv-meta-item"><strong>Mode de paiement</strong>${escapeHtml(paiement)}</div>
            <div class="inv-meta-item"><strong>Statut</strong>${escapeHtml(statut)}</div>
            <div class="inv-meta-item"><strong>Lieu</strong>${escapeHtml(lieu)}</div>
          </div>

          ${note ? `<div class="inv-note">${escapeHtml(note)}</div>` : ""}

          ${signaturesHtml}

          <div class="inv-footer-note">Document généré par SADEX · Construire · Former · Innover</div>
        </div>
      `;

      showPreview(html, { landscape: false });
    });
  }

  // ---------- Photos du site (mise à jour directe via l'API GitHub) ----------
  const GITHUB_OWNER = "ndirediallo";
  const GITHUB_REPO = "sadex";
  const GITHUB_BRANCH = "main";
  const GITHUB_TOKEN_KEY = "sadexGithubToken";

  const SITE_PHOTOS = [
    { path: "assets/images/formation-informatique.jpg", label: "Formation en informatique" },
    { path: "assets/images/architecture.jpg", label: "Architecture" },
    { path: "assets/images/prestations-services.jpg", label: "Prestations de services" },
    { path: "assets/images/electricite.jpg", label: "Électricité" },
    { path: "assets/images/programmation.jpg", label: "Programmation" },
    { path: "assets/images/videosurveillance.jpg", label: "Caméras de surveillance" },
    { path: "assets/images/solaire.jpg", label: "Panneaux solaires" },
  ];

  const photoSlotsContainer = document.getElementById("photo-slots");

  if (photoSlotsContainer) {
    const githubConnectBox = document.getElementById("github-connect");
    const githubConnectedBox = document.getElementById("github-connected");
    const ghTokenInput = document.getElementById("gh-token");
    const ghSaveBtn = document.getElementById("gh-save");
    const ghDisconnectBtn = document.getElementById("gh-disconnect");

    function getGithubToken() {
      return localStorage.getItem(GITHUB_TOKEN_KEY) || "";
    }

    function refreshConnectionUI() {
      var connected = !!getGithubToken();
      githubConnectBox.hidden = connected;
      githubConnectedBox.hidden = !connected;
    }

    ghSaveBtn.addEventListener("click", function () {
      var token = ghTokenInput.value.trim();
      if (!token) return;
      localStorage.setItem(GITHUB_TOKEN_KEY, token);
      ghTokenInput.value = "";
      refreshConnectionUI();
    });

    ghDisconnectBtn.addEventListener("click", function () {
      localStorage.removeItem(GITHUB_TOKEN_KEY);
      refreshConnectionUI();
    });

    refreshConnectionUI();

    // Redimensionne/compresse l'image dans le navigateur avant envoi
    // (garde le site rapide, évite les fichiers trop lourds pour l'API GitHub).
    function resizeImageToBase64(file, maxWidth) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var scale = Math.min(1, maxWidth / img.width);
            var canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
            resolve(dataUrl.split(",")[1]);
          };
          img.onerror = function () { reject(new Error("Image illisible")); };
          img.src = reader.result;
        };
        reader.onerror = function () { reject(new Error("Fichier illisible")); };
        reader.readAsDataURL(file);
      });
    }

    function githubRequest(path, options) {
      var token = getGithubToken();
      var headers = {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      return fetch(
        "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path,
        Object.assign({ headers: headers }, options)
      );
    }

    function uploadPhoto(slot, file, statusEl, imgEl) {
      statusEl.textContent = "Préparation de l'image...";

      resizeImageToBase64(file, 1000)
        .then(function (base64) {
          statusEl.textContent = "Vérification du fichier existant...";
          return githubRequest(slot.path + "?ref=" + GITHUB_BRANCH, { method: "GET" }).then(function (getRes) {
            if (getRes.ok) {
              return getRes.json().then(function (data) {
                return { base64: base64, sha: data.sha };
              });
            }
            if (getRes.status === 404) {
              return { base64: base64, sha: null };
            }
            throw new Error("Lecture impossible (" + getRes.status + ")");
          });
        })
        .then(function (result) {
          statusEl.textContent = "Envoi en cours...";
          var body = {
            message: "Mise à jour de la photo : " + slot.label + " (via l'espace admin)",
            content: result.base64,
            branch: GITHUB_BRANCH,
          };
          if (result.sha) body.sha = result.sha;

          return githubRequest(slot.path, { method: "PUT", body: JSON.stringify(body) }).then(function (putRes) {
            if (!putRes.ok) {
              return putRes.json().catch(function () { return {}; }).then(function (err) {
                throw new Error(err.message || "Erreur " + putRes.status);
              });
            }
            imgEl.src = "data:image/jpeg;base64," + result.base64;
            statusEl.textContent = "✅ Envoyée ! Le site sera à jour dans ~1 minute.";
          });
        })
        .catch(function (err) {
          statusEl.textContent = "❌ Erreur : " + err.message;
        });
    }

    SITE_PHOTOS.forEach(function (slot, index) {
      var wrapper = document.createElement("div");
      wrapper.className = "photo-slot";
      var inputId = "photo-input-" + index;

      wrapper.innerHTML =
        '<img src="' + slot.path + '" alt="' + escapeHtml(slot.label) + '">' +
        '<div class="photo-slot-body">' +
          '<div class="photo-slot-label">' + escapeHtml(slot.label) + "</div>" +
          '<label class="photo-slot-upload" for="' + inputId + '">Changer la photo</label>' +
          '<input type="file" id="' + inputId + '" accept="image/*">' +
          '<div class="photo-slot-status"></div>' +
        "</div>";

      var imgEl = wrapper.querySelector("img");
      var statusEl = wrapper.querySelector(".photo-slot-status");
      var fileInput = wrapper.querySelector("input[type=file]");

      fileInput.addEventListener("change", function () {
        if (!getGithubToken()) {
          statusEl.textContent = "Connectez GitHub d'abord (ci-dessus).";
          fileInput.value = "";
          return;
        }
        var file = fileInput.files[0];
        if (!file) return;
        uploadPhoto(slot, file, statusEl, imgEl);
        fileInput.value = "";
      });

      photoSlotsContainer.appendChild(wrapper);
    });
  }
});
