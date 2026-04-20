const path = require("path");
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { trace, posterize } = require("potrace");

const app = express();
const port = Number(process.env.PORT) || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Please upload a valid image file."));
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/vectorize", upload.single("image"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image was uploaded." });
    return;
  }

  try {
    const settings = parseSettings(req.body);
    const normalized = await normalizeImage(req.file.buffer, settings);
    const svg = await vectorizeImage(normalized, settings);

    res.json({
      filename: buildOutputFilename(req.file.originalname),
      mimeType: "image/svg+xml",
      svg,
      settings,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Vectorization failed.",
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: error.message });
    return;
  }

  if (error) {
    res.status(400).json({ error: error.message || "Request failed." });
    return;
  }

  res.status(500).json({ error: "Unexpected server error." });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Vectorizer running at http://localhost:${port}`);
  });
}

function parseSettings(body) {
  return {
    threshold: clampNumber(body.threshold, 0, 255, 180),
    turdSize: clampNumber(body.turdSize, 0, 20, 2),
    optTolerance: clampNumber(body.optTolerance, 0, 1, 0.2),
    posterizeLevels: clampNumber(body.posterizeLevels, 2, 8, 4),
    invert: body.invert === "true",
    monochrome: body.monochrome !== "false",
    highContrast: body.highContrast === "true",
  };
}

async function normalizeImage(input, settings) {
  const image = sharp(input, { failOn: "none" }).rotate();
  const metadata = await image.metadata();
  const maxDimension = 1600;
  const resizeNeeded =
    Math.max(metadata.width || 0, metadata.height || 0) > maxDimension;

  let pipeline = image;

  if (resizeNeeded) {
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (settings.monochrome) {
    pipeline = pipeline
      .grayscale()
      .normalise()
      .linear(settings.highContrast ? 1.25 : 1, -(settings.highContrast ? 16 : 0));
  } else {
    pipeline = pipeline
      .normalise()
      .median(1)
      .png({ palette: true, colors: settings.posterizeLevels });
  }

  return pipeline.png().toBuffer();
}

function vectorizeImage(buffer, settings) {
  return new Promise((resolve, reject) => {
    const vectorizer = settings.monochrome ? trace : posterize;
    const options = {
      threshold: settings.threshold,
      turdSize: settings.turdSize,
      optTolerance: settings.optTolerance,
      background: "transparent",
      blackOnWhite: !settings.invert,
    };

    if (settings.monochrome) {
      options.color = "#111111";
    } else {
      options.steps = settings.posterizeLevels;
      options.fillStrategy = "dominant";
      options.rangeDistribution = "auto";
    }

    vectorizer(buffer, options, (error, svg) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(svg);
    });
  });
}

function buildOutputFilename(originalName) {
  const extension = path.extname(originalName);
  const basename = path.basename(originalName, extension) || "vectorized-image";
  return `${basename}.svg`;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

module.exports = {
  app,
  parseSettings,
  normalizeImage,
  vectorizeImage,
};
