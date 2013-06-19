/*
 * jhaml.js
 * Joe's HTML abstraction markup language
 * A domain specific language for HTML templating by Joe Langeway.
 *
 */

if (typeof define !== 'function') { var define = require('amdefine')(module) }

define(['underscore'], function(_) {

	function Jhaml(opt) {
		_.extend(this,
		{
			templates: {}, //externally callable templates, everything named you complied plus all the defs there in get a function with that name here
			_itos: {}, //internal template op codes, every jhaml template is also represented abstractly in this hash so they can be composed effeciently
		}, opt);
	}
	Jhaml.prototype = {
		_log: function() {
			var window;
			if(window && window.console && window.console.log && window.console.log.apply)
				return window.console.log.apply(window.console, arguments);
		},
		_echars: {'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;'},
		escape: function (txt) {
			var echars = this._echars;
			return txt.replace(/[<>&"]/g, function(m) { return echars[m]; });
		},
		_opcodes: {
			LITERAL: 0, 	//output some literal text
			PARAMBODY: 1, 	//buffer output of program in op to pass as argument
			PARAMREF: 2, 	//pass structured object as argument
			HTMLREF: 3,		//output value of argument
			TEXTREF: 4,		//output html escaped value of argument
			EXTCALL: 5,		//call a function from the templates collection
			INTCALL: 6,		//call a program from the _itos collection
			BODY: 7,		//run a program stored in op
			FOR: 8			//execute subtemplate for each element of collection
		},
		lookup: function(params, name) {
			//this function can be overridden if more sophisticated model objects are used that cannot be indexed like objects
			return params[name];
		},
		_resolveLookUp: function(params, path, error) {
			var val = params;
			_.each(path, function(p) {
				val = val[p];
				if(val === undefined)
					error('parameter ' + p + ' in ' + path.join('.') + ' is undefined');
			});
			return val;
		},
		execute: function(op, params, htmla0) {
			var htmla = htmla0 || [];
			var self = this;
			function error(msg) {
				throw new Error(msg + ' at ' + op.filename + ':' + op.line + ':' + op.cPos)
			}
			var opcodes = this._opcodes;

			function evalargs() {
				var args = _.extend({}, params);
				if(op.splat) {
					_.extend(args, self.execute(op.splat, params))
				}
				_.each(op.args, function(val, name) {
					args[name] = self.execute(val, params);
				});
				return args;	
			}
			switch(op.opcode)
			{
				case opcodes.LITERAL: //text that is independent of the params
					htmla.push( op.text );
					break;
				
				case opcodes.PARAMBODY: 
					return this.execute(op.body, params);

				case opcodes.PARAMREF: //extract an arbitrary param object, used in argument lists when calling external templates
					return this._resolveLookUp(params, op.path, error);
					
				case opcodes.HTMLREF: //insert text or html from a param
				case opcodes.TEXTREF:
					var val = this._resolveLookUp(params, op.path, error);
					if(op.opcode === opcodes.TEXTREF) {
						val = this.escape(val);
					}
					htmla.push( val );
					break;
				
				case opcodes.EXTCALL:
					var args = evalargs();
					var f = this.templates[op.tname]
					if(f === undefined)
						error('external template ' + op.fname + ' is undefined');
					htmla.push( f.call(this, args) );
					break;

				case opcodes.INTCALL:
					var args = evalargs();
					var _t = this._itos[op.tname]
					if(_t === undefined)
						error('internal template ' + op.fname + ' is undefined');
					this.execute(_t, args, htmla);
					break;
				
				case opcodes.BODY:
					_.each(op.body, function(tel) {
						self.execute(tel, params, htmla);
					});
					break;
				case opcodes.FOR:
					var collection = this._resolveLookUp(params, op.path, error)
						, opbody = op.body
						, valueVarName = op.valueVarname
						, keyVarName = op.keyVarName
						;
					function perItem(val, key) {
						var pbase = {};
						pbase[valueVarName] = val;
						keyVarName && (pbase[keyVarName] = key);
						self.execute(op.body, _.extend({}, params, pbase), htmla);						
					}
					if(_.isArray(collection)) {
						_.each(collection, perItem);
					} else if(_.isObject(collection)) {
						var keys = _.keys(collection);
						keys.sort();
						_.each(keys, function(key) { perItem(collection[key], key); });
					} else {
						error('for..in may only be applied to arrays or objects: ' + op.path.join('.'));
					}
					break;

				default:
					error('Unrecognized kind of thing in template');
			}
			if(htmla0 === undefined)
				return htmla.join('');
		},
		_addInternalTemplate: function(tname, body) {
			var obody = this._itos[tname] = this.optimize(body);
			var self = this;
			this.templates[tname] = function(args) {
				return self.execute(obody, args);
			};
		},
		compile: function(txt0, filename) {
			//a recursive descent parser for syntax driven compilation, affect is to call _addInternalTemplate for each template def
			var txt1 = txt0,
				line = 1,
				self = this;

			var opcodes = this._opcodes;

		    function eatChars(n) {
	    		line += (txt1.substring(0, n).match(/\n/g) || []).length;
	    		txt1 = txt1.substring(n);
		    }
			function eatWhitespace() {
		    	var wm = txt1.match(/^\s+/);
		    	if(wm)
		    		eatChars(wm[0].length);
		    }
		    function emit(op) {
		    	op.filename = filename;
		    	op.line = line;
		    	op.cPos = txt0.length - txt1.length;
		    	return op;
		    }
		    function error(msg0) {
		    	var cPos = txt0.length - txt1.length;
		    	var msg1 = 'jhaml.js: ' + msg0 + ' filename: ' + filename + ', line: ' + line + ', cPos: ' + cPos;
		    	self._log(msg1);
		    	throw new Error(msg1);
		    }

		    //begin parser functions, each roughly corresponds to a rule in a BNF grammer, though we cheat a bit on repititions
		    function parseCommentRun() {
		    	var m;
		    	if(m = txt1.match(/^(?:[^*\/]+|\*[^\/]|\/[^*])/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseCommentEnd() {
		    	var m;
		    	if(m = txt1.match(/^\*\//)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}

		    }
		    function parseComment() {
		    	var m;
		    	if(m = txt1.match(/^\s*\/\*/)) {
		    		eatChars(m[0].length);
		    		while(!parseCommentEnd()) {
		    			parseComment() || //comments may nest
		    			parseCommentRun() ||
		    			error('Syntax error in comment?');
		    		}
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }

		    function parseReference() {
		    	function parseRef(m) {
		    		eatChars(m[0].length);
		    		return emit( { 
		    				opcode: m[1] === '~' ? opcodes.TEXTREF : opcodes.HTMLREF,
		    				path: _.map(m[2].split('.'), function(p) { return p.replace(/^\s+|\s+$/g, ''); })
		    			} );
		    	}
		    	var m;
		    	if(m = txt1.match(/^\s*@\s*(~?)\s*([a-z]\w*(?:\s*\.\s*[a-z]\w*)*)/i)) {
		    		return parseRef(m);
		    	} else if(m = txt1.match(/^\s*@\s*(~?)\s*\(\s*([a-z]\w*(?:\s*\.\s*[a-z]\w*)*)\s*\)/i)) {
		    		return parseRef(m);
		    	} else {
		    		return false;
		    	}
		    }
		    function parseCallEnd() {
		    	var m;
		    	if(m = txt1.match(/^\s*\)\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseCallArgName() {
		    	var m;
		    	if(m = txt1.match(/^\s*(\w+)\s*:\s*/)) {
		    		var argName = m[1];
		    		eatChars(m[0].length);
		    		return argName;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseCallArgSeparator() {
		    	var m;
		    	if(m = txt1.match(/^\s*,\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseCallArgValue() {
		    	var op1,
		    		op0 = parseReference() || 
		    			parseQuote() || 
		    			parseLiteral() || 
		    			parseBody() || 
		    			error('Expected call argument value');
		    	if(op0.opcode === opcodes.HTMLREF) {
		    		op0.opcode = opcodes.PARAMREF;
		    		op1 = op0;
		    	} else {
	    			op1 = emit( { opcode: opcodes.PARAMBODY, body: op0 } )
		    	}
		    	return op1;
		    }
		    function parseCall() {
		    	var m;
		    	if(m = txt1.match(/^\s*(\w+)\s*\(/)) {
	    			var tname = m[1], 
	    				args = {},
	    				op = emit( { 
	    						opcode: self._itos[tname] ? opcodes.INTCALL : opcodes.EXTCALL,
    							tname: tname, args: args
    					 	});
		    		eatChars(m[0].length);
		    		while(parseComment())
		    			eatWhitespace();
		    		var splat = parseReference();
		    		if(splat) {
		    			if(splat.opcode !== opcodes.HTMLREF) {
		    				error('Splat argument must be an undecorated reference.')
		    			}
		    			splat.opcode = opcodes.PARAMREF;
		    			op.splat = splat;
		    			parseCallArgSeparator();
		    		}
		    		if(parseCallEnd()) {
		    			return op;
		    		}
	    			do {
			    		while(parseComment())
			    			eatWhitespace();
	    				var argName = parseCallArgName() || error('Expected argument name');
	    				var argValue = parseCallArgValue() || error('Expected argument value');
	    				args[argName] = argValue;
			    		while(parseComment())
			    			eatWhitespace();
	    			} while( parseCallArgSeparator() );
	    			parseCallEnd() || error('Expected ")"');
	    			return op;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseQuote() {
		    	var m;
		    	if(m = txt1.match(/^\s*"([^"]*)"\s*/)) {
		    		eatChars(m[0].length);
		    		return emit( { opcode: opcodes.LITERAL, text: m[1] } );
		    	} else {
		    		return false;
		    	}
		    }
		    function parseIdentifier() {
		    	var m;
		    	if(m = txt1.match(/^\s*([a-z][-\w]*)\s*/i)) {
		    		eatChars(m[0].length);
		    		return emit( { opcode: opcodes.LITERAL, text: m[1] } );
		    	} else {
		    		return false;
		    	}
		    }
		    function parseTagId(tag) {
		    	var m, id;
		    	if(tag.id) {
	    			return false;
		    	} else if(m = txt1.match(/^\s*#\s*/)) {
		    		eatChars(m[0].length);
	    			tag.id = parseIdentifier() || parseReference() || error('Expected ID');
	    			return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseTagClass(tag) {
		    	var m, className;
		    	if(m = txt1.match(/^\s*\.\s*/)) {
		    		eatChars(m[0].length);
	    			className = parseIdentifier() || parseReference() || error('Expected Class Name');
		    		tag.classNames.push( className );
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseTagAttr(tag) {
		    	var m, attrName;
		    	if(m = txt1.match(/^\s*\[\s*([-\w]+)\s*=\s*/)) {
		    		eatChars(m[0].length);
		    		attrName = m[1];
		    		attrValue = parseQuote() || parseReference() || error('Expected Attribute Value');
		    		tag.attr[attrName] = attrValue;
		    		if(m = txt1.match(/^\s*\]\s*/)) {
		    			eatChars(m[0].length);
		    			return true;
		    		} else {
		    			error('Expected "]"');
		    		}
		    	} else {
		    		return false;
		    	}
		    }
		    function parseTag() {
		    	var m;
		    	if(m = txt1.match(/^\s*([a-z]\w*)\s*/i)) {
	    			var a = [], 
	    				op = emit( { opcode: opcodes.BODY, body: a } );
	    			var tagName = m[1];
		    		var tag = { id: false, classNames: [], attr: {} };
	    			eatChars(m[0].length);

	    			while(parseTagId(tag) || parseTagClass(tag) || parseTagAttr(tag))
	    				; //
	    			a.push( emit( { opcode: opcodes.LITERAL, text: '<' + tagName } ) );
	    			if(tag.id) {
    					a.push( emit( { opcode: opcodes.LITERAL, text: ' id="' } ) );
    					a.push( tag.id );
    					a.push( emit( { opcode: opcodes.LITERAL, text: '"' } ) );
	    			}
	    			if(tag.classNames.length) {
	    				a.push( emit( { opcode: opcodes.LITERAL, text: ' class="' } ) );
	    				var iff = false;
	    				_.each(tag.classNames, function(className) {
	    					if(iff) {
	    						a.push( emit( { opcode: opcodes.LITERAL, text: ' ' } ) );
	    					}
	    					iff = true;
	    					a.push(className);
	    				})
	    				a.push( emit( { opcode: opcodes.LITERAL, text: '"' } ) );
	    			}
	    			_.each(tag.attr, function(attrValue, attrName) {
						a.push( emit( { opcode: opcodes.LITERAL, text: ' ' + attrName + '="' } ) );
						a.push( attrValue );
						a.push( emit( { opcode: opcodes.LITERAL, text: '"' } ) );
	    			});
	    			var body = parseBody();
	    			if(body) {
	    				a.push( emit( { opcode: opcodes.LITERAL, text: '>' } ) );
	    				a.push( body );
	    				a.push( emit( { opcode: opcodes.LITERAL, text: '</' + tagName + '>' } ) );
	    			} else {
	    				a.push( emit( { opcode: opcodes.LITERAL, text: '></' + tagName + '>' } ) );
	    			}
	    			return op;
		    	} else {
		    		return false;
		    	}

		    }
		    function parseLiteralRun() {
		    	var m;
		    	if(m = txt1.match(/^[^\\~@]+/)) {
		    		var op = emit( { opcode: opcodes.LITERAL, text: m[0] } );
		    		eatChars(m[0].length);
		    		return op;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseLiteralEscape() {
		    	var m;
		    	if(m = txt1.match(/^\\(.)/)) {
		    		var op = emit( { opcode: opcodes.LITERAL, text: m[1] } );
		    		eatChars(m[0].length);
		    		return op;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseLiteralEnd() {
		    	var m;
		    	if(m = txt1.match(/^~\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseLiteral() {
		    	var m;
		    	if(m = txt1.match(/^\s*~/)) {
	    			var a = [], 
	    				op = emit( { opcode: opcodes.BODY, body: a } );
					eatChars(m[0].length);
					while( !parseLiteralEnd() ) {
						var lop = parseLiteralRun() ||
								parseLiteralEscape() ||
								parseReference() ||
								error('Syntax error in literal');
						a.push(lop);
					}
		    		return op;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseForIn() {
		    	var m;
		    	if(m = txt1.match(/^\s*in\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseVariableNameSeparator() {
		    	var m;
		    	if(m = txt1.match(/^\s*,\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseVariableName() {
		    	var m;
		    	if(m = txt1.match(/^\s*([a-z][-\w]*)/i)) {
		    		eatChars(m[0].length);
		    		return m[1];
		    	} else {
		    		return false;
		    	}
		    }
		    function parseFor() {
		    	var m;
		    	if(m = txt1.match(/^\s*for\s+/i)) {
		    		var op = emit( { opcode: opcodes.FOR, body: null, valueVarname: null, keyVarName: null, path: null } );
		    		eatChars(m[0].length);
		    		if(!(op.valueVarname = parseVariableName())) {
		    			error('Expected iterator value variable name');
		    		}
		    		if(parseVariableNameSeparator()) {
			    		if(!(op.keyVarName = parseVariableName())) {
			    			error('Expected iterator key variable name');
			    		}	    			
		    		}
		    		if(!parseForIn()) {
		    			error('Expected "in" after "for .."');
		    		}
		    		var ref = parseReference();
		    		if(!ref) {
		    			error('Expected reference to collection after "for .. in"');
		    		}
		    		if(ref.op == opcodes.TEXTREF) {
		    			error('Only text can be html escaped');
		    		}
		    		op.path = ref.path;
		    		if(!(op.body = parseBody())) {
						error('Expected body, "{", after "for .. in"');
		    		}

		    		return op;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseBodyClose() {
		    	var m;
		    	if(m = txt1.match(/^\s*\}\s*/)) {
		    		eatChars(m[0].length);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }
		    function parseBody() {
		    	var m;
		    	if(m = txt1.match(/^\s*\{\s*/)) {
			    	var body = [],
			    		op = emit( { opcode: opcodes.BODY, body: body  } );
	    			eatChars(m[0].length);
	    			while( !parseBodyClose() ) {
    					var subOp = parseCall() || 
    						parseFor() ||
    						parseTag() || 
    						parseLiteral() || 
    						parseReference() ||
    						parseComment() ||
    						error('Syntax error in body(line:' + op.line + ',cPos:' + op.cPos + ')');
    					if(subOp !== true) {
    						body.push(subOp);
    					}
	    			}
	    			return op;
		    	} else {
		    		return false;
		    	}

		    }

		    function parseDef() {
		    	var m;
		    	if(m = txt1.match(/^\s*def\s+(\w+)\s*\{/i)) {
		    		var tName = m[1];
		    		eatChars(m[0].length - 1);
		    		var body = parseBody();
		    		if(false === body) {
		    			error('Expected template body');
		    		}
		    		self._addInternalTemplate(tName, body);
		    		return true;
		    	} else {
		    		return false;
		    	}
		    }

		    //outer most loop of compiler
		    eatWhitespace();
		    while(parseDef() || parseComment())
		    	eatWhitespace();
		    eatWhitespace();
		    if(txt1.length) {
		    	error('Syntax error, Expected DEF')
		    }
		},
		optimize: function(ops) {
			//compresses the opcode object ops in place by inlining bodies and joining consecutive literals
			if(ops.opcode === this._opcodes.PARAMBODY || ops.opcode === this._opcodes.BODY) {
				for(var i = ops.body.length - 1; i >= 0; i--) {
					if(ops.body[i].opcode === this._opcodes.BODY) {
						var b2 = ops.body[i].body;
						ops.body.splice.apply(ops.body, [i, 1].concat(b2));
						i += b2.length;
					} else if(i > 0 && ops.body[i].opcode === this._opcodes.LITERAL && ops.body[i - 1].opcode === this._opcodes.LITERAL) {
						ops.body[i - 1].text += ops.body[i].text;
						ops.body.splice(i, 1);
					}
				}
			}
			return ops;
		}
	}

	return Jhaml;
});
