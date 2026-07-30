import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import logo from "../assets/images/logo/logo.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "About Us", path: "/about" },
    { name: "Products", path: "/products" },
    { name: "Why DEF", path: "/why-def" },
    { name: "Quality", path: "/quality" },
    { name: "Sustainability", path: "/sustainability" },
    { name: "Contact Us", path: "/contact" },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-logo">
          <img
            src={logo}
            alt="Dhudhat DEF Logo"
            className="logo-icon"
            width="1774"
            height="887"
          />
          <div className="logo-text">
            <span className="logo-title">
              DHUDHAT <span className="logo-def">DEF</span>
            </span>
            <span className="logo-tagline">DRIVING CLEANER TOMORROW</span>
          </div>
        </NavLink>

        <nav className={`navbar-links ${menuOpen ? "active" : ""}`}>
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={() => setMenuOpen(false)}
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/contact" className="btn-enquire">
          Enquire Now
        </NavLink>

        <button
          className="navbar-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;