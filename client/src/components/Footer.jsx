import React from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaLinkedinIn, FaInstagram, FaYoutube } from "react-icons/fa";
import { FaPhoneAlt, FaEnvelope, FaGlobe, FaMapMarkerAlt } from "react-icons/fa";
import logo from "../assets/images/logo/logo.png";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-col footer-brand">
          <div className="footer-logo">
            <img
              src={logo}
              alt="Dudhat DEF Logo"
              className="logo-icon"
              width="1774"
              height="887"
              loading="lazy"
            />
            <div className="logo-text">
              <span className="logo-title">
                Dudhat <span className="logo-def">DEF</span>
              </span>
              <span className="logo-tagline">DRIVING CLEANER TOMORROW</span>
            </div>
          </div>
          <p>
            Dudhat Industries Private Limited is committed to delivering
            premium quality DEF solutions for a cleaner environment and
            better tomorrow.
          </p>
        </div>

        <div className="footer-col">
          <h4>Quick Links</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/products">Products</Link></li>
            <li><Link to="/why-def">Why DEF</Link></li>
            <li><Link to="/quality">Quality</Link></li>
            <li><Link to="/sustainability">Sustainability</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Products</h4>
          <ul>
            <li>10L Can</li>
            <li>20L Can</li>
            <li>210L Drum</li>
            <li>1000L IBC Tank</li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Why DEF</h4>
          <ul>
            <li>Reduces Emissions</li>
            <li>Improves Performance</li>
            <li>ISO 22241 Compliant</li>
            <li>Eco Friendly</li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Contact Info</h4>
          <ul className="footer-contact">
            <li><FaPhoneAlt /> +91 12345 67890</li>
            <li><FaEnvelope /> info@Dudhatdef.com</li>
            <li><FaGlobe /> www.Dudhatdef.com</li>
            <li>
              <FaMapMarkerAlt /> Dudhat Industries Private Limited,
              Plot No. ___, MIDC, ________, Maharashtra, India.
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Follow Us</h4>
          <div className="footer-social">
            <a href="/" aria-label="Facebook"><FaFacebookF /></a>
            <a href="/" aria-label="LinkedIn"><FaLinkedinIn /></a>
            <a href="/" aria-label="Instagram"><FaInstagram /></a>
            <a href="/" aria-label="YouTube"><FaYoutube /></a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {year} Dudhat Industries Private Limited. All Rights Reserved.</p>
        <div className="footer-legal">
          <Link to="/">Privacy Policy</Link>
          <Link to="/">Terms &amp; Conditions</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;