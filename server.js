const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const users = new Map();

app.use(express.static('public'));

// Set up multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), (req, res) => {
    const { username, recipient, recipientUsername } = req.body;
    const file = req.file;

    if (!file || !username || !recipient) {
        return res.status(400).send('Invalid request');
    }

    const fileName = file.originalname;
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Save the file to the uploads folder
    fs.writeFileSync(filePath, file.buffer);

    // Emit the file uploaded event to the recipient
    io.to(recipient).emit('file uploaded', {
        username,
        recipientUsername,
        fileName,
        filePath
    });

    res.send('File uploaded successfully');
});

io.on('connection', (socket) => {
    console.log('User connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
        users.delete(socket.id);
        io.emit('update user list', Array.from(users.values()));
    });

    socket.on('toggle visibility', (isVisible, username) => {
        const currentVisibility = users.has(socket.id) ? users.get(socket.id).isVisible : false;
        users.set(socket.id, { id: socket.id, isVisible: !currentVisibility, username });
        io.emit('update user list', Array.from(users.values()));
    });

    socket.on('update username', (newUsername) => {
        users.get(socket.id).username = newUsername;
        io.emit('update user list', Array.from(users.values()));
    });

    io.to(socket.id).emit('update user list', Array.from(users.values())); // Send initial user list to the connected user
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
