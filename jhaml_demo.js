/* 
 * jhaml_demo.js
 * a quick demo for jhaml.js
 * Joe's HTML abstraction markup language
 */

requirejs.config({
	shim: {
    	underscore: {
      		exports: '_'
    	}
    },
	paths: {
		'jquery' : 'http://ajax.googleapis.com/ajax/libs/jquery/1.10.0/jquery',
		underscore: 'node_modules/underscore/underscore'
	}
});

require(['jhaml', 'underscore', 'jquery'], function(Jhaml, _, $) {
	var jhaml = new Jhaml();

	var data = {
		heading: 'Jhaml demo',
		image: 'http://profile.ak.fbcdn.net/hprofile-ak-prn1/c76.0.453.453/s160x160/15845_591459568577_4195121_n.jpg',
		texts: [
			"Jhaml stands for Joe's HTML abstraction markup language.",
			"Jhaml is pronounced 'Jamal' but may be pronounced as 'Jamle' in the presence of people named 'Jamal' to avoid confusion."
		],
		source: ''
	}

	function afterLoad() {
		$('body').html(jhaml.templates.main(data));
		$('#content').append( _.map(data.texts, function(txt) { return jhaml.templates.text({content: txt}); }).join(''));
	}
	$.ajax({
		url:'jhaml_demo.jhaml',
		dataType: 'text',
		success: function(templates) {
			data.source = templates;
			jhaml.compile(templates);
			afterLoad();
		}
	});
});