exports.create = function() {
	return Parse.Object.extend("FPTTeam", {

		initialize: function(attrs, options) {
			this.name = "team";
		}

	}, {

		newWithName: function(name) {
			var newTeam = new Parse.Object("FPTTeam");
			newTeam.set("name", name);
			return newTeam;
		}

	});
}