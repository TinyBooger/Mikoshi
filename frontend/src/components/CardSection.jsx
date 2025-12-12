import React from 'react';

function CardSection({ title, children }) {
  // Inject grid CSS once
  React.useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('card-section-grid-style')) {
      const style = document.createElement('style');
      style.id = 'card-section-grid-style';
      style.innerHTML = `
        .card-section-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .card-section-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  return (
    <section>
      <h2 className="fw-bold text-dark mb-4" style={{ fontSize: '2.1rem', letterSpacing: '0.5px' }}>
        {title}
      </h2>
      <div className="card-section-grid">
        {children}
      </div>
    </section>
  );
}

export default CardSection;
