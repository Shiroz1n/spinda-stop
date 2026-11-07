import assert from "node:assert/strict";
import { test } from "node:test";
import { getPokepasteRawUrl } from "../src/data/pokepaste.js";

test("Poképaste links resolve only to the public raw route on the expected host", () => {
  assert.equal(getPokepasteRawUrl("https://pokepast.es/4d18a11252f2937f"), "https://pokepast.es/4d18a11252f2937f/raw");
  assert.equal(getPokepasteRawUrl("https://www.pokepast.es/4d18a11252f2937f/raw/"), "https://pokepast.es/4d18a11252f2937f/raw");
  assert.equal(getPokepasteRawUrl("http://pokepast.es/4d18a11252f2937f"), null);
  assert.equal(getPokepasteRawUrl("https://pokepast.es.attacker.test/4d18a11252f2937f"), null);
  assert.equal(getPokepasteRawUrl("https://user@pokepast.es/4d18a11252f2937f"), null);
  assert.equal(getPokepasteRawUrl("https://pokepast.es/4d18a11252f2937f?redirect=other"), null);
});
