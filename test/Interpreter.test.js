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
		assert.deepStrictEqual(actual, expected);
	});
}

await testInterp("Nil literal", "nil", "nil");
await testInterp("Empty program", "", "nil");
await testInterp("True literal", "true", "true");
await testInterp("False literal", "false", "false");
await testInterp("Num literal", "14.5", "14.5");
await testInterp("Keyword literal", ":x", ":x");
await testInterp("Str literal", '"test\n"', '"test\n"');
await testInterp("List constructor", "[1 2 3]", "(1 2 3)");
await testInterp("One plus one", "(__builtin__add 1 1)", "2");
await testInterp("Add spread list", "(__builtin__add ... [3 4])", "7");
await testInterp(
	"Add spread map",
	'(__builtin__add "x" ... { 1 2 })',
	'"x1,2"'
);
await testInterp("Basic Str conversion", '(Str nil "x" :x 3)', '"x:x3"');
await testInterp("Def variable", "(def x 4) x", "4");
await testInterp("Def chain", "(def x 42) (def y x) y", "42");
await testInterp("If no args", "(if)", "nil");
await testInterp("If true", "(if true 1 2)", "1");
await testInterp("If false", "(if false 1 2)", "2");
await testInterp("If nil", "(if nil 4)", "nil");
await testInterp("Do def chain", "(do (def x 1) (def x (Str 2 x)) x)", '"21"');
await testInterp("Let single binding 1", "(let (x 4) x)", "4");
await testInterp(
	"Let single binding 2",
	"(def x 4) (let (x [x x]) x)",
	"(4 4)"
);
await testInterp(
	"Let multi binding",
	"(let (x 1 y 2 z 3) (def s (__builtin__add x y)) (__builtin__add s z))",
	"6"
);
await testInterp(
	"Let list binding 1",
	"(let ([first second] [1 2]) (Str first second))",
	'"12"'
);
await testInterp(
	"Let list binding 2",
	"(let ([first ... rest] [1 2 3]) rest)",
	"(2 3)"
);
await testInterp("Let list binding 3", "(let ([x] {:x 4 :y 5}) x)", "(:x 4)");
await testInterp(
	"Let list binding 4",
	"(let ([[x] ... rest] [[1 2 3] 0 -1]) (rest x))",
	"-1"
);
await testInterp("Let map binding 1", "(let ({ :x x } {:x 4}) x)", "4");
await testInterp(
	"Let map binding 2",
	"(let ({ :x x :y y :z z } {:x 4 :z :z}) (Str y z))",
	'":z"'
);
await testInterp("Let map binding 3", "(let ({ 2 x } [1 2 3]) x)", "3");
await testInterp("Proc identity", "((proc (x) x) 4)", "4");
await testInterp(
	"Proc square",
	"((proc (x) (def y x) (__builtin__mul y y)) 5)",
	"25"
);
await testInterp(
	"Proc destructirng 1",
	"((proc (x y ... rest) rest) ... [:x :y 1 2 3])",
	"(1 2 3)"
);
// TODO Let custom type bindings
// await test("Def proc name", "(def p (proc (x) x)) (Str p)", '"#proc<p>"');
