exports.create = function() {
	return Parse.Object.extend("FPTCompetition", {

		initialize: function(attrs, options) {
		}

	}, {

		newWithName: function(name) {
			var newCompetition = new Parse.Object("FPTCompetition");
			newCompetition.set("name", name);
			return newCompetition;
		}

	});
}