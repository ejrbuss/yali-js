import { hash } from "immutable";
import * as Builtins from "./Builtins.js";

export class Keyword {
	/** @type {symbol} */ static #secret = Symbol("Keyword.#secret");
	/** @type {{ [name: string]: Keyword }} */ static #keywordCache = {};
	/** @type {string} */ name;

	static for(name) {
		if (!(name in Keyword.#keywordCache)) {
			Keyword.#keywordCache[name] = new Keyword(name, Keyword.#secret);
		}
		return Keyword.#keywordCache[name];
	}

	constructor(name, secret) {
		if (secret !== Keyword.#secret) {
			throw new Error("Keyword constructor should not be called directly!");
		}
		this.name = name;
	}

	hashCode() {
		return hash(this.name);
	}

	equals(other) {
		return this === other;
	}

	toStr() {
		return `:${this.name}`;
	}
}

Keyword.prototype.type = Builtins.Keyword;
Keyword.prototype.typeName = "Keyword";
