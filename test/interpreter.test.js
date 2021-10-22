import assert from "assert";
import { isList, isMap } from "immutable";
import { addBuiltins } from "../src/builtins.js";
import { Interpreter } from "../src/interpreter.js";
import { read } from "../src/reader.js";
import { test } from "./test.js";

export function testInterp(name, source, expected) {
	test(name, () => {
		let interpreter = new Interpreter();
		addBuiltins(interpreter.globalEnv);
		let forms = read(source, name);
		let actual;
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

testInterp("Empty program", "", "nil");
testInterp("Nil literal", "nil", "nil");
testInterp("True literal", "true", "true");
testInterp("False literal", "false", "false");
testInterp("Num literal", "14.5", "14.5");
testInterp("Keyword literal", ":x", ":x");
testInterp("Str literal", '"test\n"', '"test\n"');
testInterp("List constructor", "[1 2 3]", "(1 2 3)");
testInterp("One plus one", "(js.+ 1 1)", "2");
testInterp("Add spread list", "(js.+ ... [3 4])", "7");
testInterp("Add spread map", '(js.+ "x" ... { 1 2 })', '"x1,2"');
testInterp("Basic Str conversion", '(Str nil "x" :x 3)', '"nilx:x3"');
testInterp("Def variable", "(def x 4) x", "4");
testInterp("Def chain", "(def x 42) (def y x) y", "42");
testInterp("If true", "(if true 1 2)", "1");
testInterp("If false", "(if false 1 2)", "2");
testInterp("Do def chain", "(do (def x 1) (def x (Str 2 x)) x)", '"21"');
testInterp("Let single binding 1", "(let (x 4) x)", "4");
testInterp("Let single binding 2", "(def x 4) (let (y [x x]) y)", "(4 4)");
testInterp("Let shadow binding", "(def x 4) (let (x 2) x)", "2");
testInterp(
	"Let multi binding",
	"(let (x 1 y 2 z 3) (def s (js.+ x y)) (js.+ s z))",
	"6"
);
testInterp(
	"Let list binding 1",
	"(let ([first second] [1 2]) (Str first second))",
	'"12"'
);
testInterp(
	"Let list binding 2",
	"(let ([first ... rest] [1 2 3]) rest)",
	"(2 3)"
);
testInterp("Let list binding 3", "(let ([x] {:x 4 :y 5}) x)", "(:x 4)");
testInterp(
	"Let list binding 4",
	"(let ([[x] ... rest] [[1 2 3] 0 -1]) (js.+ rest x))",
	'"List [ 0, -1 ]1"'
);
testInterp("Let map binding 1", "(let ({ :x x } {:x 4}) x)", "4");
testInterp(
	"Let map binding 2",
	"(let ({ :x x :y y :z z } {:x 4 :z :z}) (Str y z))",
	'"nil:z"'
);
testInterp("Proc identity", "((proc (x) x) 4)", "4");
testInterp("Proc square", "((proc (x) (def y x) (js.* y y)) 5)", "25");
testInterp(
	"Proc destructirng 1",
	"((proc (x y ... rest) rest) ... [:x :y 1 2 3])",
	"(1 2 3)"
);
testInterp(
	"Recur basic",
	"(def f (proc (x n) (if x (recur (f false (js.+ n 1))) n))) (f true 3)",
	"4"
);
testInterp(
	"Macro does not evaluate args",
	"(def x 4) (def-macro (m) 'x) (m y z ...rest)",
	"4"
);
testInterp(
	"Macro binds source code",
	"(def-macro (m x ... rest) ['List ... rest]) (m z 1 2 3)",
	"(1 2 3)"
);
testInterp(
	"Macro-expand macro test",
	"(macro-expand ((proc () 'x) x y z ... rest))",
	"x"
);
testInterp("Quasi-quote with unqote", "(def x 4) `(x y ,x)", "(x y 4)");
testInterp(
	"quasi-quote with unquote-splice",
	"(def x [1 2 3]) `(x y ,,, x)",
	"(x y 1 2 3)"
);
testInterp(
	"Quasi-quote nested",
	"(def x [1 2 3]) (def y 'y') `(x y [1 2] ,,, x (,y))",
	"(x y (List 1 2) 1 2 3 (y'))"
);
testInterp(
	"Eval does not write to current env by default",
	"(def x 2) (eval '(def x 4)) x",
	"2"
);
testInterp(
	"Eval does not read from local env by default",
	"(let () (def x 4) (try (eval 'x) 2))",
	"2"
);
testInterp("Eval can define", "(def e (__env)) (eval '(def x 4) e) x", "4");
testInterp(
	"Custom let binding",
	"(def-type (Point x y)) (def p (Point 1 2)) (let ((Point a b) p) (js.- a b))",
	"-1"
);
testInterp(
	"Custom match binding",
	"(def-type (Point x y)) (def p (Point 8 2)) (match p (Point a b) (js./ a b))",
	"4"
);
testInterp("Test throw", "(try (throw (error)) 4)", "4");
testInterp(
	"Test throw with catch",
	'(try (throw (error "test")) (catch error error.message))',
	'"test"'
);
testInterp("Def proc name", "(def-proc (p x) x) (js.get p __name)", '"p"');
testInterp(
	"Recur to zero",
	"(def-proc (p n) (if (binary= 0 n) 0 (recur (p (js.- n 1))))) (p 10)",
	"0"
);
testInterp(
	"Recur multiple arguments",
	"(def-proc (p l n) (if (binary= 0 l) n (recur (p (js.- l 1) (js.+ n 1))))) (p 100 50)",
	"150"
);
