const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./database');
const cookie = require('cookie');

const validAuthTokens = [];

const indexHtmlFile = fs.readFileSync(path.join(__dirname, 'static', 'index.html'));
const regHtmlFile = fs.readFileSync(path.join(__dirname, 'static', 'register.html'));
const loginHtmlFile = fs.readFileSync(path.join(__dirname, 'static', 'login.html'));
const styleFile = fs.readFileSync(path.join(__dirname, 'static', 'style.css'));
const jsFile = fs.readFileSync(path.join(__dirname, 'static', 'js.js'));
const authFile = fs.readFileSync(path.join(__dirname, 'static', 'auth.js'));

const server = http.createServer((req, res)=>{
    if(req.method === 'GET') {
        switch(req.url) {
            case '/register': return res.end(regHtmlFile);
            case '/login': return res.end(loginHtmlFile);
            case '/style.css': return res.end(styleFile);
            case '/js.js': return res.end(jsFile);
            case '/auth.js': return res.end(authFile);
            default: return guarded(req, res);
        }
    }
    if(req.method === 'POST') {
        switch(req.url) {
          case '/api/register': return registerUser(req, res);
          case '/api/login': return loginUser(req, res);
          default: return guarded(req, res);
        }
    }
});

function guarded(req, res) {
    const credentionals = getCredentionals(req.headers?.cookie);
    if(!credentionals) {
      res.writeHead(302, {'Location': '/register'});
      return res.end();
    }
    if(req.method === 'GET') {
      switch(req.url) {
        case '/': return res.end(indexHtmlFile);
        case '/script.js': return res.end(scriptFile);
      }
    }
    res.writeHead(404);
    return res.end('Error 404');
  }
  
  function getCredentionals(c = '') {
    const cookies = cookie.parse(c);
    const token = cookies?.token;
    if(!token || !validAuthTokens.includes(token)) return null;
    const [user_id, login] = token.split('.');
    if(!user_id || !login) return null;
    return {user_id, login};
  }

function registerUser(req, res){
    let data = '';
    req.on('data', (chunk)=>{
        data += chunk;
    });
    req.on('end', async ()=>{
        console.log(data);
        try{
            const user = JSON.parse(data);

            if(!user.login || !user.password){
                return res.end("Empty login or password");
            }

            if(await db.isUserExist(user.login)){
                return res.end("User alredy exist");
            }

            await db.addUser(user);
            return res.end("Registration is successfull");
        }catch(e){
            return res.end("Error: " + e);
        }
    })
}

function loginUser(req, res){
    let data = '';
    req.on('data', (chunk)=>{
        data += chunk;
    });
    req.on('end', async ()=>{
        console.log(data);
        try{
            const user = JSON.parse(data);
            const token = await db.getAuthToken(user);
            validAuthTokens.push(token);
            res.writeHead(200);
            res.end(token);
        }catch(e){
            res.writeHead(500);
            return res.end("Error: " + e);
        }
    });
}

server.listen(3000);

const { Server } = require('socket.io');
const io = new Server(server);

io.on('connection', (socket)=>{
    console.log('a user connected. id - ' + socket.id);
    
    let userName = 'user';
    let userID = 0;

    socket.on('setNickname', (nickname)=>{
        userName = nickname;
    })

    socket.on('new_message', (message)=>{
        io.emit('message', userName +":"+ message);
    })
})

io.use((socket, next)=>{
    const cookie = socket.handshake.auth.cookie;
    const credentionals = getCredentionals(cookie);
    if(!credentionals){
        next(new Error("no auth"));
    }
    socket.credentionals = credentionals;
    next();
})
