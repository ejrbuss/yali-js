// This serves primarily as documentation
// Usage tends to be direct ie obj.prop
export const SpecialProperties = {
	// Type related
	type: "type", // the constructor of this object
	typeName: "typeName", // the type name of this object
	procName: "procName", // the name of this proc
	macro: "macro", // if this proc is a macro
	// Conversion related
	toBool: "toBool", // convert an object to a Bool
	toNum: "toNum", // convert an object to a Num
	toStr: "toStr", // convert an object to a Str
	// Value related
	equals: "equals", // comparison method
	hashCode: "hashCode", // hashing method
	// Collection related
	first: "first",
	rest: "rest",
};

export const Constructors = {
	Nil: Symbol.for("Nil"),
	Bool: Symbol.for("Bool"),
	Num: Symbol.for("Num"),
	Str: Symbol.for("Str"),
	Sym: Symbol.for("Sym"),
	Keyword: Symbol.for("Keyword"),
	Proc: Symbol.for("Proc"),
	List: Symbol.for("List"),
	Map: Symbol.for("Map"),
	Error: Symbol.for("Error"),
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
	MacroExpand: Symbol.for("macro-expand"),
	Quote: Symbol.for("quote"),
	QuasiQuote: Symbol.for("quasi-quote"),
	Unquote: Symbol.for("unquote"),
	UnquoteSplice: Symbol.for("unquote-splice"),
	Splice: Symbol.for("..."),
	Eval: Symbol.for("eval"),
	Import: Symbol.for("import"),
};
