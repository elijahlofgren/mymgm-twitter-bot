/**
 * TweetbotController
 *
 * @description :: Server-side logic for managing tweetbots
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var twitterAPI = require('node-twitter-api');
var moment = require('moment');
var request = require('request');

function getTwitterApi() {
    var twitter = new twitterAPI({
        consumerKey: sails.config.twitter.consumerKey,
        consumerSecret: sails.config.twitter.consumerSecret,
        callback: sails.config.twitter.callback
    });
    return twitter;
}

function getBotAuth(callback) {
    Tweetbot.find({
        // No criteria, assumes a single record in collection
    }).limit(1).exec(function (err, tweetBots) {
        if (err) {
            sails.log.error(err);
        }
        if (!tweetBots) {
            sails.log.error('Could not find bot auth. Is Mongo collection empty?');
        }

        sails.log('Found tweetbots "%s"', JSON.stringify(tweetBots));
        // TO DO: Switch to promise instead of callback
        // Assumption is we only ever fetch 1 record so return first index of array.
        return callback(tweetBots[0]);
    });
}

function sendTweet(status) {
    var twitter = getTwitterApi();
    return getBotAuth(function (tweetBot) {
        sails.log('getBotAuth callback: Found tweetBot "%s"', JSON.stringify(tweetBot));
        var accessToken = tweetBot.accessToken;
        var accessTokenSecret = tweetBot.accessTokenSecret;

        twitter.statuses("update", {
            status: status
        },
            accessToken,
            accessTokenSecret,
            function (error, data, response) {
                if (error) {
                    sails.log({
                        error: error, data: data
                    });
                } else {
                    sails.log({
                        data: data
                    });
                }
            }
        );
    });
}

module.exports = {
    hi: function (req, res) {
        return res.send('Hi there!');
    },
    getTwitterRequestToken: function (req, res) {
        var twitter = getTwitterApi();
        twitter.getRequestToken(function (error, requestToken, requestTokenSecret, results) {
            if (error) {
                return res.send("Error getting OAuth request token : " + JSON.stringify(error));
            } else {
                var url = 'https://twitter.com/oauth/authenticate?oauth_token=' + requestToken;

                //store token and tokenSecret in Mongo DB, we'll need them later;
                Tweetbot.create({ requestToken: requestToken, requestTokenSecret: requestTokenSecret }).exec(
                    function createCB(err, created) {
                        // TO DO: redirect user
                        return res.send({
                            error: error, requestToken: requestToken, requestTokenSecret: requestTokenSecret, results: results,
                            urlToGoTo: url
                        });
                    });
            }
        });

    },
    // TO DO: Refactor
    authCallback: function (req, res) {
        var twitter = getTwitterApi();

        return getBotAuth(function (tweetBot) {
            sails.log('getBotAuth callback: Found tweetBot "%s"', JSON.stringify(tweetBot));

            var requestToken = tweetBot.requestToken;
            sails.log('requestToken = ' + requestToken);
            //console.log('req= ' + JSON.stringify(req));
            var oauth_verifier = req.param('oauth_verifier');
            console.log('oauth_verifier = ' + oauth_verifier);
            var requestTokenSecret = tweetBot.requestTokenSecret;
            sails.log('requestTokenSecret = ' + requestTokenSecret);

            twitter.getAccessToken(requestToken, requestTokenSecret, oauth_verifier, function (error, accessToken, accessTokenSecret, results) {
                if (error) {
                    console.log('Could not get access token. FATAL ERROR:');
                    console.log(error);
                } else {
                    var updatedData = {
                        accessToken: accessToken,
                        accessTokenSecret: accessTokenSecret
                    };

                    Tweetbot.update({ requestToken: tweetBot.requestToken, requestTokenSecret: tweetBot.requestTokenSecret },
                        updatedData).exec(function afterwards(err, updated) {

                            if (err) {
                                sails.log.error(err);
                            }

                            sails.log('Saved accessToken and accessTokenSecret to Mongo');
                        });

                    var url = 'http://localhost:1337/tweetbot/testTweet';
                    sails.log('TO DO: redirect user to:');
                    sails.log(url);
                    return res.send({
                        urlToGoTo: url
                    });
                    //store accessToken and accessTokenSecret somewhere (associated to the user)
                    //Step 4: Verify Credentials belongs here
                }
            });
        });
    },
    testTweet: function (req, res) {
        sendTweet("(ignore, testing tweet bot code) Hello world from http://www.mymgm.org/ tweetbot.");
        res.send("Sending tweet!");
    },
    tweetTodaysEvents: function (req, res) {
        sails.log('tweetTodaysEvents called!');
        // Check for any events happening today
        var eventsUrl = 'http://localhost:5000/api/localeventsapi';
        // var eventsUrl = 'http://www.mymgm.org/api/localeventsapi';
        request(eventsUrl, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // sails.log('body');
                // sails.log(body);
                var events = JSON.parse(body);
                //   sails.log('events');
                //   sails.log(events);

                sails.log('events.length:');
                sails.log(events.length);
                var foundEventForToday = false;
                for (var i = 0; i < events.length; i++) {
                    var event = events[i];
                    //sails.log('event:');
                    //sails.log(event);
                    var eventStartDate = moment(event.startDate);
                    var isToday = eventStartDate.isSame(new Date(), "day");
                    if (isToday) {
                        foundEventForToday = true;
                        sails.log('*** Starting to compose tweet!');
                        var statusNoUrl = 'Today in #mymgm - "' + event.title +
                            '" Get the details here: ';
                        var status = statusNoUrl + event.url;

                        sails.log('Status = ');
                        sails.log(status);
                        if (statusNoUrl.length > 117) {
                            sails.log('longer than 117 without URL, trying another one ');
                            statusNoUrl = 'Today in #mymgm "' + event.title +
                                '" ';
                            status = statusNoUrl + event.url;
                            sails.log('Status = ');
                            sails.log(status);


                            if (statusNoUrl.length > 117) {
                                var tempStatus = 'Today in #mymgm "" ';
                                // Use 144 so we can include "..."
                                var maxTitle = 114 - tempStatus.length;

                                status = 'Today in #mymgm "' +
                                    event.title.substring(0, maxTitle) + "..." +
                                    '" ' + event.url;
                                sails.log('Status = ');
                                sails.log(status);
                            }

                            sendTweet(status);
                        }
                    }
                }
                if (foundEventForToday) {
                    sails.log('tweetTodaysEvents done attempt at tweeting!');
                } else {
                    sails.log("Didn't find any events to tweet about today.");
                }

            } else {
                sails.log('error:');
                sails.log(error);
                sails.log('body:');
                sails.log(body);
            }
        });

        res.send("Attempting to send tweets (if any events today)!");
    }

};

