'use strict';

var txtwiki = require('../txtwiki.js');

(function(){
	test('Link parsing', function(){
		function parse(then, expected){
			equal(txtwiki.parseWikitext(then), expected);
		}
		parse("[[link]]", "link");
	})
}());
