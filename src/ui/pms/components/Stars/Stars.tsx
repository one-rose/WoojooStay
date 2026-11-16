import "./stars.css";

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="pm-stars" role="img" aria-label={`별점 5점 만점에 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "pm-stars__on" : "pm-stars__off"} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}
