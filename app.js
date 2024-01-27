const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
var cookieParser = require('cookie-parser');
const mysql2 = require('mysql2');
var session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const fetch = require('node-fetch');
const { createHash } = require('crypto');

const db = mysql2.createConnection({
  host: "34.163.89.163",
  user: "myusr",
  password: ">39]'EveHS}zR3Ai",
  database: 'myproject_db'
});

const app = express()
const port = 3000

app.set('trust proxy', 1) 
app.use(cookieParser());
var MemoryStore = session.MemoryStore;

app.use(session({
  name : 'app.sid',
  secret: 'myproject',
  resave: false,
  store: new MemoryStore(),
  saveUninitialized: true,
  cookie: {maxAge: 24*60*60*1000},
}));

app.use(flash());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); 
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, 'public/images/');
  },
  filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.use(function(req,res,next){
  res.locals.session = req.session;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  app.locals.moment = require('moment');
  next();
});


app.get('/', (req, res) => {
  if ( !req.session.user ){
    res.redirect('/login');
  } else{
    res.redirect('/home');
  }
});


app.get('/register', (req, res) => {
  res.render('register');
});


app.post('/register', (req, res) => {
  const username = req.body.username;
  const password = hash(req.body.password);
  db.query(`SELECT COUNT(*) AS cnt FROM users WHERE username = ?`, [username], function (err, result, fields){
    if (err) throw err;
    //console.log(result[0].cnt);
    if ( parseInt(result[0].cnt) > 0 ){
      req.flash('error', 'Υπάρχει ήδη χρήστης με το όνομα χρήστη που δώσατε');
      res.redirect('back');
    } else{
      db.query(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], function (err, result, fields){
        if (err) throw err;
        req.flash('success', 'Επιτυχής εγγραφή. Μπορείτε τώρα να πραγματοποιήσετε είσοδο');
        res.redirect('back');
      });
    }
  });
});


function hash(string) {
  return createHash('sha256').update(string).digest('hex');
}

app.get('/login', (req, res) => {
  const host = req.headers.host;
  const isLocalhost = host.includes('localhost');
  res.render('login', {'isLocalhost': isLocalhost});
});


app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = hash(req.body.password);
  db.query(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], function (err, result, fields){
    if (err) throw err;
    //console.log(result.length);
    if ( result.length === 0 ){
      req.flash('error', 'Άκυρα στοιχεία εισόδου');
      res.redirect('back');
    } else{
      //console.log(result[0]);
      req.session.user = result[0];
      res.redirect('/home');
    }
  });
});


app.get('/home', (req, res) => {
  if ( !req.session.user ){
    req.flash('error', 'Πρέπει να κάνετε είσοδο πρώτα');
    res.redirect('/login');
  } else{
    const isAdmin = req.session.user.username === 'admin' ? true : false;
    //const sel = queryObject.sel;
    let query = `SELECT * FROM books`;
    db.query(query, [], function (err, result, fields){
      if (err) throw err;
      //console.log(result);
      if ( result ){
        res.render('home', {books: result, 'isAdmin' : isAdmin});
      } else{
        res.render('home');
      }
    });
  }
});


app.post('/add', upload.single('image'), (req, res) => {
  if ( !req.session.user ){
    req.flash('error', 'Πρέπει να κάνετε είσοδο πρώτα');
    res.redirect('/login');
  } else{
    const isAdmin = req.session.user.username === 'admin' ? true : false;
    if ( !isAdmin ){
      req.flash('error', 'Δεν έχετε πρόσβαση');
      res.redirect('back');
    } else{
      const title = req.body.title;
      const author = req.body.author;
      const publisher = req.body.publisher;
      const release_year = req.body.release_year ? parseInt(req.body.release_year) : null;
      const image = upload && req.file ? ('images/' + req.file.filename) : null;
      db.query(`INSERT INTO books (title, author, publisher, release_year, image) VALUES (?, ?, ?, ?, ?)`, 
      [title, author, publisher, release_year, image], function (err, result, fields){
        if (err) throw err;
        req.flash('success', 'Το βιβλίο προστέθηκε');
        res.redirect('/home');
      });
    }
  }
});


app.post('/save', (req, res) => {
  if ( !req.session.user ){
    req.flash('error', 'Πρέπει να κάνετε είσοδο πρώτα');
    res.redirect('/login');
  } else{
    const isAdmin = req.session.user.username === 'admin' ? true : false;
    if ( !isAdmin ){
      req.flash('error', 'Δεν έχετε πρόσβαση');
      res.redirect('back');
    } else{
      //console.log(req.body); 
      if ( req.body.id && req.body.id.length ){
        req.body.id.forEach((bookId, index) => {
          let id = bookId;
          //console.log(bookId);
          let title = req.body.title[index];
          let author = req.body.author[index];
          let publisher = req.body.publisher[index];
          let release_year = req.body.release_year[index] ? parseInt(req.body.release_year[index]) : null;
          db.query(`UPDATE books SET title = ?, author = ?, publisher = ?, release_year = ? WHERE id = ?`, 
          [title, author, publisher, release_year, id], function (err, result, fields){
            if (err) throw err;
          });
      });
      req.flash('success', 'Επιτυχής αποθήκευση');
      res.redirect('back');
      }
    }
  }
});


app.get('/search', async (req, res) => {
  const term = req.query.term;
  const url = `http://openlibrary.org/search.json?q=${encodeURIComponent(term)}&?limit=100`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const books = data.docs.map((book, index) => ({
      id: index + 1,
      title: book.title,
      author: book.author_name ? book.author_name.join(', ') : 'Unknown',
      release_year: book.first_publish_year || 'N/A',
      publisher: book.publisher ? book.publisher[0] : '',
      image: book.cover_edition_key ? `http://covers.openlibrary.org/b/olid/${book.cover_edition_key}-M.jpg` : 'N/A'
    }));
    //console.log(books);
    res.render('home', {books: books, term: term});
  } catch(error){
    console.error(error);
    res.render('home', {term: term});
    req.flash('error', "Συνέβη κάποιο λάθος κατά την αναζήτηση στο Open Library");
  }
});


app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});


app.listen(port, () => {
  console.log(`App listening on port ${port}`)
});

module.exports = app;