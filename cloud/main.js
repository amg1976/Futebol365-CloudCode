var xmlreader = require("cloud/xmlreader.js");
var game = require("cloud/FPTGame.js")
var FPTGame = game.create();
var team = require("cloud/FPTTeam.js")
var FPTTeam = team.create();

function makeGamesList() {

	var arr = Array();
	arr.push.apply(arr, arguments);

	arr.loadFromRSSResponse = function(xmlObject) {
		var ownArray = this;
		xmlObject.rss.channel.item.each(function(index, item) { 
			ownArray.push(item);
		});
	}

	arr.convertToFPTGames = function(queryResults) {

		var ownArray = this;
		for (var i = 0; i < ownArray.length; i++) {

			var currentGuid = ownArray[i].guid.text();
			var filteredResults = queryResults.filter(function(element2) {
				return element2.get("guid") == currentGuid;
			});
			if (filteredResults.length == 0) {
				ownArray[i] = FPTGame.newFromXml(ownArray[i]);
			} else {
				var item = filteredResults[0];
				item.setTitle(ownArray[i].title.text());
				item.set("link", ownArray[i].link.text());
				ownArray[i] = item;
			}

		}

	}

	arr.getUniqueTeamNames = function() {

		var allTeamNames = Array();
		for (var i = 0; i < arr.length; i++) {
			allTeamNames = allTeamNames.concat(arr[i].teamNames);
		}
		return arrayUnique(allTeamNames);

	}

	return arr;

}

Parse.Cloud.job("update_tvgames", function(request, response) {
	Parse.Cloud.useMasterKey();
	Parse.Cloud.httpRequest({
	  url: 'http://feeds.feedburner.com/futebol365/futebolnatv/'
	}).then(function(httpResponse) {
	  	// success
		xmlreader.read(httpResponse.text, function(error, result) {
			if (error) {
				response.error(error);
			} else {
				var allItems = makeGamesList();
				allItems.loadFromRSSResponse(result);

				var query = new Parse.Query(FPTGame);
				var allGuids = allItems.map(function(element) { return element.guid.text() });
				query.limit(1000);
				query.containedIn("guid", allGuids);
				query.find({
					success: function(results) {

						allItems.convertToFPTGames(results);
						
						if (allItems.length > 0) {

							var allUniqueTeams = allItems.getUniqueTeamNames();

							var teamsQuery = new Parse.Query(FPTTeam);
							teamsQuery.limit(1000);
							teamsQuery.containedIn("name", allUniqueTeams);
							teamsQuery.find({
								success: function(teamResults) {

									for (var i = 0; i < allUniqueTeams.length; i++) {
										var name = allUniqueTeams[i];
										var filtered = teamResults.filter(function(item) {
											return item.get("name") == name;
										});
										if (filtered.length == 0) {
											var newTeam = FPTTeam.newWithName(name);
											allUniqueTeams[i] = newTeam;
										} else {
											allUniqueTeams[i] = filtered[0];
										}
									};

									for (var i = 0; i < allItems.length; i++) {
										var game = allItems[i];
										var homeTeam = allUniqueTeams.filter(function(item) {
											return item.get("name") == game.teamNames[0];
										})[0];
										var awayTeam = allUniqueTeams.filter(function(item) {
											return item.get("name") == game.teamNames[1];
										})[0];
										game.set("homeTeam", homeTeam);
										game.set("homeTeamName", homeTeam.get("name"));
										game.set("awayTeam", awayTeam);
										game.set("awayTeamName", awayTeam.get("name"));
									}

									Parse.Object.saveAll(allUniqueTeams, {
										success: function(teamList) {
											Parse.Object.saveAll(allItems, {
												success: function(list) { response.success("Saved " + list.length + " games, " + teamList.length + " teams"); },
												error: function(error) { response.error("Error saving: " + error); }
											});
										},
										error: function(error) {
											response.log("Error saving teams: " + error);
										}
									});

								},
								error: function(error) {
									response.error("Error in teams query: " + error);
								}
							});

						} else {
							response.success("No items to save");
						}
					},
					error: function(error) {
						response.error("Error in query: " + error);
					}
				});

			}
		})
	},function(httpResponse) {
	  // error
	  response.response.error('Request failed with response code ' + httpResponse.status);
	});
})

var arrayUnique = function(a) {
	return a.reduce(function(p, c) {
		if (p.indexOf(c) < 0) p.push(c);
		return p;
	}, []);
};
