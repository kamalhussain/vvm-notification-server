var parseString = require('xml2js').parseString;
fs = require('fs');

fs.readFile('./notifications.xml', 'utf8', function(err, data) {
    if (err) {
        console.log(err);

    } else {
        var attrs = {};

        parseString(data, function(err, result) {
            (result['SOAP-ENV:Envelope']['SOAP-ENV:Body']).forEach(function(item) {
                item['wsc:notify'].forEach(function(item) {
                    item['wsc:notificationRequest'].forEach(function(item) {
                        item['wsc:notificationPayload'].forEach(function(item) {
                            item['wsc:notificationEntry'].forEach(function(item) {
                                attrs[item.attributeName] = item.value;
                            });
                        });
                    });
                });
            });
        });

        console.log(attrs);
    }
});
