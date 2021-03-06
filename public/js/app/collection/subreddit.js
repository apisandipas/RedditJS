define(['backbone', 'model/single', "moment"], function(Backbone, SingleModel) {

	var SubredditCollection = Backbone.Collection.extend({

		initialize: function(models, data) {
			_.bindAll(this);

			this.after = ""
			this.subName = data.subName
			this.sortOrder = data.sortOrder
			this.domain = data.domain
			this.count = 1
			if (typeof this.sortOrder === 'undefined') {
				this.sortOrder = 'hot' //the default sort order is hot
			}
			//this.sortOrder = "/" + this.sortOrder //needs to start with a slash to be injected into the URL
			this.subID = this.subName + this.sortOrder

			//build the URL string before fetch
			if (this.subName == "front" || this.domain !== null) {
				this.subnameWithrR = ''
			} else {
				this.subnameWithrR = 'r/' + this.subName + '/'
			}

			if (this.domain !== null) {
				this.domainStr = 'domain/' + this.domain + '/'
			} else {
				this.domainStr = ''
			}

			this.instanceUrl = this.getUrl()

		},
		// Reference to this collection's model.
		model: SingleModel,
		url: function() {
			return this.instanceUrl //keeps a dynamic URL so we can give it a new "after"
		},
		getUrl: function() {
			var username = $.cookie('username')
			var linkCount = window.settings.get('linkCount')

			if (typeof username !== "undefined") {
				return '/api/?url=' + this.domainStr + this.subnameWithrR + this.sortOrder + ".json&limit=" + linkCount + "&after=" + this.after + "&cookie=" + $.cookie('reddit_session');
			} else {
				console.log("http://api.reddit.com/" + this.domainStr + this.subnameWithrR + this.sortOrder + ".json?after=" + this.after + "&limit=" + linkCount + "&jsonp=?")
				return "http://api.reddit.com/" + this.domainStr + this.subnameWithrR + this.sortOrder + ".json?after=" + this.after + "&limit=" + linkCount + "&jsonp=?"
			}
		},
		parse: function(response) {
			if (typeof response === 'undefined' || response.length === 0) {
				return
			}

			this.after = response.data.after;

			if (typeof this.after === 'undefined' || this.after === "" || this.after === null) {
				this.after = "stop" //tells us we have finished downloading all of the possible posts in this subreddit
			}

			var modhash = response.data.modhash;
			if (typeof modhash == "string" && modhash.length > 5) {
				$.cookie('modhash', modhash, {
					path: '/'
				});
			}

			var self = this;
			var models = Array();
			_.each(response.data.children, function(item) {
				if (item.data.hidden === false) {

					var singleModel = new SingleModel({
						subName: this.subName,
						id: item.data.id,
						parseNow: false
					});
					item.data = singleModel.parseOnce(item.data)
					item.data.count = self.count

					if ((self.count % 2) === 0) {
						item.data.evenOrOdd = "even"
					} else {
						item.data.evenOrOdd = "odd"
					}

					self.count++;

					models.push(item.data)

				}
			});

			//reset the url to have the new after tag
			this.instanceUrl = this.getUrl()
			return models;
		}

	});
	return SubredditCollection;
});