import { guideById } from "./data/guides";
const id = process.argv[2];
const g = guideById(id)!;
const q = (s: unknown) => JSON.stringify(s);
console.log(`GUIDE ${g.id} | title=${q(g.title)} | tagline=${q(g.tagline)} | hero=${q(g.hero?.label)}`);
console.log(`intro=${q(g.intro)}`);
for (const s of g.sections) {
  console.log(`\nSECTION ${s.id} | title=${q(s.title)} | eyebrow=${q(s.eyebrow)}`);
  s.blocks.forEach((b, i) => {
    switch (b.kind) {
      case "p": console.log(`  [${i}] p ${q(b.text)}`); break;
      case "list": console.log(`  [${i}] list ordered=${!!b.ordered} ${q(b.items)}`); break;
      case "callout": console.log(`  [${i}] callout tone=${b.tone} title=${q(b.title)} text=${q(b.text)} demoLabel=${q(b.demo?.label)}`); break;
      case "demo": console.log(`  [${i}] demo caption=${q(b.caption)} label=${q(b.demo.label)}`); break;
      case "demoGrid": console.log(`  [${i}] demoGrid (${b.demos.length} demos)`); break;
      case "cases": console.log(`  [${i}] cases: ${b.cases.map((c) => c.id).join(", ")}`); for (const c of b.cases) console.log(`       case ${c.id} | name=${q(c.name)} | recognise=${q(c.recognise)} | hold=${q(c.hold)} | note=${q(c.note)}`); break;
      case "practice": console.log(`  [${i}] practice label=${q(b.label)}`); break;
      case "guideLink": console.log(`  [${i}] guideLink label=${q(b.label)} text=${q(b.text)}`); break;
    }
  });
}
