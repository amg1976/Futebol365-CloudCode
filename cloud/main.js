var xmlreader = require("cloud/xmlreader.js");
var game = require("cloud/FPTGame.js")
var FPTGame = game.create();
var team = require("cloud/FPTTeam.js")
var FPTTeam = team.create();

/*
Parse.Cloud.job("update_tvgames", function(request, status) {
	Parse.Cloud.useMasterKey();
	*/
Parse.Cloud.define("update_tvgames", function(request, response) {
	Parse.Cloud.httpRequest({
	  url: 'http://feeds.feedburner.com/futebol365/futebolnatv/'
	}).then(function(httpResponse) {
	  	// success
		xmlreader.read(httpResponse.text, function(error, result) {
			if (error) {
				response.error(error);
			} else {
				var allItems = Array();
				result.rss.channel.item.each(function(index, item) { 
					allItems.push(item);
				});

				var query = new Parse.Query(FPTGame);
				var allGuids = allItems.map(function(element) { return element.guid.text() });
				query.containedIn("guid", allGuids);
				query.find({
					success: function(results) {
						var itemsToUpdate = Array();
						var itemsToSave = allItems.filter(function(element1) {
							var currentGuid = element1.guid.text();
							var filteredResults = results.filter(function(element2) {
								return element2.get("guid") == currentGuid;
							});
							if (filteredResults.length == 0) {
								return true;
							} else {
								var item = filteredResults[0];
								item.setTitle(element1.title.text());
								item.set("link", element1.link.text());
								itemsToUpdate.push(item);
								return false;
							}
						});
						for (var i = 0; i < itemsToSave.length; i++) {
							itemsToSave[i] = FPTGame.newFromXml(itemsToSave[i]);
						};
						var itemsToSubmit = itemsToSave.concat(itemsToUpdate);
						if (itemsToSubmit.length > 0) {

							var allTeamNames = Array();
							for (var i = 0; i < itemsToSubmit.length; i++) {
								allTeamNames = allTeamNames.concat(itemsToSubmit[i].teamNames);
							}
							var allUniqueTeams = arrayUnique(allTeamNames);

							for (var i = 0; i < allUniqueTeams.length; i++) {
								var newTeam = FPTTeam.newWithName(allUniqueTeams[i]);
								allUniqueTeams[i] = newTeam;
								//newTeam.save();
								/*
								newTeam.save(null, { 
									success: function(team) {
										console.log("Created team " + team.get("name"));
									}, 
									error: function(team, error) {
										console.log("Error creating team " + team.get("name") + ": " + error);
									}
								});
								*/
							};

							for (var i = 0; i < itemsToSubmit.length; i++) {
								var game = itemsToSubmit[i];
								var homeTeam = allUniqueTeams.filter(function(item) {
									return item.get("name") == game.teamNames[0];
								})[0];
								var awayTeam = allUniqueTeams.filter(function(item) {
									return item.get("name") == game.teamNames[1];
								})[0];
								game.set("homeTeam", homeTeam);
								game.set("awayTeam", awayTeam);
							}

							Parse.Object.saveAll(allUniqueTeams, {
								success: function(teamList) {
									//response.success("Saved " + teamList.length + " teams");
									Parse.Object.saveAll(itemsToSubmit, {
										success: function(list) { response.success("Saved " + list.length + " games, " + teamList.length + " teams"); },
										error: function(error) { response.error("Error saving: " + error); }
									});
								},
								error: function(error) {
									response.log("Error saving teams: " + error);
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
