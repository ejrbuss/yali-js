export const Special = {
	// unique symbols
	name: Symbol("#__name"),
	yaliConstructor: Symbol("#__yali-constructor"),
	jsConstructor: Symbol("#__js-constructor"),
	sourceRef: Symbol("#__source-ref"),
	macro: Symbol("#__macro"),
	proc: Symbol("#__proc"),
	stack: Symbol("#__stack"),
	params: Symbol("#__params"),
	body: Symbol("#__body"),
	builtin: Symbol("#__builtin"),
	help: Symbol("#__help"),
	protcol: Symbol("#__protocol"),
	// common symbols
	this: Symbol.for("this"),
};

export const ConstructorSymbols = {
	List: Symbol.for("List"),
	Map: Symbol.for("Map"),
};

export const SpecialForms = {
	Def: Symbol.for("def"),
	DefProc: Symbol.for("def-proc"),
	DefMacro: Symbol.for("def-macro"),
	DefType: Symbol.for("def-type"),
	DefInterface: Symbol.for("def-interface"),
	DefImpl: Symbol.for("def-impl"),
	If: Symbol.for("if"),
	Do: Symbol.for("do"),
	Recur: Symbol.for("recur"),
	Throw: Symbol.for("throw"),
	Try: Symbol.for("try"),
	Catch: Symbol.for("catch"),
	Async: Symbol.for("async"),
	Await: Symbol.for("await"),
	Let: Symbol.for("let"),
	Match: Symbol.for("match"),
	Proc: Symbol.for("proc"),
	MacroExpand: Symbol.for("macro-expand"),
	Quote: Symbol.for("quote"),
	QuasiQuote: Symbol.for("quasi-quote"),
	Unquote: Symbol.for("unquote"),
	UnquoteSplice: Symbol.for("unquote-splice"),
	Splice: Symbol.for("..."),
	Dot: Symbol.for("."),
	Set: Symbol.for("set!"),
};
