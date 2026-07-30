import React from "react";

const ProductCard = ({ image, title, subtitle, buttonText = "View Details" }) => {
  return (
    <div className="product-card">
      <div className="product-image">
        <img src={image} alt={title} />
      </div>
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      <button className="btn-view-details">{buttonText}</button>
    </div>
  );
};

export default ProductCard;