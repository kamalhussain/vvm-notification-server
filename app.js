/**
 * Module dependencies.
 */

var express = require('express')
        , routes = require('./routes')
        //, user = require('./routes/user')
        , http = require('http')
        , path = require('path'),
        fs = require('fs');

var Subscriptions = require('./routes/subscriptions').Subscriptions;

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

var sub = new Subscriptions();

function checkURL(value) {
    var urlregex = new RegExp("^(http:\/\/www.|https:\/\/www.|ftp:\/\/www.|www.|http:\/\/){1}([0-9A-Za-z]+\.)");

    if (urlregex.test(value)) {
        return (true);
    }

    return (false);
}

/**
 * Get subscription information for a phone number
 */
app.get('/subscriptions/:id', function(req, res) {
    sub.findByPhone(req.params.id, function(err, item) {
        if (err) {
            console.log("error: cannot find subscription for phone " + req.params.id);
            res.jsonp({"error": "cannot get subscrption information"});
        } else {
            if (item == null) {
                res.jsonp({"status": "subscription information not found"});
            } else {
                res.jsonp(item);
            }
        }
    });
});

app.get('/subscriptions', function(req, res) {
    sub.findAll(function(err, items) {
        if (err) {
            console.log("error: cannot get subscriptions");
            res.jsonp({"error": "cannot get subscription information"});
        } else {
            res.jsonp(items);
        }
    });
});

app.post('/subscriptions', function(req, res) {
    console.log(req.body);

    res.setHeader('Content-Type', 'application/json');
    
    if (!checkURL(req.body.notifyURL)) {
        res.send({"error": "invalid URL specified"});
        return;
    }

    sub.insertNotifyURL(req.body.phone, {
        url: req.body.notifyURL,
        created_at: new Date()
    },
    function(err, item) {
        if (err)
            console.log("error inserting a record");
        else
            res.send({"status" : "subscription added"});
    });
});

app.post('/notify', function(req, res) {
    var content = '';
    res.setHeader('Content-Type', 'text/xml');
    req.on('data', function(chunk) {
        content += chunk;
    });

    req.on('end', function() {
        sub.processNotifications(content, function(err, item) {

            if (err) {
                res.end(err);
            } else {
                //just send common response.

                fs.readFile('./success-response.xml', 'utf8', function(err, data) {
                    if (err) {
                        console.log(err);

                    } else {

                        //res.setHeader('Content-Length', data.length);
                        res.end(data);
                    }

//            if (err) {
//                console.log("error processing a notification");
//                res.send({"error": "notifications failed"});
//            } else {
//                res.send(item);
//            }
                });
            }
        });
    });
});

app.post('/test100', function(req, res) {
    console.log("test100");

    var content = '';

    req.on('data', function(chunk) {
        content += chunk;
    });

    req.on('end', function() {
        console.log(content);
        res.send(content);
        res.send("test100 end");
    });
});

app.post('/test101', function(req, res) {
    console.log("test101");

    var content = '';

    req.on('data', function(chunk) {
        content += chunk;
    });

    req.on('end', function() {
        console.log(content);
        res.send(content);
    });
});

app.post('/test102', function(req, res) {
    console.log("test102");

    var content = '';

    req.on('data', function(chunk) {
        content += chunk;
    });

    req.on('end', function() {
        console.log(content);
        res.send(content);
    });
});

//app.get('/', routes.index);
//app.get('/subscriptions/:id', sub.findByPhone);

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
