# Vectorizer

Local image vectorizer app that lets you upload an image, preview the traced result, and download the output as an SVG.

## Features

- Upload common image formats locally in the browser
- Adjust threshold, cleanup, smoothing, inversion, and contrast
- Preview the original image and generated SVG side by side
- Download the final vectorized SVG file

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

## Notes

- Output format is SVG.
- Very large images are resized before tracing to keep the app responsive.
- Best results usually come from logos, illustrations, icons, signatures, and high-contrast artwork.
