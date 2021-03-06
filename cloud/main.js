var xmlreader = require("cloud/xmlreader.js");
var game = require("cloud/FPTGame.js")
var FPTGame = game.create();
var team = require("cloud/FPTTeam.js")
var FPTTeam = team.create();
var competition = require("cloud/FPTCompetition.js")
var FPTCompetition = competition.create();

function makeGamesList(xmlObject) {

	var arr = Array();

	xmlObject.rss.channel.item.each(function(index, item) { 
		arr.push(item);
	});

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

	arr.getUniqueTeams = function() {

		var allTeamNames = Array();
		for (var i = 0; i < arr.length; i++) {
			allTeamNames = allTeamNames.concat(arr[i].teamNames);
		}

		var arrayUniqueTeams = arrayUnique(allTeamNames);

		arrayUniqueTeams.convertToFPTTeams = function(queryResults) {

			var ownArray = this;
			for (var i = 0; i < ownArray.length; i++) {
				var name = ownArray[i];
				var filtered = queryResults.filter(function(item) {
					return item.get("name") == name;
				});
				if (filtered.length == 0) {
					var newTeam = FPTTeam.newWithName(name);
					ownArray[i] = newTeam;
				} else {
					ownArray[i] = filtered[0];
				}
			};

		}

		return arrayUniqueTeams;

	}

	arr.updateTeams = function(allTeams) {

		var ownArray = this;
		for (var i = 0; i < ownArray.length; i++) {
			var game = ownArray[i];
			var homeTeam = allTeams.filter(function(item) {
				return item.get("name") == game.teamNames[0];
			})[0];
			var awayTeam = allTeams.filter(function(item) {
				return item.get("name") == game.teamNames[1];
			})[0];
			game.set("homeTeam", homeTeam);
			game.set("homeTeamName", homeTeam.get("name"));
			game.set("awayTeam", awayTeam);
			game.set("awayTeamName", awayTeam.get("name"));
		}

	}

	arr.addCompetitions = function(allResults) {
		arr = arr.map(function(game) {
			var filtered = allResults.filter(function(result) {
				return result[1] == game.get("guid");
			});
			if (filtered.length > 0) {
				game.relation("competition").add(filtered[0][2]);
			}
			return game;
		});
	}

	arr.allGuids = function() {
		return arr.map(function(element) { return element.guid.text() });
	}

	return arr;

}

function makeResultsList(xmlObject) {
	var arr = Array();

	xmlObject.rss.channel.item.each(function(index, item) { 
		var newItem = Array();
		newItem.push(parseCompetitionTitle(item.title.text()));
		newItem.push(item.guid.text());
		arr.push(newItem);
	});

	arr.addCompetitions = function(competitions) {
		arr = arr.map(function(element) {
			var resultCompetitionName = element[0];
			var filtered = competitions.filter(function(competitionElement) {
				return competitionElement.get("name") == resultCompetitionName;
			});
			if (filtered.length > 0) {
				element.push(filtered[0]);
			}
			return element;
		});
	}

	return arr;
}

function makeCompetitionsList(xmlObject) {

	var arr = Array();

	xmlObject.rss.channel.item.each(function(index, item) { 
		arr.push(parseCompetitionTitle(item.title.text()));
	});

	arr = arrayUnique(arr);

	arr = arr.map(function(element) {
		var competition = FPTCompetition.newWithName(element);
		return competition;
	});

	arr.getNewCompetitions = function(queryResults) {
		return this.filter(function(element) {
			var filtered = queryResults.filter(function(resultElement) {
				return resultElement.get("name") == element.get("name");
			});
			return filtered.length == 0;
		});
	}

	return arr;
}

Parse.Cloud.job("update_tvgames", function(request, response) {

	Parse.Cloud.httpRequest({
	  url: 'http://feeds.feedburner.com/futebol365/resultados/'
	}).then(
		function(httpResponse) { 
			xmlreader.read(httpResponse.text, function(error, result) {
				if (error) {
					response.error(error);
				} else {

					var allResults = makeResultsList(result);
					var allCompetitions = makeCompetitionsList(result);

					var query = new Parse.Query(FPTCompetition);
					query.limit(1000);
					query.find({
						success: function(results) {

							var newCompetitions = allCompetitions.getNewCompetitions(results);
							Parse.Object.saveAll(newCompetitions, {
								success: function(competitionsList) { 
									
									allResults.addCompetitions(competitionsList);

									Parse.Cloud.httpRequest({
									  url: 'http://feeds.feedburner.com/futebol365/futebolnatv/'
									}).then(function(httpResponse) {
									  	// success
										xmlreader.read(httpResponse.text, function(error, result) {
											if (error) {
												response.error(error);
											} else {
												var allGames = makeGamesList(result);
												
												var query = new Parse.Query(FPTGame);
												var allGuids = allGames.allGuids();
												query.limit(1000);
												query.containedIn("guid", allGuids);
												query.find({
													success: function(results) {

														allGames.convertToFPTGames(results);
														
														if (allGames.length > 0) {

															var allUniqueTeams = allGames.getUniqueTeams();

															var teamsQuery = new Parse.Query(FPTTeam);
															teamsQuery.limit(1000);
															teamsQuery.containedIn("name", allUniqueTeams);
															teamsQuery.find({
																success: function(teamResults) {

																	allUniqueTeams.convertToFPTTeams(teamResults);
																	allGames.updateTeams(allUniqueTeams);
																	/*
																	NOTE: right now its not possible to now the competition until after the game as finished
																	allGames.addCompetitions(allResults);
																	*/

																	Parse.Object.saveAll(allUniqueTeams, {
																		success: function(teamList) {
																			Parse.Object.saveAll(allGames, {
																				success: function(list) { response.success("Saved " + list.length + " games, " + teamList.length + " teams, " + competitionsList.length + " competitions"); },
																				error: function(error) { response.error("Error saving: " + error); }
																			});
																		},
																		error: function(error) {
																			response.error("Error saving teams: " + error);
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
									  response.error('Request failed with response code ' + httpResponse.status);
									});

								},
								error: function(error) { 
									response.error("Error saving: " + error); 
								}
							});
							
						},
						error: function(error) {
							response.error("Error querying: " + error); 
						}
					});

				}
			});
		},
		function(httpResponse) { 
			// error
			response.error('Request failed with response code ' + httpResponse.status);
		}
	);

})

var arrayUnique = function(a) {
	return a.reduce(function(p, c) {
		if (p.indexOf(c) < 0) p.push(c);
		return p;
	}, []);
};

var parseCompetitionTitle = function(title) {
	return title.substring(0, title.indexOf(":"));
};
