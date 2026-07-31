# Dudhat DEF Website (MERN Stack)

## Structure

client/   -> React frontend (saare pages + components)
server/   -> Node + Express + MongoDB backend (contact form API)

## Client (client/src/)
- pages/        -> Har screen ek page: Home, About, Products, WhyDef, Quality, Packaging, Sustainability, Contact
- components/   -> Reusable pieces: Navbar, Footer, Button, ProductCard, FeatureCard, ContactForm
- styles/       -> variables.css (colors/fonts common), App.css (global styles)
- assets/images -> logo, products, packaging, general images

## Server (server/)
- config/db.js              -> MongoDB connection
- models/Contact.js         -> Contact form schema
- controllers/contactController.js -> Logic to save form data
- routes/contactRoutes.js   -> API route: POST /api/contact
- server.js                 -> Express app entry point
- .env.example              -> MONGO_URI, PORT env variables

## Kaise chalayenge (baad me):
1. server folder me: npm install, then npm run dev
2. client folder me: npm install, then npm start
