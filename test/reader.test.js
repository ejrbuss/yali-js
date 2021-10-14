import assert from "assert";
import { Keyword } from "../src/keyword.js";
import { read } from "../src/reader.js";
import { test } from "./test.js";

function testRead(name, source, expected) {
	test(name, () => {
		let forms = read(source, name);
		let actual = forms.toJS();
		assert.deepStrictEqual(actual, expected);
	});
}

const S = Symbol.for;
const K = Keyword.for;
testRead("Nil literal", "nil", [undefined]);
testRead("Bool literal", "true false", [true, false]);
testRead("Integer literal", "1234 +1 -77777", [1234, +1, -77777]);
testRead("Float literal", "1.34 .7", [1.34, 0.7]);
testRead("Exponent literal", "1e4 +2.5e6 6e-14", [1e4, +2.5e6, 6e-14]);
testRead("Sym literal", "a +inc? -12c", [S("a"), S("+inc?"), S("-12c")]);
testRead("Keyword literal", ":x :12-4", [K("x"), K("12-4")]);
testRead("Str literal", '"string" "\n\\n\\"\\\\\\""', ["string", '\n\n"\\"']);
// testRead("List literal", "(1 2 3) (() ())", [
// 	[1, 2, 3],
// 	[[], []],
// ]);
// testRead("List constructor", "[] [1 2 3] [(1 2) x]", [
// 	[S("List")],
// 	[S("List"), 1, 2, 3],
// 	[S("List"), [1, 2], S("x")],
// ]);
// testRead("Map constructor", "{} {:x 4} {[1 2] 3}", [
// 	[S("Map")],
// 	[S("Map"), K("x"), 4],
// 	[S("Map"), [S("List"), 1, 2], 3],
// ]);
// testRead("Quote macro", "'a", [[S("quote"), S("a")]]);
// testRead("Quasi-quote macro", "`a", [[S("quasi-quote"), S("a")]]);
// testRead("Unquote-splice macro", ",,,a", [[S("unquote-splice"), S("a")]]);
// testRead("Unquote macro", ",a", [[S("unquote"), S("a")]]);
