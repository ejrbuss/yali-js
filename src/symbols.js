export const Special = {
	name: Symbol("#yali-name"),
	jsConstructor: Symbol("#yali-js-constructor"),
	sourceRef: Symbol("#yali-source-ref"),
	macro: Symbol("#yali-macro"),
	proc: Symbol("#yali-proc"),
	stack: Symbol("#yali-stack"),
	params: Symbol("#yali-params"),
	body: Symbol("#yali-body"),
};

export const ConstructorSymbols = {
	List: Symbol.for("List"),
	Map: Symbol.for("Map"),
};

export const SpecialForms = {
	Def: Symbol.for("def"),
	If: Symbol.for("if"),
	Do: Symbol.for("do"),
	Recur: Symbol.for("recur"),
	Throw: Symbol.for("throw"),
	Try: Symbol.for("try"),
	Catch: Symbol.for("catch"),
	Let: Symbol.for("let"),
	Proc: Symbol.for("proc"),
	Macro: Symbol.for("macro"),
	MultiProc: Symbol.for("multi-proc"),
	MacroExpand: Symbol.for("macro-expand"),
	Quote: Symbol.for("quote"),
	QuasiQuote: Symbol.for("quasi-quote"),
	Unquote: Symbol.for("unquote"),
	UnquoteSplice: Symbol.for("unquote-splice"),
	Splice: Symbol.for("..."),
	Async: Symbol.for("async"),
	Await: Symbol.for("await"),
};
