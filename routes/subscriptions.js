var Db = require('mongodb').Db,
        Connection = require('mongodb').Connection,
        Server = require('mongodb').Server,
        parseString = require('xml2js').parseString,
        http = require('http'),
        url = require("url"),
        crypto = require('crypto');

var host = "localhost",
        port = 27017;

Array.prototype.getUnique = function() {
    var u = {}, a = [];
    for (var i = 0, l = this.length; i < l; ++i) {
        if (u.hasOwnProperty(this[i])) {
            continue;
        }
        a.push(this[i]);
        u[this[i]] = 1;
    }
    return a;
}

Subscriptions = function() {
    this.db = new Db('voicemail', new Server(host, port, {auto_reconnect: true}, {}));
    this.db.open(function() {
    });
}

Subscriptions.prototype.getCollection = function(cb) {
    var subThis = this;

    this.db.collection('subscriptions', {strict: true}, function(err, coll) {
        if (err) {
            console.log("subscriptions collection doesn't exist, creating");
            subThis.dummySubscriptions(cb);
        } else {
            console.log("subscriptions collection does exist");
            cb(null, coll);
        }
    })
};

Subscriptions.prototype.findByPhone = function(id, cb) {
    console.log("calling findByPhone()");

    this.getCollection(function(err, coll) {
        if (err) {
            cb(err);
        } else {
            coll.findOne({_id: id}, function(err, item) {
                if (err)
                    cb(err);
                else
                    cb(null, item)
            });
        }
    });
};

Subscriptions.prototype.deleteByPhone = function(id, cb) {
    console.log("calling deleteByPhone()");

    this.getCollection(function(err, coll) {
        if (err) {
            cb(err);
        } else {
            coll.remove({_id: id}, function(err, item) {
                if (err)
                    cb(err);
                else
                    cb(null, item)
            });
        }
    });
};

Subscriptions.prototype.findAll = function(cb) {
    console.log("calling findAll");

    this.getCollection(function(err, coll) {
        if (err) {
            console.log("error getting collection");
            cb(err);
        } else {
            coll.find().toArray(function(err, items) {
                if (err)
                    cb(err);
                else
                    cb(null, items)
            });
        }
    });
};

Subscriptions.prototype.insertNotifyURL = function(phone, record, cb) {
    console.log("calling insertNotifyURL " + phone + record);

    this.getCollection(function(err, coll) {
        if (err) {
            cb(err);
        } else {
            coll.findOne({_id: phone, "notifyURL.url": record.url}, function(err, item) {
                if (err)
                    cb(err);

                if (item === null) {
                    coll.update({_id: phone}, {"$push": {notifyURL: record}}, {upsert: true, safe: false},
                    function(err, item) {
                        if (err) {
                            console.log("error: cannot update subscription information");
                            cb(err);
                        } else {
                            cb(null, {"status": "successfully updated"});
                        }
                    });
                } else {
                    cb(null, item);
                }
            });
        }
    });
};

Subscriptions.prototype.processNotifications = function(xmlData, cb) {
    console.log("processing notifications");

    var subThis = this, attrs = {};
    var login, password;

    parseString(xmlData, function(err, result) {
        if (err) {
            cb(err);
        } else {
            (result['SOAP-ENV:Envelope']['SOAP-ENV:Body']).forEach(function(item) {
                item['wsc:notify'].forEach(function(item) {
                    item['wsc:notificationRequest'].forEach(function(item) {
                        item['wsc:notificationPayload'].forEach(function(item) {
                            item['wsc:notificationEntry'].forEach(function(item) {
                                attrs[item.attributeName] = item.value;
                            });
                        });

                        item['wsc:clientSecuritySegment'].forEach(function(item) {
                            login = item['applicationID'][0];
                            password = item['applicationPasscode'][0];
                        });
                    });
                });
            });

            var shasum, passwordHash;
        
            if (password != null) {
                shasum = crypto.createHash('sha1');
                shasum.update("myvoice2013");
                passwordHash = shasum.digest('hex');
            }

            if ((login !== "mab") || (password !== passwordHash)) {
                console.log("login or password doesn't match. login: " + login + ", password: " + password);
                cb("<status>Invalid login</status>");
                
            } else {

                var phone = attrs['mboxNumber'][0];

                //TODO there might be some rework required here to get the status message from each
                //call. Looks like we are over-writing the request object
                //TODO do research on how to do send parallel or serial requests to multiple endpoints
                subThis.findByPhone(phone, function(err, item) {
                    if (err) {
                        cb(err);
                    } else {

                        if (item != null) {
                            console.log("posting data" + JSON.stringify(attrs));
                            
                            item.notifyURL.forEach(function(rec) {
                                var itemString = JSON.stringify(attrs);

                                var headers = {
                                    'Content-Type': 'application/json',
                                    'Content-Length': itemString.length
                                };

                                var options = url.parse(rec.url);
                                options['method'] = 'POST';
                                options['headers'] = headers;

                                var req = http.request(options, function(res) {
                                    res.setEncoding('utf-8');

                                    var responseString = '';

                                    res.on('data', function(data) {
                                        responseString += data;
                                    });

                                    res.on('end', function() {
                                        cb(null, responseString);
                                    });
                                });

                                req.on('error', function(e) {
                                    console.log("error: post request to " + rec.url + " failed");
                                    cb(null);
                                });

                                console.log("posting to " + rec.url);
                                req.write(itemString);
                                req.end();
                            });
                        } else {
                            cb(null);
                        }
                    }
                });
            }
        }
    });
};

Subscriptions.prototype.dummySubscriptions = function(cb) {
    console.log("creating dummy subcriptions for testing");

    var subscriptions = [
        {"_id": "1111111111", "notifyURL": [{"url": "www.nofiyme", "added": "today"}]},
        {"_id": "2222222222", "notifyURL": [{"url": "www.nofiyme", "added": "today"}]},
        {"_id": "3333333333", "notifyURL": [{"url": "www.nofiyme", "added": "today"}]}
    ];

    this.db.collection("subscriptions", function(err, coll) {
        console.log("inserting records");
        coll.insert(subscriptions, {safe: true}, function(err, result) {
            if (err)
                cb(err);
            else
                cb(null, coll);
        });
    });
};

exports.Subscriptions = Subscriptions;