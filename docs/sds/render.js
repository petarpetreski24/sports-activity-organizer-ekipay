// Renders every img/*.svg to img/*.png at 2x for crisp embedding in the docx.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const dir = path.join(__dirname, 'img');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));

for (const f of files) {
  const svg = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = svg.match(/width="(\d+)"/);
  const baseWidth = m ? parseInt(m[1], 10) : 900;
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: baseWidth * 2 },
    font: { loadSystemFonts: true },
    background: 'white',
  });
  const png = resvg.render().asPng();
  const out = path.join(dir, f.replace(/\.svg$/, '.png'));
  fs.writeFileSync(out, png);
  console.log('rendered', f, '->', path.basename(out), `(${png.length} bytes)`);
}
