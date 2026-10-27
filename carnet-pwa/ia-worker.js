// Reconnaissance des plats, exécutée sur le téléphone dans un fil séparé (l'écran reste fluide).
// Modèle : MobileCLIP S0. Téléchargé une seule fois, puis gardé en cache par le navigateur.
import { env, AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, RawImage }
  from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL = "Xenova/mobileclip_s0";
let ready = null;
let tokenizer, textModel, processor, visionModel;

function load() {
  if (!ready) {
    const progress_callback = (p) => {
      if (p.status === "progress") self.postMessage({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
    };
    ready = (async () => {
      tokenizer = await AutoTokenizer.from_pretrained(MODEL, { progress_callback });
      textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL, { progress_callback });
      processor = await AutoProcessor.from_pretrained(MODEL, { progress_callback });
      visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { quantized: false, progress_callback });
    })();
    ready.catch(() => { ready = null; });
  }
  return ready;
}

self.onmessage = async ({ data: msg }) => {
  try {
    if (msg.type === "load") {
      await load();
      self.postMessage({ id: msg.id, ok: true });
    } else if (msg.type === "image") {
      await load();
      const image = new RawImage(new Uint8ClampedArray(msg.pixels), msg.width, msg.height, 4);
      const { image_embeds } = await visionModel(await processor(image));
      self.postMessage({ id: msg.id, ok: true, embedding: image_embeds.normalize().tolist()[0] });
    } else if (msg.type === "texts") {
      await load();
      const out = [];
      for (let i = 0; i < msg.texts.length; i += 32) {
        const inputs = tokenizer(msg.texts.slice(i, i + 32), { padding: "max_length", truncation: true });
        const { text_embeds } = await textModel(inputs);
        out.push(...text_embeds.normalize().tolist());
      }
      self.postMessage({ id: msg.id, ok: true, embeddings: out });
    }
  } catch (e) {
    self.postMessage({ id: msg.id, ok: false, error: String(e && e.message || e) });
  }
};
