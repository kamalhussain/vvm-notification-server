var app = require('express')()
        , server = require('http').createServer(app)
        , io = require('socket.io').listen(server);

server.listen(4000);

app.post('/test3', function(req, res) {
    for (var item in req.headers) {
        console.log(item + ": " + req.headers[item]);
    }

    res.send("test");
});

app.post('/test', function(req, res) {
    var content;

    req.on('data', function(chunk) {
        content += chunk;
    });

    req.on('end', function() {
        console.log("here" + content);
        res.send(content);
    });
});

var activeClients = 0;

io.sockets.on('connection', function(socket) {
    clientConnect(socket);
});

function clientConnect(socket) {
    app.post('/test2', function(req, res) {

        var content;

        req.on('data', function(chunk) {
            content += chunk;
        });

        req.on('end', function() {
            console.log(content);
            socket.emit('message', JSON.stringify(content));
            res.send("test");
        });
    });

    activeClients++;

    socket.on('disconnect', function() {
        clientDisconnect();
    });
}

function clientDisconnect(socket) {
    activeClients--;
    io.sockets.emit('message', {clients: activeClients});
}