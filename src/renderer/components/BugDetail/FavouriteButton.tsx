import { Star } from "lucide-react";

interface FavouriteButtonProps {
  favourited: boolean;
  disabled?: boolean;
  pending?: boolean;
  onToggle: () => void;
}

export function FavouriteButton({
  favourited,
  disabled = false,
  pending = false,
  onToggle,
}: FavouriteButtonProps) {
  return (
    <button
      type="button"
      className={
        favourited
          ? "follow-button secondary-button favourite-button-active"
          : "follow-button secondary-button"
      }
      aria-label={favourited ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={favourited}
      title={favourited ? "Favourited" : "Favourite"}
      disabled={disabled || pending}
      onClick={onToggle}
    >
      <Star
        size={15}
        aria-hidden="true"
        {...(favourited
          ? { fill: "currentColor", strokeWidth: 0 }
          : { strokeWidth: 2 })}
      />
    </button>
  );
}
