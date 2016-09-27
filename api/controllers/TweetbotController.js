/**
 * TweetbotController
 *
 * @description :: Server-side logic for managing tweetbots
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var twitterAPI = require('node-twitter-api');

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
                    var url = 'http://localhost:1337/tweetbot/testTweet?accessToken=' +
                        accessToken + '&accessTokenSecret=' + accessTokenSecret;
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
        var twitter = getTwitterApi();
        var accessToken = req.param('accessToken');
        console.log('accessToken = ' + accessToken);
        var accessTokenSecret = req.param('accessTokenSecret');
        console.log('accessTokenSecret = ' + accessTokenSecret);
        twitter.statuses("update", {
            status: "(ignore, testing tweet bot code) Hello world from http://www.mymgm.org/ tweetbot."
        },
            accessToken,
            accessTokenSecret,
            function (error, data, response) {
                if (error) {
                    return res.send({
                        error: error, data: data
                    });
                } else {
                    return res.send({
                        data: data
                    });
                }
            }
        );
    }
};

