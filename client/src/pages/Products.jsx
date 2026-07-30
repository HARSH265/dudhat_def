import React from "react";
import { FaTint, FaCertificate, FaClock, FaCarSide } from "react-icons/fa";
import ProductCard from "../components/ProductCard";
import FeatureCard from "../components/FeatureCard";

import can10L from "../assets/images/products/can-10l.png";
import can20L from "../assets/images/products/can-20l.png";
import drum210L from "../assets/images/products/drum-210l.png";
import ibc1000L from "../assets/images/products/ibc-1000l.png";

const Products = () => {
  const products = [
    { image: can10L, title: "10L Can", subtitle: "18L" },
    { image: can20L, title: "20L Can", subtitle: "10L" },
    { image: drum210L, title: "210L Drum", subtitle: "350L" },
    { image: ibc1000L, title: "1000L IBC Tank", subtitle: "1000L" },
  ];

  const features = [
    { icon: FaTint, title: "High Purity", description: "99.9% Purity" },
    { icon: FaCertificate, title: "ISO 22241", description: "Compliant" },
    { icon: FaClock, title: "Long Shelf Life", description: "18 Months" },
    { icon: FaCarSide, title: "Engine Safe", description: "& Reliable" },
  ];

  return (
    <section className="section products-page">
      <div className="container">
        <h2 className="section-title">Our Products</h2>
        <p className="section-subtitle">High quality DEF for every need</p>

        <div className="product-grid">
          {products.map((p, i) => (
            <ProductCard key={i} image={p.image} title={p.title} subtitle={p.subtitle} />
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

export default Products;