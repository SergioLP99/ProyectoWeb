const express = require('express');
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Session middleware configuration
app.use(session({
    secret: 'your_secret_key', // Secret key to sign the session ID cookie
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));


// Configure storage for multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'images/') // Ensure this directory exists
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// Middleware for static files
app.use(express.static(path.join(__dirname, 'views')));
app.use('/images', express.static('images'));

// Middleware for parsing URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // For parsing application/json




// Pagina del Login
app.get('/', (req, res) => {
    // Render the login.html file from the 'views' folder
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/calculator', isLoggedIn,(req, res) => {
    // Render the login.html file from the 'views' folder
    res.sendFile(path.join(__dirname, 'views', 'calculator.html'));
});

app.get('/catalogue', isLoggedIn,(req, res) => {
    // Render the login.html file from the 'views' folder
    res.sendFile(path.join(__dirname, 'views', 'catalogue.html'));
});

app.get('/mainmenu', isLoggedIn,(req, res) => {
    // Render the login.html file from the 'views' folder
    res.sendFile(path.join(__dirname, 'views', 'mainmenu.html'));
});


// Credenciales para los usuarios
const users = {
    'admin': { password: 'admin', role: 'admin' },
    'user': { password: 'user', role: 'user' }
};

// Middleware que checa si el usuario tiene una sesion activa dentro de la aplicacion.
function isLoggedIn(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).send('Favor de iniciar sesion para poder ver este recurso.');
    }
}

// Middleware to check for admin role
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).send('You do not have permission to view this page.');
    }
}


// Manejo del form para log in
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username].password === password) {
        // Log in correcto
        req.session.user = {
            username,
            role: users[username].role
        };
        console.log(req.session)
        if (req.session.user) {
                res.json({ success: true, url: '/mainmenu' });            
        } else {
            res.json({ success: false, message: 'Usuario o contrasena invalidos.' });        
        }
        
    } else {
        // Log in incorrecto
        res.send('Ha ocurrido un error al realizar esta operacion.');
    }
});


app.get('/products', (req, res) => {
    const searchQuery = req.query.search; // Get the search query from URL parameters

    fs.readFile(path.join(__dirname, 'products.json'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send("Unable to retrieve products.");
            return;
        }
        let products = JSON.parse(data);

        // Filter products if there is a search query
        if (searchQuery) {
            products = products.filter(product => 
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        res.json(products);
    });
});

// Route to add a new product
app.post('/newProduct', upload.single('productImage'), (req, res) => {
    const { name, size, price } = req.body;
    console.log("---------------This is the req.body---------------------")
    console.log(req.body)
    console.log("---------------This is the req.body---------------------")

    const product = {
        id: Date.now(), // Utilizando un el timestamp actual como identificador para cada producto.
        name,
        size,
        price,
        imagePath: `/images/${req.file.filename}` // Guardando la direccion de la imagen dentro del objecto.
    };

    console.log("This is the new product")
    console.log(product)
    
    fs.readFile(path.join(__dirname, 'products.json'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send("Unable to read products.");
            return;
        }
        const products = JSON.parse(data);
        products.push(product);
        fs.writeFile(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2), err => {
            if (err) {
                res.status(500).send("Failed to save product.");
                return;
            }
            res.send("Product saved successfully.");
        });
    });
});

app.put('/updateProduct/:id', upload.single('productImage'), (req, res) => {
    const filePath = path.join(__dirname, 'products.json');
    const { id } = req.params;
    const { name, size, price } = req.body;  // Other form fields

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send("Error reading products data.");
        }

        let products = JSON.parse(data);
        const productIndex = products.findIndex(p => p.id === parseInt(id));

        if (productIndex !== -1) {
            const currentProduct = products[productIndex];
            // Check if a new file was uploaded
            const imagePath = req.file ? `/images/${req.file.filename}` : currentProduct.imagePath;

            // Update product
            products[productIndex] = { ...currentProduct, name, size, price, imagePath };

            fs.writeFile(filePath, JSON.stringify(products, null, 2), 'utf8', (err) => {
                if (err) {
                    return res.status(500).send("Error updating product.");
                }
                res.send({ message: "Product updated successfully", product: products[productIndex] });
            });
        } else {
            res.status(404).send({ message: "Product not found" });
        }
    });
});


app.get('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const filePath = path.join(__dirname, 'products.json');  // Path to the products JSON file

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Failed to read products file:", err);
            return res.status(500).send("Error accessing product data.");
        }

        const products = JSON.parse(data);
        const product = products.find(p => p.id === productId);

        if (!product) {
            return res.status(404).send({ message: 'Product not found' });
        }

        res.json(product);
    });
});



app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);

    fs.readFile(path.join(__dirname, 'products.json'), 'utf8', (err, data) => {
        if (err) {
            res.status(500).send("Unable to read products.");
            return;
        }
        let products = JSON.parse(data);
        products = products.filter(product => product.id !== productId);  // Remove the product

        fs.writeFile(path.join(__dirname, 'products.json'), JSON.stringify(products, null, 2), err => {
            if (err) {
                res.status(500).send("Failed to update product list after deletion.");
                return;
            }
            res.send("Product deleted successfully.");
        });
    });
});


// Path to the products JSON file
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

app.post('/add-to-cart', (req, res) => {
    const { productId } = req.body;

    console.log(req.body)

    // Read the products file to find the product details
    fs.readFile(PRODUCTS_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error("Failed to read products file:", err);
            return res.status(500).send("Error accessing product data.");
        }

        const products = JSON.parse(data);
        const product = products.find(p => p.id === parseInt(productId));

        if (!product) {
            return res.status(404).send("Product not found.");
        }

        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Check if product already exists in cart
        const cartItem = req.session.cart.find(item => item.id === product.id);
        if (cartItem) {
            cartItem.quantity += 1;  // Increment quantity if product already in cart
        } else {
            // Add new product with complete details to the cart
            req.session.cart.push({
                id: product.id,
                name: product.name,
                size: product.size,
                price: product.price,
                imagePath: product.imagePath,
                quantity: 1
            });

            console.log(req.session.cart)
        }

        res.json({ message: "Product added to cart", cart: req.session.cart });
    });
});

// Retrieve cart from session
app.get('/cart', (req, res) => {
    if (!req.session.cart || req.session.cart.length === 0) {
        // Return a message or an empty array if the cart is empty
        res.json([]);
    } else {
        // Return the cart contents if there are items in it
        res.json(req.session.cart);
    }
});

app.delete('/remove-from-cart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    if (req.session.cart) {
        const initialLength = req.session.cart.length;
        req.session.cart = req.session.cart.filter(item => item.id !== productId);

        if (req.session.cart.length < initialLength) {
            res.json({ success: true, message: "Item removed from cart." });
        } else {
            res.json({ success: false, message: "Item not found in cart." });
        }
    } else {
        res.json({ success: false, message: "No cart found." });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Failed to log out.');
        }
        res.redirect('/');
    });
});

app.get('/user-role', (req, res) => {
    if (req.session.user.role) {
        res.json({ role: req.session.user.role });
    } else {
        res.status(401).json({ error: 'No user session found' });  
    }
});

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
