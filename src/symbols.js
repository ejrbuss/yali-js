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
	Undef: Symbol.for("undef"),
	If: Symbol.for("if"),
	Do: Symbol.for("do"),
	Recur: Symbol.for("recur"),
	Throw: Symbol.for("throw"),
	Try: Symbol.for("try"),
	Catch: Symbol.for("catch"),
	Let: Symbol.for("let"),
	Match: Symbol.for("match"),
	Proc: Symbol.for("proc"),
	Macro: Symbol.for("macro"),
	Interface: Symbol.for("interface"),
	MacroExpand: Symbol.for("macro-expand"),
	Quote: Symbol.for("quote"),
	QuasiQuote: Symbol.for("quasi-quote"),
	Unquote: Symbol.for("unquote"),
	UnquoteSplice: Symbol.for("unquote-splice"),
	Splice: Symbol.for("..."),
	Async: Symbol.for("async"),
	Await: Symbol.for("await"),
	Type: Symbol.for("type"), // todo
};
