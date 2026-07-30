import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home  from "./pages/Home";
import About from "./pages/About";
import Products from "./pages/Products";
import WhyDef from "./pages/WhyDef";
import Quality from "./pages/Quality";
import Packaging from "./pages/Packaging";
import Sustainability from "./pages/Sustainability";
import Contact from "./pages/Contact";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/why-def" element={<WhyDef />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/packaging" element={<Packaging />} />
        <Route path="/sustainability" element={<Sustainability />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;