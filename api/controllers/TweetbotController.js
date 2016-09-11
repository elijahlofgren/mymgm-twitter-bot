/**
 * TweetbotController
 *
 * @description :: Server-side logic for managing tweetbots
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var twitterAPI = require('node-twitter-api');

function getTwitterApi() {
    var twitter = new twitterAPI({
        consumerKey: sails.config.consumerKey,
        consumerSecret: sails.config.consumerSecret,
        callback: sails.config.callback
    });
    return twitter;
}

module.exports = {
    hi: function (req, res) {
        return res.send('Hi there!');
    },
    getTwitterRequestToken: function (req, res) {
        var twitter = getTwitterApi();
        twitter.getRequestToken(function (error, requestToken, requestTokenSecret, results) {
            if (error) {
                return res.send("Error getting OAuth request token : " + error);
            } else {
                var url = 'https://twitter.com/oauth/authenticate?oauth_token=' + requestToken;
                return res.send({
                    error: error, requestToken: requestToken, requestTokenSecret: requestTokenSecret, results: results,
                    urlToGoTo: url
                });
                //store token and tokenSecret somewhere, you'll need them later; redirect user
            }
        });

    },
    authCallback: function (req, res) {
        var twitter = getTwitterApi();
        var requestToken = 'HARD_CODED_RESULT_FROM_getTwitterRequestToken'; // TO DO: Stop hardcoding and store in DB
        //console.log('req= ' + JSON.stringify(req));
        var oauth_verifier = req.param('oauth_verifier');
        console.log('oauth_verifier = ' + oauth_verifier);
        var requestTokenSecret = 'HARD_CODED_RESULT_FROM_getTwitterRequestToken'; // TO DO: Stop hardcoding and store in DB
        twitter.getAccessToken(requestToken, requestTokenSecret, oauth_verifier, function (error, accessToken, accessTokenSecret, results) {
            if (error) {
                console.log(error);
            } else {
                var url = 'http://localhost:1337/tweetbot/testTweet?accessToken=' + accessToken + '&accessTokenSecret=' + accessTokenSecret;
                return res.send({
                    urlToGoTo: url
                });
                //store accessToken and accessTokenSecret somewhere (associated to the user)
                //Step 4: Verify Credentials belongs here
            }
        });
    },
    testTweet: function (req, res) {
        var twitter = getTwitterApi();
        var accessToken = req.param('accessToken');
        console.log('accessToken = ' + accessToken);
        var accessTokenSecret = req.param('accessTokenSecret');
        console.log('accessTokenSecret = ' + accessTokenSecret);
        twitter.statuses("update", {
            status: "(ignore, testing tweet bot code) Hello world from tweetbot."
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

