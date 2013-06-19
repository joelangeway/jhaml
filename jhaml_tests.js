/* 
 * jhaml_tests.js
 * tests for jhaml.js
 * Joe's HTML abstraction markup language
 */

QUnit.config.autostart = false;

requirejs.config({
	shim: {
    	underscore: {
      		exports: '_'
    	}
    },
    paths: {
    	underscore: 'node_modules/underscore/underscore'
    }
});

require(['jhaml', 'underscore'], function(Jhaml, _) {
	
	var testsForSuccess = [
		{
			testname: 'Basic def and tag',
			jhaml: 'def basic { div#foo.bar.baaz[data-fred="bob"] {span { ~yeah ~ } ~ buddy~ } }',
			tname: 'basic',
			args: {},
			html: '<div id="foo" class="bar baaz" data-fred="bob"><span>yeah </span> buddy</div>'
		},
		{
			testname: 'One letter tag',
			jhaml: 'def call1 { b }',
			tname: 'call1',
			args: {},
			html: '<b></b>'
		},
		{
			testname: 'One letter id',
			jhaml: 'def call1 { span#a }',
			tname: 'call1',
			args: {},
			html: '<span id="a"></span>'
		},
		{
			testname: 'One letter class name',
			jhaml: 'def call1 { span.a }',
			tname: 'call1',
			args: {},
			html: '<span class="a"></span>'
		},
		{
			testname: 'One letter class names',
			jhaml: 'def call1 { span.a.b }',
			tname: 'call1',
			args: {},
			html: '<span class="a b"></span>'
		},
		{
			testname: 'Reference id',
			jhaml: 'def ref { div#@foo }',
			tname: 'ref',
			args: {foo: 'bar'},
			html: '<div id="bar"></div>'
		},
		{
			testname: 'Nested reference id',
			jhaml: 'def ref { div#@foo.bar }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div id="baaz"></div>'
		},
		{
			testname: 'Nested reference id with whitespace 1',
			jhaml: 'def ref { div#@foo. bar }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div id="baaz"></div>'
		},
		{
			testname: 'Nested reference id with whitespace 2',
			jhaml: 'def ref { div#@foo .bar }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div id="baaz"></div>'
		},
		{
			testname: 'Nested reference id with whitespace 3',
			jhaml: 'def ref { div#@foo \n . \n \t bar }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div id="baaz"></div>'
		},
		{
			testname: 'Nested parened reference id',
			jhaml: 'def ref { div#@(foo.bar) }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div id="baaz"></div>'
		},
		{
			testname: 'Reference classname',
			jhaml: 'def ref { div.@foo }',
			tname: 'ref',
			args: {foo: 'bar'},
			html: '<div class="bar"></div>'
		},
		{
			testname: 'Nested parened reference classname',
			jhaml: 'def ref { div.@(foo.bar).billy }',
			tname: 'ref',
			args: {foo: {bar: 'baaz'}},
			html: '<div class="baaz billy"></div>'
		},
		{
			testname: 'Reference classnames',
			jhaml: 'def ref { div.@(foo).@bar.ted }',
			tname: 'ref',
			args: {foo:'bunny', bar: { ted: 'bear' } },
			html: '<div class="bunny bear"></div>'
		},
		{
			testname: 'Reference attribute',
			jhaml: 'def ref { div [  data-foo = @ bar . baaz ] }',
			tname: 'ref',
			args: { bar: { baaz: ' 0 ' } },
			html: '<div data-foo=" 0 "></div>'
		},
		{
			testname: 'plain literal',
			jhaml: 'def call1 { div { ~ \n \t literal \t \t \n ~ } }',
			tname: 'call1',
			args: {},
			html: '<div> \n \t literal \t \t \n </div>'
		},
		{
			testname: 'literal with escapes',
			jhaml: 'def call1 { div { ~ \n \t literal \\@ \\~ \\q \t \t \n ~ } }',
			tname: 'call1',
			args: {},
			html: '<div> \n \t literal @ ~ q \t \t \n </div>'
		},
		{
			testname: 'literal with references',
			jhaml: 'def call1 { div { ~a: @a b: @b~ } }',
			tname: 'call1',
			args: {a: 'A', b: 'B' },
			html: '<div>a: A b: B</div>'
		},
		{
			testname: 'html escape references',
			jhaml: 'def call1 { ~123@~(a)123~ }',
			tname: 'call1',
			args: {a: '. < . > . & . " .abc' },
			html: '123. &lt; . &gt; . &amp; . &quot; .abc123'
		},
		{
			testname: 'references in literals do not affect whitespace',
			jhaml: 'def call1 { div { ~ @ a . @a . @(a  ) . @ ( a).@(a).~ } }',
			tname: 'call1',
			args: {a: 'A' },
			html: '<div> A . A . A . A.A.</div>'
		},
		{
			testname: 'Internal call',
			jhaml: 'def callee { div.callee } def caller { div.caller { callee() } }',
			tname: 'caller',
			args: {},
			html: '<div class="caller"><div class="callee"></div></div>'
		},
		{
			testname: 'Basic comment',
			jhaml: 'def call1 { div { ~foo~ /* comment */ ~bar~ } }',
			tname: 'call1',
			args: {},
			html: '<div>foobar</div>'
		},
		{
			testname: 'Comments do not work inside literals',
			jhaml: 'def call1 { div { ~foo /* comment */ bar~ } }',
			tname: 'call1',
			args: {},
			html: '<div>foo /* comment */ bar</div>'
		},
		{
			testname: 'Comments nest',
			jhaml: 'def call1 { div { ~foo~ /* outer /* inner */ */ ~bar~ } }',
			tname: 'call1',
			args: {},
			html: '<div>foobar</div>'
		},
		{
			testname: 'Top level comment',
			jhaml: '/* comment */ def call1 { div { ~foo~ } } /* comment */',
			tname: 'call1',
			args: {},
			html: '<div>foo</div>'
		},
		{
			testname: 'Comment inside call',
			jhaml: 'def callee { div.callee } def caller { div.caller { callee( /* comment */ ) } }',
			tname: 'caller',
			args: {},
			html: '<div class="caller"><div class="callee"></div></div>'
		},
		
		{
			testname: 'Internal call passing arg',
			jhaml: 'def callee { li { @bar } } def caller { ul { callee(bar: @foo) } }',
			tname: 'caller',
			args: {foo: 'bunny'},
			html: '<ul><li>bunny</li></ul>'
		},
		{
			testname: 'Pass literal',
			jhaml: 'def call2 { li{@a} } def call1 { ul{ call2( a: ~foo~ ) }}',
			tname: 'call1',
			args: {},
			html: '<ul><li>foo</li></ul>'
		},
		{
			testname: 'Pass body',
			jhaml: 'def call2 { span.call2{ @a @b } } def call1 { span.call1{ call2(a: {span.a}, b: ~<span class="b"></span>~ ) } }',
			tname: 'call1',
			args: {},
			html: '<span class="call1"><span class="call2"><span class="a"></span><span class="b"></span></span></span>'
		},
		{
			testname: 'Dynamic scope',
			jhaml: 'def call3 { span.a3{@a}span.b3{@b}span.c3{@c} } ' + 
					'def call2 { span.a2{@a}span.b2{@b}span.c2{@c} call3(b: @c, c: @b) } ' + 
					'def call1 { span.a1{@a}span.b1{@b}span.c1{@c} call2(c: "CC") }',
			tname: 'call1',
			args: {a:'A',b:'B',c:'C'},
			html: '<span class="a1">A</span><span class="b1">B</span><span class="c1">C</span>' + 
					'<span class="a2">A</span><span class="b2">B</span><span class="c2">CC</span>' +
					'<span class="a3">A</span><span class="b3">CC</span><span class="c3">B</span>'
		},
		{
			testname: 'splat 1',
			jhaml: 'def call2 { li{@a} li{@foo} } def call1 { ul{ call2( @bar ) }}',
			tname: 'call1',
			args: {foo: 1, bar: {a:2, b: 3}},
			html: '<ul><li>2</li><li>1</li></ul>'
		},
		{
			testname: 'splat 2',
			jhaml: 'def call2 { li{@b.c} li{@e} li{@f.h} } def call1 { ul{ call2( @b.d ) }}',
			tname: 'call1',
			args: {a: 1, b: {c:2, d: {e: 3, f: {g: 4, h: 5}}}},
			html: '<ul><li>2</li><li>3</li><li>5</li></ul>'
		},
		{
			testname: 'splat 3',
			jhaml: 'def call2 { li{@b.c} li{@e} li{@f.h} li{@g.g}} def call1 { ul{ call2( @b.d, g: @b.d.f ) }}',
			tname: 'call1',
			args: {a: 1, b: {c:2, d: {e: 3, f: {g: 4, h: 5}}}},
			html: '<ul><li>2</li><li>3</li><li>5</li><li>4</li></ul>'
		},
		{
			testname: 'For .. In',
			jhaml: 'def call1 { for txt in @txts { span { @txt } } }',
			tname: 'call1',
			args: {txts: ['a', 'b', 'c'] },
			html: '<span>a</span><span>b</span><span>c</span>'
		},
		{
			testname: 'For .. In 2',
			jhaml: 'def call1 { for txt, name in @txts { span { @name ~-~ @txt } } }',
			tname: 'call1',
			args: {txts: {b:'3', a:'2', c:'1'} },
			html: '<span>a-2</span><span>b-3</span><span>c-1</span>'
		},
		{
			testname: 'For .. In 3',
			jhaml: 'def call1 { for txt, index in @txts { span { @index ~-~ @txt } } }',
			tname: 'call1',
			args: {txts: ['a', 'b', 'c'] },
			html: '<span>0-a</span><span>1-b</span><span>2-c</span>'
		},
		{
			testname: 'For .. In 4',
			jhaml: 'def call1 { for txt in @txts { span { @txt ~ - ~ @b ~ - ~ @c } } } def call2 { div { call1(txts:@a, b:"Q") } }',
			tname: 'call2',
			args: {a: ['a', 'b', 'c'], b: 'P', c: 'X' },
			html: '<div><span>a - Q - X</span><span>b - Q - X</span><span>c - Q - X</span></div>'
		},
		
	];
	_.each(testsForSuccess, function(t) {
		test(t.testname, function() {
			var jhaml = new Jhaml();
			jhaml.compile(t.jhaml);
			var result = jhaml.templates[t.tname](t.args);
			var expect = t.html;
			ok(result === expect, "Render test");
		});
	});

	test('Test external call', function() {
		var jhaml = new Jhaml();
		jhaml.templates.addAandB = function(o) { return '' + ((o.a - 0) + (o.b - 0)); };
		jhaml.compile('def call1 { span { ~The sum of @a and @b is ~ addAandB(a:@a,b:@b) } }');
		ok(_.isFunction(jhaml.templates.call1), "def creates a template function");
		var result = jhaml.templates.call1({a: 2, b:3});
		var expect = '<span>The sum of 2 and 3 is 5</span>'
		ok(result === expect, "Render test")
	});

});
