import assert from "assert";
import { isList, isMap } from "immutable";
import { Interpreter } from "../src/interpreter.js";
import { read } from "../src/reader.js";
import { test } from "./test.js";

export function testInterp(name: string, source: string, expected: string) {
	test(name, async () => {
		let interpreter = new Interpreter({});
		let forms = read(source, name);
		let actual: unknown;
		for (let form of forms) {
			actual = interpreter.interp(form);
		}
		if (isList(actual) || isMap(actual)) {
			actual = actual.toJS();
		}
		let readExpected = read(expected).first();
		if (isList(readExpected) || isMap(readExpected)) {
			readExpected = readExpected.toJS();
		}
		assert.deepStrictEqual(actual, readExpected);
	});
}

// testInterp("Empty program", "", "nil");
// testInterp("Nil literal", "nil", "nil");
// testInterp("True literal", "true", "true");
// testInterp("False literal", "false", "false");
// testInterp("Num literal", "14.5", "14.5");
// testInterp("Keyword literal", ":x", ":x");
// testInterp("Str literal", '"test\n"', '"test\n"');
// testInterp("List constructor", "[1 2 3]", "(1 2 3)");
// testInterp("One plus one", "(__builtin__add 1 1)", "2");
// testInterp("Add spread list", "(__builtin__add ... [3 4])", "7");
// testInterp("Add spread map", '(__builtin__add "x" ... { 1 2 })', '"x1,2"');
// testInterp("Basic Str conversion", '(Str nil "x" :x 3)', '"x:x3"');
// testInterp("Def variable", "(def x 4) x", "4");
// testInterp("Def chain", "(def x 42) (def y x) y", "42");
// testInterp("If no args", "(if)", "nil");
// testInterp("If true", "(if true 1 2)", "1");
// testInterp("If false", "(if false 1 2)", "2");
// testInterp("If nil", "(if nil 4)", "nil");
// testInterp("Do def chain", "(do (def x 1) (def x (Str 2 x)) x)", '"21"');
// testInterp("Let single binding 1", "(let (x 4) x)", "4");
// testInterp("Let single binding 2", "(def x 4) (let (x [x x]) x)", "(4 4)");
// testInterp(
// 	"Let multi binding",
// 	"(let (x 1 y 2 z 3) (def s (__builtin__add x y)) (__builtin__add s z))",
// 	"6"
// );
// testInterp(
// 	"Let list binding 1",
// 	"(let ([first second] [1 2]) (Str first second))",
// 	'"12"'
// );
// testInterp(
// 	"Let list binding 2",
// 	"(let ([first ... rest] [1 2 3]) rest)",
// 	"(2 3)"
// );
// testInterp("Let list binding 3", "(let ([x] {:x 4 :y 5}) x)", "(:x 4)");
// testInterp(
// 	"Let list binding 4",
// 	"(let ([[x] ... rest] [[1 2 3] 0 -1]) (rest x))",
// 	"-1"
// );
// testInterp("Let map binding 1", "(let ({ :x x } {:x 4}) x)", "4");
// testInterp(
// 	"Let map binding 2",
// 	"(let ({ :x x :y y :z z } {:x 4 :z :z}) (Str y z))",
// 	'":z"'
// );
// testInterp("Let map binding 3", "(let ({ 2 x } [1 2 3]) x)", "3");
// testInterp("Proc identity", "((proc (x) x) 4)", "4");
// testInterp(
// 	"Proc square",
// 	"((proc (x) (def y x) (__builtin__mul y y)) 5)",
// 	"25"
// );
// testInterp(
// 	"Proc destructirng 1",
// 	"((proc (x y ... rest) rest) ... [:x :y 1 2 3])",
// 	"(1 2 3)"
// );
// testInterp(
// 	"Recur to zeor",
// 	"((proc (n) (if (__builtin__equals 0 n) 0 (recur (__builtin__sub n 1)))) 10)",
// 	"0"
// );
// testInterp(
// 	"Recur multiple arguments",
// 	"((proc (l r) (if (__builtin__equals 0 l) r (recur (__builtin__sub l 1) (__builtin__add r 1)))) 100 50)",
// 	"150"
// );
// testInterp(
// 	"Macro does not evaluate args",
// 	"(def x 4) ((macro () 'x) y z ... rest)",
// 	"4"
// );
// testInterp(
// 	"Macro binds source code",
// 	"((macro (x ... rest) ['List ... rest]) z 1 2 3)",
// 	"(1 2 3)"
// );
// testInterp(
// 	"Macro-expand macro test",
// 	"(macro-expand ((macro () 'x) x y z ... rest))",
// 	"x"
// );
// testInterp("Quasi-quote with unqote", "(def x 4) `(x y ,x)", "(x y 4)");
// testInterp(
// 	"quasi-quote with unquote-splice",
// 	"(def x [1 2 3]) `(x y ,,, x)",
// 	"(x y 1 2 3)"
// );
// testInterp(
// 	"Quasi-quote nested",
// 	"(def x [1 2 3]) (def y 'y') `(x y [1 2] ,,, x (,y))",
// 	"(x y (List 1 2) 1 2 3 (y'))"
// );
// testInterp("Eval can define", "(__builtin__evalForms '((def x 4) x))", "4");
// testInterp(
// 	"Eval does not infect current environment",
// 	"(def x 1) (__builtin__evalForms '((def x 4))) x",
// 	"1"
// );
// testInterp(
// 	"Import prefixes names",
// 	'(__builtin__importForms \'((def x 4)) "imported-") imported-x',
// 	"4"
// );
// testInterp(
// 	"Import does not use local names",
// 	"(def x 4) (let (x 2) (__builtin__importForms '((def x x))) x)",
// 	"4"
// );
// TODO test Let custom type bindings
// TODO test Throw (need to be able to create an error)
// test("Def proc name", "(def p (proc (x) x)) (Str p)", '"#proc<p>"');
