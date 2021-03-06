define(['App', 'underscore', 'backbone', 'marionette', 'view/header-view', 'view/sidebar-view', 'collection/my-subreddits', 'model/sidebar', 'event/channel'],
    function(App, _, Backbone, Marionette, HeaderView, SidebarView, MySubredditsCollection, SidebarModel, channel) {

        var AppRouter = Backbone.Marionette.AppRouter.extend({
            initialize: function(options) {
                //load settings
                window.settings = new Backbone.Model()
                this.loadSettingsFromCookies()

                window.subreddits = new MySubredditsCollection()
                //caching subreddit json in a global because it takes about 3 seconds to query from reddit api
                window.subs = []
                App.headerRegion.show(new HeaderView());
            },
            routes: {
                'r/myrandom(/)': 'myrandom',
                'r/:subName/submit(/)': 'submit',
                'submit(/)': 'submit',
                'prefs(/)': 'prefs',
                'subreddits(/)': 'subreddits',
                'subreddits(/):q': 'subreddits',
                '(:sortOrder)(/)': 'home',
                'r/:subName(/)': 'subreddit',
                'r/:subName/:sortOrder(/)': 'subreddit',
                'domain/:domain(/)': 'subredditDomain',
                'domain/:domain/:sortOrder(/)': 'subredditDomain',

                'r/:subName/comments/:id(/)': 'single',
                'r/:subName/comments/:id/:slug(/)': 'single',
                'r/:subName/comments/:id/:slug/:commentLink(/)': 'single',

                'user/:username(/)': 'user',
                'user/:username/:sortOrder(/)': 'user',
                'message/compose/:username(/)': 'compose',
                'message/:type(/)': 'inbox',

                'search': 'search',
                'search/:q(/)': 'search',
                'search/:q/:timeFrame(/)': 'search',
                'search/:q/:timeFrame/:sortOrder(/)': 'search'

            },
            //middleware, this will be fired before every route
            route: function(route, name, callback) {
                var router = this;
                if (!callback) callback = this[name];
                var f = function() {

                    //middleware functions, functions that get called between every route
                    if (name != 'single') { //hide the bottom bar if not in single view
                        App.bottombarRegion.close()
                    }
                    //end middleware functions
                    callback.apply(router, arguments); //call the actual route
                };
                return Backbone.Router.prototype.route.call(this, route, name, f);
            },
            home: function(sortOrder) {

                // channel.trigger("header:updateSortOrder")
                if (window.subs.length > 1) {
                    window.stop()
                }
                this.doSidebar('front');
                require(['view/subreddit-view'], function(SubredditView) {

                    App.mainRegion.show(new SubredditView({
                        subName: 'front',
                        sortOrder: sortOrder || 'hot'
                    }));
                })
            },

            subreddit: function(subName, sortOrder) {
                if (window.subs.length > 1) {
                    window.stop()
                }
                this.doSidebar(subName);
                require(['view/subreddit-view'], function(SubredditView) {
                    App.mainRegion.show(new SubredditView({
                        subName: subName,
                        sortOrder: sortOrder || 'hot'
                    }));

                })

            },

            subredditDomain: function(domain, sortOrder) {
                this.doSidebar('front');
                require(['view/subreddit-view'], function(SubredditView) {
                    App.mainRegion.show(new SubredditView({
                        subName: '',
                        sortOrder: sortOrder || 'hot',
                        domain: domain
                    }));

                })
            },

            //'r/:subName/comments/:id/:slug(/):commentLink(/)': 'single',
            single: function(subName, id, slug, commentLink) {
                if (window.subs.length > 1) {
                    window.stop()
                }
                this.doSidebar(subName);

                require(['view/single-view', 'view/bottom-bar-view'], function(SingleView, BottomBarView) {

                    App.mainRegion.show(new SingleView({
                        subName: subName,
                        id: id,
                        commentLink: commentLink || null
                    }));

                    //only update btm bar if the subreddit changes
                    if ((typeof App.bottombarRegion.currentView === 'undefined' || App.bottombarRegion.currentView.subName != subName) && window.settings.get('btmbar') === true) {
                        App.bottombarRegion.show(new BottomBarView({
                            subName: subName,
                            id: id
                        }))
                    }

                })

            },

            user: function(username, sortOrder) {
                var self = this
                require(['view/user-sidebar-view', 'view/user-view'], function(UserSidebarView, UserView) {

                    App.sidebarRegion.show(new UserSidebarView({
                        username: username
                    }))

                    App.mainRegion.show(new UserView({
                        username: username,
                        sortOrder: sortOrder
                    }));

                });
            },
            compose: function(username) {

                require(['view/compose-view'], function(ComposeView) {
                    App.mainRegion.show(new ComposeView({
                        username: username
                    }));

                });
            },
            inbox: function(type) {

                require(['view/inbox-view'], function(InboxView) {
                    App.mainRegion.show(new InboxView({
                        type: type
                    }));

                });
            },
            subreddits: function(searchQ) {
                require(['view/subreddit-picker-view'], function(SubredditPickerView) {
                    //if (typeof searchQ === 'undefined') {
                    //searchQ = ''
                    //}
                    App.mainRegion.show(new SubredditPickerView({
                        searchQ: searchQ || ''
                    }))

                })
            },
            search: function(searchQ, timeFrame, sortOrder) {

                this.doSidebar('front');
                require(['view/search-view'], function(SearchView) {
                    App.mainRegion.show(new SearchView({
                        searchQ: searchQ,
                        timeFrame: timeFrame,
                        sortOrder: sortOrder
                    }))
                })
            },
            submit: function(subName) {
                this.doSidebar(subName);
                require(['view/submit-view'], function(SubmitView) {
                    App.mainRegion.show(new SubmitView({
                        subName: subName
                    }))
                });
            },

            prefs: function() {
                this.doSidebar('front');
                require(['view/prefs'], function(PrefsView) {
                    App.mainRegion.show(new PrefsView())
                });

            },
            //loads a random subreddit that the user is subscribed to
            myrandom: function() {
                var self = this
                setTimeout(function() {

                    if (typeof window.subreddits !== 'undefined' && window.subreddits.length > 14) {
                        var rand = window.subreddits.at(Math.floor((Math.random() * window.subreddits.length)))
                        // this.subreddit(rand.get('display_name'))
                        Backbone.history.navigate('r/' + rand.get('display_name'), {
                            trigger: true
                        })
                    } else {
                        self.myrandom() //have to wait for the subreddits to load first, this is incredibly ugly, but I have to wait for the subreddit data to load.  Maybe store data in localstorage?
                    }

                }, 100)
            },

            /*   Util functions
             
             
             */
            //displays the sidebar for that subreddit if its not already created
            doSidebar: function(subName) {
                if (typeof App.sidebarRegion.currentView === 'undefined' || App.sidebarRegion.currentView.subName != subName) { //only update sidebar if the subreddit changes

                    var sidebarModel = new SidebarModel(subName)
                    if (subName == 'front') {
                        App.sidebarRegion.show(new SidebarView({
                            subName: subName,
                            model: sidebarModel
                        }))
                    } else {
                        sidebarModel.fetch({
                            success: function(model) {
                                App.sidebarRegion.show(new SidebarView({
                                    subName: subName,
                                    model: model
                                }))
                            }
                        })
                    }

                    // this.sidebar = new SidebarView({
                    //     subName: subName
                    // })
                }
            },
            loadSettingsFromCookies: function() {
                var checkboxes = new Array("btmbar", "cmtLoad", "customCSS", "showSidebar", "infin");
                var selectboxes = new Array('linkCount')

                for (var i in checkboxes) {

                    if (typeof $.cookie(checkboxes[i]) === 'undefined' || $.cookie(checkboxes[i]) == 'true') {
                        window.settings.set(checkboxes[i], true)
                    } else {
                        window.settings.set(checkboxes[i], false)
                    }
                }

                for (var x in selectboxes) {
                    if (typeof $.cookie(selectboxes[x]) === 'undefined') {
                        window.settings.set(selectboxes[x], 50)
                    } else {
                        window.settings.set(selectboxes[x], $.cookie(selectboxes[x]))
                    }
                }

            }

        });

        return AppRouter;

    });