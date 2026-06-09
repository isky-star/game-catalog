const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// Создаем папки для данных и загрузок
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Файлы для хранения данных
const gamesFile = path.join(dataDir, 'games.json');
const usersFile = path.join(dataDir, 'users.json');
const cartsFile = path.join(dataDir, 'carts.json');
const wishlistsFile = path.join(dataDir, 'wishlists.json');

// Инициализация файлов с начальными данными
if (!fs.existsSync(gamesFile)) {
    fs.writeFileSync(gamesFile, JSON.stringify([
        { id: 1, title: 'Cyberpunk 2077', genre: 'RPG', release_year: 2020, developer: 'CD Projekt Red', publisher: 'CD Projekt', rating: 4.5, description: 'Откройте для себя историю Ви — наёмницы, борющейся за жизнь в огромном открытом мире Найт-Сити.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() },
        { id: 2, title: 'The Witcher 3: Wild Hunt', genre: 'RPG', release_year: 2015, developer: 'CD Projekt Red', publisher: 'CD Projekt', rating: 4.9, description: 'Станьте профессиональным охотником на монстров Геральтом из Ривии и исследуйте огромный открытый мир.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() },
        { id: 3, title: 'Minecraft', genre: 'Sandbox', release_year: 2011, developer: 'Mojang Studios', publisher: 'Microsoft Studios', rating: 4.8, description: 'Исследуйте, стройте и выживайте в бесконечном мире из кубиков.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() },
        { id: 4, title: 'Grand Theft Auto V', genre: 'Action', release_year: 2013, developer: 'Rockstar North', publisher: 'Rockstar Games', rating: 4.7, description: 'Три совершенно разных преступника борются за своё место в Лос-Сантосе.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() },
        { id: 5, title: 'Red Dead Redemption 2', genre: 'Action', release_year: 2018, developer: 'Rockstar Studios', publisher: 'Rockstar Games', rating: 4.8, description: 'Америка, 1899 год. Артур Морган и банда Датча ван дер Линде вынуждены бежать.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() },
        { id: 6, title: 'Elden Ring', genre: 'Action RPG', release_year: 2022, developer: 'FromSoftware', publisher: 'Bandai Namco', rating: 4.95, description: 'Сражайтесь в огромном фэнтезийном мире, созданном Хидэтакой Миядзаки и Джорджем Р.Р. Мартином.', cover_image: '/images/game.jpg', created_at: new Date().toISOString() }
    ], null, 2));
}

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify([
        { id: 1, username: 'admin', email: 'admin@example.com', password_hash: bcrypt.hashSync('admin123', 10), role: 'admin', created_at: new Date().toISOString(), is_active: true }
    ], null, 2));
}

if (!fs.existsSync(cartsFile)) fs.writeFileSync(cartsFile, JSON.stringify({}));
if (!fs.existsSync(wishlistsFile)) fs.writeFileSync(wishlistsFile, JSON.stringify({}));

// Функции для работы с JSON файлами
function readJSON(file) {
    return JSON.parse(fs.readFileSync(file));
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Настройка multer для фото
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'playzone_secret_key_2024',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

const isAuthenticated = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    next();
};

const isAdmin = (req, res, next) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Недостаточно прав' });
    next();
};

// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    const users = readJSON(usersFile);
    if (users.find(u => u.username === username || u.email === email)) {
        return res.status(400).json({ error: 'Пользователь или email уже существует' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        username,
        email,
        password_hash: hashedPassword,
        role: 'user',
        created_at: new Date().toISOString(),
        is_active: true
    };
    users.push(newUser);
    writeJSON(usersFile, users);
    res.json({ message: 'Регистрация успешна' });
});

// Вход
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJSON(usersFile);
    const user = users.find(u => u.username === username);
    
    if (!user) return res.status(401).json({ error: 'Неверный логин или пароль' });
    
    bcrypt.compare(password, user.password_hash, (err, valid) => {
        if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        res.json({ message: 'OK', user: { id: user.id, username: user.username, role: user.role } });
    });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    res.json({ user: { id: req.session.userId, username: req.session.username, role: req.session.role } });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Выход выполнен' });
});

// Получить все игры
app.get('/api/games', (req, res) => {
    const games = readJSON(gamesFile);
    res.json(games);
});

// Добавить игру (админ)
app.post('/api/games', isAuthenticated, isAdmin, upload.single('cover_image'), (req, res) => {
    const { title, genre, release_year, developer, publisher, rating, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Название игры обязательно' });
    
    const games = readJSON(gamesFile);
    const newId = games.length > 0 ? Math.max(...games.map(g => g.id)) + 1 : 1;
    
    let cover_image = null;
    if (req.file) cover_image = '/uploads/' + req.file.filename;
    
    const newGame = {
        id: newId,
        title,
        genre: genre || null,
        release_year: release_year || null,
        developer: developer || null,
        publisher: publisher || null,
        rating: rating || 0,
        description: description || null,
        cover_image: cover_image || '/images/game.jpg',
        created_at: new Date().toISOString()
    };
    games.push(newGame);
    writeJSON(gamesFile, games);
    res.json({ message: 'Игра добавлена', gameId: newId });
});

// Редактировать игру (админ)
app.post('/api/games/:id', isAuthenticated, isAdmin, upload.single('cover_image'), (req, res) => {
    const gameId = parseInt(req.params.id);
    const { title, genre, release_year, developer, publisher, rating, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Название игры обязательно' });
    
    const games = readJSON(gamesFile);
    const index = games.findIndex(g => g.id === gameId);
    if (index === -1) return res.status(404).json({ error: 'Игра не найдена' });
    
    let cover_image = games[index].cover_image;
    if (req.file) cover_image = '/uploads/' + req.file.filename;
    
    games[index] = {
        ...games[index],
        title,
        genre: genre || null,
        release_year: release_year || null,
        developer: developer || null,
        publisher: publisher || null,
        rating: rating || 0,
        description: description || null,
        cover_image
    };
    writeJSON(gamesFile, games);
    res.json({ message: 'Игра обновлена' });
});

// Удалить игру (админ)
app.delete('/api/games/:id', isAuthenticated, isAdmin, (req, res) => {
    const gameId = parseInt(req.params.id);
    const games = readJSON(gamesFile);
    const filtered = games.filter(g => g.id !== gameId);
    
    if (filtered.length === games.length) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    writeJSON(gamesFile, filtered);
    res.json({ message: 'Игра удалена' });
});

// Корзина
app.get('/api/cart', isAuthenticated, (req, res) => {
    const carts = readJSON(cartsFile);
    res.json({ items: carts[req.session.userId] || [] });
});

app.post('/api/cart', isAuthenticated, (req, res) => {
    const { gameId } = req.body;
    const carts = readJSON(cartsFile);
    if (!carts[req.session.userId]) carts[req.session.userId] = [];
    if (!carts[req.session.userId].includes(gameId)) {
        carts[req.session.userId].push(gameId);
    }
    writeJSON(cartsFile, carts);
    res.json({ items: carts[req.session.userId] });
});

app.delete('/api/cart/:gameId', isAuthenticated, (req, res) => {
    const gameId = parseInt(req.params.gameId);
    const carts = readJSON(cartsFile);
    if (carts[req.session.userId]) {
        carts[req.session.userId] = carts[req.session.userId].filter(id => id !== gameId);
    }
    writeJSON(cartsFile, carts);
    res.json({ items: carts[req.session.userId] || [] });
});

// Желаемое
app.get('/api/wishlist', isAuthenticated, (req, res) => {
    const wishlists = readJSON(wishlistsFile);
    res.json({ items: wishlists[req.session.userId] || [] });
});

app.post('/api/wishlist', isAuthenticated, (req, res) => {
    const { gameId } = req.body;
    const wishlists = readJSON(wishlistsFile);
    if (!wishlists[req.session.userId]) wishlists[req.session.userId] = [];
    if (!wishlists[req.session.userId].includes(gameId)) {
        wishlists[req.session.userId].push(gameId);
    }
    writeJSON(wishlistsFile, wishlists);
    res.json({ items: wishlists[req.session.userId] });
});

app.delete('/api/wishlist/:gameId', isAuthenticated, (req, res) => {
    const gameId = parseInt(req.params.gameId);
    const wishlists = readJSON(wishlistsFile);
    if (wishlists[req.session.userId]) {
        wishlists[req.session.userId] = wishlists[req.session.userId].filter(id => id !== gameId);
    }
    writeJSON(wishlistsFile, wishlists);
    res.json({ items: wishlists[req.session.userId] || [] });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🌐 Сервер запущен: http://localhost:3000`);
    console.log(`📁 Данные хранятся в папке: ${dataDir}`);
    console.log(`👤 Админ: admin / admin123`);
});