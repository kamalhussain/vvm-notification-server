var Db = require('mongodb').Db,
        Connection = require('mongodb').Connection,
        Server = require('mongodb').Server,
        ObjectID = require('mongodb').ObjectID,
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

    this.db.collection('subscriptions2', {strict: true}, function(err, coll) {
        if (err) {
            console.log("subscriptions2 collection doesn't exist, creating");
            subThis.dummySubscriptions(cb);
        } else {
            console.log("subscriptions2 collection does exist");
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
            coll.find({phoneNumber: id}).toArray(function(err, items) {
                if (err)
                    cb(err);
                else {
                    var n_items = [];

                    items.forEach(function(item) {
                        item.id = item._id;
                        delete item._id;
                        n_items.push(item);
                    });

                    cb(null, n_items)
                }
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

Subscriptions.prototype.deleteBySubId = function(id, cb) {
    console.log("calling deleteBySubId()");

    this.getCollection(function(err, coll) {
        if (err) {
            cb(err);
        } else {
            coll.remove({_id: ObjectID(id)}, function(err, item) {
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
                    var n_items = [];

                items.forEach(function(item) {
                    item.id = item._id;
                    delete item._id;
                    n_items.push(item);
                });

                cb(null, n_items)
            });
        }
    });
};

Subscriptions.prototype.findTest = function(id, cb) {
    console.log("calling findAll");

    this.getCollection(function(err, coll) {
        if (err) {
            console.log("error getting collection");
            cb(err);
        } else {
            coll.findOne({_id: ObjectID(id)}, function(err, items) {
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
            coll.findOne({phoneNumber: phone, url: record.url}, function(err, item) {
                if (err)
                    cb(err);

                if (item === null) {
                    coll.insert(record, {safe: true}, function(err, result) {
                        if (err) {
                            console.log("error: cannot update subscription information");
                            cb(err);
                        } else {
                            cb(null, {"status": "subscription added", "id": result[0]._id});
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
                                if (item.attributeName == "event") {
                                    attrs[item.attributeName] = item.value[0];
                                } else if (item.attributeName == "folder") {
                                    attrs[item.attributeName] = item.value[0];
                                } else if (item.attributeName == "mboxNumber") {
                                    attrs['user'] = item.value[0];
                                } else if (item.attributeName == "msgType") {
                                    attrs['type'] = item.value[0];
                                } else if (item.attributeName == "usrMsg") {
                                    attrs['update_message'] = (item.value[0]).replace(/[\r\n]/g, "");
                                } else {
                                }
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

                var phone = attrs['user'];

                //TODO there might be some rework required here to get the status message from each
                //call. Looks like we are over-writing the request object
                //TODO do research on how to do send parallel or serial requests to multiple endpoints
                subThis.findByPhone(phone, function(err, items) {
                    if (err) {
                        cb(err);
                    } else {

                        if (items !== null) {
                            console.log(attrs);
                            console.log("posting data" + JSON.stringify(attrs));

                            items.forEach(function(item) {
                                var itemString = JSON.stringify(attrs);

                                var headers = {
                                    'Content-Type': 'application/json',
                                    'Content-Length': itemString.length
                                };

                                var options = url.parse(item.url);
                                options['method'] = 'POST';
                                options['headers'] = headers;

                                var req;

                                if (options.protocol == "http:") {
                                    req = http.request(options, function(res) {
                                        res.setEncoding('utf-8');

                                        var responseString = '';

                                        res.on('data', function(data) {
                                            responseString += data;
                                        });

                                        res.on('end', function() {
                                            cb(null, responseString);
                                        });
                                    });

                                } else {
                                    req = https.request(options, function(res) {
                                        res.setEncoding('utf-8');

                                        var responseString = '';

                                        res.on('data', function(data) {
                                            responseString += data;
                                        });

                                        res.on('end', function() {
                                            cb(null, responseString);
                                        });
                                    });
                                }

                                req.on('error', function(e) {
                                    console.log("error: post request to " + item.url + " failed");
                                    cb(null);
                                });

                                console.log("posting to " + item.url);
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
        {"phoneNumber": "1111111111", "url": "www.nofiy.me", "created_at": "today"},
        {"phoneNumber": "2222222222", "url": "www.nofiy2.me", "created_at": "today"},
        {"phoneNumber": "3333333333", "url": "www.nofiy3.me", "created_at": "today"}
    ];

    this.db.collection("subscriptions2", function(err, coll) {
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