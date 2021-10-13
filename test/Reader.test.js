import assert from "assert";
import { Keyword } from "../src/keyword.js";
import { read } from "../src/Reader.js";
import { test } from "./Test.js";

async function testRead(name, source, expected) {
	await test(name, () => {
		let forms = read(source, name);
		let actual = forms.toJS();
		assert.deepStrictEqual(actual, expected);
	});
}

const S = Symbol.for;
const K = Keyword.for;

await testRead("Nil literal", "nil", [undefined]);
await testRead("Bool literal", "true false", [true, false]);
await testRead("Integer literal", "1234 +1 -77777", [1234, +1, -77777]);
await testRead("Float literal", "1.34 .7", [1.34, 0.7]);
await testRead("Exponent literal", "1e4 +2.5e6 6e-14", [1e4, +2.5e6, 6e-14]);
await testRead("Sym literal", "a +inc? -12c", [S("a"), S("+inc?"), S("-12c")]);
await testRead("Keyword literal", ":x :12-4", [K("x"), K("12-4")]);
await testRead("Str literal", '"string" "\n\\n\\"\\\\\\""', [
	"string",
	'\n\n"\\"',
]);
await testRead("List literal", "(1 2 3) (() ())", [
	[1, 2, 3],
	[[], []],
]);
await testRead("List constructor", "[] [1 2 3] [(1 2) x]", [
	[S("List")],
	[S("List"), 1, 2, 3],
	[S("List"), [1, 2], S("x")],
]);
await testRead("Map constructor", "{} {:x 4} {[1 2] 3}", [
	[S("Map")],
	[S("Map"), K("x"), 4],
	[S("Map"), [S("List"), 1, 2], 3],
]);
await testRead("Quote macro", "'a", [[S("quote"), S("a")]]);
await testRead("Quasi-quote macro", "`a", [[S("quasi-quote"), S("a")]]);
await testRead("Unquote-splice macro", ",,,a", [[S("unquote-splice"), S("a")]]);
await testRead("Unquote macro", ",a", [[S("unquote"), S("a")]]);
