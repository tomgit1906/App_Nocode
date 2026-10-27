// Photos des repas et reconnaissance des plats. Tout reste sur le téléphone :
// les photos et leurs « empreintes » sont dans IndexedDB, l'IA tourne dans ia-worker.js.
window.PhotoIA = (() => {
  "use strict";
  const MODEL_KEY = "labels:mobileclip_s0:v1";

  // ---------- IndexedDB ----------
  const dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open("memo-insuline", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("photos", { keyPath: "id" }); r.result.createObjectStore("kv"); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  function tx(store, mode, fn) {
    return dbp.then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    }));
  }
  const getPhoto = (id) => tx("photos", "readonly", s => s.get(id));
  const putPhoto = (rec) => tx("photos", "readwrite", s => s.put(rec));
  const deletePhoto = (id) => tx("photos", "readwrite", s => s.delete(id));
  const allPhotos = () => tx("photos", "readonly", s => s.getAll());
  const clearPhotos = () => tx("photos", "readwrite", s => s.clear());

  // empreintes des photos déjà validées, pour reconnaître les plats du patient
  const embeddings = new Map();
  const loaded = allPhotos().then(list => list.forEach(p => p.emb && embeddings.set(p.id, p.emb))).catch(() => {});

  // ---------- photo : réduction de taille ----------
  async function prepare(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.75));
    // petite copie pour l'IA, qui travaille en 256 px
    const s = Math.min(1, 320 / Math.max(c.width, c.height));
    const c2 = document.createElement("canvas");
    c2.width = Math.round(c.width * s); c2.height = Math.round(c.height * s);
    const ctx = c2.getContext("2d"); ctx.drawImage(c, 0, 0, c2.width, c2.height);
    const img = ctx.getImageData(0, 0, c2.width, c2.height);
    bmp.close && bmp.close();
    return { blob, pixels: img.data.buffer, width: c2.width, height: c2.height };
  }

  const urls = new Map();
  async function photoURL(id) {
    if (urls.has(id)) return urls.get(id);
    const rec = await getPhoto(id).catch(() => null);
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob);
    urls.set(id, u);
    return u;
  }

  // ---------- IA (fil séparé) ----------
  let worker = null, seq = 0;
  const pending = new Map();
  let onProgress = () => {};
  let modelState = "absent"; // absent | loading | ready | error
  function call(type, payload = {}, transfer = []) {
    if (!worker) {
      worker = new Worker("ia-worker.js", { type: "module" });
      worker.onmessage = ({ data }) => {
        if (data.type === "progress") { onProgress(data); return; }
        const p = pending.get(data.id); if (!p) return;
        pending.delete(data.id);
        data.ok ? p.resolve(data) : p.reject(new Error(data.error));
      };
      worker.onerror = (e) => { pending.forEach(p => p.reject(new Error(e.message || "worker"))); pending.clear(); worker = null; modelState = "error"; };
    }
    const id = ++seq;
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, type, ...payload }, transfer); });
  }
  async function loadModel() {
    modelState = "loading";
    try { await call("load"); modelState = "ready"; } catch (e) { modelState = "error"; throw e; }
  }

  // empreintes des noms de plats (calculées une fois, puis gardées)
  let labelCache = null;
  async function labelEmbeddings(foods) {
    if (!labelCache) labelCache = (await tx("kv", "readonly", s => s.get(MODEL_KEY)).catch(() => null)) || {};
    const prompt = (f) => "a photo of " + (f.en || f.name);
    const missing = [...new Set(foods.map(prompt))].filter(p => !labelCache[p]);
    if (missing.length) {
      const { embeddings: embs } = await call("texts", { texts: missing });
      missing.forEach((p, i) => (labelCache[p] = embs[i]));
      await tx("kv", "readwrite", s => s.put(labelCache, MODEL_KEY)).catch(() => {});
    }
    return foods.map(f => labelCache[prompt(f)]);
  }

  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  // Propose des plats pour une photo : d'abord les repas déjà photographiés qui ressemblent,
  // puis les plats de la liste que l'IA reconnaît.
  async function suggest(emb, entries, foods, norm) {
    await loaded;
    const out = [];
    const seen = new Set();
    // 1. repas du patient qui ressemblent (apprentissage par ses propres photos)
    const similar = entries.filter(e => e.photoId && embeddings.has(e.photoId))
      .map(e => ({ e, sim: dot(emb, embeddings.get(e.photoId)) }))
      .filter(x => x.sim >= 0.8).sort((a, b) => b.sim - a.sim);
    if (similar.length) {
      const best = similar[0].e;
      out.push({ kind: "combo", items: best.items, entry: best });
      best.items.forEach(i => seen.add(norm(i.name)));
    }
    similar.forEach(({ e }) => e.items.forEach(i => {
      if (!seen.has(norm(i.name))) { seen.add(norm(i.name)); out.push({ kind: "item", food: i, mine: true }); }
    }));
    // 2. reconnaissance parmi la liste (catalogue + aliments du patient)
    const labels = await labelEmbeddings(foods);
    const scored = foods.map((f, i) => ({ f, s: dot(emb, labels[i]) })).sort((a, b) => b.s - a.s);
    for (const { f } of scored) {
      if (out.length >= 5) break;
      if (!seen.has(norm(f.name))) { seen.add(norm(f.name)); out.push({ kind: "item", food: f, mine: false }); }
    }
    return out.slice(0, 5);
  }

  async function analyse(prepared) {
    const { embedding } = await call("image", { pixels: prepared.pixels, width: prepared.width, height: prepared.height }, [prepared.pixels]);
    modelState = "ready";
    return embedding;
  }

  // ---------- sauvegarde ----------
  const toDataURL = (blob) => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  async function exportAll() {
    const list = await allPhotos();
    return Promise.all(list.map(async p => ({ id: p.id, emb: p.emb || null, data: await toDataURL(p.blob) })));
  }
  async function importAll(list) {
    for (const p of list || []) {
      if (!p || !p.id || !p.data) continue;
      const blob = await (await fetch(p.data)).blob();
      await putPhoto({ id: p.id, blob, emb: p.emb || null });
      if (p.emb) embeddings.set(p.id, p.emb);
    }
  }

  return {
    prepare, analyse, suggest, photoURL, loadModel,
    get modelState() { return modelState; },
    set onProgress(fn) { onProgress = fn; },
    async save(id, blob, emb) { await putPhoto({ id, blob, emb: emb || null }); if (emb) embeddings.set(id, emb); },
    async setEmbedding(id, emb) { const rec = await getPhoto(id); if (rec) { rec.emb = emb; await putPhoto(rec); embeddings.set(id, emb); } },
    async remove(id) { embeddings.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } await deletePhoto(id); },
    async clear() { embeddings.clear(); urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); await clearPhotos(); },
    exportAll, importAll,
    async count() { return (await allPhotos()).length; },
  };
})();
