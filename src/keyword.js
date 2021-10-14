export class Keyword {
	static KeywordCache = {};

	constructor(name) {
		this.name = name;
	}

	static for(name) {
		const cache = Keyword.KeywordCache;
		let keyword = cache[name];
		if (typeof keyword !== "undefined") {
			return keyword;
		}
		keyword = new Keyword(name);
		cache[name] = keyword;
		return keyword;
	}
}
