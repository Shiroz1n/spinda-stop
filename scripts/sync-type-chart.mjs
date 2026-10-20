import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Generations } from "@smogon/calc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "apps/web/src/data/typeChart.json");
const types = [...Generations.get(0).types]
  .filter((type) => type.name !== "???")
  .sort((left, right) => left.name.localeCompare(right.name, "en"));
const chart = Object.fromEntries(types.map((attacker) => [
  attacker.name.toLocaleLowerCase("en"),
  Object.fromEntries(types.map((defender) => [
    defender.name.toLocaleLowerCase("en"),
    attacker.effectiveness[defender.name] ?? 1,
  ])),
]));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(chart, null, 2)}\n`);
console.log(`Wrote ${types.length} × ${types.length} type chart from @smogon/calc.`);
