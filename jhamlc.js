#!/usr/bin/env node

var path = require('path')
    , fs = require('fs')
    , sys = require('util')
    , os = require('os')
    
    , requirejs = require('requirejs')
    , Jhaml = require('./jhaml.js')
    , jhaml = new Jhaml()
    ;

function printHelp() {
	var helpTxt = 'This is the command line tool for converting jhaml source to HTML. ' +
			'Pass it files containing jhaml source and it outputs HTML. ' +
			'Each file is implicately wrapped in a template definition and the template called after each file. ' +
			'Files are processed in the order the appear. ' + 
			'A single - in place of a filename indicates standard input and ' + 
			'will cause jhamlc to read stdin to the end and process it as a single file in sequence. ' +
			'To specify a bag of arguments to pass, include a JSON literal object as a command line argument. ' +
			'If no files are given, then standard input is implied as though a single - were given. ';
	console.log(helpTxt);
	process.exit(0);
}

var context = {}, nProcessed = 0;

function readStdin(cb) {
	var chunks = [];
	process.stdin.on('data', function(chunk) {
		chunks.push(chunk);
	});
	process.stdin.on('end', function() {
		cb && cb(chunks.join(''));
		cb = null;
	});
	process.stdin.setEncoding('utf8');
	process.stdin.resume();
}

function processJhaml(txt, filename) {
	//console.warn('processing ' + filename + ': ' + txt);
	var fname = 'JHAMLIMMEDIATEFILE_' + nProcessed + '_' + ('' + Math.random()).substr(2, 6); //we add random junk so no one tries to guess these
	var src = 'def ' + fname + '{ ' + txt + ' }';
	jhaml.compile(src, filename);
	var html = jhaml.templates[fname](context);
	process.stdout.write(html);
	nProcessed++;
}
	
function argLoop(argi) {
	if(argi >= process.argv.length) {
		if(nProcessed == 0) {
			readStdin(function(txt) {
				processJhaml(txt, 'STDIN');
			});
		}
		return;
	}
	var arg = process.argv[argi].replace(/^\s+|\s+$/g, '');
	if(arg.match(/jhamlc(?:\.js)?$/)) {
		return argLoop(argi + 1);
	}
	if(arg == '--help') {
		printHelp(); //exits
	}
	if(arg.match(/^\{.*\}$/)) {
		context = JSON.parse(arg);
		return argLoop(argi + 1);
	}
	if(arg == '-') {
		readStdin(function(txt) {
			processJhaml(txt);
			argLoop(argi + 1);
		});
		return;
	}
	fs.readFile(arg, 'utf8', function(err, txt) {
		if(err) {
			console.error('Unable to read file "' + arg + '", argument ' + argi +', error: ' + util.inspect(err));
			process.exit(1);
		}
		processJhaml(txt, arg);
		argLoop(argi + 1);
	});
}
argLoop(1);
