/**
 * Fixes the console for every possible browser.
 * 
 * Author: Antti Hukkanen
 * 
 */
if (window.loadFirebugConsole) {
	window.loadFirebugConsole();
} else {
	if (!window.console) {
		window.console = {
			logindex: 0,
			consolewin: null,
			consoleelem: null,
			initialized: false,
			html: {
				separator: '<br/>'
			},
			windowoptions: {
				width: 300,
				height: 200
			},
			init: function() {
				if (console.consolewin === null) {
					console.initialized = true;
					var options = '';
					for (var i in console.windowoptions) {
						if (options.length > 0) {
							options += ',';
						}
						options += i + '=' + console.windowoptions[i];
					}
					console.consolewin = window.open('','Console',options);
					console.consolewin.document.body.innerHTML = "";
				}
			},
			getTime: function() {
				var now = new Date();
				var year = now.getFullYear();
				var mon = now.getMonth() < 9 ? '0' + (now.getMonth()+1) : now.getMonth()+1;
				var day = now.getDate() < 10 ? '0' + now.getDate() : now.getDate();
				var hrs = now.getHours() < 10 ? '0' + now.getHours() : now.getHours();
				var mins = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes();
				var secs = now.getSeconds() < 10 ? '0' + now.getSeconds() : now.getSeconds();
				
				return year + "-" + mon + "-" + day + " " + hrs + ":" + mins + ":" + secs;
			},
			writemsg: function(msg) {
				if (!console.initialized) {
					console.init();
				}
				msg = console.getTime() + " " + msg;
				if (console.logindex > 0) {
					msg = console.html.separator + msg;
				}
				console.consolewin.document.body.innerHTML = 
					console.consolewin.document.body.innerHTML + msg;
				console.logindex++;
			},
			info: function(msg) {
				console.writemsg(msg);
			},
			log: function(msg) {
				console.writemsg(msg);
			},
			warn: function(msg) {
				console.writemsg(msg);
			},
			error: function(msg) {
				console.writemsg(msg);
			}
		};
	}
}