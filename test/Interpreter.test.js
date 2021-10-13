import assert from "assert";
import { isList, isMap } from "immutable";
import { createDefaultEnv } from "../src/DefaultEnv.js";
import { Interpreter } from "../src/Interpreter.js";
import { read } from "../src/Reader.js";
import { test } from "./Test.js";

async function testInterp(name, source, expected) {
	await test(name, async () => {
		let interpreter = new Interpreter(createDefaultEnv());
		let forms = read(source, name);
		let actual;
		for (let form of forms) {
			actual = await interpreter.interp(form);
		}
		if (isList(actual) || isMap(actual)) {
			actual = actual.toJS();
		}
		expected = read(expected).first();
		if (isList(expected) || isMap(expected)) {
			expected = expected.toJS();
		}
		assert.deepEqual(actual, expected);
	});
}

testInterp("Empty program", "", "nil");
testInterp("Nil literal", "nil", "nil");
testInterp("True literal", "true", "true");
testInterp("False literal", "false", "false");
testInterp("Num literal", "14.5", "14.5");
testInterp("Keyword literal", ":x", ":x");
testInterp("Str literal", '"test\n"', '"test\n"');
testInterp("List constructor", "[1 2 3]", "(1 2 3)");
testInterp("One plus one", "(__builtin__add 1 1)", "2");
testInterp("Add spread list", "(__builtin__add ... [3 4])", "7");
testInterp("Add spread map", '(__builtin__add "x" ... { 1 2 })', '"x1,2"');
testInterp("Basic Str conversion", '(Str nil "x" :x 3)', '"x:x3"');
testInterp("Def variable", "(def x 4) x", "4");
testInterp("Def chain", "(def x 42) (def y x) y", "42");
testInterp("If no args", "(if)", "nil");
testInterp("If true", "(if true 1 2)", "1");
testInterp("If false", "(if false 1 2)", "2");
testInterp("If nil", "(if nil 4)", "nil");
// await test("Def proc name", "(def p (proc (x) x)) (Str p)", '"#proc<p>"');
