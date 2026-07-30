import React from "react";
import { FaWind, FaTachometerAlt, FaShieldAlt, FaLeaf } from "react-icons/fa";
import Button from "../components/Button";
import FeatureCard from "../components/FeatureCard";
import heroBg from "../assets/images/general/hero-bg.png";
import isoBadge from "../assets/images/general/iso-badge.png";

const Home = () => {
  const features = [
    {
      icon: FaWind,
      title: "Reduces Emissions",
      description: "Helps reduce harmful NOx emissions",
    },
    {
      icon: FaTachometerAlt,
      title: "Improves Performance",
      description: "Ensures smooth engine operation & efficiency",
    },
    {
      icon: FaShieldAlt,
      title: "ISO 22241 Compliant",
      description: "Meets international quality standards",
    },
    {
      icon: FaLeaf,
      title: "Eco Friendly",
      description: "Contributes to a cleaner & greener tomorrow",
    },
  ];

  return (
    <>
      {/* HERO SECTION */}
      <section className="hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-flex">
          <div className="hero-content">
            <h1>
              CLEAN DIESEL. <br />
              <span>CLEANER FUTURE.</span>
            </h1>
            <p>
              High quality Diesel Exhaust Fluid (DEF) for reduced emissions
              and better engine performance.
            </p>
            <div className="hero-buttons">
              <Button text="Our Products" to="/products" variant="primary" />
              <Button text="Contact Us" to="/contact" variant="outline" />
            </div>
          </div>
        </div>
        <img
          src={isoBadge}
          className="iso-badge"
          alt="ISO 22241 Compliant"
          width="215"
          height="140"
        />
      </section>

      {/* FEATURE STRIP */}
      <section className="feature-strip">
        <div className="container feature-grid">
          {features.map((f, i) => (
            <FeatureCard
              key={i}
              icon={f.icon}
              title={f.title}
              description={f.description}
              variant="dark"
            />
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;