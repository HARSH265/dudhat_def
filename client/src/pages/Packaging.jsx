import React from "react";
import { FaLock, FaBoxOpen, FaShieldAlt, FaRecycle } from "react-icons/fa";
import ProductCard from "../components/ProductCard";
import FeatureCard from "../components/FeatureCard";

import can10L from "../assets/images/packaging/pack-10l.png";
import can20L from "../assets/images/packaging/pack-20l.png";
import drum210L from "../assets/images/packaging/pack-210l.png";
import ibc1000L from "../assets/images/packaging/pack-1000l.png";

const Packaging = () => {
  const packages = [
    { image: can10L, title: "10L Can" },
    { image: can20L, title: "20L Can" },
    { image: drum210L, title: "210L Drum" },
    { image: ibc1000L, title: "1000L IBC Tank" },
  ];

  const features = [
    { icon: FaLock, title: "Leak Proof", description: "Packaging" },
    { icon: FaBoxOpen, title: "Easy to Store", description: "& Handle" },
    { icon: FaShieldAlt, title: "Tamper Proof", description: "Cap" },
    { icon: FaRecycle, title: "100% Recyclable", description: "Packaging" },
  ];

  return (
    <section className="section products-page">
      <div className="container">
        <h2 className="section-title">Our Packaging</h2>
        <p className="section-subtitle">
          Available in multiple packaging options to suit your needs.
        </p>

        <div className="product-grid">
          {packages.map((p, i) => (
            <ProductCard key={i} image={p.image} title={p.title} subtitle="" />
          ))}
        </div>

        <div className="feature-grid products-features">
          {features.map((f, i) => (
            <FeatureCard
              key={i}
              icon={f.icon}
              title={f.title}
              description={f.description}
              variant="light"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Packaging;