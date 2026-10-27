(() => {
  "use strict";

  // ---------- données (uniquement sur le téléphone) ----------
  // Glycémie stockée en mg/dL ; affichée dans l'unité choisie.
  // Repas : { id, at: "AAAA-MM-JJTHH:MM", gly: mg/dL|null, items: [{ name, cat, size? }], units, note }
  const KEY = "memo-insuline-v1";
  let data = { version: 1, settings: { unit: "gl" }, entries: [], custom: [] };
  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch { storageOk = false; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch { storageOk = false; toast("Enregistrement impossible : le stockage du téléphone est plein ou bloqué."); return false; }
  }
  // Demande à Android de ne pas effacer ces données en cas de manque de place.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- outils ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const norm = (s) => (s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-‐]/g, " ").replace(/\s+/g, " ");
  const fmt = (n, d) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtUnits = (u) => fmt(u, Number.isInteger(u) ? 0 : 1);
  const parseNum = (s) => { const v = parseFloat(String(s || "").replace(",", ".")); return isFinite(v) ? v : null; };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const UNIT = { gl: "g/L", mg: "mg/dL", mmol: "mmol/L" };
  function glyToMg(str) {
    const v = parseNum(str); if (v == null || v <= 0) return null;
    const u = data.settings.unit;
    return u === "mg" ? Math.round(v) : u === "mmol" ? Math.round(v * 18.016) : Math.round(v * 100);
  }
  function fmtGly(mg) {
    if (mg == null) return "—";
    const u = data.settings.unit;
    return u === "mg" ? fmt(Math.round(mg), 0) : u === "mmol" ? fmt(mg / 18.016, 1) : fmt(mg / 100, 2);
  }
  function nowLocal() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  function fmtWhen(at) {
    const d = new Date(at);
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  const itemLabel = (it) => it.name + (it.size ? " (" + it.size.toLowerCase() + ")" : "");
  const itemKey = (it) => norm(it.name) + (it.size ? "|" + norm(it.size) : "");
  const comboKey = (items) => items.map(itemKey).sort().join(" + ");

  let toastTimer;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200); }

  // ---------- repas en cours ----------
  let current = [];

  function allFoods() {
    // aliments du patient (avec nombre d'utilisations) + catalogue, sans doublon
    const map = new Map();
    const uses = new Map();
    data.entries.forEach(e => e.items.forEach(it => { const k = norm(it.name); uses.set(k, (uses.get(k) || 0) + 1); if (!map.has(k)) map.set(k, { name: it.name, cat: it.cat }); }));
    data.custom.forEach(f => { const k = norm(f.name); if (!map.has(k)) map.set(k, f); });
    const en = new Map();
    window.CATALOGUE.forEach(f => { const k = norm(f.name); en.set(k, f.en); if (!map.has(k)) map.set(k, f); });
    return [...map.entries()].map(([k, f]) => ({ name: f.name, cat: f.cat, en: en.get(k), key: k, uses: uses.get(k) || 0 }));
  }

  function addItem(food) {
    const it = { name: food.name, cat: food.cat };
    if (food.cat === "boisson") it.size = lastSizeFor(food.name) || (/caf|the|chocolat chaud|lait/.test(norm(food.name)) ? "Tasse" : "Verre");
    current.push(it);
    $("f-search").value = "";
    $("btn-add").disabled = true;
    renderSearch(); renderItems(); renderMemo();
  }
  function lastSizeFor(name) {
    const k = norm(name);
    const e = [...data.entries].sort((a, b) => b.at.localeCompare(a.at)).find(e => e.items.some(i => norm(i.name) === k && i.size));
    return e ? e.items.find(i => norm(i.name) === k).size : null;
  }

  function renderItems() {
    const ul = $("items");
    ul.replaceChildren(...current.map((it, i) => {
      const left = el("span", { className: "tag " + it.cat, textContent: it.cat === "boisson" ? "Boisson" : "Plat" });
      const mid = el("div", {}, el("div", { className: "name", textContent: it.name }));
      if (it.cat === "boisson") {
        const sel = el("select");
        sel.setAttribute("aria-label", "Quantité de " + it.name);
        window.TAILLES.forEach(t => sel.append(el("option", { value: t, textContent: t, selected: t === it.size })));
        sel.onchange = () => { it.size = sel.value; renderMemo(); };
        mid.append(sel);
      }
      const rm = el("button", { type: "button", className: "rm", textContent: "×" });
      rm.setAttribute("aria-label", "Retirer " + it.name);
      rm.onclick = () => { current.splice(i, 1); renderItems(); renderMemo(); renderQuick(); };
      return el("li", {}, left, mid, rm);
    }));
    $("items-empty").hidden = current.length > 0;
    renderQuick();
  }

  function renderSearch() {
    const q = norm($("f-search").value);
    const box = $("results");
    if (!q) { box.hidden = true; box.replaceChildren(); $("quick-zone").hidden = false; return; }
    $("quick-zone").hidden = true;
    $("browse").hidden = true;
    const words = q.split(" ");
    const matches = allFoods()
      .filter(f => words.every(w => f.key.includes(w)))
      .sort((a, b) => (b.uses - a.uses) || (a.key.startsWith(q) ? -1 : 0) - (b.key.startsWith(q) ? -1 : 0) || a.key.localeCompare(b.key))
      .slice(0, 7);
    const kids = matches.map(f => {
      const b = el("button", { type: "button" }, el("span", { textContent: f.name }), el("span", { className: "tag " + f.cat, textContent: f.uses ? f.uses + "×" : (f.cat === "boisson" ? "Boisson" : "Plat") }));
      b.onclick = () => addItem(f);
      return b;
    });
    if (!matches.some(f => f.key === q)) {
      const name = $("f-search").value.trim();
      const pick = (cat) => { data.custom.push({ name, cat }); save(); addItem({ name, cat }); };
      const bp = el("button", { type: "button", textContent: "C'est un plat" }); bp.onclick = () => pick("plat");
      const bb = el("button", { type: "button", textContent: "C'est une boisson" }); bb.onclick = () => pick("boisson");
      // en tête de liste pour rester visible au-dessus du clavier
      kids.unshift(el("div", { className: "add-new" }, el("span", { textContent: "Nouveau : « " + name + " » est…" }), el("div", { className: "two" }, bp, bb)));
    }
    box.replaceChildren(...kids);
    box.hidden = false;
  }

  const chip = (f) => {
    const b = el("button", { type: "button", className: "chip " + f.cat, textContent: "+ " + f.name });
    b.onclick = () => { $("browse").hidden = true; $("btn-browse").textContent = "Voir toute la liste"; addItem(f); };
    return b;
  };

  function renderQuick() {
    // les habituels du patient d'abord, complétés par des suggestions courantes tant qu'il y en a peu
    const inCurrent = new Set(current.map(i => norm(i.name)));
    const foods = allFoods().filter(f => !inCurrent.has(f.key));
    const fav = foods.filter(f => f.uses > 0).sort((a, b) => b.uses - a.uses).slice(0, 10);
    const keys = new Set(fav.map(f => f.key));
    const extra = window.SUGGESTIONS.map(norm).map(k => foods.find(f => f.key === k)).filter(f => f && !keys.has(f.key)).slice(0, Math.max(0, 10 - fav.length));
    $("quick-label").textContent = fav.length ? "Mes habituels" + (extra.length ? " et suggestions" : "") : "Suggestions";
    $("quick").replaceChildren(...fav.map(chip), ...extra.map(chip));
  }

  function renderBrowse() {
    const inCurrent = new Set(current.map(i => norm(i.name)));
    const foods = allFoods().filter(f => !inCurrent.has(f.key)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const group = (cat, title) => el("div", { style: "display:grid;gap:8px" }, el("div", { className: "browse-cat", textContent: title }),
      el("div", { className: "chips" }, ...foods.filter(f => f.cat === cat).map(chip)));
    $("browse").replaceChildren(group("plat", "Plats, desserts et en-cas"), group("boisson", "Boissons"));
  }
  $("btn-browse").onclick = () => {
    const open = $("browse").hidden;
    if (open) renderBrowse();
    $("browse").hidden = !open;
    $("btn-browse").textContent = open ? "Masquer la liste" : "Voir toute la liste";
  };

  // miniature cliquable (la photo est chargée depuis le téléphone)
  function thumb(photoId) {
    const img = el("img", { alt: "Photo du repas" });
    const b = el("button", { type: "button", className: "thumb" }, img);
    b.setAttribute("aria-label", "Agrandir la photo");
    PhotoIA.photoURL(photoId).then(u => { if (u) img.src = u; else b.hidden = true; });
    b.onclick = () => { $("viewer-img").src = img.src; $("viewer").showModal(); };
    return b;
  }
  $("viewer-close").onclick = () => $("viewer").close();
  $("viewer").addEventListener("click", (ev) => { if (ev.target === $("viewer")) $("viewer").close(); });

  function memoRow(e) {
    const row = el("div", { className: "memo-row" + (e.photoId ? " has-photo" : "") });
    if (e.photoId) row.append(thumb(e.photoId));
    row.append(
      el("div", { className: "when num", textContent: fmtWhen(e.at) + " · glycémie " + fmtGly(e.gly) + (e.gly != null ? " " + UNIT[data.settings.unit] : "") }),
      el("div", { className: "u num" }, document.createTextNode(fmtUnits(e.units)), el("small", { textContent: "unités" })),
      el("div", { className: "what", textContent: e.items.map(itemLabel).join(" + ") + (e.note ? " — " + e.note : "") }));
    return row;
  }

  function renderMemo() {
    const box = $("memo"), body = $("memo-body");
    if (!current.length) { box.hidden = true; return; }
    const sorted = [...data.entries].sort((a, b) => b.at.localeCompare(a.at));
    const ck = comboKey(current);
    const same = sorted.filter(e => comboKey(e.items) === ck).slice(0, 4);
    const shown = new Set(same.map(e => e.id));
    const groups = [];
    if (same.length) groups.push(el("div", { className: "memo-group" }, el("div", { className: "lbl", textContent: current.length > 1 ? "Exactement ce repas" : "La dernière fois" }), ...same.map(memoRow)));
    current.forEach(it => {
      const k = norm(it.name);
      const withIt = sorted.filter(e => !shown.has(e.id) && e.items.some(i => norm(i.name) === k)).slice(0, 2);
      withIt.forEach(e => shown.add(e.id));
      if (withIt.length) groups.push(el("div", { className: "memo-group" }, el("div", { className: "lbl", textContent: "Avec " + it.name }), ...withIt.map(memoRow)));
    });
    if (!groups.length) groups.push(el("p", { className: "memo-note", style: "margin:0", textContent: "Première fois pour ce repas : vos unités seront rappelées ici la prochaine fois." }));
    body.replaceChildren(...groups);
    box.hidden = false;
  }

  // ---------- photo et reconnaissance ----------
  let photo = null; // { id, blob, url, emb, saved }

  function setStatus(txt) { $("ia-status").textContent = txt; }
  function clearPhoto() {
    if (photo && !photo.saved) URL.revokeObjectURL(photo.url);
    photo = null;
    $("photo-preview").hidden = true; $("photo-btn").hidden = false;
    $("ia-props").hidden = true; $("ia-chips").replaceChildren();
    $("f-photo").value = "";
  }
  $("photo-remove").onclick = clearPhoto;

  PhotoIA.onProgress = (p) => {
    if (!p.total || !/onnx/.test(p.file || "")) return;
    const txt = "Première utilisation : téléchargement du module d'IA… " + Math.round(p.loaded / p.total * 100) + " %";
    if (photo && !photo.emb) setStatus(txt);
    $("model-info").textContent = txt;
  };

  $("f-photo").onchange = async () => {
    const file = $("f-photo").files[0];
    if (!file) return;
    clearPhoto();
    let prepared;
    try { prepared = await PhotoIA.prepare(file); }
    catch { toast("Cette image n'a pas pu être ouverte."); return; }
    const p = photo = { id: "p" + newId(), blob: prepared.blob, url: URL.createObjectURL(prepared.blob), emb: null, saved: false };
    $("photo-img").src = p.url;
    $("photo-preview").hidden = false; $("photo-btn").hidden = true;
    setStatus("Analyse de la photo… Vous pouvez saisir votre glycémie en attendant.");
    try {
      const emb = await PhotoIA.analyse(prepared);
      p.emb = emb;
      if (p.saved) await PhotoIA.setEmbedding(p.id, emb); // repas déjà enregistré pendant l'analyse
      if (photo !== p) return;
      const props = await PhotoIA.suggest(emb, data.entries, allFoods(), norm);
      if (photo !== p) return;
      renderProposals(props);
      setStatus(props.length ? "Analyse terminée." : "Plat non reconnu : choisissez-le dans la liste.");
    } catch (err) {
      console.warn("Reconnaissance indisponible", err);
      if (photo === p) setStatus(navigator.onLine ? "La reconnaissance n'a pas fonctionné. Choisissez le plat dans la liste." : "Reconnaissance indisponible hors ligne tant que le module d'IA n'a pas été téléchargé. Choisissez le plat dans la liste.");
    }
  };

  function renderProposals(props) {
    const chips = props.map(pr => {
      if (pr.kind === "combo") {
        const b = el("button", { type: "button", className: "chip ia" }, document.createTextNode(pr.items.map(i => i.name).join(" + ")),
          el("span", { className: "mine", textContent: "comme le " + new Date(pr.entry.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) }));
        b.onclick = () => { pr.items.forEach(i => { if (!current.some(c => norm(c.name) === norm(i.name))) current.push({ ...i }); }); b.remove(); renderItems(); renderMemo(); };
        return b;
      }
      const b = el("button", { type: "button", className: "chip ia " + pr.food.cat }, document.createTextNode("+ " + pr.food.name));
      if (pr.mine) b.append(el("span", { className: "mine", textContent: "déjà noté" }));
      b.onclick = () => { b.remove(); addItem(pr.food); };
      return b;
    });
    $("ia-chips").replaceChildren(...chips);
    $("ia-props").hidden = !chips.length;
  }

  function resetForm() {
    clearPhoto();
    current = [];
    $("f-gly").value = ""; $("f-units").value = ""; $("f-note").value = ""; $("f-search").value = "";
    $("f-when").value = nowLocal();
    renderSearch(); renderItems(); renderMemo();
  }

  // saisie manuelle : un nom connu est ajouté tout de suite, un nouveau nom demande « plat ou boisson ? »
  function addTyped() {
    const name = $("f-search").value.trim();
    if (!name) { $("f-search").focus(); return; }
    const known = allFoods().find(f => f.key === norm(name));
    if (known) { addItem(known); return; }
    renderSearch();
    const choice = $("results").querySelector(".add-new button");
    if (choice) choice.focus();
  }
  const syncAdd = () => ($("btn-add").disabled = !$("f-search").value.trim());
  $("f-search").addEventListener("input", () => { renderSearch(); syncAdd(); });
  $("f-search").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTyped(); } });
  $("btn-add").onclick = () => { addTyped(); syncAdd(); };
  syncAdd();
  const step = (d) => { const v = parseNum($("f-units").value) || 0; $("f-units").value = fmtUnits(Math.max(0, Math.round((v + d) * 2) / 2)); };
  $("u-minus").onclick = () => step(-0.5);
  $("u-plus").onclick = () => step(0.5);

  $("btn-save").onclick = async () => {
    if (!current.length) { toast("Ajoutez au moins un plat ou une boisson."); $("f-search").focus(); return; }
    const units = parseNum($("f-units").value);
    if (units == null || units < 0 || units > 100) { toast("Indiquez le nombre d'unités injectées (0 si aucune)."); $("f-units").focus(); return; }
    const glyStr = $("f-gly").value.trim();
    const gly = glyToMg(glyStr);
    if (glyStr && gly == null) { toast("La glycémie n'est pas un nombre valide."); $("f-gly").focus(); return; }
    const e = { id: newId(), at: $("f-when").value || nowLocal(), gly, items: current.map(i => ({ ...i })), units: Math.round(units * 2) / 2, note: $("f-note").value.trim() };
    if (photo) {
      try { await PhotoIA.save(photo.id, photo.blob, photo.emb); photo.saved = true; e.photoId = photo.id; }
      catch { toast("La photo n'a pas pu être gardée (stockage plein ?). Le repas est enregistré sans photo."); }
    }
    data.entries.push(e);
    if (!save()) { data.entries.pop(); if (e.photoId) PhotoIA.remove(e.photoId); return; }
    toast("Enregistré : " + fmtUnits(e.units) + " unités");
    resetForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- journal ----------
  function renderJournal() {
    const q = norm($("j-search").value);
    const list = [...data.entries].sort((a, b) => b.at.localeCompare(a.at))
      .filter(e => !q || e.items.some(i => norm(i.name).includes(q)) || norm(e.note).includes(q));
    const root = $("journal");
    if (!data.entries.length) { root.replaceChildren(el("p", { className: "empty", textContent: "Aucun repas noté pour l'instant. Vos repas apparaîtront ici après le premier enregistrement." })); return; }
    if (!list.length) { root.replaceChildren(el("p", { className: "empty", textContent: "Aucun repas ne correspond à cette recherche." })); return; }
    const out = []; let day = null;
    list.slice(0, 300).forEach(e => {
      const d = new Date(e.at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      if (d !== day) { day = d; out.push(el("div", { className: "day-label", textContent: d })); }
      out.push(entryCard(e));
    });
    root.replaceChildren(...out);
  }

  function entryCard(e) {
    const its = el("div", { className: "its" }, ...e.items.map(i => el("span", { className: "pill " + i.cat, textContent: itemLabel(i) })));
    if (e.photoId) its.prepend(thumb(e.photoId));
    const what = el("div", {}, its, el("div", { className: "meta num", textContent: "Glycémie avant : " + fmtGly(e.gly) + (e.gly != null ? " " + UNIT[data.settings.unit] : "") }));
    if (e.note) what.append(el("div", { className: "note", textContent: e.note }));
    const acts = el("div", { className: "acts" });
    const again = el("button", { type: "button", textContent: "Remanger ce repas" });
    again.onclick = () => { current = e.items.map(i => ({ ...i })); show("repas"); renderItems(); renderMemo(); $("f-gly").focus(); };
    const del = el("button", { type: "button", className: "btn-danger", textContent: "Supprimer" });
    del.onclick = () => {
      const yes = el("button", { type: "button", className: "btn-danger", textContent: "Oui, supprimer" });
      const no = el("button", { type: "button", textContent: "Annuler" });
      yes.onclick = () => { data.entries = data.entries.filter(x => x.id !== e.id); save(); if (e.photoId) PhotoIA.remove(e.photoId).catch(() => {}); renderJournal(); toast("Repas supprimé"); };
      no.onclick = () => acts.replaceChildren(again, del);
      acts.replaceChildren(el("span", { textContent: "Supprimer ce repas ?" }), no, yes);
    };
    acts.append(again, del);
    return el("article", { className: "card entry" },
      el("div", { className: "t num", textContent: new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) }),
      what,
      el("div", { className: "u num" }, document.createTextNode(fmtUnits(e.units)), el("small", { textContent: "unités" })),
      acts);
  }
  $("j-search").addEventListener("input", renderJournal);

  // ---------- réglages ----------
  $("s-unit").onchange = () => { data.settings.unit = $("s-unit").value; save(); renderUnit(); toast("Unité : " + UNIT[data.settings.unit]); };
  function renderUnit() { document.querySelectorAll(".u-label").forEach(n => (n.textContent = UNIT[data.settings.unit])); $("s-unit").value = data.settings.unit; }

  function downloadFile(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const today = () => new Date().toISOString().slice(0, 10);
  $("btn-backup").onclick = async () => {
    let photos = [];
    try { photos = await PhotoIA.exportAll(); } catch { toast("Les photos n'ont pas pu être ajoutées à la sauvegarde."); }
    downloadFile("memo-insuline-sauvegarde-" + today() + ".json", JSON.stringify({ ...data, photos }), "application/json");
    toast("Sauvegarde créée dans vos téléchargements");
  };
  $("btn-restore").onclick = () => $("f-restore").click();
  $("f-restore").onchange = async () => {
    const f = $("f-restore").files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.entries)) throw new Error("format");
      const known = new Set(data.entries.map(e => e.id));
      const added = d.entries.filter(e => e && e.id && Array.isArray(e.items) && !known.has(e.id));
      const photoIds = new Set(added.map(e => e.photoId).filter(Boolean));
      await PhotoIA.importAll((d.photos || []).filter(p => photoIds.has(p.id))).catch(() => toast("Certaines photos n'ont pas pu être restaurées."));
      data.entries.push(...added);
      (d.custom || []).forEach(c => { if (!data.custom.some(x => norm(x.name) === norm(c.name))) data.custom.push(c); });
      save(); renderAll();
      toast(added.length + " repas restaurés");
    } catch { toast("Ce fichier n'est pas une sauvegarde de Mémo insuline."); }
    $("f-restore").value = "";
  };
  $("btn-csv").onclick = () => {
    if (!data.entries.length) { toast("Rien à exporter pour l'instant."); return; }
    const esc = (v) => { const s = v == null ? "" : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [["Date", "Heure", "Glycémie avant (" + UNIT[data.settings.unit] + ")", "Mangé / bu", "Unités", "Note"]];
    [...data.entries].sort((a, b) => a.at.localeCompare(b.at)).forEach(e => {
      const d = new Date(e.at);
      rows.push([d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), e.gly == null ? "" : fmtGly(e.gly), e.items.map(itemLabel).join(" + "), fmtUnits(e.units), e.note]);
    });
    downloadFile("memo-insuline-" + today() + ".csv", "﻿" + rows.map(r => r.map(esc).join(";")).join("\n"), "text/csv");
  };
  $("btn-wipe").onclick = () => {
    const z = $("wipe-zone");
    const yes = el("button", { type: "button", className: "btn-danger", textContent: "Oui, tout effacer" });
    const no = el("button", { type: "button", textContent: "Annuler" });
    no.onclick = () => z.replaceChildren(wipeBtn);
    yes.onclick = () => { data.entries = []; data.custom = []; save(); PhotoIA.clear().catch(() => {}); renderAll(); z.replaceChildren(wipeBtn); toast("Toutes les données ont été effacées"); };
    z.replaceChildren(el("p", { className: "notice", style: "margin:0 0 8px", textContent: "Tous vos repas seront effacés de ce téléphone. Faites d'abord une sauvegarde si vous voulez les garder." }), el("div", { className: "btn-row" }, no, yes));
  };
  const wipeBtn = $("btn-wipe");

  $("btn-model").onclick = async () => {
    $("btn-model").disabled = true;
    $("model-info").textContent = "Téléchargement du module d'IA…";
    try { await PhotoIA.loadModel(); $("model-info").textContent = "Module d'IA prêt : la reconnaissance fonctionne aussi hors ligne."; }
    catch { $("model-info").textContent = "Le téléchargement a échoué. Vérifiez la connexion internet et réessayez."; }
    $("btn-model").disabled = false;
  };

  async function renderStorage() {
    let txt = storageOk ? data.entries.length + " repas enregistrés sur ce téléphone." : "Le stockage est bloqué : les repas ne seront pas gardés.";
    try { if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) txt += " Stockage protégé contre l'effacement automatique."; } catch {}
    $("storage-info").textContent = txt;
  }

  // ---------- navigation ----------
  const TITLES = { repas: "Nouveau repas", journal: "Journal", reglages: "Réglages" };
  function show(view) {
    ["repas", "journal", "reglages"].forEach(v => ($("view-" + v).hidden = v !== view));
    document.querySelectorAll("nav.tabs button").forEach(b => { if (b.dataset.view === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("view-title").textContent = TITLES[view];
    if (view === "journal") renderJournal();
    if (view === "reglages") renderStorage();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav.tabs button").forEach(b => (b.onclick = () => show(b.dataset.view)));

  function renderAll() { renderUnit(); renderItems(); renderMemo(); renderJournal(); }

  // ---------- démarrage ----------
  load();
  resetForm();
  renderUnit();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
