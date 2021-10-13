import assert from "assert";
import { AnsiCodes, applyCode } from "../src/AnsiCodes.js";
import { Keyword } from "../src/keyword.js";
import { read } from "../src/Reader.js";

async function test(name, source, expected) {
	try {
		let forms = read(source, name);
		let actual = forms.toJS();
		assert.deepEqual(actual, expected);
		console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
	} catch (error) {
		console.log();
		console.log(applyCode(AnsiCodes.FgRed, ` ✘ ${name}`));
		console.error(error);
	}
}

const S = Symbol.for;
const K = Keyword.for;

await test("Nil literal", "nil", [undefined]);
await test("Bool literal", "true false", [true, false]);
await test("Integer literal", "1234 +1 -77777", [1234, +1, -77777]);
await test("Float literal", "1.34 .7", [1.34, 0.7]);
await test("Exponent literal", "1e4 +2.5e6 6e-14", [1e4, +2.5e6, 6e-14]);
await test("Sym literal", "a +inc? -12c", [S("a"), S("+inc?"), S("-12c")]);
await test("Keyword literal", ":x :12-4", [K("x"), K("12-4")]);
await test("Str literal", '"string" "\n\\n\\"\\\\\\""', ["string", '\n\n"\\"']);
await test("List literal", "(1 2 3) (() ())", [
	[1, 2, 3],
	[[], []],
]);
await test("List constructor", "[] [1 2 3] [(1 2) x]", [
	[S("List")],
	[S("List"), 1, 2, 3],
	[S("List"), [1, 2], S("x")],
]);
await test("Map constructor", "{} {:x 4} {[1 2] 3}", [
	[S("Map")],
	[S("Map"), K("x"), 4],
	[S("Map"), [S("List"), 1, 2], 3],
]);
await test("Quote macro", "'a", [[S("quote"), S("a")]]);
await test("Quasi-quote macro", "`a", [[S("quasi-quote"), S("a")]]);
await test("Unquote-splice macro", ",,,a", [[S("unquote-splice"), S("a")]]);
await test("Unquote macro", ",a", [[S("unquote"), S("a")]]);
