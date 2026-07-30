import React from "react";

const FeatureCard = ({ icon: Icon, title, description, variant = "light" }) => {
  return (
    <div className={`feature-card feature-card-${variant}`}>
      <div className="feature-icon">
        <Icon />
      </div>
      <div className="feature-text">
        <h4>{title}</h4>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
};

export default FeatureCard;