// src/components/CardGrid.jsx
import CardTile from './CardTile';

export default function CardGrid({ cards, onCardClick, showTradeable = false, emptyMessage = 'No cards yet' }) {
  if (!cards?.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="card-grid-display">
      {cards.map(card => (
        <CardTile
          key={card.id}
          card={card}
          onClick={() => onCardClick?.(card)}
          showTradeable={showTradeable}
        />
      ))}
    </div>
  );
}
