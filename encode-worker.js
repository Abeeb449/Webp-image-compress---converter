// Off-main-thread encoder. Runs the SAME vendored jsquash encoders as the main
// thread, so output is byte-identical — this only moves the CPU-heavy encode
// off the UI thread and lets a batch encode across several cores in parallel.
//
// Loaded as a module worker: `new Worker('./encode-worker.js', { type: 'module' })`.
// Paths to ./vendor/... resolve relative to this file (the site root), matching
// where index.html loads the same encoders from.

const MODULES = {
  webp: './vendor/jsquash-webp/encode.js',
  avif: './vendor/jsquash-avif/encode.js'
};

// One cached import per format, reused across messages.
const encoders = {};
function getEncoder(format) {
  if (!encoders[format]) {
    encoders[format] = import(MODULES[format]).then(function (mod) { return mod.default; });
  }
  return encoders[format];
}

// Build the exact same options object the main thread uses in encodeCanvas(),
// so the encoded bytes match.
function buildOptions(m) {
  if (m.lossless) return m.format === 'avif' ? { lossless: true } : { lossless: 1 };
  return { quality: m.quality };
}

self.onmessage = function (e) {
  const m = e.data;
  getEncoder(m.format)
    .then(function (encode) {
      const imageData = {
        data: new Uint8ClampedArray(m.data),
        width: m.width,
        height: m.height
      };
      return encode(imageData, buildOptions(m));
    })
    .then(function (buffer) {
      // buffer is an ArrayBuffer — transfer it back (zero-copy).
      self.postMessage({ id: m.id, ok: true, buffer: buffer }, [buffer]);
    })
    .catch(function (err) {
      self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
    });
};
