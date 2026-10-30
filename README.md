# spritesmaker

Parametric top-down sprite generator for aircraft and vessels. Give it an ICAO type code, it looks up the real dimensions on Wikipedia, picks the matching silhouette template and renders a 128×128 PNG sprite.

Built for the flight-tracker and marine-tracker map projects, where every aircraft and ship type needs a consistent, correctly proportioned icon.

## How it works

1. **Specs** — `src/fetch-specs.js` resolves an ICAO code to a Wikipedia article (`data/icao-to-wiki.json`) and pulls wingspan, length and engine layout.
2. **Templates** — `src/templates/` holds one parametric SVG template per family: narrowbody, widebody, regional, turboprop, bizjet, light piston, fighter, helicopter and vessel.
3. **Render** — `src/render.js` scales the template to the real proportions and rasterises it with [sharp](https://sharp.pixelplumbing.com/).
4. **QA** — `src/qa.js` and `src/validate.js` check orientation and silhouette; results land in `data/qa-results.json`. `src/contact-sheet.js` tiles everything into one image for a quick visual pass.

There is also an experimental 3D path (`src/render-3d.js`, `src/blender-render.py`) that renders from Sketchfab models instead of templates.

## Usage

```bash
npm install
node index.js --icao A320          # one sprite
node index.js --all                # every type in data/icao-types.json
node src/contact-sheet.js          # review sheet
```

Output goes to `output/`.

## Related

- [sprite-orientation-classifier](https://github.com/yasser159/sprite-orientation-classifier) — the TensorFlow.js model that checks the generated sprites point north.

## License

MIT
