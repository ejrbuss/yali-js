import { freezeOwnProperties } from "./util.js";

export class Keyword {
	static #KeywordRegistry = {};
	name;

	constructor(name) {
		this.name = name;
		// Keywords should not permit any modification
		Object.freeze(this);
	}

	static for(name) {
		const internedKeyword = Keyword.#KeywordRegistry[name];
		if (typeof internedKeyword !== "undefined") {
			return internedKeyword;
		}
		const newKeyword = new Keyword(name);
		Keyword.#KeywordRegistry[name] = newKeyword;
		return newKeyword;
	}
}

// Protect methods
freezeOwnProperties(Keyword);
freezeOwnProperties(Keyword.prototype);
