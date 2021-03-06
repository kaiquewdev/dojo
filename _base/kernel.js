define(["../has", "./config", "require", "module"], function(has, config, require, module){
	// module:
	//		dojo/_base/kernel
	// summary:
	//		This module is the foundational module of the dojo boot sequence; it defines the dojo object.
	var
		// loop variables for this module
		i, p,

		// create dojo, dijit, and dojox; initialize _scopeName and possibly publish to the global
		// namespace: three possible cases:
		//
		//   1. The namespace is not mentioned in config.scopeMap: _scopeName is set to the default
		//      name (dojo, dijit, or dojox), and the object is published to the global namespace
		//
		//   2. The namespace is mentioned with a nonempty name: _scopeName is set to the name given
		//      and the object is published to the global namespace under that name
		//
		//   3. Then namespace is mentioned, but the value is falsy (e.g., ""): _scopeName is set to
		//       _(dojo|dijit|dojox)<reasonably-unque-number> and the object is *not* published to the global namespace
		dojo = {
			config: {},
			global:this,
			dijit:{},
			dojox:{}
		},
		temp = {dojo:dojo, dijit:dojo.dijit, dojox:dojo.dojox},
		scopeMap = {dojo:"dojo", dijit:"dijit", dojox:"dojox"},
		match = module.id.match(/[^\/]+/),
		thisDojoName = match && match[0],
		configScopeMap = config[thisDojoName + "Scope"] || config.scopeMap || [];
	for(i = 0; i < configScopeMap.length; i++){
		scopeMap[configScopeMap[i][0]] = configScopeMap[i][1];
	}
	for(p in temp){
		temp[p]._scopeName = scopeMap[p];
		if(!config.noGlobals){
			dojo.global[scopeMap[p]] = temp[p];
		}
	}

	// copy the configuration, but only one-level deep; we'll clone it in the main module
	// after dojo.clone is defined. This technique will allow us to do some clean up on
	// the passed in config yet ultimately return the config object as we received it. After
	// the main module is defined and config is cloned, dojo's config object is completely
	// independend of the passed config object.
	//
	// allow the configuration to overwrite existing has feature tests during this bootstrap;
	// this allows (e.g.) hard-setting a has feature test to force an execution path that may
	// be different than actually indicated in the environment. However, after bootstrap, config
	// can't overwrite has tests.
	dojo.config = {};
	for(p in config){
		dojo.config[p] = config[p];
		has.add(p, config[p], 0, 1);
	}
	for(p in config.has){
		has.add(p, config.has[p], 0, 1);
	}
	if(has("dojo-loader") && has("dojo-config-api")){
		require.on("config", function(config){
			for(p in config){
				has.add(p, config[p]);
			}
		});
	}
	dojo.baseUrl = dojo.config.baseUrl = require.baseUrl;

	/*=====
		dojo.version = function(){
			// summary:
			//		Version number of the Dojo Toolkit
			// major: Integer
			//		Major version. If total version is "1.2.0beta1", will be 1
			// minor: Integer
			//		Minor version. If total version is "1.2.0beta1", will be 2
			// patch: Integer
			//		Patch version. If total version is "1.2.0beta1", will be 0
			// flag: String
			//		Descriptor flag. If total version is "1.2.0beta1", will be "beta1"
			// revision: Number
			//		The SVN rev from which dojo was pulled
			this.major = 0;
			this.minor = 0;
			this.patch = 0;
			this.flag = "";
			this.revision = 0;
		}
	=====*/
	var rev = "$Rev: 23930 $".match(/\d+/);
	dojo.version = {
		major: 1, minor: 7, patch: 0, flag: "dev",
		revision: rev ? +rev[0] : NaN,
		toString: function(){
			var v = dojo.version;
			return v.major + "." + v.minor + "." + v.patch + v.flag + " (" + v.revision + ")";	// String
		}
	};

	// notice that modulePaths won't be applied to any require's before the dojo/_base/kernel factory is run;
	// this is the v1.6- behavior. Going forward from 1.7, consider modulePaths deprecated and
	// configure the loader directly.
	if(config.modulePaths){
		var paths = {};
		for(p in config.modulePaths){
			paths[p.replace(/\./g, "/")] = config.modulePaths[p];
		}
		require({paths:paths});
	}

	config.locale && (dojo.locale = config.locale);

	dojo.isAsync = !has("dojo-loader") || require.async;

	// define dojo's eval method so that an almost-pristine environment is provided
	// (only the variables __scope and __text shadow globals)
	var dojoEval = new Function("__scope", "__text", "return (__scope.eval || eval)(__text);");
	dojo.eval = function(text){
		return dojoEval(dojo.global, text);
	};

	if(!has("host-rhino")){
		dojo.exit = function(exitcode){
			quit(exitcode);
		};
	}

	has.add("dojo-guarantee-console",
		// ensure that console.log, console.warn, etc. are defined
		1
	);
	if(has("dojo-guarantee-console")){
		// intentional global console
		typeof console != "undefined" || (console = {});
		//	Be careful to leave 'log' always at the end
		var cn = [
			"assert", "count", "debug", "dir", "dirxml", "error", "group",
			"groupEnd", "info", "profile", "profileEnd", "time", "timeEnd",
			"trace", "warn", "log"
		];
		var i = 0, tn;
		while((tn = cn[i++])){
			if(!console[tn]){
				(function(){
					var tcn = tn + "";
					console[tcn] = ('log' in console) ? function(){
						var a = Array.apply({}, arguments);
						a.unshift(tcn + ":");
						console["log"](a.join(" "));
					} : function(){};
					console[tcn]._fake = true;
				})();
			}
		}
	}

	has.add("bug-for-in-skips-shadowed", function(){
		// if true, the for-in interator skips object properties that exist in Object's prototype (IE 6 - ?)
		for(var i in {toString: 1}){
			return 0;
		}
		return 1;
	});
	if(has("bug-for-in-skips-shadowed")){
		var
			extraNames = dojo._extraNames = "hasOwnProperty.valueOf.isPrototypeOf.propertyIsEnumerable.toLocaleString.toString.constructor".split("."),
			extraLen = extraNames.length;
	}
	var empty = {};
	dojo._mixin = function(/*Object*/ target, /*Object*/ source){
		// summary:
		//		Adds all properties and methods of source to target. This addition
		//		is "prototype extension safe", so that instances of objects
		//		will not pass along prototype defaults.
		var name, s, i;
		for(name in source){
			// the "tobj" condition avoid copying properties in "source"
			// inherited from Object.prototype.	 For example, if target has a custom
			// toString() method, don't overwrite it with the toString() method
			// that source inherited from Object.prototype
			s = source[name];
			if(!(name in target) || (target[name] !== s && (!(name in empty) || empty[name] !== s))){
				target[name] = s;
			}
		}

		if(has("bug-for-in-skips-shadowed")){
			if(source){
				for(i = 0; i < extraLen; ++i){
					name = extraNames[i];
					s = source[name];
					if(!(name in target) || (target[name] !== s && (!(name in empty) || empty[name] !== s))){
						target[name] = s;
					}
				}
			}
		}

		return target; // Object
	};

	dojo.mixin = function(/*Object*/obj, /*Object...*/props){
		// summary:
		//		Adds all properties and methods of props to obj and returns the
		//		(now modified) obj.
		//	description:
		//		`dojo.mixin` can mix multiple source objects into a
		//		destination object which is then returned. Unlike regular
		//		`for...in` iteration, `dojo.mixin` is also smart about avoiding
		//		extensions which other toolkits may unwisely add to the root
		//		object prototype
		//	obj:
		//		The object to mix properties into. Also the return value.
		//	props:
		//		One or more objects whose values are successively copied into
		//		obj. If more than one of these objects contain the same value,
		//		the one specified last in the function call will "win".
		//	example:
		//		make a shallow copy of an object
		//	| var copy = dojo.mixin({}, source);
		//	example:
		//		many class constructors often take an object which specifies
		//		values to be configured on the object. In this case, it is
		//		often simplest to call `dojo.mixin` on the `this` object:
		//	| dojo.declare("acme.Base", null, {
		//	|		constructor: function(properties){
		//	|			// property configuration:
		//	|			dojo.mixin(this, properties);
		//	|
		//	|			console.log(this.quip);
		//	|			//	...
		//	|		},
		//	|		quip: "I wasn't born yesterday, you know - I've seen movies.",
		//	|		// ...
		//	| });
		//	|
		//	| // create an instance of the class and configure it
		//	| var b = new acme.Base({quip: "That's what it does!" });
		//	example:
		//		copy in properties from multiple objects
		//	| var flattened = dojo.mixin(
		//	|		{
		//	|			name: "Frylock",
		//	|			braces: true
		//	|		},
		//	|		{
		//	|			name: "Carl Brutanananadilewski"
		//	|		}
		//	| );
		//	|
		//	| // will print "Carl Brutanananadilewski"
		//	| console.log(flattened.name);
		//	| // will print "true"
		//	| console.log(flattened.braces);
		if(!obj){ obj = {}; }
		for(var i = 1, l = arguments.length; i < l; i++){
			dojo._mixin(obj, arguments[i]);
		}
		return obj; // Object
	};

	var getProp = function(/*Array*/parts, /*Boolean*/create, /*Object*/context){
		var p, i = 0, dojoGlobal = dojo.global;
		if(!context){
			if(!parts.length){
				return dojoGlobal;
			}else{
				p = parts[i++];
				try{
					context = (scopeMap[p] && dojo.global[scopeMap[p]]);
				}catch(e){}
				context = context || (p in dojoGlobal ? dojoGlobal[p] : (create ? dojoGlobal[p] = {} : undefined));
			}
		}
		while(context && (p = parts[i++])){
			context = (p in context ? context[p] : (create ? context[p] = {} : undefined));
		}
		return context; // mixed
	};

	dojo.setObject = function(/*String*/name, /*Object*/value, /*Object?*/context){
		// summary:
		//		Set a property from a dot-separated string, such as "A.B.C"
		//	description:
		//		Useful for longer api chains where you have to test each object in
		//		the chain, or when you have an object reference in string format.
		//		Objects are created as needed along `path`. Returns the passed
		//		value if setting is successful or `undefined` if not.
		//	name:
		//		Path to a property, in the form "A.B.C".
		//	context:
		//		Optional. Object to use as root of path. Defaults to
		//		`dojo.global`.
		//	example:
		//		set the value of `foo.bar.baz`, regardless of whether
		//		intermediate objects already exist:
		//	| dojo.setObject("foo.bar.baz", value);
		//	example:
		//		without `dojo.setObject`, we often see code like this:
		//	| // ensure that intermediate objects are available
		//	| if(!obj["parent"]){ obj.parent = {}; }
		//	| if(!obj.parent["child"]){ obj.parent.child = {}; }
		//	| // now we can safely set the property
		//	| obj.parent.child.prop = "some value";
		//		whereas with `dojo.setObject`, we can shorten that to:
		//	| dojo.setObject("parent.child.prop", "some value", obj);
		var parts = name.split("."), p = parts.pop(), obj = getProp(parts, true, context);
		return obj && p ? (obj[p] = value) : undefined; // Object
	};

	dojo.getObject = function(/*String*/name, /*Boolean?*/create, /*Object?*/context){
		// summary:
		//		Get a property from a dot-separated string, such as "A.B.C"
		//	description:
		//		Useful for longer api chains where you have to test each object in
		//		the chain, or when you have an object reference in string format.
		//	name:
		//		Path to an property, in the form "A.B.C".
		//	create:
		//		Optional. Defaults to `false`. If `true`, Objects will be
		//		created at any point along the 'path' that is undefined.
		//	context:
		//		Optional. Object to use as root of path. Defaults to
		//		'dojo.global'. Null may be passed.
		return getProp(name.split("."), create, context); // Object
	};

	dojo.exists = function(/*String*/name, /*Object?*/obj){
		//	summary:
		//		determine if an object supports a given method
		//	description:
		//		useful for longer api chains where you have to test each object in
		//		the chain. Useful for object and method detection.
		//	name:
		//		Path to an object, in the form "A.B.C".
		//	obj:
		//		Object to use as root of path. Defaults to
		//		'dojo.global'. Null may be passed.
		//	example:
		//	| // define an object
		//	| var foo = {
		//	|		bar: { }
		//	| };
		//	|
		//	| // search the global scope
		//	| dojo.exists("foo.bar"); // true
		//	| dojo.exists("foo.bar.baz"); // false
		//	|
		//	| // search from a particular scope
		//	| dojo.exists("bar", foo); // true
		//	| dojo.exists("bar.baz", foo); // false
		return dojo.getObject(name, false, obj) !== undefined; // Boolean
	};

	has.add("dojo-debug-messages",
		// include dojo.deprecated/dojo.experimental implementations
		1
	);
	if(has("dojo-debug-messages")){
		dojo.deprecated = function(/*String*/ behaviour, /*String?*/ extra, /*String?*/ removal){
			//	summary:
			//		Log a debug message to indicate that a behavior has been
			//		deprecated.
			//	behaviour: String
			//		The API or behavior being deprecated. Usually in the form
			//		of "myApp.someFunction()".
			//	extra: String?
			//		Text to append to the message. Often provides advice on a
			//		new function or facility to achieve the same goal during
			//		the deprecation period.
			//	removal: String?
			//		Text to indicate when in the future the behavior will be
			//		removed. Usually a version number.
			//	example:
			//	| dojo.deprecated("myApp.getTemp()", "use myApp.getLocaleTemp() instead", "1.0");

			var message = "DEPRECATED: " + behaviour;
			if(extra){ message += " " + extra; }
			if(removal){ message += " -- will be removed in version: " + removal; }
			console.warn(message);
		};

		dojo.experimental = function(/* String */ moduleName, /* String? */ extra){
			//	summary: Marks code as experimental.
			//	description:
			//		This can be used to mark a function, file, or module as
			//		experimental.	 Experimental code is not ready to be used, and the
			//		APIs are subject to change without notice.	Experimental code may be
			//		completed deleted without going through the normal deprecation
			//		process.
			//	moduleName: String
			//		The name of a module, or the name of a module file or a specific
			//		function
			//	extra: String?
			//		some additional message for the user
			//	example:
			//	| dojo.experimental("dojo.data.Result");
			//	example:
			//	| dojo.experimental("dojo.weather.toKelvin()", "PENDING approval from NOAA");
			var message = "EXPERIMENTAL: " + moduleName + " -- APIs subject to change without notice.";
			if(extra){ message += " " + extra; }
			console.warn(message);
		};
	}else{
		dojo.deprecated = dojo.experimental = function(){};
	}


	has.add("dojo-moduleUrl",
		// include dojo.moduleUrl
		1
	);
	if(has("dojo-moduleUrl")){
		dojo.moduleUrl = function(/*String*/module, /*String?*/url){
			//	summary:
			//		Returns a URL relative to a module.
			//	example:
			//	|	var pngPath = dojo.moduleUrl("acme","images/small.png");
			//	|	console.dir(pngPath); // list the object properties
			//	|	// create an image and set it's source to pngPath's value:
			//	|	var img = document.createElement("img");
			//	|	img.src = pngPath;
			//	|	// add our image to the document
			//	|	dojo.body().appendChild(img);
			//	example:
			//		you may de-reference as far as you like down the package
			//		hierarchy.  This is sometimes handy to avoid lenghty relative
			//		urls or for building portable sub-packages. In this example,
			//		the `acme.widget` and `acme.util` directories may be located
			//		under different roots (see `dojo.registerModulePath`) but the
			//		the modules which reference them can be unaware of their
			//		relative locations on the filesystem:
			//	|	// somewhere in a configuration block
			//	|	dojo.registerModulePath("acme.widget", "../../acme/widget");
			//	|	dojo.registerModulePath("acme.util", "../../util");
			//	|
			//	|	// ...
			//	|
			//	|	// code in a module using acme resources
			//	|	var tmpltPath = dojo.moduleUrl("acme.widget","templates/template.html");
			//	|	var dataPath = dojo.moduleUrl("acme.util","resources/data.json");

			// TODOC v1.6- returns a trailing slash if url is missing; v1.7+ does not
			// TODOC v1.6- returns null iff module is falsy

			// require.toUrl requires a filetype; therefore, just append the suffix "/x.y" to guarantee a filetype, then
			// remove the suffix from the result. This way clients can request a url w/out a filetype. This should be
			// rare, but it maintains backcompat for the v1.x line (note: dojo.moduleUrl will be removed in v2.0)
			return require.toUrl(module.replace(/\./g, "/") + (url ? ("/" + url) : "") + "/x.y").match(/(.+)\/x\.\y$/)[1];
		};
	}

	return dojo;
});
