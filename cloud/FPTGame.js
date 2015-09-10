exports.create = function() {
	return Parse.Object.extend("FPTGame", {

		updateFromXml: function(xmlItem) {
			this.setTitle(xmlItem[i].title.text());
			this.set("link", xmlItem[i].link.text());
		},

		setTitle: function(title) {
			this.set("title", title);
			var matches = parseTitle(title);
			this.set("tvChannel", matches[1]);
			this.set("dateString", matches[4]);
			this.set("date", dateFromString(matches[4]));
			this.teamNames = [ matches[2], matches[3] ];
		},

		initialize: function(attrs, options) {
			this.teamNames = Array();
		}

	}, {

		newFromXml: function(xmlItem) {
			var newGame = new Parse.Object("FPTGame");
			newGame.setTitle(xmlItem.title.text());
			newGame.set("guid", xmlItem.guid.text());
			newGame.set("link", xmlItem.link.text());
			return newGame;
		}

	});
}

function parseTitle(title) {
	var re = new RegExp('^([a-zA-Z0-9 .]+): (.+) - (.+) \\((\\d{4}-\\d{2}-\\d{2} às \\d{2}:\\d{2})\\)$');
	return re.exec(title);
}

function dateFromString(dateString) {
	var m = new moment(dateString, "YYYY-MM-DD[ às ]HH:mm", false);
	m.zone("+01:00");
	return m.utc().toDate();
}

var moment = require('moment');
